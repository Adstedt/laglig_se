import { describe, it, expect } from 'vitest'
import {
  buildUnitEconomicsReport,
  renderReportHtml,
  type ReportRow,
} from '@/lib/costs/report'

const rows: ReportRow[] = [
  {
    workspaceName: 'Alfa',
    tier: 'TEAM',
    totalCostSek: 100,
    revenueSek: 1299,
    grossMarginPct: 92.3,
  },
  {
    workspaceName: 'Beta',
    tier: 'SOLO',
    totalCostSek: 300,
    revenueSek: 499,
    grossMarginPct: 39.9,
  },
  {
    workspaceName: 'Gamma',
    tier: 'TRIAL',
    totalCostSek: 20,
    revenueSek: 0,
    grossMarginPct: null,
  },
  {
    workspaceName: 'Delta',
    tier: 'ENTERPRISE',
    totalCostSek: 80,
    revenueSek: null,
    grossMarginPct: null,
  },
]

describe('buildUnitEconomicsReport', () => {
  it('averages margin only over rows that carry one', () => {
    const r = buildUnitEconomicsReport(rows)
    expect(r.marginRowCount).toBe(2)
    expect(r.avgMarginPct).toBeCloseTo((92.3 + 39.9) / 2, 6)
  })

  it('flags workspaces under the 60% floor, sorted worst-first', () => {
    const r = buildUnitEconomicsReport(rows)
    expect(r.lowMargin.map((x) => x.workspaceName)).toEqual(['Beta'])
  })

  it('does not flag an 85% workspace', () => {
    const r = buildUnitEconomicsReport([
      {
        workspaceName: 'Healthy',
        tier: 'TEAM',
        totalCostSek: 50,
        revenueSek: 1299,
        grossMarginPct: 85,
      },
    ])
    expect(r.lowMargin).toHaveLength(0)
  })

  it('sums MRR and cost across all rows (null revenue treated as 0)', () => {
    const r = buildUnitEconomicsReport(rows)
    expect(r.totalRevenueSek).toBe(1299 + 499 + 0)
    expect(r.totalCostSek).toBe(100 + 300 + 20 + 80)
  })

  it('returns null avg margin when no row has a margin', () => {
    const r = buildUnitEconomicsReport([rows[2]!, rows[3]!])
    expect(r.avgMarginPct).toBeNull()
  })
})

describe('renderReportHtml', () => {
  it('renders the low-margin workspace and escapes names', () => {
    const html = renderReportHtml(
      buildUnitEconomicsReport([
        {
          workspaceName: 'A & <B>',
          tier: 'SOLO',
          totalCostSek: 300,
          revenueSek: 499,
          grossMarginPct: 39.9,
        },
      ]),
      '2026-05'
    )
    expect(html).toContain('2026-05')
    expect(html).toContain('A &amp; &lt;B&gt;')
    expect(html).toContain('39.9 %')
  })
})
