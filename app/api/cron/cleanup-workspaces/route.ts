/**
 * Story 5.1: Cron job for hard-deleting expired workspaces
 * Runs daily to permanently delete workspaces that have been soft-deleted for 30+ days.
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-workspaces",
 *     "schedule": "0 3 * * *"
 *   }]
 * }
 */

import { NextResponse } from 'next/server'
import { hardDeleteExpiredWorkspaces } from '@/lib/workspace/workspace-operations'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute max

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // In production, require authorization
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const deletedCount = await hardDeleteExpiredWorkspaces()

    return NextResponse.json({
      success: true,
      message: `Hard-deleted ${deletedCount} expired workspace(s)`,
      deletedCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] cleanup-workspaces error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
