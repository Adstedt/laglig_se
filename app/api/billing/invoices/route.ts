/**
 * Story 5.4: GET /api/billing/invoices
 *
 * Proxies stripe.invoices.list for the active workspace's customer to the UI.
 * We don't store invoices locally — the canonical record is Stripe; we only
 * surface a thin slice (id, number, amount, status, hosted/PDF links).
 */
import { NextResponse } from 'next/server'
import { requirePermissionForBilling } from '@/lib/api/require-permission'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe/config'

export async function GET() {
  // Story 5.13: bypass billing gates — invoice listing is part of the
  // billing surface and must be reachable when gated.
  const result = await requirePermissionForBilling('workspace:billing')
  if (!result.granted) return result.response

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: result.context.workspaceId },
    select: { stripe_customer_id: true },
  })

  if (!workspace.stripe_customer_id) {
    return NextResponse.json({ invoices: [] })
  }

  const invoices = await stripe.invoices.list({
    customer: workspace.stripe_customer_id,
    limit: 24,
  })

  return NextResponse.json({
    invoices: invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amount_due: inv.amount_due,
      currency: inv.currency,
      status: inv.status,
      created: inv.created,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
    })),
  })
}
