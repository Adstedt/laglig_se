/**
 * Story 5.5c — path-level integration tests for the AI token quota gate.
 *
 * Verifies the gate is wired into BOTH the chat hot path (POST /api/chat)
 * and the customer.subscription.updated webhook reset. Without these, the
 * assertWithinTokenQuota unit tests pass even if a dev removes the gate
 * call from app/api/chat/route.ts.
 *
 * TOKEN-001 fix (Quinn 2026-05-05): added 4 chat-route POST tests covering
 * 402 hard cap, 200 success, X-AI-Usage-Warning header, and 500 on
 * non-quota error. Webhook tests retained from initial implementation.
 *
 * Mocking pattern follows tests/unit/usage/seat-enforcement-paths.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// Module mocks (must be declared before route imports)
// ============================================================================

// We mock assertWithinTokenQuota and the upsert path explicitly — testing the
// route-level wiring, not the helper internals (those have their own unit tests).
const mockAssertWithinTokenQuota = vi.fn()
vi.mock('@/lib/usage/check', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/usage/check')>(
      '@/lib/usage/check'
    )
  return {
    ...actual,
    assertWithinTokenQuota: (...args: unknown[]) =>
      mockAssertWithinTokenQuota(...args),
  }
})

// Stub the AI SDK so streamText doesn't actually call any provider. Returns
// a minimal stub whose toUIMessageStreamResponse echoes any headers passed by
// the route — the X-AI-Usage-Warning test needs to read that back.
const mockStreamText = vi.fn()
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return {
    ...actual,
    streamText: (...args: unknown[]) => {
      mockStreamText(...args)
      return {
        toUIMessageStreamResponse: (
          opts?: { headers?: Record<string, string> } | undefined
        ) =>
          new Response('streamed', {
            status: 200,
            headers: opts?.headers ?? {},
          }),
      }
    },
    smoothStream: () => undefined,
    stepCountIs: () => undefined,
  }
})

// AI provider clients aren't called (streamText is stubbed) but their imports
// must resolve. Replace with no-op factories.
vi.mock('@ai-sdk/openai', () => ({
  openai: () => ({}),
}))
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: () => ({}),
}))

// Agent tools / system prompt builders pull a lot of unrelated state. Stub
// them — the route only forwards their return values to streamText (mocked).
vi.mock('@/lib/agent/tools', () => ({
  createAgentTools: () => ({}),
}))
vi.mock('@/lib/agent/web-search-config', () => ({
  createWebSearchTool: () => ({}),
}))
vi.mock('@/lib/agent/system-prompt', () => ({
  buildSystemPrompt: vi.fn().mockResolvedValue('test system prompt'),
  formatCompanyContext: vi.fn().mockReturnValue(''),
}))

// Sentry stub — the chat route imports captureException for TOKEN-002 ops
// alerting. Replace with a no-op so tests don't try to send real events.
const mockSentryCapture = vi.fn()
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockSentryCapture(...args),
}))

const mockInvalidateSeatCache = vi.fn()
vi.mock('@/lib/usage/seat-cache', () => ({
  invalidateSeatCache: (...args: unknown[]) => mockInvalidateSeatCache(...args),
  getCachedAddonSeatCount: vi.fn().mockResolvedValue(0),
}))

const mockWorkspace = {
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  update: vi.fn(),
}
const mockWorkspaceUsage = {
  upsert: vi.fn(),
  findUnique: vi.fn(),
}
const mockChatUsageEvent = { create: vi.fn() }
const mockTransaction = vi.fn()
const mockStripeWebhookEvent = {
  findUnique: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
}
const mockUser = { findUnique: vi.fn() }
const mockWorkspaceMember = { findFirst: vi.fn() }
const mockCompanyProfile = { findFirst: vi.fn() }

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: mockWorkspace,
    workspaceUsage: mockWorkspaceUsage,
    chatUsageEvent: mockChatUsageEvent,
    stripeWebhookEvent: mockStripeWebhookEvent,
    user: mockUser,
    workspaceMember: mockWorkspaceMember,
    companyProfile: mockCompanyProfile,
    $transaction: (arg: unknown) => mockTransaction(arg),
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: 'user_owner', email: 'owner@example.com' },
  }),
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
      hasPermission: () => true,
    }),
  }
})

vi.mock('@/lib/cache/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  isRedisConfigured: () => false,
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Reset assertWithinTokenQuota mock to a no-op default
  mockAssertWithinTokenQuota.mockResolvedValue({})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ============================================================================
// customer.subscription.updated webhook — Pattern A reset
// ============================================================================

import Stripe from 'stripe'

const TEST_WEBHOOK_SECRET = 'whsec_test'
const TEST_STRIPE_KEY = 'sk_test_dummy'

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_dummy',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    STRIPE_SOLO_PRICE_ID: 'price_solo',
    STRIPE_TEAM_PRICE_ID: 'price_team',
    STRIPE_ENTERPRISE_PRICE_ID: 'price_ent',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}))

const realStripe = new Stripe(TEST_STRIPE_KEY)
const stripeMock = {
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  subscriptions: { retrieve: vi.fn() },
  invoices: { list: vi.fn() },
  webhooks: realStripe.webhooks, // real signature verification
}
vi.mock('@/lib/stripe/config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/stripe/config')>(
    '@/lib/stripe/config'
  )
  return { ...actual, stripe: stripeMock }
})

vi.mock('@/lib/email/email-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}))

function signWebhookPayload(payload: object) {
  const body = JSON.stringify(payload)
  const header = realStripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: TEST_WEBHOOK_SECRET,
  })
  return { body, header }
}

function makeWebhookRequest(body: string, header: string) {
  return new Request('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': header },
  })
}

describe('customer.subscription.updated webhook → resets WorkspaceUsage on period advance', () => {
  it('NULL → future current_period_end (trial→paid conversion) triggers reset', async () => {
    // Existing workspace has NULL current_period_end (trial state)
    mockWorkspace.findUnique.mockResolvedValue({ current_period_end: null })
    mockStripeWebhookEvent.findUnique.mockResolvedValue(null)
    mockStripeWebhookEvent.create.mockResolvedValue({})
    mockTransaction.mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops)
      return ops
    })

    const futureUnix = Math.floor(Date.now() / 1000) + 86400 * 30
    const startUnix = Math.floor(Date.now() / 1000)
    const { body, header } = signWebhookPayload({
      id: 'evt_trial_to_paid',
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_xyz',
          status: 'active',
          metadata: { workspaceId: 'ws_test' },
          items: {
            data: [
              {
                price: { id: 'price_solo' },
                current_period_end: futureUnix,
                current_period_start: startUnix,
              },
            ],
          },
        },
      },
    })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest(body, header))

    expect(res.status).toBe(200)
    // Transaction was called with both workspace.update + workspaceUsage.upsert
    expect(mockTransaction).toHaveBeenCalled()
    // Cache invalidation fired
    expect(mockInvalidateSeatCache).toHaveBeenCalledWith('ws_test')
  })

  it('plan upgrade mid-period (current_period_end unchanged) does NOT reset counter', async () => {
    const sameUnix = Math.floor(Date.now() / 1000) + 86400 * 15
    // Existing workspace already has the same current_period_end → NOT advanced
    mockWorkspace.findUnique.mockResolvedValue({
      current_period_end: new Date(sameUnix * 1000),
    })
    mockStripeWebhookEvent.findUnique.mockResolvedValue(null)
    mockStripeWebhookEvent.create.mockResolvedValue({})

    // When period doesn't advance, the handler uses prisma.workspace.update
    // directly (no $transaction). So the workspaceUsage upsert never fires.
    const startUnix = sameUnix - 86400 * 30
    const { body, header } = signWebhookPayload({
      id: 'evt_plan_change_no_reset',
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_xyz',
          status: 'active',
          metadata: { workspaceId: 'ws_test' },
          items: {
            data: [
              {
                price: { id: 'price_team' }, // tier changed but period_end same
                current_period_end: sameUnix,
                current_period_start: startUnix,
              },
            ],
          },
        },
      },
    })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest(body, header))

    expect(res.status).toBe(200)
    // Critical: $transaction never called (no usage upsert) since period
    // didn't advance. workspace.update was called directly.
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockWorkspace.update).toHaveBeenCalledTimes(1)
    expect(mockWorkspaceUsage.upsert).not.toHaveBeenCalled()
  })

  it('billing anniversary (current_period_end advances) triggers reset', async () => {
    const oldUnix = Math.floor(Date.now() / 1000) - 86400 // 1 day ago
    const newUnix = Math.floor(Date.now() / 1000) + 86400 * 30 // 30 days ahead
    mockWorkspace.findUnique.mockResolvedValue({
      current_period_end: new Date(oldUnix * 1000),
    })
    mockStripeWebhookEvent.findUnique.mockResolvedValue(null)
    mockStripeWebhookEvent.create.mockResolvedValue({})

    let capturedTransactionOps: unknown[] | null = null
    mockTransaction.mockImplementation(async (ops: unknown) => {
      capturedTransactionOps = ops as unknown[]
      if (Array.isArray(ops)) return Promise.all(ops)
      return ops
    })

    const { body, header } = signWebhookPayload({
      id: 'evt_anniversary',
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_xyz',
          status: 'active',
          metadata: { workspaceId: 'ws_test' },
          items: {
            data: [
              {
                price: { id: 'price_solo' },
                current_period_end: newUnix,
                current_period_start: Math.floor(Date.now() / 1000),
              },
            ],
          },
        },
      },
    })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest(body, header))

    expect(res.status).toBe(200)
    // Transaction includes BOTH workspace.update + workspaceUsage.upsert
    expect((capturedTransactionOps as unknown[] | null)?.length).toBe(2)
    expect(mockInvalidateSeatCache).toHaveBeenCalledWith('ws_test')
  })
})

// ============================================================================
// POST /api/chat — TOKEN-001 fix: gate wiring on the primary user surface.
//
// Without these tests a dev removing `assertWithinTokenQuota` from
// app/api/chat/route.ts would still see all unit tests pass. This block
// asserts the four observable contract slices: 402 on hard cap, 200 on
// success, X-AI-Usage-Warning on soft warn, 500 on non-quota throw.
//
// Note: TokenQuotaExceededError is dynamically imported inside each test
// (rather than at module top-level) because a top-level import would
// trigger lib/usage/check → lib/prisma during ESM hoisting, before the
// const-declared mock objects (mockWorkspace etc.) are initialized — TDZ
// crash. Dynamic import inside it() runs after all consts are live.
// ============================================================================

describe('POST /api/chat — token quota gate wiring', () => {
  const buildChatRequest = () =>
    new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hej!' }] }],
        contextType: 'global',
      }),
    })

  beforeEach(() => {
    // Default companyProfile lookup result — buildSystemPrompt is mocked so
    // the value doesn't matter, but the route awaits the call before falling
    // through to streamText.
    mockCompanyProfile.findFirst.mockResolvedValue(null)
  })

  it('returns HTTP 402 + AI_TOKEN_QUOTA_EXCEEDED when assertWithinTokenQuota throws TokenQuotaExceededError', async () => {
    const { TokenQuotaExceededError } = await import('@/lib/usage/check')
    mockAssertWithinTokenQuota.mockRejectedValue(
      new TokenQuotaExceededError(
        6_000_000, // usage
        3_000_000, // limit (Solo)
        6_000_000, // hardCap (2× included)
        'SOLO'
      )
    )

    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(buildChatRequest())

    expect(res.status).toBe(402)
    const json = (await res.json()) as {
      code?: string
      usage?: number
      limit?: number
      hardCap?: number
      tier?: string
    }
    expect(json.code).toBe('AI_TOKEN_QUOTA_EXCEEDED')
    expect(json.usage).toBe(6_000_000)
    expect(json.limit).toBe(3_000_000)
    expect(json.hardCap).toBe(6_000_000)
    expect(json.tier).toBe('SOLO')
    // Critical: streamText was NOT called — gate stops the request before
    // any AI provider invocation.
    expect(mockStreamText).not.toHaveBeenCalled()
  })

  it('proceeds to streamText (200 response) when quota check passes with no warning', async () => {
    mockAssertWithinTokenQuota.mockResolvedValue({})

    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(buildChatRequest())

    expect(res.status).toBe(200)
    expect(mockStreamText).toHaveBeenCalledTimes(1)
    // No soft-warn header attached when warning is absent.
    expect(res.headers.get('X-AI-Usage-Warning')).toBeNull()
  })

  it('attaches X-AI-Usage-Warning header when quota check returns a warning payload', async () => {
    mockAssertWithinTokenQuota.mockResolvedValue({
      warning: {
        usage: 2_400_000,
        limit: 3_000_000,
        approxQueriesRemaining: 20,
      },
    })

    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(buildChatRequest())

    expect(res.status).toBe(200)
    const headerValue = res.headers.get('X-AI-Usage-Warning')
    expect(headerValue).not.toBeNull()
    const parsed = JSON.parse(headerValue!) as {
      usage: number
      limit: number
      approxQueriesRemaining: number
    }
    expect(parsed.usage).toBe(2_400_000)
    expect(parsed.limit).toBe(3_000_000)
    expect(parsed.approxQueriesRemaining).toBe(20)
  })

  it('returns HTTP 500 when assertWithinTokenQuota throws a non-quota error (e.g., DB outage)', async () => {
    // Critical: chat must fail CLOSED on quota-check error per Story 5.5c
    // design — protects margin during DB outages. Gated by TOKEN-003 future
    // consideration if observability shows this pattern firing in prod.
    mockAssertWithinTokenQuota.mockRejectedValue(
      new Error('Connection to database closed')
    )

    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(buildChatRequest())

    expect(res.status).toBe(500)
    expect(mockStreamText).not.toHaveBeenCalled()
  })
})
