/**
 * Story 5.12 — unit tests for lib/onboarding/tier-recommendation.ts.
 *
 * Covers AC 13: five rule cases for the data-driven recommendation badge.
 */
import { describe, it, expect } from 'vitest'
import { recommendTier } from '@/lib/onboarding/tier-recommendation'

describe('recommendTier', () => {
  it('< 5 employees + empty flags → SOLO, no enterpriseHint', () => {
    const result = recommendTier({
      employeeCount: 2,
      activityFlags: {},
    })
    expect(result.tier).toBe('SOLO')
    expect(result.enterpriseHint).toBe(false)
    expect(result.reason).toMatch(/Solo/i)
  })

  it('undefined employeeCount + no flags → SOLO (graceful default)', () => {
    const result = recommendTier({ activityFlags: {} })
    expect(result.tier).toBe('SOLO')
    expect(result.enterpriseHint).toBe(false)
  })

  it('8 employees + has_collective_agreement → TEAM, reason cites both signals', () => {
    const result = recommendTier({
      employeeCount: 8,
      activityFlags: { has_collective_agreement: true },
    })
    expect(result.tier).toBe('TEAM')
    expect(result.enterpriseHint).toBe(false)
    expect(result.reason).toMatch(/8 anställda/)
    expect(result.reason).toMatch(/kollektivavtal/)
    expect(result.reason).toMatch(/Team inkluderar/)
  })

  it('25 employees → TEAM with enterpriseHint=true', () => {
    const result = recommendTier({
      employeeCount: 25,
      activityFlags: {},
    })
    expect(result.tier).toBe('TEAM')
    expect(result.enterpriseHint).toBe(true)
  })

  it('60 employees → TEAM with enterpriseHint=true (same return shape)', () => {
    const result = recommendTier({
      employeeCount: 60,
      activityFlags: {},
    })
    expect(result.tier).toBe('TEAM')
    expect(result.enterpriseHint).toBe(true)
  })

  it('hasCollectiveAgreement passed at top-level (split out by wizard) → still TEAM', () => {
    const result = recommendTier({
      employeeCount: 3,
      activityFlags: {},
      hasCollectiveAgreement: true,
    })
    expect(result.tier).toBe('TEAM')
    expect(result.reason).toMatch(/kollektivavtal/)
  })

  it('flag-only trigger (no employee count) → TEAM', () => {
    const result = recommendTier({
      activityFlags: { heavyMachinery: true },
    })
    expect(result.tier).toBe('TEAM')
    expect(result.reason).toMatch(/tunga maskiner/)
  })

  it('personalData flag alone is NOT a Team trigger (universally true, weak signal)', () => {
    const result = recommendTier({
      employeeCount: 2,
      activityFlags: { personalData: true },
    })
    expect(result.tier).toBe('SOLO')
  })
})
