'use server'

/**
 * Story 6.10: Workspace Activity Log
 * Global activity feed with filters and cursor-based pagination.
 *
 * Read-side enrichment (activity log revamp): after the cursor page is
 * sliced, resolve referenced entities (one findMany per model) and attach
 * category + primary/secondary refs so the UI can render one human sentence
 * per row with deep links. Write path is unchanged.
 */

import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { resolveEntityNames } from '@/lib/activity/entity-resolver'
import {
  categoryForAction,
  actionsForCategory,
} from '@/lib/activity/categories'
import type { ActivityCategory, ResolvedEntityRef } from '@/lib/activity/types'

interface ActivityFilters {
  userId?: string | undefined
  action?: string[] | undefined
  entityType?: string[] | undefined
  category?: ActivityCategory[] | undefined
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
  category: ActivityCategory
  primary: ResolvedEntityRef
  secondary?: ResolvedEntityRef
}

export async function getWorkspaceActivity(
  filters: ActivityFilters = {},
  cursor?: string,
  limit = 50
) {
  return await withWorkspace(async ({ workspaceId }) => {
    const where: Record<string, unknown> = { workspace_id: workspaceId }

    if (filters.userId) where.user_id = filters.userId
    if (filters.entityType?.length)
      where.entity_type = { in: filters.entityType }
    if (filters.startDate || filters.endDate) {
      const createdAt: Record<string, Date> = {}
      if (filters.startDate) createdAt.gte = new Date(filters.startDate)
      if (filters.endDate) createdAt.lte = new Date(filters.endDate)
      where.created_at = createdAt
    }

    // Category filter expands to the union of action strings in that category.
    // An explicit `action` filter wins — it's narrower and typically programmatic.
    const categoryActions = filters.category?.length
      ? filters.category.flatMap((c) => actionsForCategory(c))
      : []
    const explicitActions = filters.action ?? []
    if (explicitActions.length > 0) {
      where.action = { in: explicitActions }
    } else if (categoryActions.length > 0) {
      where.action = { in: categoryActions }
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

    // Enrich: resolve entity names (batched) and attach category.
    const resolved = await resolveEntityNames(items, workspaceId)
    const enriched: WorkspaceActivityEntry[] = items.map((a) => {
      const refs = resolved.get(a.id)
      const primary = refs?.primary ?? {
        id: a.entity_id,
        label: `[${a.entity_type}]`,
        href: null,
        deleted: false,
      }
      return {
        ...a,
        category: categoryForAction(a.action),
        primary,
        ...(refs?.secondary ? { secondary: refs.secondary } : {}),
      }
    })

    return {
      success: true,
      data: {
        activities: enriched,
        nextCursor,
      },
    }
  })
}
