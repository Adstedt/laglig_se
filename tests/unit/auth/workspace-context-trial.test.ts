/**
 * Story 5.13: Workspace-context trial gate tests.
 *
 * Verifies the assertTrialNotExpired predicate via behaviour at the
 * getWorkspaceContextInternal boundary. The predicate is internal — testing
 * it through the public API (getWorkspaceContext) ensures both the DB-fetch
 * path AND the cache-hit path share the same gate semantics.
 *
 * Pattern mirrors tests/unit/billing/stripe-integration.test.ts (Story 5.4 /
 * TEST-002): vi.mock for prisma, session, headers; isRedisConfigured is
 * stubbed false so the DB-fetch branch runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------- Mocks ----------------------------------------------------------
//
// vi.mock factories are HOISTED to the top of the file by vitest. Top-level
// const declarations after the mock calls hit a TDZ error when the factory
// resolves during eager module import. vi.hoisted() lifts the shared mock
// objects to the same hoisted scope so the factories can read them safely.

const mocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  workspaceMember: { findFirst: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: mocks.user,
    workspaceMember: mocks.workspaceMember,
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { email: 'owner@example.com' },
  }),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: () => ({ value: 'ws_under_test' }),
  }),
}))

vi.mock('@/lib/cache/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn() },
  isRedisConfigured: () => false,
}))

// React's cache() wrapper memoizes per-render — but vitest reuses module
// state across tests, so we re-import a fresh uncached version each time
// to avoid a previous test's resolved value leaking. The exported
// getWorkspaceContextUncached() helper does exactly that.
import { getWorkspaceContextUncached } from '@/lib/auth/workspace-context'

const baseUser = {
  id: 'user_1',
  email: 'owner@example.com',
}

const baseWorkspace = {
  id: 'ws_under_test',
  name: 'Acme AB',
  slug: 'acme-ab',
  status: 'ACTIVE' as const,
  payment_grace_period_ends_at: null,
  // Story 5.13 trial fields:
  subscription_tier: 'TRIAL' as const,
  trial_ends_at: null as Date | null,
  stripe_subscription_id: null as string | null,
}

function makeMember(workspaceOverride: Partial<typeof baseWorkspace> = {}) {
  return {
    role: 'OWNER' as const,
    workspace_id: baseWorkspace.id,
    workspace: { ...baseWorkspace, ...workspaceOverride },
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

beforeEach(() => {
  mocks.user.findUnique.mockResolvedValue(baseUser)
})

describe('Story 5.13: TRIAL_EXPIRED gate at workspace-context boundary', () => {
  it('redirects to /settings?tab=billing&reason=trial_expired when trial_ends_at < now AND no Stripe sub', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    mocks.workspaceMember.findFirst.mockResolvedValue(
      makeMember({
        subscription_tier: 'TRIAL',
        trial_ends_at: yesterday,
        stripe_subscription_id: null,
      })
    )

    // Story 5.13: gate calls Next.js redirect() instead of throwing.
    // The framework-level NEXT_REDIRECT exception is recognised by its
    // digest prefix `NEXT_REDIRECT;...;<status>;` per Next.js convention.
    await expect(getWorkspaceContextUncached()).rejects.toMatchObject({
      message: 'NEXT_REDIRECT',
      digest: expect.stringContaining(
        '/settings?tab=billing&reason=trial_expired'
      ),
    })
  })

  it('does NOT throw when trial_ends_at is in the future', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    mocks.workspaceMember.findFirst.mockResolvedValue(
      makeMember({
        subscription_tier: 'TRIAL',
        trial_ends_at: tomorrow,
        stripe_subscription_id: null,
      })
    )

    const ctx = await getWorkspaceContextUncached()
    expect(ctx.workspaceId).toBe('ws_under_test')
  })

  it('does NOT throw when stripe_subscription_id is set (converted user)', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    mocks.workspaceMember.findFirst.mockResolvedValue(
      makeMember({
        // trial fields are stale post-conversion but the gate filters them out
        subscription_tier: 'TRIAL',
        trial_ends_at: yesterday,
        stripe_subscription_id: 'sub_xxx',
      })
    )

    const ctx = await getWorkspaceContextUncached()
    expect(ctx.workspaceId).toBe('ws_under_test')
  })

  it('does NOT throw when subscription_tier !== TRIAL (paid customer)', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    mocks.workspaceMember.findFirst.mockResolvedValue(
      makeMember({
        subscription_tier: 'SOLO',
        trial_ends_at: yesterday, // stale; ignored because tier ≠ TRIAL
        stripe_subscription_id: 'sub_xxx',
      })
    )

    const ctx = await getWorkspaceContextUncached()
    expect(ctx.workspaceId).toBe('ws_under_test')
  })

  it('does NOT throw when trial_ends_at is null (defensive — should not happen in prod)', async () => {
    mocks.workspaceMember.findFirst.mockResolvedValue(
      makeMember({
        subscription_tier: 'TRIAL',
        trial_ends_at: null,
        stripe_subscription_id: null,
      })
    )

    const ctx = await getWorkspaceContextUncached()
    expect(ctx.workspaceId).toBe('ws_under_test')
  })
})
