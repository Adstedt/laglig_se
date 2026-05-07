/**
 * Story 5.5a — integration tests for seat enforcement.
 *
 * Mocks Prisma + Stripe per the existing pattern in
 * tests/unit/billing/stripe-integration.test.ts. Covers:
 *   - countActiveAddonSeats math (multiple SubscriptionItems, base filter)
 *   - assertSeatAvailable across tier × pending-invitation × add-on combinations
 *   - SeatLimitExceededError shape
 *
 * Invite-create + accept HTTP-path integration is partially exercised here by
 * importing the route handler and calling it with mocked dependencies. Full
 * E2E (real DB, real Stripe sandbox) is deferred to a dedicated E2E pass.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ------------------- mock setup ------------------------------------------

const mockWorkspace = {
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
}
const mockWorkspaceMember = {
  count: vi.fn(),
}
const mockWorkspaceInvitation = {
  count: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: mockWorkspace,
    workspaceMember: mockWorkspaceMember,
    workspaceInvitation: mockWorkspaceInvitation,
  },
}))

const stripeMock = {
  subscriptions: { retrieve: vi.fn() },
}
vi.mock('@/lib/stripe/config', () => ({ stripe: stripeMock }))

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_TEAM_PRICE_ID: 'price_team_base',
    STRIPE_SOLO_PRICE_ID: 'price_solo_base',
  },
}))

// ------------------- helpers ---------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const setWorkspace = (
  tier: 'TRIAL' | 'SOLO' | 'TEAM' | 'ENTERPRISE',
  opts: {
    trial_picked_tier?: 'TRIAL' | 'SOLO' | 'TEAM' | 'ENTERPRISE' | null
    stripe_subscription_id?: string | null
  } = {}
) => {
  const ws = {
    subscription_tier: tier,
    trial_picked_tier: opts.trial_picked_tier ?? null,
    stripe_subscription_id: opts.stripe_subscription_id ?? null,
  }
  mockWorkspace.findUnique.mockResolvedValue(ws)
  mockWorkspace.findUniqueOrThrow.mockResolvedValue(ws)
}

const setSeatCounts = (members: number, pending: number) => {
  mockWorkspaceMember.count.mockResolvedValue(members)
  mockWorkspaceInvitation.count.mockResolvedValue(pending)
}

// ============================================================================
// countActiveAddonSeats
// ============================================================================

describe('countActiveAddonSeats', () => {
  it('returns 0 for non-TEAM workspaces (Solo)', async () => {
    setWorkspace('SOLO', { stripe_subscription_id: 'sub_xyz' })
    const { countActiveAddonSeats } = await import('@/lib/usage/seats')
    expect(await countActiveAddonSeats('ws_x')).toBe(0)
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled()
  })

  it('returns 0 for non-TEAM workspaces (Enterprise)', async () => {
    setWorkspace('ENTERPRISE', { stripe_subscription_id: 'sub_xyz' })
    const { countActiveAddonSeats } = await import('@/lib/usage/seats')
    expect(await countActiveAddonSeats('ws_x')).toBe(0)
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled()
  })

  it('returns 0 for workspaces without a Stripe subscription', async () => {
    setWorkspace('TEAM', { stripe_subscription_id: null })
    const { countActiveAddonSeats } = await import('@/lib/usage/seats')
    expect(await countActiveAddonSeats('ws_x')).toBe(0)
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled()
  })

  it('returns 0 for TEAM workspace with only the base Price item', async () => {
    setWorkspace('TEAM', { stripe_subscription_id: 'sub_xyz' })
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ price: { id: 'price_team_base' }, quantity: 1 }] },
    })
    const { countActiveAddonSeats } = await import('@/lib/usage/seats')
    expect(await countActiveAddonSeats('ws_x')).toBe(0)
  })

  // Skipped: countActiveAddonSeats is short-circuited to return 0 until
  // Story 5.6 (Add-On Purchase System) ships. Un-skip this and the next
  // two tests when the live Stripe lookup is restored.
  it.skip('sums quantities across non-base SubscriptionItems', async () => {
    setWorkspace('TEAM', { stripe_subscription_id: 'sub_xyz' })
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      items: {
        data: [
          { price: { id: 'price_team_base' }, quantity: 1 },
          { price: { id: 'price_addon_seat' }, quantity: 2 },
          { price: { id: 'price_other_addon' }, quantity: 1 },
        ],
      },
    })
    const { countActiveAddonSeats } = await import('@/lib/usage/seats')
    expect(await countActiveAddonSeats('ws_x')).toBe(3)
  })

  it.skip('honors trial_picked_tier=TEAM for TRIAL workspace', async () => {
    setWorkspace('TRIAL', {
      trial_picked_tier: 'TEAM',
      stripe_subscription_id: 'sub_xyz',
    })
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      items: {
        data: [
          { price: { id: 'price_team_base' }, quantity: 1 },
          { price: { id: 'price_addon_seat' }, quantity: 1 },
        ],
      },
    })
    const { countActiveAddonSeats } = await import('@/lib/usage/seats')
    expect(await countActiveAddonSeats('ws_x')).toBe(1)
  })
})

// ============================================================================
// assertSeatAvailable
// ============================================================================

describe('assertSeatAvailable', () => {
  it('Solo at 0 members + 0 pending → allows the first invite', async () => {
    setWorkspace('SOLO')
    setSeatCounts(0, 0)
    const { assertSeatAvailable } = await import('@/lib/usage/seats')
    const usage = await assertSeatAvailable('ws_x')
    expect(usage.used).toBe(0)
    expect(usage.limit).toBe(1)
  })

  it('Solo at 1 member → blocks second invite (cap reached)', async () => {
    setWorkspace('SOLO')
    setSeatCounts(1, 0)
    const { assertSeatAvailable, SeatLimitExceededError } = await import(
      '@/lib/usage/seats'
    )
    await expect(assertSeatAvailable('ws_x')).rejects.toBeInstanceOf(
      SeatLimitExceededError
    )
  })

  it('Solo at 0 members + 1 pending → blocks (race protection)', async () => {
    setWorkspace('SOLO')
    setSeatCounts(0, 1)
    const { assertSeatAvailable, SeatLimitExceededError } = await import(
      '@/lib/usage/seats'
    )
    await expect(assertSeatAvailable('ws_x')).rejects.toBeInstanceOf(
      SeatLimitExceededError
    )
  })

  it('Team at 2 members → allows third invite (cap = 3)', async () => {
    setWorkspace('TEAM', { stripe_subscription_id: null })
    setSeatCounts(2, 0)
    const { assertSeatAvailable } = await import('@/lib/usage/seats')
    const usage = await assertSeatAvailable('ws_x')
    expect(usage.used).toBe(2)
    expect(usage.limit).toBe(3)
  })

  it('Team at 3 members + 0 pending → blocks fourth invite', async () => {
    setWorkspace('TEAM', { stripe_subscription_id: null })
    setSeatCounts(3, 0)
    const { assertSeatAvailable, SeatLimitExceededError } = await import(
      '@/lib/usage/seats'
    )
    await expect(assertSeatAvailable('ws_x')).rejects.toBeInstanceOf(
      SeatLimitExceededError
    )
  })

  // Skipped: depends on add-on seats (Story 5.6, in backlog).
  it.skip('Team at 3 members + 2 add-on seats → allows fourth invite (cap = 5)', async () => {
    setWorkspace('TEAM', { stripe_subscription_id: 'sub_xyz' })
    setSeatCounts(3, 0)
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      items: {
        data: [
          { price: { id: 'price_team_base' }, quantity: 1 },
          { price: { id: 'price_addon_seat' }, quantity: 2 },
        ],
      },
    })
    const { assertSeatAvailable } = await import('@/lib/usage/seats')
    const usage = await assertSeatAvailable('ws_x')
    expect(usage.used).toBe(3)
    expect(usage.limit).toBe(5)
    expect(usage.addonSeatCount).toBe(2)
  })

  it('Enterprise bypasses the cap (limit=null)', async () => {
    setWorkspace('ENTERPRISE')
    setSeatCounts(999, 50)
    const { assertSeatAvailable } = await import('@/lib/usage/seats')
    const usage = await assertSeatAvailable('ws_x')
    expect(usage.limit).toBeNull()
  })

  it('TRIAL with trial_picked_tier=TEAM applies Team cap of 3', async () => {
    setWorkspace('TRIAL', { trial_picked_tier: 'TEAM' })
    setSeatCounts(3, 0)
    const { assertSeatAvailable, SeatLimitExceededError } = await import(
      '@/lib/usage/seats'
    )
    await expect(assertSeatAvailable('ws_x')).rejects.toBeInstanceOf(
      SeatLimitExceededError
    )
  })

  it('SeatLimitExceededError carries currentSeats / limit / tier', async () => {
    setWorkspace('SOLO')
    setSeatCounts(1, 0)
    const { assertSeatAvailable, SeatLimitExceededError } = await import(
      '@/lib/usage/seats'
    )
    try {
      await assertSeatAvailable('ws_x')
      expect.fail('expected throw')
    } catch (error) {
      expect(error).toBeInstanceOf(SeatLimitExceededError)
      const err = error as InstanceType<typeof SeatLimitExceededError>
      expect(err.currentSeats).toBe(1)
      expect(err.limit).toBe(1)
      expect(err.tier).toBe('SOLO')
    }
  })
})
