'use server'

/**
 * Story 10.3: Invitation Server Actions
 * Server actions for workspace invitation acceptance flow.
 */

import { revalidatePath, updateTag } from 'next/cache'
import type { WorkspaceInvitation, WorkspaceStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import { getServerSession } from '@/lib/auth/session'
import { setActiveWorkspace } from '@/lib/auth/workspace-context'
import {
  invalidateUserCache,
  invalidateWorkspaceCache,
} from '@/lib/cache/workspace-cache'

// ============================================================================
// Types
// ============================================================================

export type InvitationWithDetails = WorkspaceInvitation & {
  workspace: { id: string; name: string; status: WorkspaceStatus }
  inviter: { id: string; name: string | null; email: string }
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get pending, non-expired invitations for a given email.
 * Marks expired invitations as EXPIRED. Deduplicates by workspace_id (latest only).
 * Auto-accepts invitations where user is already a workspace member.
 */
export async function getPendingInvitations(
  email: string
): Promise<InvitationWithDetails[]> {
  const session = await getServerSession()
  if (!session?.user?.email || session.user.email !== email) {
    return []
  }

  try {
    // Bulk-mark expired invitations
    await prisma.workspaceInvitation.updateMany({
      where: {
        email,
        status: 'PENDING',
        expires_at: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    })

    // Fetch pending, non-expired invitations for ACTIVE workspaces only
    const invitations = await prisma.workspaceInvitation.findMany({
      where: {
        email,
        status: 'PENDING',
        expires_at: { gt: new Date() },
        workspace: { status: 'ACTIVE' },
      },
      include: {
        workspace: { select: { id: true, name: true, status: true } },
        inviter: { select: { id: true, name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    // Check if user is already a member of any invited workspaces
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (user) {
      const existingMemberships = await prisma.workspaceMember.findMany({
        where: {
          user_id: user.id,
          workspace_id: {
            in: invitations.map((inv) => inv.workspace_id),
          },
        },
        select: { workspace_id: true },
      })

      const memberWorkspaceIds = new Set(
        existingMemberships.map((m) => m.workspace_id)
      )

      if (memberWorkspaceIds.size > 0) {
        // Auto-accept invitations for workspaces the user already belongs to
        await prisma.workspaceInvitation.updateMany({
          where: {
            email,
            status: 'PENDING',
            workspace_id: { in: Array.from(memberWorkspaceIds) },
          },
          data: { status: 'ACCEPTED' },
        })
      }

      // Filter out auto-accepted and only keep non-member invitations
      const remaining = invitations.filter(
        (inv) => !memberWorkspaceIds.has(inv.workspace_id)
      )

      // Deduplicate by workspace_id — keep latest (already ordered by created_at desc)
      return deduplicateByWorkspace(remaining)
    }

    // User not found in DB yet — return deduplicated invitations
    return deduplicateByWorkspace(invitations)
  } catch (error) {
    console.error('Error fetching pending invitations:', error)
    return []
  }
}

/**
 * Accept a pending invitation.
 * Creates WorkspaceMember, updates invitation status, sets active workspace, invalidates cache.
 */
export async function acceptInvitation(invitationId: string): Promise<{
  success: boolean
  error?: string | undefined
  workspaceId?: string | undefined
}> {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return { success: false, error: 'Du måste vara inloggad' }
    }

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
      include: {
        workspace: { select: { id: true, status: true } },
      },
    })

    if (!invitation) {
      return { success: false, error: 'Inbjudan hittades inte' }
    }

    if (invitation.email !== session.user.email) {
      return { success: false, error: 'Inbjudan tillhör en annan användare' }
    }

    if (invitation.status !== 'PENDING') {
      return { success: false, error: 'Inbjudan är inte längre giltig' }
    }

    if (invitation.expires_at < new Date()) {
      await prisma.workspaceInvitation.update({
        where: { id: invitationId },
        data: { status: 'EXPIRED' },
      })
      return { success: false, error: 'Inbjudan har gått ut' }
    }

    if (invitation.workspace.status !== 'ACTIVE') {
      return { success: false, error: 'Workspace är inte längre aktivt' }
    }

    // Look up Prisma user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return { success: false, error: 'Användare hittades inte' }
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        user_id: user.id,
        workspace_id: invitation.workspace_id,
      },
    })

    if (existingMember) {
      // Already a member — silently accept the invitation
      await prisma.workspaceInvitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED' },
      })
      return {
        success: false,
        error: 'Du är redan medlem i denna workspace',
      }
    }

    // Create member and update invitation in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.workspaceMember.create({
        data: {
          user_id: user.id,
          workspace_id: invitation.workspace_id,
          role: invitation.role,
          invited_by: invitation.invited_by,
          invited_at: invitation.created_at,
        },
      })

      await tx.workspaceInvitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED' },
      })
    })

    // Set active workspace cookie
    await setActiveWorkspace(invitation.workspace_id)

    // ------------------------------------------------------------------
    // Cache invalidation — Story 5.3 follow-up.
    //
    // Three separate cache layers have to be cleared or the Settings page
    // keeps serving stale member lists after an accept:
    //
    //   1. Next.js `unstable_cache` tags used by app/(workspace)/settings/page.tsx
    //      — cleared by updateTag (Next.js 16 server-action API with
    //      read-your-own-writes). revalidatePath alone does NOT clear
    //      tag-based caches.
    //   2. Redis workspace-members cache (`workspace:members:{id}`) and
    //      the per-user workspace-context cache.
    //   3. `auth:context:{email}:{workspaceId}` keys that getWorkspaceContext
    //      actually reads — different namespace from what invalidateUserCache
    //      clears, so we delete them explicitly for the joining user's email.
    // ------------------------------------------------------------------

    updateTag('workspace-members')
    updateTag(`workspace-${invitation.workspace_id}`)
    revalidatePath('/settings')
    revalidatePath('/')

    await Promise.all([
      invalidateUserCache(user.id, ['context']),
      invalidateWorkspaceCache(invitation.workspace_id, ['members', 'context']),
    ])

    if (isRedisConfigured()) {
      // Upstash Redis `del` is variadic; passing both keys in a single call
      // satisfies its "at least 2 args" type signature.
      await redis.del(
        `auth:context:${session.user.email}:${invitation.workspace_id}`,
        `auth:context:${session.user.email}:default`
      )
    }

    return { success: true, workspaceId: invitation.workspace_id }
  } catch (error) {
    console.error('Error accepting invitation:', error)
    return { success: false, error: 'Något gick fel. Försök igen.' }
  }
}

/**
 * Story 5.3 follow-up: Lightweight, unauthenticated invitation preview for
 * the signup form. Given a token (which is itself the auth), returns just
 * enough metadata to render the "you're signing up to join {workspace}"
 * badge. Returns null for missing / non-PENDING / expired / inactive-
 * workspace tokens so the caller can silently hide the badge in those
 * cases without leaking whether the token exists.
 */
export async function getInvitationPreview(token: string): Promise<{
  workspaceName: string
  role: string
  email: string
} | null> {
  if (!token) return null
  try {
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      select: {
        status: true,
        expires_at: true,
        email: true,
        role: true,
        workspace: { select: { name: true, status: true } },
      },
    })

    if (!invitation) return null
    if (invitation.status !== 'PENDING') return null
    if (invitation.expires_at < new Date()) return null
    if (invitation.workspace.status !== 'ACTIVE') return null

    return {
      workspaceName: invitation.workspace.name,
      role: invitation.role,
      email: invitation.email,
    }
  } catch {
    return null
  }
}

/**
 * Decline a pending invitation by marking it as REVOKED.
 */
export async function declineInvitation(invitationId: string): Promise<{
  success: boolean
  error?: string | undefined
}> {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return { success: false, error: 'Du måste vara inloggad' }
    }

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    })

    if (!invitation) {
      return { success: false, error: 'Inbjudan hittades inte' }
    }

    if (invitation.email !== session.user.email) {
      return { success: false, error: 'Inbjudan tillhör en annan användare' }
    }

    if (invitation.status !== 'PENDING') {
      return { success: false, error: 'Inbjudan är inte längre giltig' }
    }

    await prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    })

    return { success: true }
  } catch (error) {
    console.error('Error declining invitation:', error)
    return { success: false, error: 'Något gick fel. Försök igen.' }
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Deduplicate invitations by workspace_id, keeping the most recent one.
 * Assumes input is already sorted by created_at desc.
 */
function deduplicateByWorkspace(
  invitations: InvitationWithDetails[]
): InvitationWithDetails[] {
  const seen = new Set<string>()
  const result: InvitationWithDetails[] = []

  for (const inv of invitations) {
    if (!seen.has(inv.workspace_id)) {
      seen.add(inv.workspace_id)
      result.push(inv)
    }
  }

  return result
}
