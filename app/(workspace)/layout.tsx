import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { WorkspaceShell } from '@/components/layout/workspace-shell'
import {
  getWorkspaceContext,
  getUserWorkspaces,
  setActiveWorkspace,
  ACTIVE_WORKSPACE_COOKIE,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'
import { PausedWorkspaceBanner } from '@/components/features/workspace/paused-workspace-banner'

// Force dynamic rendering for all workspace pages since they require authentication
export const dynamic = 'force-dynamic'

async function getWorkspaceContextSafe() {
  try {
    return await getWorkspaceContext()
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      const headersList = await headers()
      const pathname = headersList.get('x-pathname') || '/'
      const redirectParam = encodeURIComponent(pathname)

      if (error.code === 'NO_WORKSPACE') {
        redirect(`/onboarding?redirect=${redirectParam}`)
      }

      if (error.code === 'WORKSPACE_DELETED') {
        redirect(`/onboarding?state=deleted&redirect=${redirectParam}`)
      }
    }

    // Let UNAUTHORIZED, ACCESS_DENIED, and other errors propagate to error boundary
    throw error
  }
}

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has an active workspace selected
  const cookieStore = await cookies()
  const activeWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value

  if (!activeWorkspaceId) {
    const workspaces = await getUserWorkspaces()

    if (workspaces.length === 1 && workspaces[0]) {
      // Auto-set the only workspace — wrapped in try-catch because
      // cookies().set() may not be supported in Server Component layouts
      try {
        await setActiveWorkspace(workspaces[0].id)
      } catch {
        // Cookie will be set on next Server Action; workspace context
        // resolves via fallback query in getWorkspaceContextInternal
      }
    } else if (workspaces.length > 1) {
      // Multiple workspaces — redirect to selector
      const headersList = await headers()
      const pathname = headersList.get('x-pathname') || '/dashboard'
      redirect(`/select-workspace?redirect=${encodeURIComponent(pathname)}`)
    }
    // 0 workspaces falls through to getWorkspaceContextSafe() → NO_WORKSPACE → /onboarding
  }

  const workspaceContext = await getWorkspaceContextSafe()

  // Handle paused workspace: render shell with warning banner
  if (workspaceContext.workspaceStatus === 'PAUSED') {
    return (
      <>
        <PausedWorkspaceBanner isOwner={workspaceContext.role === 'OWNER'} />
        <WorkspaceShell user={user}>{children}</WorkspaceShell>
      </>
    )
  }

  return <WorkspaceShell user={user}>{children}</WorkspaceShell>
}
