/**
 * Story 5.7: Workspace Settings Page
 * Server component that fetches workspace and members data,
 * then renders the client-side tabbed interface.
 */

import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { prisma } from '@/lib/prisma'
import { SettingsTabs } from '@/components/features/settings/settings-tabs'

async function getWorkspaceData(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      sni_code: true,
      company_logo: true,
      subscription_tier: true,
      trial_ends_at: true,
    },
  })

  return workspace
}

async function getWorkspaceMembers(workspaceId: string) {
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

export default async function SettingsPage() {
  const context = await getWorkspaceContext()

  const [workspace, members] = await Promise.all([
    getWorkspaceData(context.workspaceId),
    getWorkspaceMembers(context.workspaceId),
  ])

  if (!workspace) {
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
      <div>
        <h1 className="text-2xl font-semibold">Inställningar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hantera din arbetsplats och dina preferenser
        </p>
      </div>

      <SettingsTabs workspace={workspace} members={members} />
    </div>
  )
}
