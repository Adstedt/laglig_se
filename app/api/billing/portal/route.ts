/**
 * Story 5.4: POST /api/billing/portal
 *
 * Returns a Stripe Customer Portal URL — used by the billing page's
 * "Manage Payment Method" button (and any downgrade/cancel flow). Stripe owns
 * the surface for payment-method management, plan changes, invoice download.
 */
import { NextResponse } from 'next/server'
import { requirePermissionWithContext } from '@/lib/api/require-permission'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { stripe } from '@/lib/stripe/config'

export async function POST() {
  const result = await requirePermissionWithContext('workspace:billing')
  if (!result.granted) return result.response

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: result.context.workspaceId },
    select: { stripe_customer_id: true },
  })

  if (!workspace.stripe_customer_id) {
    return NextResponse.json(
      { error: 'Ingen Stripe-kund är kopplad till detta arbetsutrymme' },
      { status: 400 }
    )
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: workspace.stripe_customer_id,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  })

  return NextResponse.json({ url: session.url })
}
