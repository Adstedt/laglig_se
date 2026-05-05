/**
 * Story 5.4 — BillingDashboard tier-tile routing tests.
 *
 * Locks in BILLING-003 (QA gate 5.4 re-review): when a workspace already has
 * an active Stripe subscription, ALL non-current tier tiles must route to
 * Customer Portal — Checkout in mode:'subscription' would create a duplicate
 * sub. Only the trial-to-first-paid case may use Checkout.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BillingDashboard } from '@/components/features/billing/billing-dashboard'

// useRouter().refresh() is called by the component but doesn't run in tests.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

// Avoid the invoice fetch firing during render — tests only assert the tier tiles.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ invoices: [] }),
    })
  )
})

const baseWorkspace = {
  id: 'ws_1',
  name: 'Acme AB',
  stripeCustomerId: 'cus_x',
  currentPeriodEnd: null,
  trialEndsAt: null,
  paymentGracePeriodEndsAt: null,
}

describe('BillingDashboard tier tile routing', () => {
  it('TRIAL workspace: SOLO + TEAM tiles show Checkout, ENTERPRISE shows the booking link', () => {
    render(
      <BillingDashboard
        workspace={{
          ...baseWorkspace,
          subscriptionTier: 'TRIAL',
          subscriptionStatus: null,
          stripeSubscriptionId: null,
        }}
        showPastDueBanner={false}
        showCheckoutSuccess={false}
      />
    )

    // 2 self-serve tiles get "Välj plan" Checkout buttons; ENTERPRISE is sales-led.
    expect(screen.getAllByRole('button', { name: /Välj nivå/ })).toHaveLength(2)
    expect(
      screen.getByRole('link', { name: /Boka samtal/ })
    ).toBeInTheDocument()
    // Negative assertions: NO Portal-routed buttons should appear in trial.
    expect(
      screen.queryByRole('button', { name: /Uppgradera via portal/ })
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Nedgradera via portal/ })
    ).toBeNull()
  })

  it('TEAM workspace (active sub): SOLO routes to Portal (downgrade), ENTERPRISE shows the booking link, TEAM is "Aktiv"', () => {
    // BILLING-003 regression guard: this is the exact case Quinn flagged.
    // Pre-fix, ENTERPRISE would have shown a Checkout "Uppgradera" button
    // that hits the server-side 409 SUBSCRIPTION_EXISTS guard. Post-cleanup,
    // ENTERPRISE is sales-led — its tile always renders the booking link.
    render(
      <BillingDashboard
        workspace={{
          ...baseWorkspace,
          subscriptionTier: 'TEAM',
          subscriptionStatus: 'active',
          stripeSubscriptionId: 'sub_existing',
        }}
        showPastDueBanner={false}
        showCheckoutSuccess={false}
      />
    )

    // Downgrade path (SOLO): Portal button labelled "Nedgradera via portal".
    expect(
      screen.getByRole('button', { name: /Nedgradera via portal/ })
    ).toBeInTheDocument()
    // Enterprise tile: booking link, not a Checkout/Portal button.
    expect(
      screen.getByRole('link', { name: /Boka samtal/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Uppgradera via portal/ })
    ).toBeNull()
    // Current tier tile: disabled "Aktiv" button.
    const aktiv = screen.getByRole('button', { name: /^Aktiv$/ })
    expect(aktiv).toBeDisabled()
    // Critical negative: NO bare "Uppgradera" Checkout button anywhere.
    expect(screen.queryByRole('button', { name: /^Uppgradera$/ })).toBeNull()
  })

  it('SOLO workspace (active sub): TEAM routes to Portal as upgrade, ENTERPRISE shows the booking link', () => {
    render(
      <BillingDashboard
        workspace={{
          ...baseWorkspace,
          subscriptionTier: 'SOLO',
          subscriptionStatus: 'active',
          stripeSubscriptionId: 'sub_existing',
        }}
        showPastDueBanner={false}
        showCheckoutSuccess={false}
      />
    )

    // TEAM is an upgrade → Portal. ENTERPRISE → booking link (sales-led, not metered).
    expect(
      screen.getAllByRole('button', { name: /Uppgradera via portal/ })
    ).toHaveLength(1)
    expect(
      screen.getByRole('link', { name: /Boka samtal/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Uppgradera$/ })).toBeNull()
  })

  it('Past_due subscription is treated as active for routing — no Checkout buttons appear', () => {
    // Past_due is in ACTIVE_STATUSES — user must resolve the failed payment
    // via Portal before any plan change, not start a fresh sub via Checkout.
    render(
      <BillingDashboard
        workspace={{
          ...baseWorkspace,
          subscriptionTier: 'TEAM',
          subscriptionStatus: 'past_due',
          stripeSubscriptionId: 'sub_past_due',
        }}
        showPastDueBanner={true}
        showCheckoutSuccess={false}
      />
    )

    expect(screen.queryByRole('button', { name: /^Uppgradera$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Välj nivå$/ })).toBeNull()
    // Enterprise booking link is unconditional — should still render here.
    expect(
      screen.getByRole('link', { name: /Boka samtal/ })
    ).toBeInTheDocument()
  })

  it('Canceled subscription is NOT treated as active — Checkout buttons reappear on self-serve tiers', () => {
    // After cancellation the workspace can re-subscribe via Checkout (no
    // existing sub to dup). ENTERPRISE remains sales-led regardless of state.
    render(
      <BillingDashboard
        workspace={{
          ...baseWorkspace,
          subscriptionTier: 'TRIAL',
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: 'sub_old_canceled',
        }}
        showPastDueBanner={false}
        showCheckoutSuccess={false}
      />
    )

    expect(screen.getAllByRole('button', { name: /Välj nivå/ })).toHaveLength(2)
    expect(
      screen.getByRole('link', { name: /Boka samtal/ })
    ).toBeInTheDocument()
  })
})
