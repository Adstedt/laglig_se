/**
 * Story 5.10 — monthly unit-economics aggregation.
 *
 * For the prior calendar month, upserts one WorkspaceCost row per active
 * workspace: AI cost (from ChatUsageEvent.cost_usd_estimate → SEK), infra cost
 * (storage + flat allocation), tier revenue, and gross margin. The weekly
 * founder report (app/api/cron/unit-economics-report) reads these rows.
 *
 * Schedule: monthly, 1st at 03:00 UTC. Auth: Vercel Cron bearer (CRON_SECRET).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  computeWorkspaceRollup,
  priorMonthWindowUtc,
} from '@/lib/costs/aggregate'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (
    process.env.NODE_ENV !== 'development' &&
    CRON_SECRET &&
    authHeader !== `Bearer ${CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const { start, end } = priorMonthWindowUtc(new Date())

  // AI cost per workspace for the month (USD), from existing telemetry.
  const usageByWs = await prisma.chatUsageEvent.groupBy({
    by: ['workspace_id'],
    where: { created_at: { gte: start, lt: end } },
    _sum: { cost_usd_estimate: true },
  })
  const aiCostUsdByWs = new Map<string, number>(
    usageByWs.map((r) => [
      r.workspace_id,
      Number(r._sum.cost_usd_estimate ?? 0),
    ])
  )

  // Storage bytes per workspace — LIVE aggregate over WorkspaceFile (mirrors
  // 5.5b / lib/usage/storage.ts). QA-5.10-A: must NOT read
  // workspace_usage.storage_bytes, which is a reserved/unmaintained column
  // (always 0). Point-in-time snapshot at cron run — acceptable for a cost
  // estimate (see Story 5.10 Dev Notes).
  const storageByWs = await prisma.workspaceFile.groupBy({
    by: ['workspace_id'],
    where: { is_folder: false },
    _sum: { file_size: true },
  })
  const storageBytesByWs = new Map<string, number>(
    storageByWs.map((r) => [r.workspace_id, Number(r._sum.file_size ?? 0)])
  )

  const workspaces = await prisma.workspace.findMany({
    where: { status: 'ACTIVE', deleted_at: null },
    select: { id: true, subscription_tier: true },
  })

  let upserted = 0
  let failed = 0
  for (const ws of workspaces) {
    const rollup = computeWorkspaceRollup({
      tier: ws.subscription_tier,
      aiCostUsd: aiCostUsdByWs.get(ws.id) ?? 0,
      storageBytes: storageBytesByWs.get(ws.id) ?? 0,
    })

    // QA-5.10-C: per-workspace resilience — one bad row must not abort the
    // month. Upserts are idempotent, so a retried cron re-fills any failures.
    try {
      await prisma.workspaceCost.upsert({
        where: { workspace_id_month: { workspace_id: ws.id, month: start } },
        create: {
          workspace_id: ws.id,
          month: start,
          ai_cost: rollup.aiCostSek,
          infra_cost: rollup.infraCostSek,
          total_cost: rollup.totalCostSek,
          revenue: rollup.revenueSek,
          gross_margin_pct: rollup.grossMarginPct,
        },
        update: {
          ai_cost: rollup.aiCostSek,
          infra_cost: rollup.infraCostSek,
          total_cost: rollup.totalCostSek,
          revenue: rollup.revenueSek,
          gross_margin_pct: rollup.grossMarginPct,
        },
      })
      upserted++
    } catch (err) {
      failed++
      // eslint-disable-next-line no-console -- ops diagnostic
      console.error(`[AGGREGATE-COSTS] upsert failed for ${ws.id}`, err)
    }
  }

  const durationMs = Date.now() - startTime
  // eslint-disable-next-line no-console -- ops diagnostic
  console.log(
    `[AGGREGATE-COSTS] month=${start.toISOString().slice(0, 7)} upserted=${upserted} failed=${failed} in ${durationMs}ms`
  )
  return NextResponse.json({
    success: true,
    month: start.toISOString().slice(0, 7),
    upserted,
    failed,
    durationMs,
  })
}
