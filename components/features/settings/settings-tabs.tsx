'use client'

/**
 * Story 5.7: Settings Page Tabbed Interface
 * Main tabbed interface for workspace settings.
 * Permission-gated: Billing tab only visible to OWNER role.
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkspace } from '@/hooks/use-workspace'
import { hasPermission } from '@/lib/auth/permissions'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Settings,
  Users,
  CreditCard,
  Bell,
  Plug,
  Columns,
  Building2,
  Handshake,
} from 'lucide-react'
import type { WorkspaceRole, SubscriptionTier } from '@prisma/client'
import { GeneralTab } from './general-tab'
import { TeamTab } from './team-tab'
import { BillingDashboard } from '@/components/features/billing/billing-dashboard'
import { NotificationsTab } from './notifications-tab'
import { IntegrationsTab } from './integrations-tab'
import { WorkflowTab } from './workflow-tab'
import { CompanyProfileTab } from './company-profile-tab'
import { KollektivavtalManager } from '@/components/features/kollektivavtal/kollektivavtal-manager'
import type { TaskColumnWithCount } from '@/app/actions/tasks'
import type { CollectiveAgreementListItem } from '@/app/actions/collective-agreements'
import type { CompanyProfile } from '@prisma/client'

export interface WorkspaceData {
  id: string
  name: string
  sni_code: string | null
  company_logo: string | null
  subscription_tier: SubscriptionTier
  trial_ends_at: Date | null
  // Story 5.13: needed by the trial-expired conversion panel to highlight
  // the user's picked tier first + acknowledge Enterprise inquiry copy.
  trial_picked_tier: SubscriptionTier | null
  enterprise_inquiry_at: Date | null
}

export interface BillingData {
  subscriptionStatus: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: string | null
  paymentGracePeriodEndsAt: string | null
}

export interface MemberData {
  id: string
  user: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
  role: WorkspaceRole
  joined_at: Date
}

interface SettingsTabsProps {
  workspace: WorkspaceData
  members: MemberData[]
  columns: TaskColumnWithCount[]
  // Story 5.13: nullable when workspace is gated by TRIAL_EXPIRED /
  // PAYMENT_PAST_DUE. Settings page falls back to null so the page can render
  // (the user MUST be able to reach the Fakturering tab to convert) — the
  // Company tab just shows a placeholder until they do.
  companyProfile: CompanyProfile | null
  // Story 7.5: prefetched kollektivavtal for the Kollektivavtal tab; null when
  // the fetch failed or the workspace is billing-gated (tab shows a fallback).
  collectiveAgreements: CollectiveAgreementListItem[] | null
  billing: BillingData
  initialTab: string
  showPastDueBanner: boolean
  showCheckoutSuccess: boolean
  // Story 5.13: when true, BillingDashboard renders the trial-expired
  // conversion panel above the existing tile grid.
  showTrialExpiredPanel?: boolean
}

export function SettingsTabs({
  workspace,
  members,
  columns,
  companyProfile,
  collectiveAgreements,
  billing,
  initialTab,
  showPastDueBanner,
  showCheckoutSuccess,
  showTrialExpiredPanel = false,
}: SettingsTabsProps) {
  const { role, isLoading } = useWorkspace()
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleTabChange = (newTab: string) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set('tab', newTab)
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  // Show loading skeleton while checking permissions
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const typedRole = role as WorkspaceRole
  const canAccessBilling = hasPermission(typedRole, 'workspace:billing')
  const canAccessSettings = hasPermission(typedRole, 'workspace:settings')
  // Story 7.5: settings-tab visibility ≠ upload permission (defense in depth).
  // The tab is gated like company-profile; the upload form additionally
  // requires `employees:manage` (which e.g. ADMIN does not hold — the
  // mutation actions enforce this server-side regardless).
  const canManageEmployees = hasPermission(typedRole, 'employees:manage')

  return (
    <Tabs
      value={initialTab}
      onValueChange={handleTabChange}
      className="space-y-6"
    >
      <TabsList className="inline-flex h-auto flex-wrap gap-1 bg-muted p-1">
        <TabsTrigger value="general" className="gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Allmänt</span>
        </TabsTrigger>
        {canAccessSettings && (
          <TabsTrigger value="company-profile" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Företagsprofil</span>
          </TabsTrigger>
        )}
        {canAccessSettings && (
          <TabsTrigger value="kollektivavtal" className="gap-2">
            <Handshake className="h-4 w-4" />
            <span className="hidden sm:inline">Kollektivavtal</span>
          </TabsTrigger>
        )}
        <TabsTrigger value="team" className="gap-2">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Team</span>
        </TabsTrigger>
        {/* Billing tab only visible to OWNER */}
        {canAccessBilling && (
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Fakturering</span>
          </TabsTrigger>
        )}
        <TabsTrigger value="notifications" className="gap-2">
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">Aviseringar</span>
        </TabsTrigger>
        <TabsTrigger value="integrations" className="gap-2">
          <Plug className="h-4 w-4" />
          <span className="hidden sm:inline">Integrationer</span>
        </TabsTrigger>
        <TabsTrigger value="workflow" className="gap-2">
          <Columns className="h-4 w-4" />
          <span className="hidden sm:inline">Arbetsflöde</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralTab workspace={workspace} />
      </TabsContent>

      {canAccessSettings && (
        <TabsContent value="company-profile">
          {companyProfile ? (
            <CompanyProfileTab companyProfile={companyProfile} />
          ) : (
            // Story 5.13: workspace is gated (trial expired / payment past due);
            // company profile fetch was skipped via safeWorkspaceFetch fallback.
            // Direct user to billing tab to recover access.
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Företagsuppgifter är inte tillgängliga just nu. Aktivera din
              prenumeration i Fakturering-fliken för att fortsätta.
            </div>
          )}
        </TabsContent>
      )}

      {canAccessSettings && (
        <TabsContent value="kollektivavtal">
          <KollektivavtalManager
            initialAgreements={collectiveAgreements}
            canManage={canManageEmployees}
          />
        </TabsContent>
      )}

      <TabsContent value="team">
        <TeamTab members={members} />
      </TabsContent>

      {canAccessBilling && (
        <TabsContent value="billing">
          <BillingDashboard
            workspace={{
              id: workspace.id,
              name: workspace.name,
              subscriptionTier: workspace.subscription_tier,
              subscriptionStatus: billing.subscriptionStatus,
              stripeCustomerId: billing.stripeCustomerId,
              stripeSubscriptionId: billing.stripeSubscriptionId,
              currentPeriodEnd: billing.currentPeriodEnd,
              trialEndsAt: workspace.trial_ends_at
                ? new Date(workspace.trial_ends_at).toISOString()
                : null,
              paymentGracePeriodEndsAt: billing.paymentGracePeriodEndsAt,
            }}
            showPastDueBanner={showPastDueBanner}
            showCheckoutSuccess={showCheckoutSuccess}
            showTrialExpiredPanel={showTrialExpiredPanel}
            trialPickedTier={workspace.trial_picked_tier ?? null}
            enterpriseInquiryAt={
              workspace.enterprise_inquiry_at
                ? new Date(workspace.enterprise_inquiry_at).toISOString()
                : null
            }
          />
        </TabsContent>
      )}

      <TabsContent value="notifications">
        <NotificationsTab />
      </TabsContent>

      <TabsContent value="integrations">
        <IntegrationsTab />
      </TabsContent>

      <TabsContent value="workflow">
        <WorkflowTab columns={columns} />
      </TabsContent>
    </Tabs>
  )
}
