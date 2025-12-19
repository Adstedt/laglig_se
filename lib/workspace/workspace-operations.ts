/**
 * Story 5.1: Workspace Operations
 * Implements soft-delete, restore, and hard-delete (cleanup) for workspaces.
 * See: docs/stories/in-progress/5.1.workspace-data-model-multi-tenancy.md
 */

import { prisma } from '@/lib/prisma'
import { WorkspaceAccessError } from '@/lib/auth/workspace-context'

/**
 * Soft-delete a workspace by setting status to DELETED and deleted_at timestamp.
 * Only the workspace owner can delete a workspace.
 * RLS policies automatically hide deleted workspace data from queries.
 *
 * @param workspaceId - The workspace to delete
 * @param userId - The user attempting the deletion (must be OWNER)
 * @throws {WorkspaceAccessError} If user is not the owner
 */
export async function softDeleteWorkspace(
  workspaceId: string,
  userId: string
): Promise<void> {
  // Verify user is owner
  const member = await prisma.workspaceMember.findUnique({
    where: {
      user_id_workspace_id: {
        user_id: userId,
        workspace_id: workspaceId,
      },
    },
  })

  if (member?.role !== 'OWNER') {
    throw new WorkspaceAccessError(
      'Only workspace owner can delete workspace',
      'ACCESS_DENIED'
    )
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      status: 'DELETED',
      deleted_at: new Date(),
    },
  })
}

/**
 * Restore a soft-deleted workspace.
 * Only the workspace owner can restore, and only within 30 days of deletion.
 *
 * @param workspaceId - The workspace to restore
 * @param userId - The user attempting the restoration (must be OWNER)
 * @throws {WorkspaceAccessError} If user is not owner or recovery period expired
 */
export async function restoreWorkspace(
  workspaceId: string,
  userId: string
): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        where: { user_id: userId, role: 'OWNER' },
      },
    },
  })

  if (!workspace || workspace.members.length === 0) {
    throw new WorkspaceAccessError(
      'Only workspace owner can restore workspace',
      'ACCESS_DENIED'
    )
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  if (workspace.deleted_at && workspace.deleted_at < thirtyDaysAgo) {
    throw new WorkspaceAccessError(
      'Workspace recovery period expired (30 days)',
      'ACCESS_DENIED'
    )
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      status: 'ACTIVE',
      deleted_at: null,
    },
  })
}

/**
 * Pause a workspace (e.g., for billing suspension).
 * Paused workspaces are visible but limited in functionality.
 *
 * @param workspaceId - The workspace to pause
 * @param userId - The user attempting the pause (must be OWNER)
 */
export async function pauseWorkspace(
  workspaceId: string,
  userId: string
): Promise<void> {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      user_id_workspace_id: {
        user_id: userId,
        workspace_id: workspaceId,
      },
    },
  })

  if (member?.role !== 'OWNER') {
    throw new WorkspaceAccessError(
      'Only workspace owner can pause workspace',
      'ACCESS_DENIED'
    )
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      status: 'PAUSED',
      paused_at: new Date(),
    },
  })
}

/**
 * Resume a paused workspace.
 *
 * @param workspaceId - The workspace to resume
 * @param userId - The user attempting the resume (must be OWNER)
 */
export async function resumeWorkspace(
  workspaceId: string,
  userId: string
): Promise<void> {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      user_id_workspace_id: {
        user_id: userId,
        workspace_id: workspaceId,
      },
    },
  })

  if (member?.role !== 'OWNER') {
    throw new WorkspaceAccessError(
      'Only workspace owner can resume workspace',
      'ACCESS_DENIED'
    )
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      status: 'ACTIVE',
      paused_at: null,
    },
  })
}

/**
 * Hard-delete workspaces that have been soft-deleted for more than 30 days.
 * This is intended to be called by a cron job.
 * Prisma cascade handles related data deletion (company_profile, law_lists, etc.)
 *
 * @returns Number of workspaces deleted
 */
export async function hardDeleteExpiredWorkspaces(): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const expiredWorkspaces = await prisma.workspace.findMany({
    where: {
      status: 'DELETED',
      deleted_at: { lte: thirtyDaysAgo },
    },
  })

  for (const workspace of expiredWorkspaces) {
    // Prisma cascade handles related data deletion
    await prisma.workspace.delete({
      where: { id: workspace.id },
    })
    console.log(
      `[Cron] Hard-deleted workspace: ${workspace.id} (${workspace.name})`
    )
  }

  return expiredWorkspaces.length
}

/**
 * Get workspaces pending deletion (for admin dashboard or user recovery UI).
 */
export async function getDeletedWorkspaces(userId: string) {
  return prisma.workspace.findMany({
    where: {
      status: 'DELETED',
      members: {
        some: {
          user_id: userId,
          role: 'OWNER',
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      deleted_at: true,
    },
  })
}
