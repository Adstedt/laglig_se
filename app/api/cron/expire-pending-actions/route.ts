/**
 * Story 14.22: Cron job that marks expired PENDING agent action proposals as EXPIRED.
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/expire-pending-actions",
 *     "schedule": "0 3 * * *"
 *   }]
 * }
 *
 * Off-peak 03:00 UTC slot — doesn't collide with cleanup-invitations (02:00),
 * reset-usage-safety (04:00 Sun), cleanup-workspaces (06:00), or the 07:00+
 * notification crons.
 */

import { NextResponse } from 'next/server'
import { startJobRun, completeJobRun, failJobRun } from '@/lib/admin/job-logger'
import { expirePendingActions } from '@/app/actions/pending-agent-actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute max

export async function GET(request: Request) {
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
    runId = await startJobRun('expire-pending-actions', triggeredBy)
  } catch {
    console.error('Failed to start job run logging')
  }

  try {
    const { expiredCount } = await expirePendingActions()

    if (runId) {
      await completeJobRun(runId, {
        itemsProcessed: expiredCount,
        itemsFailed: 0,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Expired ${expiredCount} pending agent action(s)`,
      expired: expiredCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] expire-pending-actions error:', error)

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
