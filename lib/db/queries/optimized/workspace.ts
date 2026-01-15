/**
 * Story P.3: Optimized Workspace Queries
 *
 * Query patterns optimized for performance:
 * - Max 2 levels of nesting
 * - Parallel queries where possible
 * - Field selection to reduce payload
 * - Caching-friendly patterns
 */

import { prisma, withRetry } from '@/lib/prisma'
import type { WorkspaceRole, WorkspaceStatus } from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceOverview {
  id: string
  name: string
  slug: string
  status: WorkspaceStatus
  owner: {
    id: string
    name: string | null
    email: string
  }
  memberCount: number
  lawListCount: number
  taskStats: {
    total: number
    open: number
    overdue: number
  }
}

export interface WorkspaceMemberWithRole {
  userId: string
  name: string | null
  email: string
  avatarUrl: string | null
  role: WorkspaceRole
  joinedAt: Date
}

export interface WorkspaceDashboardData {
  workspace: {
    id: string
    name: string
    slug: string
  }
  stats: {
    totalLawItems: number
    compliantItems: number
    pendingItems: number
    overdueItems: number
  }
  recentActivity: Array<{
    id: string
    action: string
    entityType: string
    createdAt: Date
    userName: string | null
  }>
}

// ============================================================================
// Optimized Queries
// ============================================================================

/**
 * Get workspace overview for dashboard
 * Optimized: Parallel queries, minimal nesting
 *
 * @param workspaceId - The workspace ID
 */
export async function getWorkspaceOverview(
  workspaceId: string
): Promise<WorkspaceOverview | null> {
  // Query 1: Basic workspace info with owner
  const workspace = await withRetry(() =>
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
  )

  if (!workspace) return null

  // Queries 2-4: Run in parallel for better performance
  const [memberCount, lawListCount, taskStats] = await Promise.all([
    // Count members
    withRetry(() =>
      prisma.workspaceMember.count({
        where: { workspace_id: workspaceId },
      })
    ),
    // Count law lists
    withRetry(() =>
      prisma.lawList.count({
        where: { workspace_id: workspaceId },
      })
    ),
    // Get task stats (using parallel counts)
    getTaskStatsForWorkspace(workspaceId),
  ])

  return {
    ...workspace,
    memberCount,
    lawListCount,
    taskStats,
  }
}

/**
 * Get task statistics for a workspace
 * Optimized: Parallel count queries
 */
async function getTaskStatsForWorkspace(workspaceId: string) {
  // First get done column IDs
  const doneColumns = await withRetry(() =>
    prisma.taskColumn.findMany({
      where: { workspace_id: workspaceId, is_done: true },
      select: { id: true },
    })
  )
  const doneColumnIds = doneColumns.map((c) => c.id)

  const now = new Date()

  // Run counts in parallel
  const [total, open, overdue] = await Promise.all([
    withRetry(() =>
      prisma.task.count({
        where: { workspace_id: workspaceId },
      })
    ),
    withRetry(() =>
      prisma.task.count({
        where: {
          workspace_id: workspaceId,
          column_id: { notIn: doneColumnIds },
        },
      })
    ),
    withRetry(() =>
      prisma.task.count({
        where: {
          workspace_id: workspaceId,
          column_id: { notIn: doneColumnIds },
          due_date: { lt: now },
        },
      })
    ),
  ])

  return { total, open, overdue }
}

/**
 * Get workspace members with roles
 * Optimized: Single query with select
 *
 * @param workspaceId - The workspace ID
 */
export async function getWorkspaceMembers(
  workspaceId: string
): Promise<WorkspaceMemberWithRole[]> {
  const members = await withRetry(() =>
    prisma.workspaceMember.findMany({
      where: { workspace_id: workspaceId },
      select: {
        user_id: true,
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
      orderBy: { joined_at: 'asc' },
    })
  )

  return members.map((m) => ({
    userId: m.user_id,
    name: m.user.name,
    email: m.user.email,
    avatarUrl: m.user.avatar_url,
    role: m.role,
    joinedAt: m.joined_at,
  }))
}

/**
 * Get workspace dashboard data
 * Optimized: Parallel queries, no deep nesting
 *
 * @param workspaceId - The workspace ID
 */
export async function getWorkspaceDashboardData(
  workspaceId: string
): Promise<WorkspaceDashboardData | null> {
  // Query 1: Basic workspace info
  const workspace = await withRetry(() =>
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    })
  )

  if (!workspace) return null

  // Queries 2-3: Stats and activity in parallel
  const [stats, recentActivity] = await Promise.all([
    getLawListStats(workspaceId),
    getRecentActivity(workspaceId, 10),
  ])

  return {
    workspace,
    stats,
    recentActivity,
  }
}

/**
 * Get law list compliance stats
 * Optimized: Aggregation query
 */
async function getLawListStats(workspaceId: string) {
  const now = new Date()

  // Get all law list IDs for this workspace
  const lawLists = await withRetry(() =>
    prisma.lawList.findMany({
      where: { workspace_id: workspaceId },
      select: { id: true },
    })
  )
  const lawListIds = lawLists.map((l) => l.id)

  if (lawListIds.length === 0) {
    return {
      totalLawItems: 0,
      compliantItems: 0,
      pendingItems: 0,
      overdueItems: 0,
    }
  }

  // Run counts in parallel
  const [totalLawItems, compliantItems, pendingItems, overdueItems] =
    await Promise.all([
      withRetry(() =>
        prisma.lawListItem.count({
          where: { law_list_id: { in: lawListIds } },
        })
      ),
      withRetry(() =>
        prisma.lawListItem.count({
          where: {
            law_list_id: { in: lawListIds },
            compliance_status: 'UPPFYLLD',
          },
        })
      ),
      withRetry(() =>
        prisma.lawListItem.count({
          where: {
            law_list_id: { in: lawListIds },
            compliance_status: { in: ['EJ_PABORJAD', 'PAGAENDE'] },
          },
        })
      ),
      withRetry(() =>
        prisma.lawListItem.count({
          where: {
            law_list_id: { in: lawListIds },
            due_date: { lt: now },
            compliance_status: { notIn: ['UPPFYLLD', 'EJ_TILLAMPLIG'] },
          },
        })
      ),
    ])

  return {
    totalLawItems,
    compliantItems,
    pendingItems,
    overdueItems,
  }
}

/**
 * Get recent activity for workspace
 * Optimized: Limited query with essential fields
 */
async function getRecentActivity(workspaceId: string, limit: number) {
  const activity = await withRetry(() =>
    prisma.activityLog.findMany({
      where: { workspace_id: workspaceId },
      select: {
        id: true,
        action: true,
        entity_type: true,
        created_at: true,
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    })
  )

  return activity.map((a) => ({
    id: a.id,
    action: a.action,
    entityType: a.entity_type,
    createdAt: a.created_at,
    userName: a.user.name,
  }))
}

/**
 * Get workspaces for user with counts
 * Optimized: Single query with aggregations
 *
 * @param userId - The user ID
 */
export async function getUserWorkspaces(userId: string) {
  const memberships = await withRetry(() =>
    prisma.workspaceMember.findMany({
      where: { user_id: userId },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            company_logo: true,
            _count: {
              select: {
                members: true,
                law_lists: true,
              },
            },
          },
        },
      },
      orderBy: {
        workspace: { name: 'asc' },
      },
    })
  )

  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    status: m.workspace.status,
    logo: m.workspace.company_logo,
    role: m.role,
    memberCount: m.workspace._count.members,
    lawListCount: m.workspace._count.law_lists,
  }))
}

/**
 * Check if user has access to workspace
 * Optimized: Existence check only
 *
 * @param userId - The user ID
 * @param workspaceId - The workspace ID
 */
export async function checkWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<{ hasAccess: boolean; role: WorkspaceRole | null }> {
  const membership = await withRetry(() =>
    prisma.workspaceMember.findUnique({
      where: {
        user_id_workspace_id: {
          user_id: userId,
          workspace_id: workspaceId,
        },
      },
      select: { role: true },
    })
  )

  return {
    hasAccess: membership !== null,
    role: membership?.role ?? null,
  }
}
