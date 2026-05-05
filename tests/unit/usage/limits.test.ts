/**
 * Story 5.5a — unit tests for lib/usage/limits.ts.
 *
 * Locks in the calibrated v1 limits + the trial-tier-resolution semantics +
 * Team add-on seat math. Every test maps to an AC line in story 5.5a.
 */

import { describe, it, expect } from 'vitest'
import type { Workspace } from '@prisma/client'
import {
  AI_HARD_CAP_MULTIPLIER,
  AI_SOFT_WARN_THRESHOLD,
  TEAM_ADDON_PER_SEAT,
  TIER_LIMITS,
  getEffectiveLimits,
  isUnlimited,
  tokensHardCap,
  tokensSoftWarn,
  tokensToApproxQueries,
} from '@/lib/usage/limits'

type Ws = Pick<Workspace, 'subscription_tier' | 'trial_picked_tier'>

const ws = (
  tier: Ws['subscription_tier'],
  picked: Ws['trial_picked_tier'] = null
): Ws => ({
  subscription_tier: tier,
  trial_picked_tier: picked,
})

describe('TIER_LIMITS — calibrated v1 values', () => {
  it('Solo: 1 user / 5 employees / 3M tokens / 1 GB', () => {
    expect(TIER_LIMITS.SOLO).toEqual({
      users: 1,
      employees: 5,
      aiTokensPerMonth: 3_000_000,
      storageGB: 1,
    })
  })

  it('Team: 3 users / 20 employees / 9M tokens / 5 GB', () => {
    expect(TIER_LIMITS.TEAM).toEqual({
      users: 3,
      employees: 20,
      aiTokensPerMonth: 9_000_000,
      storageGB: 5,
    })
  })

  it('Enterprise: null/null/null users-employees-tokens, 100 GB storage default', () => {
    expect(TIER_LIMITS.ENTERPRISE).toEqual({
      users: null,
      employees: null,
      aiTokensPerMonth: null,
      storageGB: 100,
    })
  })

  it('TRIAL falls through to Solo limits as the no-picked-tier default', () => {
    expect(TIER_LIMITS.TRIAL).toEqual(TIER_LIMITS.SOLO)
  })
})

describe('TEAM_ADDON_PER_SEAT', () => {
  it('+1 user, +1.5M tokens per add-on seat', () => {
    expect(TEAM_ADDON_PER_SEAT).toEqual({
      users: 1,
      aiTokensPerMonth: 1_500_000,
    })
  })
})

describe('getEffectiveLimits — trial_picked_tier resolution', () => {
  it('TRIAL workspace with trial_picked_tier=TEAM gets Team limits', () => {
    expect(getEffectiveLimits(ws('TRIAL', 'TEAM'))).toEqual(TIER_LIMITS.TEAM)
  })

  it('TRIAL workspace with no trial_picked_tier falls back to TIER_LIMITS.TRIAL', () => {
    expect(getEffectiveLimits(ws('TRIAL', null))).toEqual(TIER_LIMITS.TRIAL)
  })

  it('Paid workspace ignores trial_picked_tier (it should be NULL post-conversion)', () => {
    expect(getEffectiveLimits(ws('SOLO', null))).toEqual(TIER_LIMITS.SOLO)
    expect(getEffectiveLimits(ws('TEAM', null))).toEqual(TIER_LIMITS.TEAM)
  })

  it('Enterprise resolves to unlimited dimensions', () => {
    const limits = getEffectiveLimits(ws('ENTERPRISE'))
    expect(limits.users).toBeNull()
    expect(limits.employees).toBeNull()
    expect(limits.aiTokensPerMonth).toBeNull()
    expect(limits.storageGB).toBe(100)
  })
})

describe('getEffectiveLimits — Team add-on seat math', () => {
  it('Team + 0 add-ons = base 3 users / 9M tokens', () => {
    const limits = getEffectiveLimits(ws('TEAM'), 0)
    expect(limits.users).toBe(3)
    expect(limits.aiTokensPerMonth).toBe(9_000_000)
  })

  it('Team + 2 add-on seats = 5 users / 12M tokens', () => {
    const limits = getEffectiveLimits(ws('TEAM'), 2)
    expect(limits.users).toBe(5)
    expect(limits.aiTokensPerMonth).toBe(12_000_000)
  })

  it('Team + add-ons does not bump employees or storage (per spec)', () => {
    const limits = getEffectiveLimits(ws('TEAM'), 2)
    expect(limits.employees).toBe(20)
    expect(limits.storageGB).toBe(5)
  })

  it('Solo ignores addonSeatCount (returns base 1 even with addonSeats=99)', () => {
    expect(getEffectiveLimits(ws('SOLO'), 99)).toEqual(TIER_LIMITS.SOLO)
  })

  it('Enterprise ignores addonSeatCount (already unlimited)', () => {
    expect(getEffectiveLimits(ws('ENTERPRISE'), 99)).toEqual(
      TIER_LIMITS.ENTERPRISE
    )
  })

  it('Trial with picked-tier=TEAM and add-ons applies the add-on math', () => {
    const limits = getEffectiveLimits(ws('TRIAL', 'TEAM'), 1)
    expect(limits.users).toBe(4)
    expect(limits.aiTokensPerMonth).toBe(10_500_000)
  })
})

describe('isUnlimited', () => {
  it('null is unlimited', () => {
    expect(isUnlimited(null)).toBe(true)
  })

  it('any number is bounded — including 0', () => {
    expect(isUnlimited(0)).toBe(false)
    expect(isUnlimited(1)).toBe(false)
    expect(isUnlimited(100)).toBe(false)
  })
})

describe('AI quota helpers (used by 5.5c, defined here for single-source-of-truth)', () => {
  it('AI_SOFT_WARN_THRESHOLD = 0.80', () => {
    expect(AI_SOFT_WARN_THRESHOLD).toBe(0.8)
  })

  it('AI_HARD_CAP_MULTIPLIER = 2.0 (option B for v1)', () => {
    expect(AI_HARD_CAP_MULTIPLIER).toBe(2.0)
  })

  it('tokensSoftWarn(3M) = 2.4M', () => {
    expect(tokensSoftWarn(3_000_000)).toBe(2_400_000)
  })

  it('tokensSoftWarn(null) = null', () => {
    expect(tokensSoftWarn(null)).toBeNull()
  })

  it('tokensHardCap(3M) = 6M (2× included)', () => {
    expect(tokensHardCap(3_000_000)).toBe(6_000_000)
  })

  it('tokensHardCap(null) = null', () => {
    expect(tokensHardCap(null)).toBeNull()
  })

  it('tokensToApproxQueries(3M) = 100', () => {
    expect(tokensToApproxQueries(3_000_000)).toBe(100)
  })

  it('tokensToApproxQueries(15K) rounds to 1', () => {
    expect(tokensToApproxQueries(15_000)).toBe(1)
  })

  it('tokensToApproxQueries(0) = 0', () => {
    expect(tokensToApproxQueries(0)).toBe(0)
  })
})
