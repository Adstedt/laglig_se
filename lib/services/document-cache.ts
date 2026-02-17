/**
 * Centralized Document Caching Service
 *
 * This service provides a unified caching layer for legal document HTML content.
 * Any part of the application that needs document HTML should use this service
 * to benefit from shared caching across all access patterns.
 *
 * Benefits:
 * - Single cache entry per document (not per view/user)
 * - Shared across public browsing, user lists, search, etc.
 * - 24-hour TTL for stable content
 * - Automatic cache warming for popular documents
 */

import { prisma } from '@/lib/prisma'
import {
  getCachedOrFetch,
  redis,
  batchGetCacheValues,
  batchSetCacheValues,
} from '@/lib/cache/redis'

const DOCUMENT_CACHE_TTL = 86400 // 24 hours

export interface CachedDocument {
  id: string
  documentNumber: string
  title: string
  htmlContent: string | null // The main content for rendering
  summary: string | null // For snippets/previews
  slug: string
  status: string
  sourceUrl: string | null
  contentType: string
  effectiveDate: Date | null // Publication date
  inForceDate: Date | null // When law becomes active
  category: string | null // Subject category
  // Court case specific fields
  courtName: string | null
  caseNumber: string | null
  caseName: string | null
  caseType: string | null
  isGuiding: boolean | null // Prejudikat
  // Full text for search/AI processing (optional)
  fullText: string | null
}

/**
 * Get document content from cache or database
 * This is THE central function for getting document HTML
 */
export async function getCachedDocument(
  documentId: string
): Promise<CachedDocument | null> {
  const cacheKey = `document:${documentId}`

  const result = await getCachedOrFetch(
    cacheKey,
    async () => {
      // Fetch from database with fields that actually exist
      const doc = await prisma.legalDocument.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          document_number: true,
          title: true,
          html_content: true, // Main content for rendering
          summary: true, // For snippets
          slug: true,
          status: true,
          source_url: true,
          content_type: true,
          effective_date: true,
          publication_date: true,
          metadata: true, // Contains category and other fields
          // Include court case relation if exists
          court_case: {
            select: {
              court_name: true,
              case_number: true,
              lower_court: true,
              decision_date: true,
              parties: true,
            },
          },
        },
      })

      if (!doc) return null

      // Transform to consistent format
      // Extract metadata fields if they exist
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metadata = (doc.metadata as any) || {}

      return {
        id: doc.id,
        documentNumber: doc.document_number,
        title: doc.title,
        htmlContent: doc.html_content,
        summary: doc.summary,
        slug: doc.slug,
        status: doc.status,
        sourceUrl: doc.source_url,
        contentType: doc.content_type,
        effectiveDate: doc.effective_date,
        inForceDate: metadata.in_force_date || doc.effective_date, // Use effective_date as fallback
        category: metadata.category || null,
        // Court case fields (from relation)
        courtName: doc.court_case?.court_name || null,
        caseNumber: doc.court_case?.case_number || null,
        caseName: metadata.case_name || null, // Might be in metadata
        caseType: metadata.case_type || null,
        isGuiding: metadata.is_guiding || false,
        fullText: null, // Not cached to save space
      }
    },
    DOCUMENT_CACHE_TTL
  )

  return result.data
}

/**
 * Get document by slug (for public browsing)
 */
export async function getCachedDocumentBySlug(
  slug: string
): Promise<CachedDocument | null> {
  // First check if we have a cached mapping from slug to ID
  const slugCacheKey = `document:slug:${slug}`

  try {
    const cachedId = await redis.get(slugCacheKey)
    if (cachedId) {
      const documentId =
        typeof cachedId === 'string' ? cachedId : String(cachedId)
      return getCachedDocument(documentId)
    }
  } catch {
    // Redis read error - continue to database
  }

  // No cached mapping, fetch from database
  const doc = await prisma.legalDocument.findFirst({
    where: { slug },
    select: { id: true },
  })

  if (!doc) return null

  // Cache the slug->id mapping for 24 hours
  try {
    await redis.set(slugCacheKey, doc.id, { ex: DOCUMENT_CACHE_TTL })
  } catch {
    // Redis write error - continue without caching
  }

  // Now get the full document (which will cache it)
  return getCachedDocument(doc.id)
}

/**
 * Get document by document number (e.g., "SFS 1977:1160")
 */
export async function getCachedDocumentByNumber(
  documentNumber: string
): Promise<CachedDocument | null> {
  // Check cached mapping
  const numberCacheKey = `document:number:${documentNumber}`

  const cachedId = await redis.get(numberCacheKey)
  if (cachedId) {
    const documentId =
      typeof cachedId === 'string' ? cachedId : String(cachedId)
    return getCachedDocument(documentId)
  }

  // No cached mapping, fetch from database
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: documentNumber },
    select: { id: true },
  })

  if (!doc) return null

  // Cache the number->id mapping
  await redis.set(numberCacheKey, doc.id, { ex: DOCUMENT_CACHE_TTL })

  return getCachedDocument(doc.id)
}

/**
 * Batch get multiple documents (efficient for lists)
 * @deprecated Use getCachedDocumentsBatched for better performance
 */
export async function getCachedDocuments(
  documentIds: string[]
): Promise<Map<string, CachedDocument>> {
  return getCachedDocumentsBatched(documentIds)
}

/**
 * Batch get multiple documents using MGET + findMany instead of N individual queries.
 * 1 mget → 1 findMany (misses only) → 1 pipeline set
 */
export async function getCachedDocumentsBatched(
  documentIds: string[]
): Promise<Map<string, CachedDocument>> {
  const uniqueIds = [...new Set(documentIds.filter(Boolean))]
  const results = new Map<string, CachedDocument>()
  if (uniqueIds.length === 0) return results

  // 1. Batch check cache
  const cacheKeys = uniqueIds.map((id) => `document:${id}`)
  const cached = await batchGetCacheValues<CachedDocument>(cacheKeys)

  // Collect hits
  const missedIds: string[] = []
  for (let i = 0; i < uniqueIds.length; i++) {
    const hit = cached.get(cacheKeys[i]!)
    if (hit) {
      results.set(uniqueIds[i]!, hit)
    } else {
      missedIds.push(uniqueIds[i]!)
    }
  }

  if (missedIds.length === 0) return results

  // 2. Single DB query for all misses
  const docs = await prisma.legalDocument.findMany({
    where: { id: { in: missedIds } },
    select: {
      id: true,
      document_number: true,
      title: true,
      html_content: true,
      summary: true,
      slug: true,
      status: true,
      source_url: true,
      content_type: true,
      effective_date: true,
      publication_date: true,
      metadata: true,
      court_case: {
        select: {
          court_name: true,
          case_number: true,
          lower_court: true,
          decision_date: true,
          parties: true,
        },
      },
    },
  })

  // 3. Transform and collect for cache write
  const toCache: { key: string; value: CachedDocument }[] = []
  for (const doc of docs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (doc.metadata as any) || {}
    const cached: CachedDocument = {
      id: doc.id,
      documentNumber: doc.document_number,
      title: doc.title,
      htmlContent: doc.html_content,
      summary: doc.summary,
      slug: doc.slug,
      status: doc.status,
      sourceUrl: doc.source_url,
      contentType: doc.content_type,
      effectiveDate: doc.effective_date,
      inForceDate: metadata.in_force_date || doc.effective_date,
      category: metadata.category || null,
      courtName: doc.court_case?.court_name || null,
      caseNumber: doc.court_case?.case_number || null,
      caseName: metadata.case_name || null,
      caseType: metadata.case_type || null,
      isGuiding: metadata.is_guiding || false,
      fullText: null,
    }
    results.set(doc.id, cached)
    toCache.push({ key: `document:${doc.id}`, value: cached })
  }

  // 4. Fire-and-forget cache write
  batchSetCacheValues(toCache, DOCUMENT_CACHE_TTL).catch(() => {})

  return results
}

/**
 * Warm cache for template documents in batches of 20.
 * Used fire-and-forget after adoption and by the cron job.
 */
export async function warmTemplateDocuments(
  documentIds: string[]
): Promise<{ warmed: number; alreadyCached: number; failed: number }> {
  const uniqueIds = [...new Set(documentIds.filter(Boolean))]
  let warmed = 0
  let alreadyCached = 0
  let failed = 0
  const batchSize = 20

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize)
    try {
      const before = new Set(
        (
          await batchGetCacheValues<CachedDocument>(
            batch.map((id) => `document:${id}`)
          )
        ).keys()
      )
      const results = await getCachedDocumentsBatched(batch)
      for (const id of batch) {
        if (before.has(`document:${id}`)) {
          alreadyCached++
        } else if (results.has(id)) {
          warmed++
        } else {
          failed++
        }
      }
    } catch {
      failed += batch.length
    }
  }

  return { warmed, alreadyCached, failed }
}

/**
 * Warm the cache with popular documents
 * This can be called by a cron job to pre-cache frequently accessed documents
 */
export async function warmDocumentCache(limit: number = 100): Promise<void> {
  // Get the most frequently accessed documents
  // You could track access patterns or use a heuristic like:
  // - Documents in the most law lists
  // - Most recently updated documents
  // - Documents with specific tags

  const popularDocuments = await prisma.lawListItem.groupBy({
    by: ['document_id'],
    _count: {
      document_id: true,
    },
    orderBy: {
      _count: {
        document_id: 'desc',
      },
    },
    take: limit,
  })

  // Cache each document
  for (const item of popularDocuments) {
    if (item.document_id) {
      await getCachedDocument(item.document_id)
    }
  }
}

/**
 * Invalidate document cache when content changes
 */
export async function invalidateDocument(documentId: string): Promise<void> {
  const keys = [
    `document:${documentId}`,
    // Also clear any slug/number mappings
  ]

  for (const key of keys) {
    await redis.del(key)
  }
}

/**
 * Get cache statistics for monitoring
 */
export async function getDocumentCacheStats(): Promise<{
  cachedDocuments: number
  estimatedSize: number
  oldestEntry?: Date
}> {
  try {
    const keys = await redis.keys('document:*')
    const documentKeys = keys.filter(
      (k) =>
        k.startsWith('document:') &&
        !k.includes(':slug:') &&
        !k.includes(':number:')
    )

    // Estimate size (rough calculation)
    let totalSize = 0
    if (documentKeys.length > 0) {
      // Sample a few documents to estimate average size
      const sample = documentKeys.slice(0, 5)
      for (const key of sample) {
        const doc = await redis.get(key)
        if (doc) {
          totalSize += JSON.stringify(doc).length
        }
      }
      const avgSize = totalSize / sample.length
      totalSize = avgSize * documentKeys.length
    }

    return {
      cachedDocuments: documentKeys.length,
      estimatedSize: totalSize,
    }
  } catch (error) {
    console.warn('Failed to get cache stats:', error)
    return {
      cachedDocuments: 0,
      estimatedSize: 0,
    }
  }
}
