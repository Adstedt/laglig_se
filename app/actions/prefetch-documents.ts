'use server'

import { prisma } from '@/lib/prisma'
import { batchGetCacheValues, batchSetCacheValues } from '@/lib/cache/redis'
import { getCachedDocumentsBatched } from '@/lib/services/document-cache'

const LIST_ITEM_CACHE_TTL = 86400 // 24 hours

/**
 * Pre-fetch and cache multiple documents in a batched operation.
 * Uses 1 MGET + 1 findMany + 1 pipeline instead of N individual queries.
 */
export async function prefetchDocuments(documentIds: string[]) {
  const validDocumentIds = documentIds.filter((id): id is string => !!id)

  if (validDocumentIds.length === 0) {
    return {
      success: true,
      stats: { total: 0, alreadyCached: 0, newlyFetched: 0, failed: 0 },
    }
  }

  try {
    // Check what's already cached (1 MGET)
    const cacheKeys = validDocumentIds.map((id) => `document:${id}`)
    const alreadyCached = await batchGetCacheValues(cacheKeys)
    const alreadyCachedCount = alreadyCached.size

    // Fetch all (batched handles dedup, cache check, DB query, and write-back)
    const results = await getCachedDocumentsBatched(validDocumentIds)

    const fetchedCount = results.size - alreadyCachedCount
    const failedCount = validDocumentIds.length - results.size

    return {
      success: true,
      stats: {
        total: validDocumentIds.length,
        alreadyCached: alreadyCachedCount,
        newlyFetched: Math.max(0, fetchedCount),
        failed: Math.max(0, failedCount),
      },
    }
  } catch {
    return { success: false, error: 'Failed to pre-fetch documents' }
  }
}

/**
 * Pre-fetch list item details for faster modal opening.
 * Uses 1 MGET + 1 findMany + 1 pipeline instead of N individual queries.
 */
export async function prefetchListItemDetails(listItemIds: string[]) {
  const validListItemIds = listItemIds.filter((id): id is string => !!id)

  if (validListItemIds.length === 0) {
    return { success: true, stats: { total: 0, cached: 0, fetched: 0 } }
  }

  try {
    // 1. Batch check cache (1 MGET)
    const cacheKeys = validListItemIds.map((id) => `list-item-details:${id}`)
    const cached = await batchGetCacheValues(cacheKeys)

    // Collect missed IDs
    const missedIds: string[] = []
    for (let i = 0; i < validListItemIds.length; i++) {
      if (!cached.has(cacheKeys[i]!)) {
        missedIds.push(validListItemIds[i]!)
      }
    }

    let fetchedCount = 0

    if (missedIds.length > 0) {
      // 2. Single DB query for all misses
      const items = await prisma.lawListItem.findMany({
        where: { id: { in: missedIds } },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              document_number: true,
              summary: true,
              slug: true,
              status: true,
              source_url: true,
              content_type: true,
              effective_date: true,
            },
          },
          law_list: {
            select: {
              id: true,
              name: true,
              workspace_id: true,
            },
          },
          responsible_user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar_url: true,
            },
          },
        },
      })

      // 3. Batch write to cache (1 pipeline)
      const toCache = items.map((item) => ({
        key: `list-item-details:${item.id}`,
        value: {
          id: item.id,
          position: item.position,
          compliance_status: item.compliance_status,
          business_context: item.business_context,
          ai_commentary: item.ai_commentary,
          category: item.category,
          added_at: item.added_at,
          updated_at: item.updated_at,
          due_date: item.due_date,
          document: item.document,
          law_list: item.law_list,
          responsible_user: item.responsible_user,
        },
      }))

      batchSetCacheValues(toCache, LIST_ITEM_CACHE_TTL).catch(() => {})
      fetchedCount = items.length
    }

    return {
      success: true,
      stats: {
        total: validListItemIds.length,
        cached: cached.size,
        fetched: fetchedCount,
      },
    }
  } catch {
    return { success: false }
  }
}
