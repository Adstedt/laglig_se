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
} from 'lucide-react'
import type { WorkspaceRole, SubscriptionTier } from '@prisma/client'
import { GeneralTab } from './general-tab'
import { TeamTab } from './team-tab'
import { BillingDashboard } from '@/components/features/billing/billing-dashboard'
import { NotificationsTab } from './notifications-tab'
import { IntegrationsTab } from './integrations-tab'
import { WorkflowTab } from './workflow-tab'
import { CompanyProfileTab } from './company-profile-tab'
import type { TaskColumnWithCount } from '@/app/actions/tasks'
import type { CompanyProfile } from '@prisma/client'

export interface WorkspaceData {
  id: string
  name: string
  sni_code: string | null
  company_logo: string | null
  subscription_tier: SubscriptionTier
  trial_ends_at: Date | null
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
  companyProfile: CompanyProfile
  billing: BillingData
  initialTab: string
  showPastDueBanner: boolean
  showCheckoutSuccess: boolean
}

export function SettingsTabs({
  workspace,
  members,
  columns,
  companyProfile,
  billing,
  initialTab,
  showPastDueBanner,
  showCheckoutSuccess,
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
          <CompanyProfileTab companyProfile={companyProfile} />
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
              trialEndsAt: workspace.trial_ends_at?.toISOString() ?? null,
              paymentGracePeriodEndsAt: billing.paymentGracePeriodEndsAt,
            }}
            showPastDueBanner={showPastDueBanner}
            showCheckoutSuccess={showCheckoutSuccess}
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
