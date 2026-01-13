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
import { getCachedOrFetch, redis } from '@/lib/cache/redis'

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
 */
export async function getCachedDocuments(
  documentIds: string[]
): Promise<Map<string, CachedDocument>> {
  const results = new Map<string, CachedDocument>()

  // Get all documents in parallel
  const promises = documentIds.map(async (id) => {
    const doc = await getCachedDocument(id)
    if (doc) {
      results.set(id, doc)
    }
  })

  await Promise.all(promises)
  return results
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
