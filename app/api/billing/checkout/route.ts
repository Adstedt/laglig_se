/**
 * Story 5.4: POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for the active workspace and returns a URL
 * the client redirects to. Auth: workspace:billing (OWNER role).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionForBilling } from '@/lib/api/require-permission'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import {
  stripe,
  STRIPE_PRICE_IDS,
  type StripePaidTier,
} from '@/lib/stripe/config'
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer'

const TierSchema = z.object({
  tier: z.enum(['SOLO', 'TEAM', 'ENTERPRISE'] as const),
})

export async function POST(request: Request) {
  // Story 5.13: bypass billing gates so trial-expired / past-due users CAN
  // reach Checkout to convert/recover. Only the billing endpoints opt in.
  const result = await requirePermissionForBilling('workspace:billing')
  if (!result.granted) return result.response

  let parsed: z.infer<typeof TierSchema>
  try {
    parsed = TierSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Ogiltig tier' }, { status: 400 })
  }
  const tier: StripePaidTier = parsed.tier

  // Enterprise is sales-led — there's no self-serve Checkout path for it.
  // The UI already routes the Enterprise tile to a booking link; this guard
  // catches direct API hits (curl, scripts, future code paths) before we
  // reach STRIPE_PRICE_IDS.ENTERPRISE (which is now optional).
  if (tier === 'ENTERPRISE') {
    return NextResponse.json(
      {
        error: 'Enterprise är säljledd',
        message:
          'Enterprise-prenumerationer hanteras manuellt. Boka ett samtal för att komma igång.',
        code: 'ENTERPRISE_NOT_SELF_SERVE',
      },
      { status: 400 }
    )
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: result.context.workspaceId },
    include: { owner: { select: { email: true } } },
  })

  // BILLING-001 (QA gate 5.4): if the workspace already has an active Stripe
  // subscription, a fresh Checkout in mode:'subscription' creates a SECOND
  // sub instead of swapping plans → double billing. Plan changes belong to
  // the Customer Portal (which handles proration + replaces the existing sub
  // in place). Reject with a redirect hint so the client can route the user.
  const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])
  if (
    workspace.stripe_subscription_id &&
    workspace.subscription_status &&
    ACTIVE_STATUSES.has(workspace.subscription_status)
  ) {
    return NextResponse.json(
      {
        error: 'Workspace already has an active subscription',
        message:
          'Det finns redan en aktiv prenumeration. Använd kundportalen för att byta plan.',
        code: 'SUBSCRIPTION_EXISTS',
        portalUrl: '/api/billing/portal',
      },
      { status: 409 }
    )
  }

  const customerId = await getOrCreateStripeCustomer(
    workspace.id,
    workspace.owner.email,
    workspace.name
  )

  // Wrap the Stripe API call: any thrown error (invalid Price ID, network
  // blip, Stripe outage) must surface as a JSON 500 — without this, Next.js
  // returns its default HTML error page and the client's `await res.json()`
  // throws "Unexpected end of JSON input", crashing the React tree.
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_IDS[tier], quantity: 1 }],
      automatic_tax: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      // Stripe does NOT auto-copy session metadata to the resulting Subscription —
      // we set it explicitly so customer.subscription.* webhooks resolve workspaceId.
      subscription_data: { metadata: { workspaceId: workspace.id, tier } },
      metadata: { workspaceId: workspace.id, tier },
      success_url: `${env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/settings/billing`,
      custom_text: {
        submit: {
          message:
            'Du kan avsluta din prenumeration när som helst i kundportalen.',
        },
        after_submit: {
          message: 'Tack! Vi skickar kvittot till din e-post.',
        },
      },
      // payment_method_types intentionally omitted — Stripe auto-enables Card,
      // Klarna, Swish per Dashboard config (per Dev Notes "Swedish payment methods").
    })

    if (!session.url) {
      return NextResponse.json(
        { error: 'Kunde inte skapa Checkout-session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Okänt fel'
    console.error('[BILLING_CHECKOUT_ERROR]', err)
    return NextResponse.json(
      {
        error: 'Kunde inte skapa Checkout-session',
        message,
      },
      { status: 500 }
    )
  }
}
