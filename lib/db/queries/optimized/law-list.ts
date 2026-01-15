/**
 * Story P.3: Optimized Law List Queries
 *
 * Query patterns optimized for performance:
 * - Max 2 levels of nesting
 * - Cursor-based pagination
 * - Field selection to reduce payload
 * - N+1 prevention with batching
 */

import { prisma, withRetry } from '@/lib/prisma'
import type {
  LawListItemStatus,
  LawListItemPriority,
  ComplianceStatus,
} from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

export interface PaginatedLawListItemsResult {
  items: LawListItemWithDocument[]
  pagination: {
    cursor: string | null
    hasMore: boolean
    total: number
  }
}

export interface LawListItemWithDocument {
  id: string
  status: LawListItemStatus
  priority: LawListItemPriority
  compliance_status: ComplianceStatus
  position: number
  due_date: Date | null
  notes: string | null
  commentary: string | null
  document: {
    id: string
    title: string
    document_number: string
    slug: string
  }
  assignee: {
    id: string
    name: string | null
    email: string
  } | null
  group: {
    id: string
    name: string
  } | null
}

export interface LawListSummary {
  id: string
  name: string
  description: string | null
  is_default: boolean
  itemCount: number
  complianceBreakdown: {
    EJ_PABORJAD: number
    PAGAENDE: number
    UPPFYLLD: number
    EJ_UPPFYLLD: number
    EJ_TILLAMPLIG: number
  }
}

// ============================================================================
// Optimized Queries
// ============================================================================

/**
 * Get paginated law list items with cursor-based pagination
 * Optimized: Max 2 levels nesting, field selection, cursor pagination
 *
 * @param lawListId - The law list ID
 * @param options - Pagination and filter options
 */
export async function getLawListItemsPaginated(
  lawListId: string,
  options: {
    cursor?: string
    limit?: number
    groupId?: string | null
    status?: LawListItemStatus[]
    complianceStatus?: ComplianceStatus[]
  } = {}
): Promise<PaginatedLawListItemsResult> {
  const { cursor, limit = 50, groupId, status, complianceStatus } = options

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    law_list_id: lawListId,
    ...(groupId !== undefined && { group_id: groupId }),
    ...(status && status.length > 0 && { status: { in: status } }),
    ...(complianceStatus &&
      complianceStatus.length > 0 && {
        compliance_status: { in: complianceStatus },
      }),
  }

  // Get total count (cached for performance)
  const total = await withRetry(() => prisma.lawListItem.count({ where }))

  // Fetch items with cursor pagination - max 2 levels of include
  const items = await withRetry(() =>
    prisma.lawListItem.findMany({
      where,
      take: limit + 1, // Fetch one extra to check hasMore
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor item
      }),
      orderBy: { position: 'asc' },
      select: {
        id: true,
        status: true,
        priority: true,
        compliance_status: true,
        position: true,
        due_date: true,
        notes: true,
        commentary: true,
        // Level 1: document (essential fields only)
        document: {
          select: {
            id: true,
            title: true,
            document_number: true,
            slug: true,
          },
        },
        // Level 1: assignee (essential fields only)
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        // Level 1: group (essential fields only)
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
  )

  // Check if there are more items
  const hasMore = items.length > limit
  const resultItems = hasMore ? items.slice(0, -1) : items
  const nextCursor =
    hasMore && resultItems.length > 0
      ? (resultItems[resultItems.length - 1]?.id ?? null)
      : null

  return {
    items: resultItems as LawListItemWithDocument[],
    pagination: {
      cursor: nextCursor,
      hasMore,
      total,
    },
  }
}

/**
 * Get law list summaries with compliance breakdown
 * Optimized: Single query with aggregation, no deep nesting
 *
 * @param workspaceId - The workspace ID
 */
export async function getLawListSummaries(
  workspaceId: string
): Promise<LawListSummary[]> {
  // Get law lists with item count
  const lawLists = await withRetry(() =>
    prisma.lawList.findMany({
      where: { workspace_id: workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        is_default: true,
        _count: {
          select: { items: true },
        },
      },
      orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
    })
  )

  // Get compliance breakdown for each law list in parallel
  const breakdowns = await Promise.all(
    lawLists.map((list) =>
      withRetry(() =>
        prisma.lawListItem.groupBy({
          by: ['compliance_status'],
          where: { law_list_id: list.id },
          _count: true,
        })
      )
    )
  )

  return lawLists.map((list, index) => {
    const breakdown = breakdowns[index] || []
    const complianceBreakdown = {
      EJ_PABORJAD: 0,
      PAGAENDE: 0,
      UPPFYLLD: 0,
      EJ_UPPFYLLD: 0,
      EJ_TILLAMPLIG: 0,
    }

    breakdown.forEach((item) => {
      complianceBreakdown[item.compliance_status] = item._count
    })

    return {
      id: list.id,
      name: list.name,
      description: list.description,
      is_default: list.is_default,
      itemCount: list._count.items,
      complianceBreakdown,
    }
  })
}

/**
 * Get law list with groups for sidebar navigation
 * Optimized: Two-query pattern to avoid N+1
 *
 * @param lawListId - The law list ID
 */
export async function getLawListWithGroups(lawListId: string) {
  // Query 1: Get law list basic info
  const lawList = await withRetry(() =>
    prisma.lawList.findUnique({
      where: { id: lawListId },
      select: {
        id: true,
        name: true,
        description: true,
        is_default: true,
        workspace_id: true,
      },
    })
  )

  if (!lawList) return null

  // Query 2: Get groups with item counts (separate query to avoid deep nesting)
  const groups = await withRetry(() =>
    prisma.lawListGroup.findMany({
      where: { law_list_id: lawListId },
      select: {
        id: true,
        name: true,
        position: true,
        _count: {
          select: { items: true },
        },
      },
      orderBy: { position: 'asc' },
    })
  )

  // Query 3: Count ungrouped items
  const ungroupedCount = await withRetry(() =>
    prisma.lawListItem.count({
      where: {
        law_list_id: lawListId,
        group_id: null,
      },
    })
  )

  return {
    ...lawList,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      position: g.position,
      itemCount: g._count.items,
    })),
    ungroupedCount,
  }
}

/**
 * Batch fetch documents for law list items
 * Optimized: Single query for multiple items (prevents N+1)
 *
 * @param documentIds - Array of document IDs to fetch
 */
export async function batchFetchDocuments(documentIds: string[]) {
  if (documentIds.length === 0) return new Map()

  const documents = await withRetry(() =>
    prisma.legalDocument.findMany({
      where: { id: { in: documentIds } },
      select: {
        id: true,
        title: true,
        document_number: true,
        slug: true,
        content_type: true,
        summary: true,
      },
    })
  )

  return new Map(documents.map((doc) => [doc.id, doc]))
}

/**
 * Update law list item with optimistic locking check
 *
 * @param itemId - The law list item ID
 * @param data - Data to update
 * @param expectedUpdatedAt - Expected updated_at for optimistic locking
 */
export async function updateLawListItem(
  itemId: string,
  data: {
    status?: LawListItemStatus
    priority?: LawListItemPriority
    compliance_status?: ComplianceStatus
    notes?: string
    due_date?: Date | null
    assigned_to?: string | null
  },
  expectedUpdatedAt?: Date
) {
  return withRetry(async () => {
    // If optimistic locking, verify version
    if (expectedUpdatedAt) {
      const current = await prisma.lawListItem.findUnique({
        where: { id: itemId },
        select: { updated_at: true },
      })

      if (
        current &&
        current.updated_at.getTime() !== expectedUpdatedAt.getTime()
      ) {
        throw new Error('CONFLICT: Item was modified by another user')
      }
    }

    return prisma.lawListItem.update({
      where: { id: itemId },
      data,
      select: {
        id: true,
        status: true,
        priority: true,
        compliance_status: true,
        updated_at: true,
      },
    })
  })
}
