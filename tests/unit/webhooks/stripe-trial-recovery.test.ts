/**
 * Story 5.13 (AC 19): Stripe webhook recovery from trial-expiry-pause.
 *
 * When a workspace has been paused by 5.13's Day-45 cron and the user
 * subsequently converts via Stripe Checkout, the existing
 * checkout.session.completed handler must restore status=ACTIVE +
 * clear paused_at — otherwise the paying customer remains locked out
 * by the existing PAUSED gate.
 *
 * The discriminator is `subscription_tier === 'TRIAL'` on the row's
 * pre-update state. PAUSED-from-billing-failure (subscription_tier ∈
 * {SOLO, TEAM, ENTERPRISE}) is NOT auto-recovered — that's a separate
 * remediation path.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'

// Hoisted constants — referenced by vi.mock factories (which are themselves
// hoisted) AND by the test bodies. Any non-hoisted const used in a factory
// hits a TDZ error during eager module init.
const consts = vi.hoisted(() => ({
  TEST_WEBHOOK_SECRET: 'whsec_test_secret_recovery',
  TEST_STRIPE_KEY: 'sk_test_recovery',
}))
const TEST_WEBHOOK_SECRET = consts.TEST_WEBHOOK_SECRET

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_SECRET_KEY: consts.TEST_STRIPE_KEY,
    STRIPE_WEBHOOK_SECRET: consts.TEST_WEBHOOK_SECRET,
    STRIPE_SOLO_PRICE_ID: 'price_solo_test',
    STRIPE_TEAM_PRICE_ID: 'price_team_test',
    STRIPE_ENTERPRISE_PRICE_ID: 'price_enterprise_test',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}))

// Hoisted shared state — vi.mock factories run before top-level consts.
const mocks = vi.hoisted(() => ({
  workspace: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  stripeWebhookEvent: {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  logActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: mocks.workspace,
    stripeWebhookEvent: mocks.stripeWebhookEvent,
  },
}))

vi.mock('@/lib/email/email-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/services/activity-logger', () => ({
  logActivity: (...args: unknown[]) => mocks.logActivity(...args),
}))

// Real stripe SDK so signature verification + tierForPriceId resolve.
vi.mock('@/lib/stripe/config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/stripe/config')>(
    '@/lib/stripe/config'
  )
  return {
    ...actual,
    stripe: new Stripe(consts.TEST_STRIPE_KEY, {
      apiVersion: '2025-01-27.acacia' as never,
    }),
  }
})

import { POST as webhookPOST } from '@/app/api/webhooks/stripe/route'

function makeCheckoutCompletedRequest(
  workspaceId: string,
  tier: 'SOLO' | 'TEAM',
  subscriptionId: string
): Request {
  const event = {
    id: `evt_recovery_${Date.now()}`,
    type: 'checkout.session.completed' as const,
    data: {
      object: {
        id: 'cs_test_xxx',
        metadata: { workspaceId, tier },
        subscription: subscriptionId,
      } as unknown as Stripe.Checkout.Session,
    },
  } as Stripe.Event

  const body = JSON.stringify(event)
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: TEST_WEBHOOK_SECRET,
  })

  return new Request('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body,
  })
}

afterEach(() => {
  vi.clearAllMocks()
  mocks.stripeWebhookEvent.findUnique.mockResolvedValue(null)
  mocks.stripeWebhookEvent.create.mockResolvedValue({})
  mocks.workspace.update.mockResolvedValue({})
})

describe('Story 5.13 AC 19: trial-pause recovery on conversion', () => {
  it('restores status=ACTIVE + clears paused_at when prior state was TRIAL+PAUSED', async () => {
    mocks.workspace.findUnique.mockResolvedValue({
      owner_id: 'user_1',
      status: 'PAUSED',
      paused_at: new Date('2026-04-15'),
      subscription_tier: 'TRIAL',
    })

    const req = makeCheckoutCompletedRequest('ws_paused', 'TEAM', 'sub_new')
    const res = await webhookPOST(req)

    expect(res.status).toBe(200)
    expect(mocks.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ws_paused' },
        data: expect.objectContaining({
          subscription_tier: 'TEAM',
          status: 'ACTIVE',
          paused_at: null,
          trial_ends_at: null,
        }),
      })
    )

    // Both ActivityLog writes fired
    const actions = mocks.logActivity.mock.calls.map((c) => c[4])
    expect(actions).toContain('trial_converted')
    expect(actions).toContain('workspace_reactivated_from_trial_pause')
  })

  it('does NOT auto-recover PAUSED workspaces with non-TRIAL prior tier (billing failure pause)', async () => {
    mocks.workspace.findUnique.mockResolvedValue({
      owner_id: 'user_2',
      status: 'PAUSED',
      paused_at: new Date('2026-04-15'),
      subscription_tier: 'TEAM', // not TRIAL → not a trial-expiry pause
    })

    const req = makeCheckoutCompletedRequest(
      'ws_billing_paused',
      'TEAM',
      'sub_new'
    )
    await webhookPOST(req)

    const updateCall = mocks.workspace.update.mock.calls[0]?.[0] as
      | { data: Record<string, unknown> }
      | undefined
    // status / paused_at must NOT appear in the update payload
    expect(updateCall?.data).not.toHaveProperty('status')
    expect(updateCall?.data).not.toHaveProperty('paused_at')
    // And no recovery ActivityLog write
    const actions = mocks.logActivity.mock.calls.map((c) => c[4])
    expect(actions).not.toContain('workspace_reactivated_from_trial_pause')
  })

  it('writes trial_converted ActivityLog on every conversion (paused or not)', async () => {
    mocks.workspace.findUnique.mockResolvedValue({
      owner_id: 'user_3',
      status: 'ACTIVE',
      paused_at: null,
      subscription_tier: 'TRIAL',
    })

    const req = makeCheckoutCompletedRequest(
      'ws_active_trial',
      'SOLO',
      'sub_new'
    )
    await webhookPOST(req)

    const actions = mocks.logActivity.mock.calls.map((c) => c[4])
    expect(actions).toContain('trial_converted')
    // No recovery write because status was already ACTIVE
    expect(actions).not.toContain('workspace_reactivated_from_trial_pause')
  })
})
