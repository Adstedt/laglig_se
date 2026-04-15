/**
 * Story 5.3: Resend a pending workspace invitation.
 *
 * Resets expires_at to now + 7 days and re-sends the invitation email
 * using the existing token. Permission: members:invite.
 */

import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { requirePermission } from '@/lib/api/require-permission'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/email-service'
import { WorkspaceInvitationEmail } from '@/emails/workspace-invitation'
import { ROLE_LABELS } from '@/components/features/settings/role-labels'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://laglig.se'
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission('members:invite')
  if (denied) return denied

  const { id } = await params
  const context = await getWorkspaceContext()

  const invitation = await prisma.workspaceInvitation.findFirst({
    where: {
      id,
      workspace_id: context.workspaceId,
      status: 'PENDING',
    },
  })
  if (!invitation) {
    return NextResponse.json(
      { error: 'Inbjudan hittades inte eller är inte väntande' },
      { status: 404 }
    )
  }

  const inviter = await prisma.user.findUnique({
    where: { id: context.userId },
    select: { name: true, email: true },
  })
  if (!inviter) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const updated = await prisma.workspaceInvitation.update({
    where: { id: invitation.id },
    data: { expires_at: new Date(Date.now() + INVITE_TTL_MS) },
  })

  const appUrl = getAppUrl()
  await sendEmail({
    to: invitation.email,
    subject: `Påminnelse: Inbjudan till ${context.workspaceName} på Laglig.se`,
    from: 'no-reply',
    react: WorkspaceInvitationEmail({
      workspaceName: context.workspaceName,
      inviterName: inviter.name ?? inviter.email,
      roleLabel: ROLE_LABELS[invitation.role],
      acceptUrl: `${appUrl}/invite/${invitation.token}`,
      unsubscribeUrl: `${appUrl}/settings?tab=notifications`,
    }),
  })

  return NextResponse.json({
    success: true,
    expiresAt: updated.expires_at,
  })
}
