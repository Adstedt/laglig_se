/**
 * Story 5.10 — weekly unit-economics report builder (pure, testable).
 *
 * Consumes the latest month's WorkspaceCost rows and produces the founder
 * summary + the low-margin alert list. The cron route renders + emails it.
 * All money is SEK.
 */

import type { SubscriptionTier } from '@prisma/client'
import { MARGIN_ALERT_FLOOR_PCT, MARGIN_TARGET_PCT } from './constants'

export interface ReportRow {
  workspaceName: string
  tier: SubscriptionTier
  totalCostSek: number
  revenueSek: number | null
  grossMarginPct: number | null
}

export interface UnitEconomicsReport {
  workspaceCount: number
  /** Rows that carry a real margin (revenue > 0). */
  marginRowCount: number
  /** Mean gross margin % across margin-bearing rows; null if none. */
  avgMarginPct: number | null
  totalRevenueSek: number
  totalCostSek: number
  /** Workspaces under the alert floor (revenue > 0 and margin < floor). */
  lowMargin: ReportRow[]
}

export function buildUnitEconomicsReport(
  rows: ReportRow[]
): UnitEconomicsReport {
  const marginRows = rows.filter((r) => r.grossMarginPct != null)
  const avgMarginPct =
    marginRows.length > 0
      ? marginRows.reduce((sum, r) => sum + (r.grossMarginPct ?? 0), 0) /
        marginRows.length
      : null

  const lowMargin = rows
    .filter(
      (r) =>
        r.grossMarginPct != null && r.grossMarginPct < MARGIN_ALERT_FLOOR_PCT
    )
    .sort((a, b) => (a.grossMarginPct ?? 0) - (b.grossMarginPct ?? 0))

  return {
    workspaceCount: rows.length,
    marginRowCount: marginRows.length,
    avgMarginPct,
    totalRevenueSek: rows.reduce((sum, r) => sum + (r.revenueSek ?? 0), 0),
    totalCostSek: rows.reduce((sum, r) => sum + r.totalCostSek, 0),
    lowMargin,
  }
}

const sek = (n: number): string =>
  `${n.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr`
const pct = (n: number | null): string =>
  n == null ? '—' : `${n.toFixed(1)} %`

export function renderReportHtml(
  report: UnitEconomicsReport,
  monthLabel: string
): string {
  const lowRows = report.lowMargin
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.workspaceName)}</td><td>${r.tier}</td>` +
        `<td style="text-align:right">${pct(r.grossMarginPct)}</td>` +
        `<td style="text-align:right">${sek(r.totalCostSek)}</td></tr>`
    )
    .join('')

  return `
    <h2>Enhetsekonomi — ${escapeHtml(monthLabel)}</h2>
    <p><strong>Snittmarginal:</strong> ${pct(report.avgMarginPct)} (mål: &gt;${MARGIN_TARGET_PCT} %)</p>
    <p><strong>Total MRR:</strong> ${sek(report.totalRevenueSek)} &nbsp;|&nbsp;
       <strong>Total kostnad:</strong> ${sek(report.totalCostSek)}</p>
    <p><strong>Arbetsytor under ${MARGIN_ALERT_FLOOR_PCT} % marginal:</strong> ${report.lowMargin.length}</p>
    ${
      lowRows
        ? `<table border="1" cellpadding="6" cellspacing="0">
             <thead><tr><th>Arbetsyta</th><th>Nivå</th><th>Marginal</th><th>Kostnad</th></tr></thead>
             <tbody>${lowRows}</tbody>
           </table>`
        : '<p>Inga arbetsytor under tröskeln. 🎉</p>'
    }
    <p style="color:#888;font-size:12px">Kostnader är uppskattade (FX + schablon för lagring/infra) — för trend och validering, inte fakturering.</p>
  `.trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
