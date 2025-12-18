/**
 * Cache Prewarm Cron Job
 *
 * Warms browse caches after sync jobs complete.
 * Scheduled to run at 5:30 AM, after sync-sfs (4:00), sync-sfs-updates (4:30),
 * and sync-court-cases (5:00) have completed.
 *
 * This ensures the first visitor each day hits warm caches.
 */
import { NextResponse } from 'next/server'
import { prewarmBrowseCache } from '@/lib/cache/prewarm-browse'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
  // Verify cron secret if configured
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[PREWARM] Starting cache prewarm job...')

  try {
    const result = await prewarmBrowseCache()

    console.log(
      `[PREWARM] Completed: ${result.warmed} warmed, ${result.failed} failed in ${result.durationMs}ms`
    )

    return NextResponse.json({
      success: true,
      warmed: result.warmed,
      failed: result.failed,
      durationMs: result.durationMs,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[PREWARM] Job failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
