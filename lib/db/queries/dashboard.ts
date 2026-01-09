/**
 * Story 6.1: Dashboard Data Fetching Functions
 * Server-side queries for dashboard widgets with graceful error handling
 *
 * Uses unstable_cache for time-based caching (30s) to reduce database load.
 * See docs/architecture/21-caching-strategy.md for caching patterns.
 */

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { startOfWeek, endOfWeek } from 'date-fns'

/**
 * Get compliance statistics for the workspace
 * Story 6.2: Uses compliance_status (Efterlevnad) field, not legacy status
 */
export async function getComplianceStats(workspaceId: string) {
  const items = await prisma.lawListItem.findMany({
    where: {
      law_list: { workspace_id: workspaceId },
    },
    select: {
      compliance_status: true,
    },
  })

  const total = items.length
  const compliant = items.filter(
    (item) => item.compliance_status === 'UPPFYLLD'
  ).length

  return { total, compliant }
}

/**
 * Get task counts for dashboard summary cards
 * Returns null if Task table doesn't exist or there's a query error
 */
export async function getTaskCounts(
  workspaceId: string,
  userId: string
): Promise<{ overdue: number; thisWeek: number; myTasks: number } | null> {
  try {
    // Check if task model exists in Prisma client (Epic 6 dependency)
    if (!prisma.task) {
      return null
    }

    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

    const [overdue, thisWeek, myTasks] = await Promise.all([
      // Overdue: due_date < now AND not in a done column
      prisma.task.count({
        where: {
          workspace_id: workspaceId,
          due_date: { lt: now },
          column: { is_done: false },
        },
      }),
      // This week: due_date within current week
      prisma.task.count({
        where: {
          workspace_id: workspaceId,
          due_date: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      }),
      // My tasks: assigned to current user
      prisma.task.count({
        where: {
          workspace_id: workspaceId,
          assignee_id: userId,
        },
      }),
    ])

    return { overdue, thisWeek, myTasks }
  } catch (error) {
    // Check if table doesn't exist (P2021) or other Prisma errors
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2021'
    ) {
      return null
    }
    // For other errors, return null to show placeholder
    console.error('Error fetching task counts:', error)
    return null
  }
}

/**
 * Get recent activity for the workspace
 * Returns null if ActivityLog table doesn't exist
 */
export async function getRecentActivity(workspaceId: string) {
  try {
    // Check if activityLog model exists in Prisma client (Epic 6 dependency)
    if (!prisma.activityLog) {
      return null
    }

    const activities = await prisma.activityLog.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        entity_type: true,
        created_at: true,
        user: {
          select: {
            name: true,
            avatar_url: true,
          },
        },
      },
    })

    return activities
  } catch (error) {
    // Check if table doesn't exist
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2021'
    ) {
      return null
    }
    console.error('Error fetching recent activity:', error)
    return null
  }
}

/**
 * Get top 5 lists for the workspace with compliance summary
 * Story 6.2: Uses compliance_status (Efterlevnad) field, not legacy status
 */
export async function getTopLists(workspaceId: string) {
  const lists = await prisma.lawList.findMany({
    where: { workspace_id: workspaceId },
    take: 5,
    orderBy: { updated_at: 'desc' },
    select: {
      id: true,
      name: true,
      items: {
        select: {
          compliance_status: true,
        },
      },
    },
  })

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    totalCount: list.items.length,
    compliantCount: list.items.filter(
      (item) => item.compliance_status === 'UPPFYLLD'
    ).length,
  }))
}

/**
 * Fetch all dashboard data in parallel (internal, uncached)
 */
async function fetchDashboardData(workspaceId: string, userId: string) {
  const [complianceStats, taskCounts, recentActivity, topLists] =
    await Promise.all([
      getComplianceStats(workspaceId),
      getTaskCounts(workspaceId, userId),
      getRecentActivity(workspaceId),
      getTopLists(workspaceId),
    ])

  return {
    complianceStats,
    taskCounts,
    recentActivity,
    topLists,
  }
}

/**
 * Fetch all dashboard data with 30-second caching.
 * Cache is keyed by workspaceId and userId to ensure user-specific data.
 * Use revalidateTag('dashboard') to invalidate after mutations.
 */
export const getDashboardData = (workspaceId: string, userId: string) =>
  unstable_cache(
    () => fetchDashboardData(workspaceId, userId),
    ['dashboard-data', workspaceId, userId],
    {
      revalidate: 30, // Cache for 30 seconds
      tags: ['dashboard', `workspace-${workspaceId}`],
    }
  )()
