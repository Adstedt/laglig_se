import { redirect } from 'next/navigation'
import {
  getUserWorkspaces,
  setActiveWorkspace,
} from '@/lib/auth/workspace-context'
import { WorkspaceSelectorCards } from './_workspace-selector-cards'

export default async function SelectWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const workspaces = await getUserWorkspaces()
  const { redirect: redirectParam } = await searchParams

  if (workspaces.length === 0) {
    redirect('/onboarding')
  }

  if (workspaces.length === 1 && workspaces[0]) {
    await setActiveWorkspace(workspaces[0].id)
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Välj arbetsplats</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Du är medlem i flera arbetsplatser. Välj vilken du vill arbeta i.
        </p>
      </div>
      <WorkspaceSelectorCards
        workspaces={workspaces}
        redirectTo={redirectParam}
      />
    </div>
  )
}
