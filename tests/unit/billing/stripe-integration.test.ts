/**
 * Story 5.4: Stripe billing integration tests.
 *
 * Coverage:
 *   - getOrCreateStripeCustomer (returns existing, creates new, persists)
 *   - Checkout endpoint (rejects invalid tier; rejects when active sub exists)
 *   - Webhook signature verification (valid + tampered)
 *   - Webhook idempotency (duplicate event.id is a no-op 200)
 *   - Webhook lifecycle handlers — each of the 5 event types we handle
 *   - Grace-period rollback on invoice.payment_succeeded
 *   - Workspace-context grace-period BLOCK (throws PAYMENT_PAST_DUE)
 *
 * The story spec recommended MSW for HTTP mocking, but MSW isn't a project
 * dep yet and adding it is a deps-decision the dev agent shouldn't make
 * unilaterally. Instead we follow the codebase's existing pattern (see
 * tests/unit/agent/retrieval.test.ts) — vi.mock for prisma + a hand-rolled
 * fake for the Stripe SDK. Webhook signature verification uses the REAL
 * stripe.webhooks.constructEvent against a payload signed in-test, so the
 * cryptographic surface is exercised end-to-end.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'

// ---------- Mocks ----------------------------------------------------------

const TEST_WEBHOOK_SECRET = 'whsec_test_secret'
const TEST_STRIPE_KEY = 'sk_test_xxx'

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_SECRET_KEY: TEST_STRIPE_KEY,
    STRIPE_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
    STRIPE_SOLO_PRICE_ID: 'price_solo_test',
    STRIPE_TEAM_PRICE_ID: 'price_team_test',
    STRIPE_ENTERPRISE_PRICE_ID: 'price_enterprise_test',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}))

const mockWorkspace = {
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}
const mockStripeWebhookEvent = {
  findUnique: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
}
// TEST-002 needs prisma.user.findUnique + prisma.workspaceMember.findFirst
// to drive getWorkspaceContextInternal end-to-end.
const mockUser = { findUnique: vi.fn() }
const mockWorkspaceMember = { findFirst: vi.fn() }

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: mockWorkspace,
    stripeWebhookEvent: mockStripeWebhookEvent,
    user: mockUser,
    workspaceMember: mockWorkspaceMember,
  },
}))

// TEST-002 helpers: mock the session + cookie reads workspace-context relies
// on. Redis is auto-disabled because UPSTASH_REDIS_REST_URL isn't injected
// into the test env (isRedisConfigured returns false → DB path runs).
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

// TEST-001 needs requirePermissionWithContext for the Checkout endpoint.
const mockRequirePermissionWithContext = vi.fn().mockResolvedValue({
  granted: true,
  context: { workspaceId: 'ws_under_test', role: 'OWNER' },
})
vi.mock('@/lib/api/require-permission', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/api/require-permission')
  >('@/lib/api/require-permission')
  return {
    ...actual,
    requirePermissionWithContext: (...args: unknown[]) =>
      mockRequirePermissionWithContext(...args),
  }
})

vi.mock('@/lib/email/email-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}))

// We need the Stripe SDK calls our handlers make to be observable. Mock the
// methods we touch; leave webhooks.constructEvent intact so signature checks
// run for real.
const realStripe = new Stripe(TEST_STRIPE_KEY)
const stripeMock = {
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
  invoices: { list: vi.fn() },
  webhooks: realStripe.webhooks, // real signature verification
}
vi.mock('@/lib/stripe/config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/stripe/config')>(
    '@/lib/stripe/config'
  )
  return {
    ...actual,
    stripe: stripeMock,
  }
})

// ---------- Helpers --------------------------------------------------------

/**
 * Sign a JSON payload the same way Stripe signs webhook deliveries so our
 * route handler's constructEvent call accepts it.
 */
function signWebhookPayload(payload: object) {
  const body = JSON.stringify(payload)
  const header = realStripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: TEST_WEBHOOK_SECRET,
  })
  return { body, header }
}

function makeWebhookRequest(body: string, header: string | null) {
  return new Request('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: header ? { 'stripe-signature': header } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------- Tests ----------------------------------------------------------

describe('getOrCreateStripeCustomer', () => {
  it('returns the existing stripe_customer_id without calling Stripe', async () => {
    mockWorkspace.findUnique.mockResolvedValueOnce({
      stripe_customer_id: 'cus_existing',
    })

    const { getOrCreateStripeCustomer } = await import('@/lib/stripe/customer')
    const id = await getOrCreateStripeCustomer(
      'ws_1',
      'owner@example.com',
      'Acme AB'
    )

    expect(id).toBe('cus_existing')
    expect(stripeMock.customers.create).not.toHaveBeenCalled()
    expect(mockWorkspace.update).not.toHaveBeenCalled()
  })

  it('creates a new Stripe customer and persists the id when missing', async () => {
    mockWorkspace.findUnique.mockResolvedValueOnce({
      stripe_customer_id: null,
    })
    stripeMock.customers.create.mockResolvedValueOnce({
      id: 'cus_new',
    } as unknown as Stripe.Customer)
    mockWorkspace.update.mockResolvedValueOnce({})

    const { getOrCreateStripeCustomer } = await import('@/lib/stripe/customer')
    const id = await getOrCreateStripeCustomer(
      'ws_1',
      'owner@example.com',
      'Acme AB'
    )

    expect(id).toBe('cus_new')
    // BILLING-002: 2nd arg must include idempotencyKey so Stripe replays
    // safely on concurrent first-time clicks.
    expect(stripeMock.customers.create).toHaveBeenCalledWith(
      {
        email: 'owner@example.com',
        name: 'Acme AB',
        metadata: { workspaceId: 'ws_1' },
      },
      { idempotencyKey: 'customer:ws_1' }
    )
    expect(mockWorkspace.update).toHaveBeenCalledWith({
      where: { id: 'ws_1' },
      data: { stripe_customer_id: 'cus_new' },
    })
  })
})

describe('Stripe webhook handler', () => {
  it('rejects requests without a stripe-signature header', async () => {
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest('{}', null))
    expect(res.status).toBe(400)
  })

  it('rejects requests with a tampered signature', async () => {
    const { body } = signWebhookPayload({ id: 'evt_1', type: 'noop' })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest(body, 'invalid-signature-value'))
    expect(res.status).toBe(400)
  })

  it('returns 200 with duplicate=true on replayed event.id', async () => {
    // Idempotency primitive is the unique constraint on stripe_event_id.
    // Replayed delivery surfaces as P2002 from prisma's create, which the
    // route translates to 200 + duplicate (race-safe vs the previous
    // findUnique → create pattern that had a TOCTOU bug under concurrent
    // duplicate deliveries).
    mockStripeWebhookEvent.create.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    )
    const { body, header } = signWebhookPayload({
      id: 'evt_dup',
      type: 'invoice.payment_succeeded',
      data: { object: { customer: 'cus_x' } },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest(body, header))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { duplicate?: boolean }
    expect(json.duplicate).toBe(true)
    // create WAS attempted (that's how we detect the dup) but the switch
    // handler is short-circuited — no workspace mutation.
    expect(mockStripeWebhookEvent.create).toHaveBeenCalledTimes(1)
    expect(mockWorkspace.update).not.toHaveBeenCalled()
  })

  it('handles checkout.session.completed → activates workspace tier', async () => {
    mockStripeWebhookEvent.findUnique.mockResolvedValueOnce(null)
    mockStripeWebhookEvent.create.mockResolvedValueOnce({})
    mockWorkspace.update.mockResolvedValueOnce({})

    const { body, header } = signWebhookPayload({
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          subscription: 'sub_abc',
          metadata: { workspaceId: 'ws_1', tier: 'TEAM' },
        },
      },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest(body, header))

    expect(res.status).toBe(200)
    expect(mockWorkspace.update).toHaveBeenCalledWith({
      where: { id: 'ws_1' },
      data: {
        subscription_tier: 'TEAM',
        stripe_subscription_id: 'sub_abc',
        subscription_status: 'active',
        trial_ends_at: null,
      },
    })
  })

  it('handles customer.subscription.updated → tier change + period_end', async () => {
    mockStripeWebhookEvent.findUnique.mockResolvedValueOnce(null)
    mockStripeWebhookEvent.create.mockResolvedValueOnce({})
    mockWorkspace.update.mockResolvedValueOnce({})

    const periodEndSeconds = Math.floor(Date.now() / 1000) + 86400 * 30
    const { body, header } = signWebhookPayload({
      id: 'evt_sub_upd_1',
      type: 'customer.subscription.updated',
      data: {
        object: {
          status: 'active',
          metadata: { workspaceId: 'ws_2' },
          items: {
            data: [
              {
                price: { id: 'price_solo_test' },
                current_period_end: periodEndSeconds,
              },
            ],
          },
        },
      },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest(body, header))

    expect(res.status).toBe(200)
    expect(mockWorkspace.update).toHaveBeenCalledWith({
      where: { id: 'ws_2' },
      data: expect.objectContaining({
        subscription_tier: 'SOLO',
        subscription_status: 'active',
        current_period_end: new Date(periodEndSeconds * 1000),
      }),
    })
  })

  it('handles customer.subscription.deleted → workspace PAUSED', async () => {
    mockStripeWebhookEvent.findUnique.mockResolvedValueOnce(null)
    mockStripeWebhookEvent.create.mockResolvedValueOnce({})
    mockWorkspace.update.mockResolvedValueOnce({})

    const { body, header } = signWebhookPayload({
      id: 'evt_sub_del_1',
      type: 'customer.subscription.deleted',
      data: { object: { metadata: { workspaceId: 'ws_3' } } },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest(body, header))

    expect(res.status).toBe(200)
    expect(mockWorkspace.update).toHaveBeenCalledWith({
      where: { id: 'ws_3' },
      data: expect.objectContaining({
        status: 'PAUSED',
        subscription_status: 'canceled',
      }),
    })
  })

  it('handles invoice.payment_failed → grace period + email', async () => {
    mockStripeWebhookEvent.findUnique.mockResolvedValueOnce(null)
    mockStripeWebhookEvent.create.mockResolvedValueOnce({})
    mockWorkspace.findFirst.mockResolvedValueOnce({
      id: 'ws_4',
      name: 'Foo AB',
      owner: { email: 'owner@foo.se' },
    })
    mockWorkspace.update.mockResolvedValueOnce({})

    const { body, header } = signWebhookPayload({
      id: 'evt_inv_fail_1',
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_4', amount_due: 39900 } },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest(body, header))

    expect(res.status).toBe(200)
    expect(mockWorkspace.update).toHaveBeenCalledWith({
      where: { id: 'ws_4' },
      data: expect.objectContaining({
        subscription_status: 'past_due',
        payment_grace_period_ends_at: expect.any(Date),
      }),
    })
    const { sendEmail } = await import('@/lib/email/email-service')
    expect(sendEmail).toHaveBeenCalledOnce()
  })

  it('handles invoice.payment_succeeded → clears grace period', async () => {
    mockStripeWebhookEvent.findUnique.mockResolvedValueOnce(null)
    mockStripeWebhookEvent.create.mockResolvedValueOnce({})
    mockWorkspace.findFirst.mockResolvedValueOnce({ id: 'ws_5' })
    mockWorkspace.update.mockResolvedValueOnce({})

    const { body, header } = signWebhookPayload({
      id: 'evt_inv_ok_1',
      type: 'invoice.payment_succeeded',
      data: { object: { customer: 'cus_5' } },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest(body, header))

    expect(res.status).toBe(200)
    expect(mockWorkspace.update).toHaveBeenCalledWith({
      where: { id: 'ws_5' },
      data: {
        payment_grace_period_ends_at: null,
        subscription_status: 'active',
      },
    })
  })

  it('rolls back idempotency row when handler throws', async () => {
    mockStripeWebhookEvent.findUnique.mockResolvedValueOnce(null)
    mockStripeWebhookEvent.create.mockResolvedValueOnce({})
    mockWorkspace.update.mockRejectedValueOnce(new Error('db down'))
    mockStripeWebhookEvent.delete.mockResolvedValueOnce({})

    const { body, header } = signWebhookPayload({
      id: 'evt_throw_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          subscription: 'sub_x',
          metadata: { workspaceId: 'ws_6', tier: 'SOLO' },
        },
      },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest(body, header))

    expect(res.status).toBe(500)
    expect(mockStripeWebhookEvent.delete).toHaveBeenCalledWith({
      where: { stripe_event_id: 'evt_throw_1' },
    })
  })
})

// ---------- TEST-001: Checkout endpoint validation -----------------------

describe('Checkout endpoint', () => {
  it('rejects an invalid tier with 400', async () => {
    const { POST } = await import('@/app/api/billing/checkout/route')
    const req = new Request('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier: 'INVALID' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects with 409 when workspace already has an active subscription', async () => {
    // BILLING-001 server-side guard: protects against the duplicate-sub bug.
    mockWorkspace.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'ws_under_test',
      name: 'Acme AB',
      owner: { email: 'owner@example.com' },
      stripe_subscription_id: 'sub_existing',
      subscription_status: 'active',
    })
    const { POST } = await import('@/app/api/billing/checkout/route')
    const req = new Request('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier: 'TEAM' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const json = (await res.json()) as { code?: string; portalUrl?: string }
    expect(json.code).toBe('SUBSCRIPTION_EXISTS')
    expect(json.portalUrl).toBe('/api/billing/portal')
    // Critical: NO Checkout session was created on the Stripe side.
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('rejects ENTERPRISE with 400 ENTERPRISE_NOT_SELF_SERVE — sales-led, no Checkout', async () => {
    // Enterprise tile in the UI routes to a booking link. This test guards
    // against direct API hits (curl, scripts) trying to start a self-serve
    // Enterprise Checkout, which would charge a placeholder Price.
    const { POST } = await import('@/app/api/billing/checkout/route')
    const req = new Request('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier: 'ENTERPRISE' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = (await res.json()) as { code?: string }
    expect(json.code).toBe('ENTERPRISE_NOT_SELF_SERVE')
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('returns JSON 500 (not HTML) when Stripe.checkout.sessions.create throws', async () => {
    // Robustness guard for the "Unexpected end of JSON input" client crash:
    // without try/catch, Next.js renders its default HTML error page for an
    // uncaught throw, the client's `await res.json()` parses HTML, throws,
    // and crashes the React tree.
    mockWorkspace.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'ws_under_test',
      name: 'Acme AB',
      owner: { email: 'owner@example.com' },
      stripe_subscription_id: null,
      subscription_status: null,
    })
    // Short-circuit getOrCreateStripeCustomer to skip the customer-create path
    // — this test is about how the route handles a Stripe throw on the
    // session.create call, not how it handles customer creation.
    mockWorkspace.findUnique.mockResolvedValueOnce({
      stripe_customer_id: 'cus_existing',
    })
    stripeMock.checkout.sessions.create.mockRejectedValueOnce(
      new Error('No such price: price_typo')
    )
    const { POST } = await import('@/app/api/billing/checkout/route')
    const req = new Request('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier: 'SOLO' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    const json = (await res.json()) as { error?: string; message?: string }
    expect(json.error).toBe('Kunde inte skapa Checkout-session')
    expect(json.message).toContain('No such price')
  })
})

// ---------- TEST-002: workspace-context grace-period block ---------------

describe('workspace-context grace-period block', () => {
  it('throws PAYMENT_PAST_DUE when payment_grace_period_ends_at is past', async () => {
    mockUser.findUnique.mockResolvedValueOnce({
      id: 'user_owner',
      email: 'owner@example.com',
    })
    // Workspace member tied to a workspace whose grace deadline is in the past.
    mockWorkspaceMember.findFirst.mockResolvedValueOnce({
      role: 'OWNER',
      workspace_id: 'ws_under_test',
      workspace: {
        id: 'ws_under_test',
        name: 'Acme AB',
        slug: 'acme',
        status: 'ACTIVE',
        // 1 day in the past
        payment_grace_period_ends_at: new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ),
      },
    })

    const { getWorkspaceContextUncached, WorkspaceAccessError } = await import(
      '@/lib/auth/workspace-context'
    )
    await expect(getWorkspaceContextUncached()).rejects.toMatchObject({
      name: 'WorkspaceAccessError',
      code: 'PAYMENT_PAST_DUE',
    })
    // Belt-and-suspenders: also assert the error class identity.
    await expect(getWorkspaceContextUncached()).rejects.toBeInstanceOf(
      WorkspaceAccessError
    )
  })

  it('returns context normally when payment_grace_period_ends_at is in the future', async () => {
    mockUser.findUnique.mockResolvedValue({
      id: 'user_owner',
      email: 'owner@example.com',
    })
    mockWorkspaceMember.findFirst.mockResolvedValue({
      role: 'OWNER',
      workspace_id: 'ws_under_test',
      workspace: {
        id: 'ws_under_test',
        name: 'Acme AB',
        slug: 'acme',
        status: 'ACTIVE',
        // 2 days in the future — still inside the 3-day grace window
        payment_grace_period_ends_at: new Date(
          Date.now() + 2 * 24 * 60 * 60 * 1000
        ),
      },
    })

    const { getWorkspaceContextUncached } = await import(
      '@/lib/auth/workspace-context'
    )
    const ctx = await getWorkspaceContextUncached()
    expect(ctx.workspaceId).toBe('ws_under_test')
    expect(ctx.role).toBe('OWNER')
  })
})
