/**
 * Story 5.5a SEAT-004 — path-level integration tests.
 *
 * Verifies the seat gate is actually wired into the user-facing flows
 * (HTTP route + server action). Without these, the assertSeatAvailable +
 * computeSeatUsage unit tests pass even if a dev removes the gate calls.
 *
 * Mocking pattern follows tests/unit/billing/stripe-integration.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// Module mocks (must be declared before route imports)
// ============================================================================

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_TEAM_PRICE_ID: 'price_team_base',
    STRIPE_SECRET_KEY: 'sk_test_dummy',
    STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
    STRIPE_SOLO_PRICE_ID: 'price_solo_dummy',
    STRIPE_ENTERPRISE_PRICE_ID: 'price_enterprise_dummy',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}))

const mockWorkspace = {
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
}
const mockWorkspaceMember = {
  count: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
}
const mockWorkspaceInvitation = {
  count: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}
const mockUser = { findUnique: vi.fn() }

const mockTransaction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: mockWorkspace,
    workspaceMember: mockWorkspaceMember,
    workspaceInvitation: mockWorkspaceInvitation,
    user: mockUser,
    $transaction: (cb: unknown) => mockTransaction(cb),
  },
}))

const stripeMock = {
  subscriptions: { retrieve: vi.fn() },
}
vi.mock('@/lib/stripe/config', () => ({ stripe: stripeMock }))

vi.mock('@/lib/cache/redis', () => ({
  redis: { del: vi.fn() },
  isRedisConfigured: () => false,
}))

vi.mock('@/lib/email/email-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/auth/workspace-context', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/auth/workspace-context')
  >('@/lib/auth/workspace-context')
  return {
    ...actual,
    getWorkspaceContext: vi.fn().mockResolvedValue({
      workspaceId: 'ws_test',
      workspaceName: 'Acme AB',
      userId: 'user_owner',
      role: 'OWNER',
    }),
    setActiveWorkspace: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/lib/auth/session', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { email: 'invitee@example.com' },
  }),
}))

vi.mock('@/lib/api/require-permission', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/api/require-permission')
  >('@/lib/api/require-permission')
  return {
    ...actual,
    requirePermission: vi.fn().mockResolvedValue(null),
  }
})

vi.mock('@/lib/cache/workspace-cache', () => ({
  invalidateUserCache: vi.fn().mockResolvedValue(undefined),
  invalidateWorkspaceCache: vi.fn().mockResolvedValue(undefined),
}))

// next/cache mocked so updateTag/revalidatePath don't blow up in tests
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

// ============================================================================
// Helpers
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const stubWorkspace = (
  tier: 'TRIAL' | 'SOLO' | 'TEAM' | 'ENTERPRISE',
  opts: {
    trial_picked_tier?: 'TRIAL' | 'SOLO' | 'TEAM' | 'ENTERPRISE' | null
    stripe_subscription_id?: string | null
  } = {}
) => ({
  subscription_tier: tier,
  trial_picked_tier: opts.trial_picked_tier ?? null,
  stripe_subscription_id: opts.stripe_subscription_id ?? null,
})

const seedSeatCounts = (members: number, pending: number) => {
  mockWorkspaceMember.count.mockResolvedValue(members)
  mockWorkspaceInvitation.count.mockResolvedValue(pending)
}

// ============================================================================
// POST /api/workspace/invitations
// ============================================================================

describe('POST /api/workspace/invitations — seat gate wiring', () => {
  const buildRequest = (body: object) =>
    new Request('http://localhost:3000/api/workspace/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('returns HTTP 402 + SEAT_LIMIT_REACHED when Solo workspace already has 1 user', async () => {
    const ws = stubWorkspace('SOLO')
    mockWorkspace.findUnique.mockResolvedValue(ws)
    mockWorkspace.findUniqueOrThrow.mockResolvedValue(ws)
    seedSeatCounts(1, 0)
    mockUser.findUnique.mockResolvedValue({
      id: 'user_owner',
      email: 'owner@example.com',
      name: 'Owner',
    })
    mockWorkspaceMember.findFirst.mockResolvedValue(null)
    mockWorkspaceInvitation.findFirst.mockResolvedValue(null)

    const { POST } = await import('@/app/api/workspace/invitations/route')
    const res = await POST(
      buildRequest({ email: 'new@example.com', role: 'MEMBER' })
    )

    expect(res.status).toBe(402)
    const json = (await res.json()) as {
      code?: string
      currentSeats?: number
      limit?: number
      tier?: string
    }
    expect(json.code).toBe('SEAT_LIMIT_REACHED')
    expect(json.currentSeats).toBe(1)
    expect(json.limit).toBe(1)
    expect(json.tier).toBe('SOLO')
    // Critical: NO invitation was actually created
    expect(mockWorkspaceInvitation.create).not.toHaveBeenCalled()
  })

  // Skipped: countActiveAddonSeats no longer calls Stripe (Story 5.6 backlog).
  // Un-skip when the live Stripe lookup is restored.
  it.skip('returns HTTP 503 + STRIPE_UNAVAILABLE when Stripe API throws', async () => {
    const ws = stubWorkspace('TEAM', { stripe_subscription_id: 'sub_xyz' })
    mockWorkspace.findUnique.mockResolvedValue(ws)
    mockWorkspace.findUniqueOrThrow.mockResolvedValue(ws)
    seedSeatCounts(2, 0) // would otherwise pass cap
    mockUser.findUnique.mockResolvedValue({
      id: 'user_owner',
      email: 'owner@example.com',
      name: 'Owner',
    })
    mockWorkspaceMember.findFirst.mockResolvedValue(null)
    mockWorkspaceInvitation.findFirst.mockResolvedValue(null)
    stripeMock.subscriptions.retrieve.mockRejectedValue(
      new Error('Stripe network failure')
    )

    const { POST } = await import('@/app/api/workspace/invitations/route')
    const res = await POST(
      buildRequest({ email: 'new@example.com', role: 'MEMBER' })
    )

    expect(res.status).toBe(503)
    const json = (await res.json()) as { code?: string }
    expect(json.code).toBe('STRIPE_UNAVAILABLE')
    expect(mockWorkspaceInvitation.create).not.toHaveBeenCalled()
  })
})

// ============================================================================
// acceptInvitation server action
// ============================================================================

describe('acceptInvitation — seat gate wiring', () => {
  const validInvitation = {
    id: 'inv_xyz',
    email: 'invitee@example.com',
    workspace_id: 'ws_test',
    role: 'MEMBER' as const,
    invited_by: 'user_owner',
    status: 'PENDING' as const,
    expires_at: new Date(Date.now() + 86400000),
    created_at: new Date(),
    workspace: { id: 'ws_test', status: 'ACTIVE' },
  }

  it('returns SEAT_LIMIT_REACHED shape when transaction-internal seat check fails', async () => {
    // Setup: Solo workspace, 1 existing member, invitee not yet a member
    const ws = stubWorkspace('SOLO')
    mockWorkspaceInvitation.findUnique.mockResolvedValue(validInvitation)
    mockUser.findUnique.mockResolvedValue({
      id: 'user_invitee',
      email: 'invitee@example.com',
    })
    mockWorkspaceMember.findFirst.mockResolvedValue(null)
    // Stripe call before transaction — succeeds with 0 add-ons (Solo workspace)
    mockWorkspace.findUnique.mockResolvedValue(ws)
    // Inside the transaction, the seat re-check uses findUniqueOrThrow
    mockWorkspace.findUniqueOrThrow.mockResolvedValue(ws)

    // Drive the transaction: simulate the tx client returning the same data
    // as the outer prisma client. The transaction callback uses tx.workspace,
    // tx.workspaceMember.count, tx.workspaceInvitation.count, etc. We provide
    // a tx client whose methods point at the same mocks.
    const txClient = {
      workspace: mockWorkspace,
      workspaceMember: mockWorkspaceMember,
      workspaceInvitation: mockWorkspaceInvitation,
    }
    seedSeatCounts(1, 1) // 1 member + 1 pending = 2 used; Solo cap = 1 → over
    mockTransaction.mockImplementation(async (cb: unknown) => {
      // Run the user's transaction body with our tx client
      await (cb as (_tx: typeof txClient) => Promise<void>)(txClient)
    })

    const { acceptInvitation } = await import('@/app/actions/invitations')
    const result = await acceptInvitation('inv_xyz')

    expect(result.success).toBe(false)
    expect(result.code).toBe('SEAT_LIMIT_REACHED')
    expect(result.currentSeats).toBe(2)
    expect(result.limit).toBe(1)
    expect(result.tier).toBe('SOLO')
    // Critical: invitation marked EXPIRED outside the rolled-back transaction
    expect(mockWorkspaceInvitation.update).toHaveBeenCalledWith({
      where: { id: 'inv_xyz' },
      data: { status: 'EXPIRED' },
    })
  })

  // Skipped: countActiveAddonSeats no longer calls Stripe (Story 5.6 backlog).
  it.skip('returns STRIPE_UNAVAILABLE shape when Stripe lookup fails before transaction', async () => {
    const ws = stubWorkspace('TEAM', { stripe_subscription_id: 'sub_xyz' })
    mockWorkspaceInvitation.findUnique.mockResolvedValue(validInvitation)
    mockUser.findUnique.mockResolvedValue({
      id: 'user_invitee',
      email: 'invitee@example.com',
    })
    mockWorkspaceMember.findFirst.mockResolvedValue(null)
    mockWorkspace.findUnique.mockResolvedValue(ws)
    stripeMock.subscriptions.retrieve.mockRejectedValue(
      new Error('Stripe down')
    )

    const { acceptInvitation } = await import('@/app/actions/invitations')
    const result = await acceptInvitation('inv_xyz')

    expect(result.success).toBe(false)
    expect(result.code).toBe('STRIPE_UNAVAILABLE')
    // Transaction was never attempted on Stripe failure
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('proceeds to member create when seat check passes inside transaction', async () => {
    // Team workspace, 2 members, no add-ons (Stripe sub absent → 0 add-ons)
    const ws = stubWorkspace('TEAM', { stripe_subscription_id: null })
    mockWorkspaceInvitation.findUnique.mockResolvedValue(validInvitation)
    mockUser.findUnique.mockResolvedValue({
      id: 'user_invitee',
      email: 'invitee@example.com',
    })
    mockWorkspaceMember.findFirst.mockResolvedValue(null)
    mockWorkspace.findUnique.mockResolvedValue(ws)
    mockWorkspace.findUniqueOrThrow.mockResolvedValue(ws)

    const txClient = {
      workspace: mockWorkspace,
      workspaceMember: mockWorkspaceMember,
      workspaceInvitation: mockWorkspaceInvitation,
    }
    // 2 members + 1 pending (this invite) = 3 used; Team cap = 3 → exactly at
    // cap. AC says accepting consumes a pending slot, so the comparison is
    // `used > limit` (not `>=`), which means 3 > 3 is false → allowed.
    seedSeatCounts(2, 1)
    mockTransaction.mockImplementation(async (cb: unknown) => {
      await (cb as (_tx: typeof txClient) => Promise<void>)(txClient)
    })

    const { acceptInvitation } = await import('@/app/actions/invitations')
    const result = await acceptInvitation('inv_xyz')

    expect(result.success).toBe(true)
    expect(result.workspaceId).toBe('ws_test')
    expect(mockWorkspaceMember.create).toHaveBeenCalled()
  })
})
