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
import { Ratelimit } from '@upstash/ratelimit'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'
import { requirePermission } from '@/lib/api/require-permission'
import { prisma } from '@/lib/prisma'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import { sendEmail } from '@/lib/email/email-service'
import { WorkspaceInvitationEmail } from '@/emails/workspace-invitation'
import { ROLE_LABELS } from '@/components/features/settings/role-labels'
import { getAppUrl } from '@/lib/utils/app-url'
import { INVITE_TTL_MS } from '@/lib/constants/invitations'
import {
  assertSeatAvailable,
  SeatLimitExceededError,
  StripeUnavailableError,
} from '@/lib/usage/seats'

// Per-workspace rate limit: 50 invitations / hour. Bounded by the
// members:invite permission but a compromised admin account could still
// spam. Mirrors the pattern in app/api/chat/route.ts.
const inviteRatelimit = isRedisConfigured()
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '1 h'),
      analytics: true,
      prefix: 'ratelimit:invitations:workspace',
    })
  : null

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

  // Per-workspace throttle — returns 429 on exhaustion. Skipped silently
  // when Redis isn't configured (local dev without Upstash creds).
  if (inviteRatelimit) {
    const { success, reset } = await inviteRatelimit.limit(context.workspaceId)
    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
      return NextResponse.json(
        {
          error:
            'Tak för inbjudningar per timme nått. Försök igen om en stund.',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      )
    }
  }

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

  // Story 5.5a: seat enforcement.
  // Counts current members + pending invitations against the tier cap so
  // concurrent invite-creates can't break the cap. The accept path also
  // re-checks for race protection.
  try {
    await assertSeatAvailable(context.workspaceId)
  } catch (error) {
    if (error instanceof SeatLimitExceededError) {
      // Tier-specific upgrade hint. Solo (and untier'd Trial which falls
      // through to Solo limits) → suggest moving to Team. Team workspaces
      // already on the highest self-serve tier → point at extra-seat purchase
      // and Enterprise. Enterprise is unlimited and never reaches this branch.
      const upgradeHint =
        error.tier === 'TEAM'
          ? 'Köp fler platser via faktureringsportalen eller kontakta säljteamet för Enterprise.'
          : 'Uppgradera till Team eller köp en extra plats.'
      return NextResponse.json(
        {
          error: 'Platsgräns uppnådd',
          message: `Din plan tillåter ${error.limit} platser. ${upgradeHint}`,
          code: 'SEAT_LIMIT_REACHED',
          currentSeats: error.currentSeats,
          limit: error.limit,
          tier: error.tier,
        },
        { status: 402 }
      )
    }
    // Story 5.5a SEAT-003: fail-closed on Stripe outage with a clean JSON
    // 503 instead of leaking the underlying StripeError as HTML.
    if (error instanceof StripeUnavailableError) {
      return NextResponse.json(
        {
          error: 'Tillfälligt tekniskt fel',
          message:
            'Det gick inte att verifiera platsbegränsningen just nu. Försök igen om en stund.',
          code: 'STRIPE_UNAVAILABLE',
        },
        { status: 503 }
      )
    }
    throw error
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
