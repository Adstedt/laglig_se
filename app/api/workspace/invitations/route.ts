/**
 * Story 5.3: Workspace invitations API.
 *
 * - POST  /api/workspace/invitations
 *     Creates a pending WorkspaceInvitation and sends the invite email.
 *     Permission: members:invite.
 *
 * - GET   /api/workspace/invitations
 *     Returns { members, invitations } for the Team settings tab.
 *     Permission: members:invite.
 */

import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { WorkspaceRole } from '@prisma/client'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'
import { requirePermission } from '@/lib/api/require-permission'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/email-service'
import { WorkspaceInvitationEmail } from '@/emails/workspace-invitation'
import { ROLE_LABELS } from '@/components/features/settings/role-labels'
import { getAppUrl } from '@/lib/utils/app-url'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const InviteBodySchema = z.object({
  email: z
    .string()
    .trim()
    .email('Ogiltig e-postadress')
    .transform((v) => v.toLowerCase()),
  role: z.enum([
    WorkspaceRole.ADMIN,
    WorkspaceRole.HR_MANAGER,
    WorkspaceRole.MEMBER,
    WorkspaceRole.AUDITOR,
  ]),
})

function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export async function POST(request: Request) {
  const denied = await requirePermission('members:invite')
  if (denied) return denied

  const context = await getWorkspaceContext()

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ogiltig JSON-body' }, { status: 400 })
  }

  const parsed = InviteBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Ogiltig indata',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }
  const { email, role } = parsed.data

  // Resolve inviter display info for the email
  const inviter = await prisma.user.findUnique({
    where: { id: context.userId },
    select: { name: true, email: true },
  })
  if (!inviter) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Duplicate member check — cheaper path: lookup user by email first
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    const existingMember = await prisma.workspaceMember.findFirst({
      where: { workspace_id: context.workspaceId, user_id: existingUser.id },
    })
    if (existingMember) {
      return NextResponse.json(
        { error: 'Användaren är redan medlem i arbetsplatsen' },
        { status: 400 }
      )
    }
  }

  // Duplicate pending invitation check
  const existingInvitation = await prisma.workspaceInvitation.findFirst({
    where: {
      workspace_id: context.workspaceId,
      email,
      status: 'PENDING',
    },
  })
  if (existingInvitation) {
    return NextResponse.json(
      { error: 'En väntande inbjudan finns redan för denna e-postadress' },
      { status: 400 }
    )
  }

  const token = generateToken()
  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspace_id: context.workspaceId,
      email,
      role,
      token,
      invited_by: context.userId,
      expires_at: new Date(Date.now() + INVITE_TTL_MS),
    },
  })

  const appUrl = getAppUrl()
  // Invitations are auth-critical (token grants workspace access), so they
  // ship from the 'no-reply' sender per FROM_ADDRESSES convention in
  // lib/email/email-service.ts — not 'notifications'.
  await sendEmail({
    to: email,
    subject: `Inbjudan till ${context.workspaceName} på Laglig.se`,
    from: 'no-reply',
    react: WorkspaceInvitationEmail({
      workspaceName: context.workspaceName,
      inviterName: inviter.name ?? inviter.email,
      roleLabel: ROLE_LABELS[role],
      acceptUrl: `${appUrl}/invite/${token}`,
      unsubscribeUrl: `${appUrl}/settings?tab=notifications`,
    }),
  })

  return NextResponse.json({ success: true, id: invitation.id })
}

export async function GET() {
  const denied = await requirePermission('members:invite')
  if (denied) return denied

  try {
    const context = await getWorkspaceContext()

    const [members, invitations] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: { workspace_id: context.workspaceId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatar_url: true,
            },
          },
        },
        orderBy: { joined_at: 'asc' },
      }),
      prisma.workspaceInvitation.findMany({
        where: {
          workspace_id: context.workspaceId,
          status: 'PENDING',
        },
        orderBy: { created_at: 'desc' },
      }),
    ])

    return NextResponse.json({ members, invitations })
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === 'UNAUTHORIZED' ? 401 : 403 }
      )
    }
    throw error
  }
}
