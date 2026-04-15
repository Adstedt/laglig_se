/**
 * Story 5.3: Invitation accept/decline page.
 *
 * Resolves a WorkspaceInvitation by token and renders the appropriate state:
 *  - Valid + matching session → Accept/Decline UI (client component)
 *  - Valid but no session → "Log in to continue" CTA
 *  - Valid but email mismatch → explain + offer logout
 *  - Expired / accepted / revoked → terminal status message
 *  - Unknown token → 404
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { ROLE_LABELS } from '@/components/features/settings/role-labels'
import { InviteActionsClient } from './invite-actions-client'
import { LogoutAndRetryButton } from './logout-button'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true, slug: true, status: true } },
      inviter: { select: { name: true, email: true } },
    },
  })

  if (!invitation) notFound()

  const session = await getServerSession()
  const sessionEmail = session?.user?.email?.toLowerCase() ?? null
  const inviteEmail = invitation.email.toLowerCase()

  // Terminal states (non-PENDING) — show status and stop.
  if (invitation.status !== 'PENDING') {
    return (
      <InviteLayout>
        <StatusCard
          icon={statusIconFor(invitation.status)}
          title={statusTitleFor(invitation.status)}
          description={statusDescriptionFor(invitation.status)}
          cta={
            invitation.status === 'ACCEPTED' ? (
              <Link href="/dashboard">
                <Button>Gå till Laglig.se</Button>
              </Link>
            ) : null
          }
        />
      </InviteLayout>
    )
  }

  // Expiry check — even PENDING rows may be past expires_at before the
  // daily cleanup cron runs.
  if (invitation.expires_at < new Date()) {
    return (
      <InviteLayout>
        <StatusCard
          icon={<Clock className="h-10 w-10 text-amber-500" />}
          title="Inbjudan har gått ut"
          description="Den här inbjudan är inte längre giltig. Be inbjudaren skicka en ny."
        />
      </InviteLayout>
    )
  }

  // Workspace must still be active.
  if (invitation.workspace.status !== 'ACTIVE') {
    return (
      <InviteLayout>
        <StatusCard
          icon={<AlertCircle className="h-10 w-10 text-destructive" />}
          title="Arbetsplatsen är inte tillgänglig"
          description="Arbetsplatsen har pausats eller tagits bort. Kontakta inbjudaren."
        />
      </InviteLayout>
    )
  }

  const inviterName = invitation.inviter.name ?? invitation.inviter.email
  const roleLabel = ROLE_LABELS[invitation.role]

  // Not logged in → branch on whether the invitee already has an account.
  // Existing account → /login. New user → /signup with the invite token so
  // post-verification routing brings them back here (Story 5.3 Option B).
  if (!sessionEmail) {
    const existingUser = await prisma.user.findUnique({
      where: { email: inviteEmail },
      select: { id: true },
    })
    const callbackUrl = `/invite/${token}`
    const emailParam = encodeURIComponent(invitation.email)

    if (existingUser) {
      const href = `/login?email=${emailParam}&callbackUrl=${encodeURIComponent(callbackUrl)}`
      return (
        <InviteLayout>
          <InvitationHeader
            workspaceName={invitation.workspace.name}
            inviterName={inviterName}
            roleLabel={roleLabel}
            email={invitation.email}
          />
          <div className="mt-6 flex flex-col gap-3">
            <Link href={href}>
              <Button className="w-full">Logga in för att fortsätta</Button>
            </Link>
            <p className="text-center text-xs text-muted-foreground">
              Logga in med <strong>{invitation.email}</strong> för att acceptera
              inbjudan.
            </p>
          </div>
        </InviteLayout>
      )
    }

    // No account yet → route to signup. Signup will wire emailRedirectTo so
    // /auth/verify forwards the login callback to /invite/<token>.
    const signupHref = `/signup?email=${emailParam}&invite=${token}`
    return (
      <InviteLayout>
        <InvitationHeader
          workspaceName={invitation.workspace.name}
          inviterName={inviterName}
          roleLabel={roleLabel}
          email={invitation.email}
        />
        <div className="mt-6 flex flex-col gap-3">
          <Link href={signupHref}>
            <Button className="w-full">Skapa konto för att fortsätta</Button>
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Du har inget konto än. Skapa ett med{' '}
            <strong>{invitation.email}</strong> för att acceptera inbjudan.
          </p>
        </div>
      </InviteLayout>
    )
  }

  // Logged in as a different user.
  if (sessionEmail !== inviteEmail) {
    return (
      <InviteLayout>
        <StatusCard
          icon={<AlertCircle className="h-10 w-10 text-amber-500" />}
          title="Inbjudan tillhör en annan användare"
          description={`Du är inloggad som ${sessionEmail}, men inbjudan är skickad till ${invitation.email}. Logga ut och logga in med rätt konto för att acceptera.`}
          cta={<LogoutAndRetryButton returnTo={`/invite/${token}`} />}
        />
      </InviteLayout>
    )
  }

  // Happy path — render the accept/decline UI.
  return (
    <InviteLayout>
      <InvitationHeader
        workspaceName={invitation.workspace.name}
        inviterName={inviterName}
        roleLabel={roleLabel}
        email={invitation.email}
      />
      <InviteActionsClient
        invitationId={invitation.id}
        workspaceSlug={invitation.workspace.slug}
      />
    </InviteLayout>
  )
}

// ============================================================================
// Local presentational helpers
// ============================================================================

function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        {children}
      </div>
    </main>
  )
}

function InvitationHeader({
  workspaceName,
  inviterName,
  roleLabel,
  email,
}: {
  workspaceName: string
  inviterName: string
  roleLabel: string
  email: string
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <h1 className="mt-4 text-xl font-semibold">
        Du har blivit inbjuden till {workspaceName}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <strong>{inviterName}</strong> har bjudit in dig som{' '}
        <strong>{roleLabel}</strong>.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{email}</p>
    </div>
  )
}

function StatusCard({
  icon,
  title,
  description,
  cta,
}: {
  icon: React.ReactNode
  title: string
  description: string
  cta?: React.ReactNode
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {cta && <div className="mt-6 flex justify-center">{cta}</div>}
    </div>
  )
}

function statusIconFor(status: 'ACCEPTED' | 'EXPIRED' | 'REVOKED' | 'PENDING') {
  switch (status) {
    case 'ACCEPTED':
      return <CheckCircle2 className="h-10 w-10 text-emerald-500" />
    case 'EXPIRED':
      return <Clock className="h-10 w-10 text-amber-500" />
    case 'REVOKED':
      return <XCircle className="h-10 w-10 text-destructive" />
    default:
      return <AlertCircle className="h-10 w-10 text-muted-foreground" />
  }
}

function statusTitleFor(
  status: 'ACCEPTED' | 'EXPIRED' | 'REVOKED' | 'PENDING'
) {
  switch (status) {
    case 'ACCEPTED':
      return 'Inbjudan är redan accepterad'
    case 'EXPIRED':
      return 'Inbjudan har gått ut'
    case 'REVOKED':
      return 'Inbjudan har återkallats'
    default:
      return 'Okänd status'
  }
}

function statusDescriptionFor(
  status: 'ACCEPTED' | 'EXPIRED' | 'REVOKED' | 'PENDING'
) {
  switch (status) {
    case 'ACCEPTED':
      return 'Du har redan gått med i arbetsplatsen.'
    case 'EXPIRED':
      return 'Den här inbjudan är inte längre giltig. Be inbjudaren skicka en ny.'
    case 'REVOKED':
      return 'Den här inbjudan har återkallats av en administratör.'
    default:
      return ''
  }
}
