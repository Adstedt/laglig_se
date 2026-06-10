/**
 * POST /api/workspace/generate-law-list
 * Story 16.4, Task 5 (AC: 8-13)
 *
 * Authenticated endpoint that kicks off the headless law list generation skill.
 * Idempotent: returns 409 if already in_progress.
 *
 * Story 25.2 follow-up: the LLM job is now run via Next.js `after()` so the
 * route returns IMMEDIATELY after the atomic claim. The client (Story 25.2
 * tutorial step + Story 16.4 dashboard banner) polls `/generation-status`
 * via SWR for live progress. Previously the route awaited the 2-5 min LLM
 * job synchronously, which left the modal/banner spinning on a hung fetch
 * and prevented the tutorial-while-waiting UX from ever rendering.
 *
 * Background-job lifetime: `after()` keeps the serverless function alive
 * until the callback completes or maxDuration (300s) hits, regardless of
 * whether the client disconnects. Same risk profile as the previous
 * synchronous version (LLM > 5 min still leaves status stuck on
 * 'in_progress'); no infra change.
 */

import { NextResponse, after } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getServerSession } from '@/lib/auth/session'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { prisma } from '@/lib/prisma'
import { generateLawList } from '@/lib/agent/skills/generate-law-list'

export const maxDuration = 300

export async function POST() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    let workspaceId: string
    try {
      const ctx = await getWorkspaceContext()
      workspaceId = ctx.workspaceId
    } catch {
      return NextResponse.json(
        { error: 'No active workspace' },
        { status: 400 }
      )
    }

    // Atomic idempotency guard — conditional update avoids TOCTOU race.
    //
    // IMPORTANT: SQL three-valued logic gotcha. Using `NOT: { field: value }`
    // alone translates to `field != value`, which evaluates to NULL (not TRUE)
    // when `field` is NULL — so NULL-status rows would be excluded from the
    // match and the route would always return 409 for clean workspaces. We
    // explicitly include the NULL case via `OR` so workspaces in any state
    // EXCEPT `'in_progress'` (including NULL) match and get updated.
    const updated = await prisma.workspace.updateMany({
      where: {
        id: workspaceId,
        OR: [
          { law_list_generation_status: null },
          { law_list_generation_status: { not: 'in_progress' } },
        ],
      },
      data: {
        law_list_generation_status: 'in_progress',
        law_list_generation_error: null,
        // Story 25.3 polish: capture the moment generation started so the
        // modal's <ProgressStrip> can compute an asymptotic % progress.
        // Overwritten on every successful kickoff (re-runs start fresh).
        law_list_generation_started_at: new Date(),
      },
    })

    if (updated.count === 0) {
      return NextResponse.json(
        { error: 'Generation already in progress' },
        { status: 409 }
      )
    }

    // Story 25.2: schedule the LLM job in `after()` so the response returns
    // immediately. The DB's `law_list_generation_status='in_progress'` is
    // already set by the atomic claim above — the modal's progress strip +
    // dashboard banner both pick it up via SWR polling.
    after(async () => {
      try {
        const result = await generateLawList(workspaceId, userId)

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { law_list_generation_status: 'completed' },
        })

        Sentry.withScope((scope) => {
          scope.setTag('skill', 'generate-law-list')
          scope.setContext('generation_result', {
            model: result.model,
            listId: result.listId,
            itemCount: result.itemCount,
            groups: result.groups,
            inputTokens: result.tokensUsed.input,
            outputTokens: result.tokensUsed.output,
            cacheReadInputTokens: result.tokensUsed.cacheRead,
            cacheWriteInputTokens: result.tokensUsed.cacheWrite,
            durationMs: result.durationMs,
          })
          Sentry.captureMessage('Law list generation completed', 'info')
        })
      } catch (skillError) {
        const errorMessage =
          skillError instanceof Error ? skillError.message : String(skillError)

        // Best-effort failure write — if THIS write also throws, log + bail.
        // The status will be stuck on 'in_progress' until a manual reset, but
        // we cannot do anything else from a background callback.
        try {
          await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              law_list_generation_status: 'failed',
              law_list_generation_error: errorMessage,
            },
          })
        } catch (writeErr) {
          console.error(
            '[generate-law-list] failed to mark status=failed after skill error',
            writeErr
          )
        }

        Sentry.captureException(skillError, {
          tags: { skill: 'generate-law-list' },
        })
      }
    })

    return NextResponse.json({ kicked_off: true }, { status: 202 })
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
