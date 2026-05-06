/**
 * Story 5.7: Workspace Settings Page
 * Story 6.5: Added columns data for workflow tab
 * Story 6.0: Added 300s caching for settings data per architecture spec
 * Server component that fetches workspace, members, and columns data,
 * then renders the client-side tabbed interface.
 */

import { unstable_cache } from 'next/cache'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { getWorkspaceContextBypassBillingGates } from '@/lib/auth/workspace-context'
import { prisma } from '@/lib/prisma'
import { SettingsTabs } from '@/components/features/settings/settings-tabs'
import { PageHeader } from '@/components/ui/page-header'
import { getTaskColumns } from '@/app/actions/tasks'
import { getCompanyProfile } from '@/app/actions/company-profile'

/**
 * Story 5.13: server actions called from this page (getCompanyProfile,
 * getTaskColumns) internally use the *gated* version of getWorkspaceContext
 * which calls Next.js redirect() on a billing-gate hit. We need to catch
 * that NEXT_REDIRECT here so the settings page can still render — the page
 * IS the conversion surface and must not redirect to itself.
 *
 * `isRedirectError` is the canonical Next.js predicate for the NEXT_REDIRECT
 * exception. Any other error propagates normally.
 */
async function safeWorkspaceFetch<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p
  } catch (err) {
    if (isRedirectError(err)) {
      return fallback
    }
    throw err
  }
}

async function getWorkspaceDataInternal(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      sni_code: true,
      company_logo: true,
      subscription_tier: true,
      trial_ends_at: true,
      // Story 5.13: trial-expired conversion panel reads these to highlight
      // the user's picked tier and adapt copy for Enterprise inquirers.
      trial_picked_tier: true,
      enterprise_inquiry_at: true,
    },
  })

  return workspace
}

// Billing fields are intentionally uncached: webhook-driven state changes
// (subscription_status flips, current_period_end advancing on renewal) need
// to be visible immediately, not deferred behind the 300s settings cache.
async function getWorkspaceBillingData(workspaceId: string) {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      subscription_status: true,
      stripe_customer_id: true,
      stripe_subscription_id: true,
      current_period_end: true,
      payment_grace_period_ends_at: true,
    },
  })
}

async function getWorkspaceMembersInternal(workspaceId: string) {
  const members = await prisma.workspaceMember.findMany({
    where: { workspace_id: workspaceId },
    select: {
      id: true,
      role: true,
      joined_at: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar_url: true,
        },
      },
    },
    orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
  })

  return members
}

/**
 * Get workspace data with 300-second cache (5 minutes)
 */
const getWorkspaceData = (workspaceId: string) =>
  unstable_cache(
    () => getWorkspaceDataInternal(workspaceId),
    ['workspace-settings', workspaceId],
    {
      revalidate: 300, // Cache for 5 minutes
      tags: ['workspace-settings', `workspace-${workspaceId}`],
    }
  )()

/**
 * Get workspace members with 300-second cache (5 minutes)
 */
const getWorkspaceMembers = (workspaceId: string) =>
  unstable_cache(
    () => getWorkspaceMembersInternal(workspaceId),
    ['workspace-members', workspaceId],
    {
      revalidate: 300, // Cache for 5 minutes
      tags: ['workspace-members', `workspace-${workspaceId}`],
    }
  )()

interface SettingsPageProps {
  searchParams: Promise<{
    tab?: string
    reason?: string
    success?: string
  }>
}

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const params = await searchParams
  // Story 5.13: settings page is the billing-conversion surface. Use the
  // bypass-version so trial-expired / past-due users can still reach the
  // billing tab to convert (gates are enforced everywhere ELSE in workspace).
  const context = await getWorkspaceContextBypassBillingGates()

  const [workspace, billing, members, columnsResult, companyProfile] =
    await Promise.all([
      getWorkspaceData(context.workspaceId),
      getWorkspaceBillingData(context.workspaceId),
      getWorkspaceMembers(context.workspaceId),
      // Story 5.13: getTaskColumns + getCompanyProfile internally call the
      // gated getWorkspaceContext. When trial-expired / past-due, those
      // throw — but the settings page is the conversion surface and MUST
      // render. Fall back to safe defaults; the relevant tabs (Workflow,
      // Company) just show empty state until the user converts.
      safeWorkspaceFetch(getTaskColumns(), {
        success: false as const,
        error: 'Provperiod slut — välj plan i Fakturering-fliken',
      }),
      safeWorkspaceFetch(getCompanyProfile(), null),
    ])

  const columns = columnsResult.success ? (columnsResult.data ?? []) : []

  if (!workspace || !billing) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Inställningar</h1>
        <p className="text-muted-foreground">
          Kunde inte hitta arbetsplatsdata.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inställningar"
        subtitle="Hantera din arbetsplats och dina preferenser"
      />

      <SettingsTabs
        workspace={workspace}
        members={members}
        columns={columns}
        companyProfile={companyProfile}
        billing={{
          subscriptionStatus: billing.subscription_status,
          stripeCustomerId: billing.stripe_customer_id,
          stripeSubscriptionId: billing.stripe_subscription_id,
          currentPeriodEnd: billing.current_period_end?.toISOString() ?? null,
          paymentGracePeriodEndsAt:
            billing.payment_grace_period_ends_at?.toISOString() ?? null,
        }}
        initialTab={params.tab ?? 'general'}
        showPastDueBanner={params.reason === 'past_due'}
        showCheckoutSuccess={params.success === 'true'}
        showTrialExpiredPanel={params.reason === 'trial_expired'}
      />
    </div>
  )
}
