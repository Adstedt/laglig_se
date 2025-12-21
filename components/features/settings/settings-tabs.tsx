'use client'

/**
 * Story 5.7: Settings Page Tabbed Interface
 * Main tabbed interface for workspace settings.
 * Permission-gated: Billing tab only visible to OWNER role.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkspace } from '@/hooks/use-workspace'
import { hasPermission } from '@/lib/auth/permissions'
import { Skeleton } from '@/components/ui/skeleton'
import { Settings, Users, CreditCard, Bell, Plug } from 'lucide-react'
import type { WorkspaceRole, SubscriptionTier } from '@prisma/client'
import { GeneralTab } from './general-tab'
import { TeamTab } from './team-tab'
import { BillingTab } from './billing-tab'
import { NotificationsTab } from './notifications-tab'
import { IntegrationsTab } from './integrations-tab'

export interface WorkspaceData {
  id: string
  name: string
  sni_code: string | null
  company_logo: string | null
  subscription_tier: SubscriptionTier
  trial_ends_at: Date | null
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
}

export function SettingsTabs({ workspace, members }: SettingsTabsProps) {
  const { role, isLoading } = useWorkspace()

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

  return (
    <Tabs defaultValue="general" className="space-y-6">
      <TabsList className="inline-flex h-auto flex-wrap gap-1 bg-muted p-1">
        <TabsTrigger value="general" className="gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Allmänt</span>
        </TabsTrigger>
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
      </TabsList>

      <TabsContent value="general">
        <GeneralTab workspace={workspace} />
      </TabsContent>

      <TabsContent value="team">
        <TeamTab members={members} />
      </TabsContent>

      {canAccessBilling && (
        <TabsContent value="billing">
          <BillingTab workspace={workspace} />
        </TabsContent>
      )}

      <TabsContent value="notifications">
        <NotificationsTab />
      </TabsContent>

      <TabsContent value="integrations">
        <IntegrationsTab />
      </TabsContent>
    </Tabs>
  )
}
