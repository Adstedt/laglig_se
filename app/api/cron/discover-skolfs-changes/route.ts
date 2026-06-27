/**
 * SKOLFS amendment detector cron (Story 9.8).
 *
 * Daily state-diff over the Skolverket API: ONE `GET /api/statute?size=20000`
 * poll → project each base to a current snapshot → diff against the per-doc
 * baseline captured by Story 9.7 (`metadata.skolfs`) → classify into
 * {NEW_LAW, AMENDMENT, REPEAL, UPCOMING_AMENDMENT} → emit dedup'd ChangeEvents
 * (ai_summary set in-detector). The downstream notify/assessment pipeline is
 * reused unchanged (source-agnostic). Heavy AMENDMENT re-ingest drains
 * out-of-band; the detection core lives in `lib/agency/skolfs-detector.ts`.
 *
 * [Source: Story 9.8 AC 1-5, 9; app/api/cron/discover-sfs-amendments (auth/log)]
 */

import { NextResponse } from 'next/server'
import { startJobRun, completeJobRun, failJobRun } from '@/lib/admin/job-logger'
import { runSkolfsDetector } from '@/lib/agency/skolfs-detector'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for cron

const CRON_SECRET = process.env.CRON_SECRET
const JOB_NAME = 'discover-skolfs-changes'
const TIMEOUT_BUFFER_MS = 30_000 // stop emitting this long before maxDuration

export async function GET(request: Request) {
  const startTime = Date.now()

  // Auth — mirror the SFS cron guard (AC 1).
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggeredBy = request.headers.get('x-triggered-by') || 'cron'
  let runId: string | undefined
  try {
    runId = await startJobRun(JOB_NAME, triggeredBy)
  } catch {
    console.error(`[${JOB_NAME}] Failed to start job run logging`)
  }

  try {
    const stats = await runSkolfsDetector({
      commit: true,
      startTime,
      maxRuntimeMs: maxDuration * 1000 - TIMEOUT_BUFFER_MS,
    })

    console.log(
      `[${JOB_NAME}] polled ${stats.polled} bases · signals new:${stats.newLaw} ` +
        `amend:${stats.amendment} repeal:${stats.repeal} upcoming:${stats.upcoming} ` +
        `· events created:${stats.eventsCreated} dup:${stats.eventsDuplicate} ` +
        `failed:${stats.eventsFailed} (firstRun=${stats.firstRun})`
    )

    if (runId) {
      await completeJobRun(runId, {
        itemsProcessed: stats.eventsCreated + stats.eventsDuplicate,
        itemsFailed: stats.eventsFailed,
        metadata: { ...stats, sample: undefined },
      })
    }
    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        duration: `${Math.round((Date.now() - startTime) / 1000)}s`,
      },
    })
  } catch (error) {
    console.error(`[${JOB_NAME}] failed:`, error)
    if (runId) {
      await failJobRun(
        runId,
        error instanceof Error ? error : new Error(String(error))
      )
    }
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
