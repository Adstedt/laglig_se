/**
 * Story 5.3: Cron job that marks expired PENDING workspace invitations as EXPIRED.
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-invitations",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startJobRun, completeJobRun, failJobRun } from '@/lib/admin/job-logger'

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
    runId = await startJobRun('cleanup-invitations', triggeredBy)
  } catch {
    console.error('Failed to start job run logging')
  }

  try {
    const result = await prisma.workspaceInvitation.updateMany({
      where: {
        status: 'PENDING',
        expires_at: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    })

    if (runId) {
      await completeJobRun(runId, {
        itemsProcessed: result.count,
        itemsFailed: 0,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Expired ${result.count} pending invitation(s)`,
      expired: result.count,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] cleanup-invitations error:', error)

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
