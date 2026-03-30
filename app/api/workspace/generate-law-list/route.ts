/**
 * POST /api/workspace/generate-law-list
 * Story 16.4, Task 5 (AC: 8-13)
 *
 * Authenticated endpoint that runs the headless law list generation skill.
 * Idempotent: returns 409 if already in_progress.
 */

import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getServerSession } from '@/lib/auth/session'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { prisma } from '@/lib/prisma'
import { generateLawList } from '@/lib/agent/skills/generate-law-list'

export const maxDuration = 120

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

    // Atomic idempotency guard — conditional update avoids TOCTOU race
    const updated = await prisma.workspace.updateMany({
      where: {
        id: workspaceId,
        NOT: { law_list_generation_status: 'in_progress' },
      },
      data: {
        law_list_generation_status: 'in_progress',
        law_list_generation_error: null,
      },
    })

    if (updated.count === 0) {
      return NextResponse.json(
        { error: 'Generation already in progress' },
        { status: 409 }
      )
    }

    try {
      const result = await generateLawList(workspaceId, userId)

      // Mark completed
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { law_list_generation_status: 'completed' },
      })

      // Log to Sentry as a custom transaction
      Sentry.withScope((scope) => {
        scope.setTag('skill', 'generate-law-list')
        scope.setContext('generation_result', {
          listId: result.listId,
          itemCount: result.itemCount,
          groups: result.groups,
          inputTokens: result.tokensUsed.input,
          outputTokens: result.tokensUsed.output,
          durationMs: result.durationMs,
        })
        Sentry.captureMessage('Law list generation completed', 'info')
      })

      return NextResponse.json({
        success: true,
        listId: result.listId,
        itemCount: result.itemCount,
        groups: result.groups,
        durationMs: result.durationMs,
      })
    } catch (skillError) {
      const errorMessage =
        skillError instanceof Error ? skillError.message : String(skillError)

      // Mark failed
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          law_list_generation_status: 'failed',
          law_list_generation_error: errorMessage,
        },
      })

      Sentry.captureException(skillError, {
        tags: { skill: 'generate-law-list' },
      })

      return NextResponse.json(
        { error: 'Generation failed', details: errorMessage },
        { status: 500 }
      )
    }
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
