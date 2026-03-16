'use server'

/**
 * Story 6.10: Workspace Activity Log
 * Global activity feed with filters and cursor-based pagination
 */

import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'

interface ActivityFilters {
  userId?: string | undefined
  action?: string[] | undefined
  entityType?: string[] | undefined
  startDate?: string | undefined
  endDate?: string | undefined
}

export type WorkspaceActivityEntry = {
  id: string
  action: string
  entity_type: string
  entity_id: string
  old_value: unknown
  new_value: unknown
  created_at: Date
  user: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
}

export async function getWorkspaceActivity(
  filters: ActivityFilters = {},
  cursor?: string,
  limit = 50
) {
  return await withWorkspace(async ({ workspaceId }) => {
    const where: Record<string, unknown> = { workspace_id: workspaceId }

    if (filters.userId) where.user_id = filters.userId
    if (filters.action?.length) where.action = { in: filters.action }
    if (filters.entityType?.length)
      where.entity_type = { in: filters.entityType }
    if (filters.startDate || filters.endDate) {
      const createdAt: Record<string, Date> = {}
      if (filters.startDate) createdAt.gte = new Date(filters.startDate)
      if (filters.endDate) createdAt.lte = new Date(filters.endDate)
      where.created_at = createdAt
    }

    const activities = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar_url: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = activities.length > limit
    const items = hasMore ? activities.slice(0, limit) : activities
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

    return {
      success: true,
      data: {
        activities: items as WorkspaceActivityEntry[],
        nextCursor,
      },
    }
  })
}
