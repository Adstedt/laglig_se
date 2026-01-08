/**
 * Story 6.2: List Item Data Fetching Functions
 * Server-side queries for task progress and last activity with graceful error handling
 */

import { prisma } from '@/lib/prisma'

// ============================================================================
// Types
// ============================================================================

export interface TaskProgress {
  completed: number
  total: number
}

export interface LastActivity {
  action: string
  timestamp: Date
  userName: string | null
}

// ============================================================================
// Single Item Queries
// ============================================================================

/**
 * Get task progress for a single list item
 * Returns null if Task model doesn't exist
 */
export async function getTaskProgress(
  listItemId: string
): Promise<TaskProgress | null> {
  try {
    // Check if task model exists in Prisma client (Epic 6 dependency)
    if (!prisma.task) {
      return null
    }

    const [completed, total] = await Promise.all([
      prisma.task.count({
        where: {
          list_item_links: { some: { law_list_item_id: listItemId } },
          column: { is_done: true },
        },
      }),
      prisma.task.count({
        where: {
          list_item_links: { some: { law_list_item_id: listItemId } },
        },
      }),
    ])

    return { completed, total }
  } catch (error) {
    // Check if table doesn't exist (P2021)
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2021'
    ) {
      return null
    }
    console.error('Error fetching task progress:', error)
    return null
  }
}

/**
 * Get last activity for a single list item
 * Returns null if ActivityLog model doesn't exist
 */
export async function getLastActivity(
  listItemId: string
): Promise<LastActivity | null> {
  try {
    // Check if activityLog model exists in Prisma client (Epic 6 dependency)
    if (!prisma.activityLog) {
      return null
    }

    const activity = await prisma.activityLog.findFirst({
      where: {
        entity_type: 'list_item',
        entity_id: listItemId,
      },
      orderBy: { created_at: 'desc' },
      select: {
        action: true,
        created_at: true,
        user: {
          select: { name: true },
        },
      },
    })

    if (!activity) return null

    return {
      action: activity.action,
      timestamp: activity.created_at,
      userName: activity.user?.name ?? null,
    }
  } catch (error) {
    // Check if table doesn't exist (P2021)
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2021'
    ) {
      return null
    }
    console.error('Error fetching last activity:', error)
    return null
  }
}

// ============================================================================
// Batch Queries (Performance Optimization)
// ============================================================================

/**
 * Get task progress for multiple list items in a single query
 * Returns a Map for O(1) lookups
 */
export async function getBatchTaskProgress(
  listItemIds: string[]
): Promise<Map<string, TaskProgress>> {
  const result = new Map<string, TaskProgress>()

  if (listItemIds.length === 0) return result

  try {
    // Check if task model exists in Prisma client (Epic 6 dependency)
    if (!prisma.task) {
      return result
    }

    // Get all task links with their completion status
    const taskLinks = await prisma.taskListItemLink.findMany({
      where: {
        law_list_item_id: { in: listItemIds },
      },
      select: {
        law_list_item_id: true,
        task: {
          select: {
            column: {
              select: { is_done: true },
            },
          },
        },
      },
    })

    // Aggregate by list item
    const countMap = new Map<string, { completed: number; total: number }>()

    for (const link of taskLinks) {
      const itemId = link.law_list_item_id
      if (!countMap.has(itemId)) {
        countMap.set(itemId, { completed: 0, total: 0 })
      }
      const counts = countMap.get(itemId)!
      counts.total++
      if (link.task?.column?.is_done) {
        counts.completed++
      }
    }

    // Fill result map
    for (const itemId of listItemIds) {
      const counts = countMap.get(itemId)
      result.set(itemId, counts ?? { completed: 0, total: 0 })
    }

    return result
  } catch (error) {
    // Check if table doesn't exist (P2021)
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2021'
    ) {
      return result
    }
    console.error('Error fetching batch task progress:', error)
    return result
  }
}

/**
 * Get last activity for multiple list items in a single query
 * Returns a Map for O(1) lookups
 */
export async function getBatchLastActivity(
  listItemIds: string[]
): Promise<Map<string, LastActivity>> {
  const result = new Map<string, LastActivity>()

  if (listItemIds.length === 0) return result

  try {
    // Check if activityLog model exists in Prisma client (Epic 6 dependency)
    if (!prisma.activityLog) {
      return result
    }

    // Get most recent activity for each list item
    // Using a raw query for performance with DISTINCT ON
    const activities = await prisma.activityLog.findMany({
      where: {
        entity_type: 'list_item',
        entity_id: { in: listItemIds },
      },
      orderBy: [{ entity_id: 'asc' }, { created_at: 'desc' }],
      select: {
        entity_id: true,
        action: true,
        created_at: true,
        user: {
          select: { name: true },
        },
      },
    })

    // Group by entity_id and take the first (most recent) for each
    const seenIds = new Set<string>()
    for (const activity of activities) {
      if (activity.entity_id && !seenIds.has(activity.entity_id)) {
        seenIds.add(activity.entity_id)
        result.set(activity.entity_id, {
          action: activity.action,
          timestamp: activity.created_at,
          userName: activity.user?.name ?? null,
        })
      }
    }

    return result
  } catch (error) {
    // Check if table doesn't exist (P2021)
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2021'
    ) {
      return result
    }
    console.error('Error fetching batch last activity:', error)
    return result
  }
}

/**
 * Fetch all list item supplementary data in parallel for a batch of items
 * Used by DocumentListTable for performance optimization
 */
export async function getListItemsSupplementaryData(listItemIds: string[]) {
  const [taskProgress, lastActivity] = await Promise.all([
    getBatchTaskProgress(listItemIds),
    getBatchLastActivity(listItemIds),
  ])

  return {
    taskProgress,
    lastActivity,
  }
}
