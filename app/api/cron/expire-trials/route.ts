/**
 * Story 5.13: Daily cron — trial expiration enforcement.
 *
 * Configured in vercel.json at "0 30 * * *" (00:30 UTC daily).
 * Auth: Bearer ${CRON_SECRET}, mirroring cleanup-workspaces pattern.
 *
 * Runs three sequential actions:
 *   1. Notify expired trials (Day 15+) — send email + lock idempotency
 *   2. Pause abandoned trials (Day 45+) — flip status to PAUSED
 *   3. Soft-delete abandoned trials (Day 75+) — flip status to DELETED
 *
 * Each action handles its own per-row try/catch and reports counts back so
 * job-logger captures itemsProcessed + itemsFailed totals.
 */

import { NextResponse } from 'next/server'
import { startJobRun, completeJobRun, failJobRun } from '@/lib/admin/job-logger'
import {
  notifyExpiredTrials,
  pauseAbandonedTrials,
  deleteAbandonedTrials,
} from '@/lib/billing/trial-expiration-cron'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  // Verify cron secret in production (existing pattern from cleanup-workspaces).
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const triggeredBy = request.headers.get('x-triggered-by') || 'cron'
  let runId: string | undefined

  try {
    runId = await startJobRun('expire-trials', triggeredBy)
  } catch {
    console.error('Failed to start job run logging')
  }

  try {
    const notifyResult = await notifyExpiredTrials()
    const pauseResult = await pauseAbandonedTrials()
    const deleteResult = await deleteAbandonedTrials()

    const totalProcessed =
      notifyResult.processed + pauseResult.processed + deleteResult.processed
    const totalFailed =
      notifyResult.failed + pauseResult.failed + deleteResult.failed

    if (runId) {
      await completeJobRun(runId, {
        itemsProcessed: totalProcessed,
        itemsFailed: totalFailed,
      })
    }

    return NextResponse.json({
      success: true,
      notify: notifyResult,
      pause: pauseResult,
      delete: deleteResult,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] expire-trials error:', error)

    if (runId) {
      await failJobRun(
        runId,
        error instanceof Error ? error : new Error(String(error))
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
