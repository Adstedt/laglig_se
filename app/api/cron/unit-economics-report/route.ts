/**
 * Story 5.10 — weekly unit-economics founder report.
 *
 * Reads the latest month's WorkspaceCost rows, builds the summary + low-margin
 * alert, and emails the founder. Idempotent/read-only (no writes).
 *
 * Schedule: weekly, Monday 09:00 UTC. Auth: Vercel Cron bearer (CRON_SECRET).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendHtmlEmail } from '@/lib/email/email-service'
import {
  buildUnitEconomicsReport,
  renderReportHtml,
  type ReportRow,
} from '@/lib/costs/report'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

  // Latest month present in the rollup.
  const latest = await prisma.workspaceCost.findFirst({
    orderBy: { month: 'desc' },
    select: { month: true },
  })
  if (!latest) {
    return NextResponse.json({ success: true, skipped: 'no rollup data yet' })
  }

  const costRows = await prisma.workspaceCost.findMany({
    where: { month: latest.month },
    select: {
      total_cost: true,
      revenue: true,
      gross_margin_pct: true,
      workspace: { select: { name: true, subscription_tier: true } },
    },
  })

  const rows: ReportRow[] = costRows.map((r) => ({
    workspaceName: r.workspace.name,
    tier: r.workspace.subscription_tier,
    totalCostSek: Number(r.total_cost),
    revenueSek: r.revenue == null ? null : Number(r.revenue),
    grossMarginPct:
      r.gross_margin_pct == null ? null : Number(r.gross_margin_pct),
  }))

  const report = buildUnitEconomicsReport(rows)
  const monthLabel = latest.month.toISOString().slice(0, 7)

  const recipient =
    process.env.FOUNDER_EMAIL ?? process.env.CRON_NOTIFICATION_EMAIL
  if (!recipient) {
    // eslint-disable-next-line no-console -- ops diagnostic
    console.warn(
      '[UNIT-ECON-REPORT] no FOUNDER_EMAIL/CRON_NOTIFICATION_EMAIL set'
    )
    return NextResponse.json({
      success: false,
      error: 'No recipient configured',
    })
  }

  const result = await sendHtmlEmail({
    to: recipient,
    subject: `Enhetsekonomi ${monthLabel} — snittmarginal ${
      report.avgMarginPct == null ? '—' : `${report.avgMarginPct.toFixed(1)} %`
    }`,
    html: renderReportHtml(report, monthLabel),
    from: 'cron',
  })

  return NextResponse.json({
    success: result.success,
    month: monthLabel,
    workspaces: report.workspaceCount,
    avgMarginPct: report.avgMarginPct,
    lowMarginCount: report.lowMargin.length,
  })
}
