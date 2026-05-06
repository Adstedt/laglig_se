import { getCurrentUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { WorkspaceShell } from '@/components/layout/workspace-shell'
import {
  getWorkspaceContext,
  getWorkspaceContextBypassBillingGates,
  getUserWorkspaces,
  setActiveWorkspace,
  ACTIVE_WORKSPACE_COOKIE,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'
import { PausedWorkspaceBanner } from '@/components/features/workspace/paused-workspace-banner'
import { getImpersonationInfo } from '@/lib/admin/auth'
import { ImpersonationBanner } from '@/components/admin/impersonation-banner'
import { getPublishedTemplates } from '@/lib/db/queries/template-catalog'
import { TrialCountdownBanner } from '@/components/features/billing/trial-countdown-banner'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering for all workspace pages since they require authentication
export const dynamic = 'force-dynamic'

async function getWorkspaceContextSafe() {
  // Story 5.13: when on /settings or /api/billing/*, use the bypass version
  // so the conversion surface itself can render even when the billing gates
  // are active. Other paths use the gated version — assertion helpers call
  // Next.js redirect() directly on a gate hit, so we don't need to catch +
  // re-redirect here.
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || '/'
  if (
    pathname.startsWith('/settings') ||
    pathname.startsWith('/api/billing/')
  ) {
    try {
      return await getWorkspaceContextBypassBillingGates()
    } catch (error) {
      return handleNonBillingErrors(error, pathname)
    }
  }

  try {
    return await getWorkspaceContext()
  } catch (error) {
    return handleNonBillingErrors(error, pathname)
  }
}

function handleNonBillingErrors(error: unknown, pathname: string): never {
  if (error instanceof WorkspaceAccessError) {
    const redirectParam = encodeURIComponent(pathname)

    if (error.code === 'NO_WORKSPACE') {
      redirect(`/onboarding?redirect=${redirectParam}`)
    }

    if (error.code === 'WORKSPACE_DELETED') {
      redirect(`/onboarding?state=deleted&redirect=${redirectParam}`)
    }
  }

  // Let UNAUTHORIZED, ACCESS_DENIED, NEXT_REDIRECT, and other errors
  // propagate to the error boundary / Next.js framework.
  throw error
}

/**
 * Story 5.13: Compute the countdown banner state for the layout.
 * Returns daysLeft only when the workspace is on TRIAL and within the
 * last 2 days (Days 13/14 of a 15-day trial). Otherwise returns null
 * so the banner is omitted entirely (zero render cost for paid workspaces).
 */
async function getTrialCountdownState(
  workspaceId: string
): Promise<{ daysLeft: number } | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      subscription_tier: true,
      trial_ends_at: true,
      stripe_subscription_id: true,
    },
  })

  if (
    !workspace ||
    workspace.subscription_tier !== 'TRIAL' ||
    !workspace.trial_ends_at ||
    workspace.stripe_subscription_id
  ) {
    return null
  }

  const msPerDay = 24 * 60 * 60 * 1000
  const daysLeft = Math.ceil(
    (workspace.trial_ends_at.getTime() - Date.now()) / msPerDay
  )

  // Show only on Day 13 (2 days left) and Day 14 (1 day left). Day 15+ is
  // gated by TRIAL_EXPIRED so the banner would never render anyway.
  if (daysLeft < 1 || daysLeft > 2) return null
  return { daysLeft }
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

  const [workspaceContext, impersonationInfo, publishedTemplates] =
    await Promise.all([
      getWorkspaceContextSafe(),
      getImpersonationInfo(),
      getPublishedTemplates(),
    ])

  // Story 5.13: trial countdown — only fetched + rendered for trial workspaces
  // in the last 2 days. Done after workspaceContext resolves so we have the id.
  const trialCountdown = await getTrialCountdownState(
    workspaceContext.workspaceId
  )

  // Handle paused workspace: render shell with warning banner
  if (workspaceContext.workspaceStatus === 'PAUSED') {
    return (
      <>
        {impersonationInfo && (
          <ImpersonationBanner
            userName={user.name ?? user.email}
            userEmail={impersonationInfo.impersonatedEmail}
            userId={user.id}
          />
        )}
        <PausedWorkspaceBanner isOwner={workspaceContext.role === 'OWNER'} />
        <WorkspaceShell
          user={user}
          role={workspaceContext.role}
          publishedTemplates={publishedTemplates}
        >
          {children}
        </WorkspaceShell>
      </>
    )
  }

  return (
    <>
      {impersonationInfo && (
        <ImpersonationBanner
          userName={user.name ?? user.email}
          userEmail={impersonationInfo.impersonatedEmail}
          userId={user.id}
        />
      )}
      <WorkspaceShell
        user={user}
        role={workspaceContext.role}
        publishedTemplates={publishedTemplates}
      >
        {children}
      </WorkspaceShell>
      {trialCountdown && (
        <TrialCountdownBanner daysLeft={trialCountdown.daysLeft} />
      )}
    </>
  )
}
