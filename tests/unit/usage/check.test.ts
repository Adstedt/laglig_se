/**
 * Story 5.5c — unit tests for lib/usage/check.ts (assertWithinTokenQuota).
 *
 * Covers the soft-warn / hard-cap / unlimited branches across tier ×
 * usage permutations. Mocks Prisma + the cached add-on seat lookup.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------- mock setup --------------------------------------------

const mockWorkspace = { findUniqueOrThrow: vi.fn() }
const mockWorkspaceUsage = { findUnique: vi.fn() }

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: mockWorkspace,
    workspaceUsage: mockWorkspaceUsage,
  },
}))

const mockGetCachedAddonSeatCount = vi.fn()
vi.mock('@/lib/usage/seat-cache', () => ({
  getCachedAddonSeatCount: (...args: unknown[]) =>
    mockGetCachedAddonSeatCount(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const setWorkspace = (
  tier: 'TRIAL' | 'SOLO' | 'TEAM' | 'ENTERPRISE',
  trial_picked_tier: 'TRIAL' | 'SOLO' | 'TEAM' | 'ENTERPRISE' | null = null
) => {
  mockWorkspace.findUniqueOrThrow.mockResolvedValue({
    subscription_tier: tier,
    trial_picked_tier,
  })
}

const setUsedTokens = (n: number) => {
  mockWorkspaceUsage.findUnique.mockResolvedValue({
    tokens_used_this_period: BigInt(n),
  })
}

// ============================================================================

describe('assertWithinTokenQuota', () => {
  it('Solo at 0 tokens used → no warning', async () => {
    setWorkspace('SOLO')
    setUsedTokens(0)
    mockGetCachedAddonSeatCount.mockResolvedValue(0)

    const { assertWithinTokenQuota } = await import('@/lib/usage/check')
    const result = await assertWithinTokenQuota('ws_x')
    expect(result.warning).toBeUndefined()
  })

  it('Solo at 50% used → no warning (under 80% threshold)', async () => {
    setWorkspace('SOLO')
    setUsedTokens(1_500_000) // 50% of 3M
    mockGetCachedAddonSeatCount.mockResolvedValue(0)

    const { assertWithinTokenQuota } = await import('@/lib/usage/check')
    const result = await assertWithinTokenQuota('ws_x')
    expect(result.warning).toBeUndefined()
  })

  it('Solo at 80% used → returns warning payload', async () => {
    setWorkspace('SOLO')
    setUsedTokens(2_400_000) // exactly 80% of 3M
    mockGetCachedAddonSeatCount.mockResolvedValue(0)

    const { assertWithinTokenQuota } = await import('@/lib/usage/check')
    const result = await assertWithinTokenQuota('ws_x')
    expect(result.warning).toBeDefined()
    expect(result.warning?.usage).toBe(2_400_000)
    expect(result.warning?.limit).toBe(3_000_000)
    expect(result.warning?.approxQueriesRemaining).toBeGreaterThanOrEqual(0)
  })

  it('Solo over included quota (overage zone, under 200% hard cap) → warning, NOT throw', async () => {
    setWorkspace('SOLO')
    setUsedTokens(4_500_000) // 150% of 3M (in overage zone, under 6M hard cap)
    mockGetCachedAddonSeatCount.mockResolvedValue(0)

    const { assertWithinTokenQuota } = await import('@/lib/usage/check')
    const result = await assertWithinTokenQuota('ws_x')
    expect(result.warning).toBeDefined()
    // approxQueriesRemaining clamped at 0 (over included)
    expect(result.warning?.approxQueriesRemaining).toBe(0)
  })

  it('Solo at hard cap (200% = 6M tokens) → throws TokenQuotaExceededError', async () => {
    setWorkspace('SOLO')
    setUsedTokens(6_000_000)
    mockGetCachedAddonSeatCount.mockResolvedValue(0)

    const { assertWithinTokenQuota, TokenQuotaExceededError } = await import(
      '@/lib/usage/check'
    )
    await expect(assertWithinTokenQuota('ws_x')).rejects.toBeInstanceOf(
      TokenQuotaExceededError
    )
  })

  it('TokenQuotaExceededError carries usage / limit / hardCap / tier', async () => {
    setWorkspace('SOLO')
    setUsedTokens(6_500_000)
    mockGetCachedAddonSeatCount.mockResolvedValue(0)

    const { assertWithinTokenQuota, TokenQuotaExceededError } = await import(
      '@/lib/usage/check'
    )
    try {
      await assertWithinTokenQuota('ws_x')
      expect.fail('expected throw')
    } catch (error) {
      expect(error).toBeInstanceOf(TokenQuotaExceededError)
      const err = error as InstanceType<typeof TokenQuotaExceededError>
      expect(err.usage).toBe(6_500_000)
      expect(err.limit).toBe(3_000_000)
      expect(err.hardCap).toBe(6_000_000)
      expect(err.tier).toBe('SOLO')
    }
  })

  it('Team at 80% of 9M (7.2M used) → warning', async () => {
    setWorkspace('TEAM')
    setUsedTokens(7_200_000)
    mockGetCachedAddonSeatCount.mockResolvedValue(0)

    const { assertWithinTokenQuota } = await import('@/lib/usage/check')
    const result = await assertWithinTokenQuota('ws_x')
    expect(result.warning).toBeDefined()
    expect(result.warning?.limit).toBe(9_000_000)
  })

  it('Team at hard cap of 18M tokens → throws', async () => {
    setWorkspace('TEAM')
    setUsedTokens(18_000_000)
    mockGetCachedAddonSeatCount.mockResolvedValue(0)

    const { assertWithinTokenQuota, TokenQuotaExceededError } = await import(
      '@/lib/usage/check'
    )
    await expect(assertWithinTokenQuota('ws_x')).rejects.toBeInstanceOf(
      TokenQuotaExceededError
    )
  })

  it('Team + 2 add-on seats raises hard cap from 18M to 24M', async () => {
    setWorkspace('TEAM')
    setUsedTokens(20_000_000) // would be over 18M base hard cap, but under 24M
    mockGetCachedAddonSeatCount.mockResolvedValue(2) // +3M each = 12M token added

    const { assertWithinTokenQuota } = await import('@/lib/usage/check')
    // Limit is 9M + 2*1.5M = 12M. Hard cap is 24M. Usage 20M is in overage
    // zone (over 12M but under 24M) → warning, not throw.
    const result = await assertWithinTokenQuota('ws_x')
    expect(result.warning).toBeDefined()
  })

  it('Enterprise → no quota check (unlimited)', async () => {
    setWorkspace('ENTERPRISE')
    setUsedTokens(999_999_999) // any number
    mockGetCachedAddonSeatCount.mockResolvedValue(0)

    const { assertWithinTokenQuota } = await import('@/lib/usage/check')
    const result = await assertWithinTokenQuota('ws_x')
    expect(result.warning).toBeUndefined()
  })

  it('Trial workspace with trial_picked_tier=TEAM uses 9M token limit', async () => {
    setWorkspace('TRIAL', 'TEAM')
    setUsedTokens(8_000_000) // ~89% of 9M → warning
    mockGetCachedAddonSeatCount.mockResolvedValue(0)

    const { assertWithinTokenQuota } = await import('@/lib/usage/check')
    const result = await assertWithinTokenQuota('ws_x')
    expect(result.warning).toBeDefined()
    expect(result.warning?.limit).toBe(9_000_000)
  })

  it('TokenQuotaExceededError uses trial_picked_tier when present', async () => {
    setWorkspace('TRIAL', 'TEAM')
    setUsedTokens(18_000_000) // over Team hard cap
    mockGetCachedAddonSeatCount.mockResolvedValue(0)

    const { assertWithinTokenQuota, TokenQuotaExceededError } = await import(
      '@/lib/usage/check'
    )
    try {
      await assertWithinTokenQuota('ws_x')
      expect.fail('expected throw')
    } catch (error) {
      expect(error).toBeInstanceOf(TokenQuotaExceededError)
      expect((error as InstanceType<typeof TokenQuotaExceededError>).tier).toBe(
        'TEAM'
      )
    }
  })

  it('null usage row (workspace never had a chat turn) → treated as 0 used', async () => {
    setWorkspace('SOLO')
    mockWorkspaceUsage.findUnique.mockResolvedValue(null)
    mockGetCachedAddonSeatCount.mockResolvedValue(0)

    const { assertWithinTokenQuota } = await import('@/lib/usage/check')
    const result = await assertWithinTokenQuota('ws_x')
    expect(result.warning).toBeUndefined()
  })
})
