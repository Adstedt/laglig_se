/**
 * Story 5.4: Get-or-create Stripe Customer for a workspace.
 *
 * Customer record lives one-per-workspace (B2B model — see story §Context):
 * subscription, billing email, invoice history all belong to the workspace,
 * not the user. Multi-workspace users end up as the billing contact on N
 * customers.
 */
import { prisma } from '@/lib/prisma'
import { stripe } from './config'

export async function getOrCreateStripeCustomer(
  workspaceId: string,
  email: string,
  companyName: string
): Promise<string> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { stripe_customer_id: true },
  })

  if (workspace?.stripe_customer_id) {
    return workspace.stripe_customer_id
  }

  // BILLING-002 (QA gate 5.4): protect against the create-create race when
  // two concurrent first-time Checkout clicks both miss the findUnique above.
  // Stripe replays the same idempotencyKey within 24h and returns the same
  // customer — so the second caller gets the first caller's customer ID
  // instead of creating an orphan in Stripe.
  const customer = await stripe.customers.create(
    {
      email,
      name: companyName,
      // workspaceId in metadata lets webhook handlers resolve back to the row
      // even if our DB write below races with a Stripe-initiated event.
      metadata: { workspaceId },
    },
    { idempotencyKey: `customer:${workspaceId}` }
  )

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { stripe_customer_id: customer.id },
  })

  return customer.id
}
