import { describe, it, expect } from 'vitest'
import {
  computeWorkspaceRollup,
  priorMonthWindowUtc,
} from '@/lib/costs/aggregate'
import {
  USD_TO_SEK,
  INFRA_FLAT_SEK_PER_WORKSPACE_MONTH,
  grossMarginPct,
  tierMonthlyRevenueSek,
} from '@/lib/costs/constants'

describe('tierMonthlyRevenueSek', () => {
  it('returns SEK list prices for paid tiers, 0 for TRIAL, null for ENTERPRISE', () => {
    expect(tierMonthlyRevenueSek('TRIAL')).toBe(0)
    expect(tierMonthlyRevenueSek('SOLO')).toBe(499)
    expect(tierMonthlyRevenueSek('TEAM')).toBe(1299)
    // Enterprise is sales-led — never auto-priced (AC 5).
    expect(tierMonthlyRevenueSek('ENTERPRISE')).toBeNull()
  })
})

describe('grossMarginPct', () => {
  it('computes (revenue - cost) / revenue * 100', () => {
    expect(grossMarginPct(1000, 100)).toBeCloseTo(90, 6)
  })
  it('returns null on zero/absent revenue (no divide-by-zero)', () => {
    expect(grossMarginPct(0, 50)).toBeNull()
    expect(grossMarginPct(null, 50)).toBeNull()
  })
})

describe('computeWorkspaceRollup', () => {
  it('converts USD cost to SEK exactly once and adds infra', () => {
    const r = computeWorkspaceRollup({
      tier: 'SOLO',
      aiCostUsd: 10,
      storageBytes: 0,
    })
    // AI: 10 USD × FX; infra: 0 storage + flat allocation.
    expect(r.aiCostSek).toBeCloseTo(10 * USD_TO_SEK, 6)
    expect(r.infraCostSek).toBeCloseTo(INFRA_FLAT_SEK_PER_WORKSPACE_MONTH, 6)
    expect(r.totalCostSek).toBeCloseTo(
      10 * USD_TO_SEK + INFRA_FLAT_SEK_PER_WORKSPACE_MONTH,
      6
    )
    expect(r.revenueSek).toBe(499)
    expect(r.grossMarginPct).toBeCloseTo(
      ((499 - r.totalCostSek) / 499) * 100,
      6
    )
  })

  it('yields null margin for a TRIAL workspace (revenue 0)', () => {
    const r = computeWorkspaceRollup({
      tier: 'TRIAL',
      aiCostUsd: 2,
      storageBytes: 0,
    })
    expect(r.revenueSek).toBe(0)
    expect(r.grossMarginPct).toBeNull()
  })

  it('excludes ENTERPRISE from auto-margin (revenue + margin null)', () => {
    const r = computeWorkspaceRollup({
      tier: 'ENTERPRISE',
      aiCostUsd: 50,
      storageBytes: 0,
    })
    expect(r.revenueSek).toBeNull()
    expect(r.grossMarginPct).toBeNull()
  })

  it('adds storage cost from bytes', () => {
    const oneGb = 1024 * 1024 * 1024
    const r = computeWorkspaceRollup({
      tier: 'TEAM',
      aiCostUsd: 0,
      storageBytes: oneGb,
    })
    // infra = 1 GB × 0.22 + flat 5
    expect(r.infraCostSek).toBeCloseTo(
      0.22 + INFRA_FLAT_SEK_PER_WORKSPACE_MONTH,
      6
    )
  })
})

describe('priorMonthWindowUtc', () => {
  it('returns [first-of-prior-month, first-of-this-month) in UTC', () => {
    const { start, end } = priorMonthWindowUtc(new Date('2026-06-12T10:00:00Z'))
    expect(start.toISOString()).toBe('2026-05-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })
  it('handles January → prior December of previous year', () => {
    const { start, end } = priorMonthWindowUtc(new Date('2026-01-05T00:00:00Z'))
    expect(start.toISOString()).toBe('2025-12-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })
})
