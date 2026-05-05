/**
 * Story 5.4: POST /api/webhooks/stripe
 *
 * Public route — identity is established by Stripe signature, NOT session.
 * Do NOT call requirePermission or any session helper here.
 *
 * Idempotency: every Stripe event.id is recorded in StripeWebhookEvent BEFORE
 * we mutate workspace state. Replays from Stripe (which it does on any non-2xx
 * response, plus periodic reconciliation) return 200 immediately on duplicate.
 *
 * Handlers cover the 5 events the story requires:
 *   - checkout.session.completed     → mark workspace active on the chosen tier
 *   - customer.subscription.updated  → tier change, period_end refresh
 *   - customer.subscription.deleted  → pause workspace
 *   - invoice.payment_failed         → start 3-day grace + email owner
 *   - invoice.payment_succeeded      → clear any past-due grace
 */
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import * as Sentry from '@sentry/nextjs'
import { stripe, tierForPriceId } from '@/lib/stripe/config'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { sendEmail } from '@/lib/email/email-service'
import { PaymentFailedEmail } from '@/emails/payment-failed'
import { invalidateSeatCache } from '@/lib/usage/seat-cache'

// Stripe needs the raw body bytes to verify the signature — Next.js parses
// JSON by default, but we read text() ourselves so the bytes match what
// Stripe signed. Header is read from the Request object directly (rather than
// next/headers) so this handler stays unit-testable without a request scope.
export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Signature verification failed'
    // eslint-disable-next-line no-console
    console.error('[STRIPE-WEBHOOK] signature verification failed:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Idempotency: claim the event_id by inserting the row. Treat the unique
  // constraint as the idempotency primitive — race-safe vs the previous
  // findUnique → create pattern (which had a TOCTOU bug where two concurrent
  // deliveries of the same event would both pass the findUnique check, both
  // attempt create, the loser would 500, and its catch block would delete
  // the winner's row — breaking at-most-once processing).
  //
  // P2002 here means "another concurrent delivery already claimed this
  // event" — we return 200 duplicate without running the switch handler.
  try {
    await prisma.stripeWebhookEvent.create({
      data: { stripe_event_id: event.id, event_type: event.type },
    })
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: unknown }).code === 'P2002'
    ) {
      return NextResponse.json({ received: true, duplicate: true })
    }
    // Some other DB issue (connection, schema, etc) — surface to Sentry and
    // return 500 so Stripe retries.
    Sentry.captureException(err, {
      tags: {
        area: 'stripe-webhook',
        event: 'idempotency_claim_failed',
        stripe_event_type: event.type,
        stripe_event_id: event.id,
      },
    })
    return NextResponse.json(
      { error: 'Failed to claim event' },
      { status: 500 }
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const workspaceId = session.metadata?.workspaceId
        const tier = session.metadata?.tier as
          | 'SOLO'
          | 'TEAM'
          | 'ENTERPRISE'
          | undefined
        if (!workspaceId || !tier) break

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            subscription_tier: tier,
            stripe_subscription_id:
              typeof session.subscription === 'string'
                ? session.subscription
                : (session.subscription?.id ?? null),
            subscription_status: 'active',
            trial_ends_at: null,
          },
        })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const workspaceId = subscription.metadata?.workspaceId
        if (!workspaceId) break

        const priceId = subscription.items.data[0]?.price.id
        const tier = priceId ? tierForPriceId(priceId) : undefined

        // Stripe API 2024-04-10+ moved current_period_end + current_period_start
        // onto the subscription item. Older versions keep them on the
        // subscription itself — read item first, fall back to legacy field.
        const item = subscription.items.data[0] as
          | (Stripe.SubscriptionItem & {
              current_period_end?: number
              current_period_start?: number
            })
          | undefined
        const periodEnd =
          item?.current_period_end ??
          (subscription as unknown as { current_period_end?: number })
            .current_period_end
        const periodStart =
          item?.current_period_start ??
          (subscription as unknown as { current_period_start?: number })
            .current_period_start

        const newPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null
        const newPeriodStart = periodStart ? new Date(periodStart * 1000) : null

        // Story 5.5c (Pattern A reset): when current_period_end advances —
        // either NULL → future date (trial→paid conversion) or future →
        // later future (monthly anniversary) — reset the WorkspaceUsage
        // counter in the SAME transaction as the Workspace update so
        // they cannot drift. Plan upgrade/downgrade mid-period does NOT
        // advance current_period_end → counter NOT reset.
        const existing = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { current_period_end: true },
        })
        const periodAdvanced =
          !!newPeriodEnd &&
          (!existing?.current_period_end ||
            newPeriodEnd > existing.current_period_end)

        // Pattern A reset: when period advances, write workspace + usage in
        // one transaction. When period unchanged (tier-change-only events),
        // just update the workspace — avoids requiring $transaction in
        // unrelated test mocks.
        if (periodAdvanced && newPeriodStart) {
          await prisma.$transaction([
            prisma.workspace.update({
              where: { id: workspaceId },
              data: {
                ...(tier ? { subscription_tier: tier } : {}),
                subscription_status: subscription.status,
                current_period_end: newPeriodEnd,
              },
            }),
            prisma.workspaceUsage.upsert({
              where: { workspace_id: workspaceId },
              create: {
                workspace_id: workspaceId,
                tokens_used_this_period: BigInt(0),
                period_started_at: newPeriodStart,
              },
              update: {
                tokens_used_this_period: BigInt(0),
                period_started_at: newPeriodStart,
              },
            }),
          ])
        } else {
          await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              ...(tier ? { subscription_tier: tier } : {}),
              subscription_status: subscription.status,
              current_period_end: newPeriodEnd,
            },
          })
        }

        // Story 5.5c: invalidate the cached add-on seat count so add-on
        // purchases / removals propagate immediately to the chat-route
        // quota check rather than waiting up to 5 minutes for the TTL.
        await invalidateSeatCache(workspaceId)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const workspaceId = subscription.metadata?.workspaceId
        if (!workspaceId) break

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            status: 'PAUSED',
            paused_at: new Date(),
            subscription_status: 'canceled',
          },
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : (invoice.customer?.id ?? null)
        if (!customerId) break

        const workspace = await prisma.workspace.findFirst({
          where: { stripe_customer_id: customerId },
          include: { owner: { select: { email: true } } },
        })
        if (!workspace) break

        const gracePeriodEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

        await prisma.workspace.update({
          where: { id: workspace.id },
          data: {
            payment_grace_period_ends_at: gracePeriodEndsAt,
            subscription_status: 'past_due',
          },
        })

        await sendEmail({
          to: workspace.owner.email,
          subject: 'Betalning misslyckades — Laglig.se',
          react: PaymentFailedEmail({
            companyName: workspace.name,
            amount: (invoice.amount_due ?? 0) / 100,
            gracePeriodEndsAt,
            manageBillingUrl: `${env.NEXT_PUBLIC_APP_URL}/settings/billing`,
          }),
          from: 'no-reply',
        })
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : (invoice.customer?.id ?? null)
        if (!customerId) break

        const workspace = await prisma.workspace.findFirst({
          where: { stripe_customer_id: customerId },
        })
        if (!workspace) break

        await prisma.workspace.update({
          where: { id: workspace.id },
          data: {
            payment_grace_period_ends_at: null,
            subscription_status: 'active',
          },
        })
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[STRIPE-WEBHOOK] handler error:', error)
    // Surface to Sentry so silent webhook failures don't accumulate. The
    // chat route gets the same treatment via Story 5.5c TOKEN-002 — webhook
    // billing path is at least as critical.
    Sentry.captureException(error, {
      tags: {
        area: 'stripe-webhook',
        event: 'webhook_handler_failed',
        stripe_event_type: event.type,
        stripe_event_id: event.id,
      },
    })
    // Roll back the idempotency row so Stripe's retry can re-process this event.
    await prisma.stripeWebhookEvent
      .delete({ where: { stripe_event_id: event.id } })
      .catch(() => {})
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
