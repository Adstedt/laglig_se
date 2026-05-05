/**
 * Story 5.5c — defensive safety cron for WorkspaceUsage counter resets.
 *
 * Pattern A (per-customer billing-cycle-anchored) is implemented in the
 * customer.subscription.updated Stripe webhook. This cron is the backstop:
 * any WorkspaceUsage row whose period_started_at is older than 35 days
 * (monthly + 5-day grace) gets its counter zeroed, in case the webhook
 * delivery failed.
 *
 * Schedule: Sunday 04:00 UTC (= ~05:00 SE winter / 06:00 SE summer).
 * Most workspaces never hit this cron — it's defensive only.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET
const STALE_DAYS = 35

export async function GET(request: Request) {
  // Auth: Vercel Cron sets the Authorization header on scheduled invocations.
  // Skip the check in development so the route is callable without setup.
  const authHeader = request.headers.get('authorization')
  if (
    process.env.NODE_ENV !== 'development' &&
    CRON_SECRET &&
    authHeader !== `Bearer ${CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000)
  const result = await prisma.workspaceUsage.updateMany({
    where: { period_started_at: { lt: cutoff } },
    data: {
      tokens_used_this_period: BigInt(0),
      period_started_at: new Date(),
    },
  })

  // eslint-disable-next-line no-console -- ops diagnostic
  console.log(
    `[RESET-USAGE-SAFETY] reset ${result.count} stale WorkspaceUsage rows`
  )
  return NextResponse.json({ success: true, reset: result.count })
}
