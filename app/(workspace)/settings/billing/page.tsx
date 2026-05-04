/**
 * Story 5.4: /settings/billing — workspace billing dashboard.
 *
 * Server component: fetches the workspace's billing state from our DB and
 * delegates payment-method mgmt + invoice download to Stripe Customer Portal.
 * Past-due banner appears when the redirect is `?reason=past_due` (set by
 * workspace-context's PAYMENT_PAST_DUE error).
 */
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/auth/permissions'
import { BillingDashboard } from '@/components/features/billing/billing-dashboard'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    reason?: string
    success?: string
  }>
}

export default async function BillingPage({ searchParams }: PageProps) {
  const params = await searchParams
  const context = await getWorkspaceContext()

  // Only OWNER can view billing — mirrors the SettingsTabs gate.
  if (!hasPermission(context.role, 'workspace:billing')) {
    redirect('/settings')
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: context.workspaceId },
    select: {
      id: true,
      name: true,
      subscription_tier: true,
      subscription_status: true,
      stripe_customer_id: true,
      stripe_subscription_id: true,
      current_period_end: true,
      trial_ends_at: true,
      payment_grace_period_ends_at: true,
    },
  })

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Fakturering"
        subtitle="Plan, betalsätt och fakturor."
      />
      <Suspense fallback={null}>
        <BillingDashboard
          workspace={{
            id: workspace.id,
            name: workspace.name,
            subscriptionTier: workspace.subscription_tier,
            subscriptionStatus: workspace.subscription_status,
            stripeCustomerId: workspace.stripe_customer_id,
            stripeSubscriptionId: workspace.stripe_subscription_id,
            currentPeriodEnd:
              workspace.current_period_end?.toISOString() ?? null,
            trialEndsAt: workspace.trial_ends_at?.toISOString() ?? null,
            paymentGracePeriodEndsAt:
              workspace.payment_grace_period_ends_at?.toISOString() ?? null,
          }}
          showPastDueBanner={params.reason === 'past_due'}
          showCheckoutSuccess={params.success === 'true'}
        />
      </Suspense>
    </div>
  )
}
