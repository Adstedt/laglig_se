'use server'

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/cache/redis'
import { getCachedDocument } from '@/lib/services/document-cache'

/**
 * Pre-fetch and cache multiple documents in parallel
 * Called when a law list is loaded to warm up the cache
 * SIMPLIFIED: Using only Redis cache, no unstable_cache
 */
export async function prefetchDocuments(documentIds: string[]) {
  // Filter out undefined/null values
  const validDocumentIds = documentIds.filter((id): id is string => !!id)

  if (validDocumentIds.length === 0) {
    return {
      success: true,
      stats: { total: 0, alreadyCached: 0, newlyFetched: 0, failed: 0 },
    }
  }

  try {
    // Fetch all documents in parallel
    const promises = validDocumentIds.map(async (documentId) => {
      // Check if already cached in Redis
      const cacheKey = `document:${documentId}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        return { documentId, cached: true }
      }

      // Fetch and cache using the centralized document cache service
      try {
        const doc = await getCachedDocument(documentId)
        if (doc) {
          return { documentId, cached: false, fetched: true }
        } else {
          return { documentId, error: true }
        }
      } catch {
        return { documentId, error: true }
      }
    })

    const results = await Promise.all(promises)

    const stats = {
      total: validDocumentIds.length,
      alreadyCached: results.filter((r) => r.cached).length,
      newlyFetched: results.filter((r) => r.fetched).length,
      failed: results.filter((r) => r.error).length,
    }

    return { success: true, stats }
  } catch {
    return { success: false, error: 'Failed to pre-fetch documents' }
  }
}

/**
 * Pre-fetch list item details for faster modal opening
 */
export async function prefetchListItemDetails(listItemIds: string[]) {
  // Filter out undefined/null values
  const validListItemIds = listItemIds.filter((id): id is string => !!id)

  if (validListItemIds.length === 0) {
    return { success: true, stats: { total: 0, cached: 0, fetched: 0 } }
  }

  try {
    const promises = validListItemIds.map(async (listItemId) => {
      // Use the SAME cache key that the modal expects!
      const cacheKey = `list-item-details:${listItemId}`

      // Check cache first
      const cached = await redis.get(cacheKey)
      if (cached) {
        return { listItemId, cached: true }
      }

      // Fetch and cache with ALL fields the modal needs
      const item = await prisma.lawListItem.findUnique({
        where: { id: listItemId },
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
              workspace_id: true, // IMPORTANT: Modal needs this for security check!
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

      if (item) {
        // Format the data exactly as the modal expects it
        const cacheData = {
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
        }

        // Cache for 24 hours (same as documents)
        await redis.set(cacheKey, JSON.stringify(cacheData), { ex: 86400 })
        return { listItemId, fetched: true }
      }

      return { listItemId, error: true }
    })

    const results = await Promise.all(promises)

    return {
      success: true,
      stats: {
        total: validListItemIds.length,
        cached: results.filter((r) => r.cached).length,
        fetched: results.filter((r) => r.fetched).length,
      },
    }
  } catch {
    return { success: false }
  }
}
