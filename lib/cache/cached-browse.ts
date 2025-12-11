/**
 * Cached Browse Functions (Story 2.19)
 *
 * Wraps browse queries with Next.js data cache (unstable_cache) for faster
 * catalogue page loading. This complements the existing Redis caching in
 * browse.ts by adding server-side request deduplication and tag-based invalidation.
 *
 * Cache Strategy:
 * - Default view (no filters, page 1): 1 hour TTL, most common access pattern
 * - Filtered/paginated views: 5 minute TTL, more dynamic but still cacheable
 * - Cache tags enable selective invalidation when sync jobs complete
 */

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { ContentType } from '@prisma/client'

// Types matching browse.ts
export interface CachedBrowseInput {
  contentTypes?: string[]
  status?: string[]
  businessType?: 'B2B' | 'PRIVATE' | 'BOTH'
  subjectCodes?: string[]
  dateFrom?: string
  dateTo?: string
  page: number
  limit: number
  sortBy: 'date_desc' | 'date_asc' | 'title' | 'relevance'
}

export interface CachedBrowseResult {
  id: string
  title: string
  documentNumber: string
  contentType: string
  category: string | null
  summary: string | null
  effectiveDate: string | null
  status: string
  slug: string
}

export interface CachedBrowseResponse {
  results: CachedBrowseResult[]
  total: number
  page: number
  totalPages: number
}

/**
 * Check if input represents the default view (no filters, page 1)
 * Default views get longer cache TTL since they're most commonly accessed
 */
function isDefaultView(input: CachedBrowseInput): boolean {
  return (
    input.page === 1 &&
    (!input.contentTypes || input.contentTypes.length === 0) &&
    (!input.status || input.status.length === 0) &&
    !input.businessType &&
    (!input.subjectCodes || input.subjectCodes.length === 0) &&
    !input.dateFrom &&
    !input.dateTo &&
    input.sortBy === 'date_desc'
  )
}

/**
 * Core browse query function - separated for caching
 * This performs the actual database query without any caching logic
 */
async function browseDocumentsCore(
  input: CachedBrowseInput
): Promise<CachedBrowseResponse> {
  const {
    contentTypes,
    status,
    businessType,
    subjectCodes,
    dateFrom,
    dateTo,
    page,
    limit,
    sortBy,
  } = input

  const offset = (page - 1) * limit

  // Build Prisma where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (contentTypes && contentTypes.length > 0) {
    where.content_type = { in: contentTypes }
  }

  if (status && status.length > 0) {
    where.status = { in: status }
  }

  if (businessType && businessType !== 'BOTH') {
    where.OR = [
      { metadata: { path: ['businessType'], equals: businessType } },
      { metadata: { path: ['businessType'], equals: 'BOTH' } },
      { metadata: { path: ['businessType'], equals: null } },
    ]
  }

  if (subjectCodes && subjectCodes.length > 0) {
    where.subjects = {
      some: {
        subject_code: { in: subjectCodes },
      },
    }
  }

  if (dateFrom || dateTo) {
    where.effective_date = {}
    if (dateFrom) {
      where.effective_date.gte = new Date(dateFrom)
    }
    if (dateTo) {
      where.effective_date.lte = new Date(dateTo)
    }
  }

  // Determine orderBy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: any
  switch (sortBy) {
    case 'date_asc':
      orderBy = { effective_date: 'asc' }
      break
    case 'title':
      orderBy = { title: 'asc' }
      break
    case 'date_desc':
    default:
      orderBy = { effective_date: 'desc' }
      break
  }

  const [results, count] = await Promise.all([
    prisma.legalDocument.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy,
      select: {
        id: true,
        title: true,
        document_number: true,
        content_type: true,
        summary: true,
        effective_date: true,
        status: true,
        slug: true,
        subjects: {
          select: { subject_name: true },
          take: 1,
        },
      },
    }),
    prisma.legalDocument.count({ where }),
  ])

  const totalPages = Math.ceil(count / limit)

  return {
    results: results.map((r) => ({
      id: r.id,
      title: r.title,
      documentNumber: r.document_number,
      contentType: r.content_type,
      category: r.subjects[0]?.subject_name ?? null,
      summary: r.summary,
      effectiveDate: r.effective_date?.toISOString() ?? null,
      status: r.status,
      slug: r.slug,
    })),
    total: count,
    page,
    totalPages,
  }
}

/**
 * Get cached browse results for the default view (page 1, no filters)
 * Uses 1-hour TTL since this is the most common access pattern
 */
export const getDefaultCatalogueResults = unstable_cache(
  async (limit: number = 25): Promise<CachedBrowseResponse> => {
    return browseDocumentsCore({
      page: 1,
      limit,
      sortBy: 'date_desc',
    })
  },
  ['catalogue-default'],
  {
    revalidate: 3600, // 1 hour TTL for default view
    tags: ['browse', 'catalogue', 'laws'],
  }
)

/**
 * Get cached browse results with filters
 * Uses 5-minute TTL since filtered results are more dynamic
 * Cache key is generated from all filter parameters for deduplication
 */
export const getCachedBrowseResults = unstable_cache(
  async (input: CachedBrowseInput): Promise<CachedBrowseResponse> => {
    return browseDocumentsCore(input)
  },
  ['browse-filtered'],
  {
    revalidate: 300, // 5 minute TTL for filtered results
    tags: ['browse', 'catalogue'],
  }
)

/**
 * Main entry point for cached catalogue browsing
 * Automatically selects appropriate cache strategy based on input:
 * - Default view: 1 hour cache
 * - Filtered view: 5 minute cache
 */
export async function getCatalogueResults(
  input: CachedBrowseInput
): Promise<CachedBrowseResponse> {
  // Use optimized default cache for default view
  if (isDefaultView(input)) {
    return getDefaultCatalogueResults(input.limit)
  }

  // Use filtered cache for all other cases
  return getCachedBrowseResults(input)
}

/**
 * Get total document count - heavily cached since it changes rarely
 * Used for pagination and stats display
 */
export const getTotalDocumentCount = unstable_cache(
  async (contentTypes?: string[]): Promise<number> => {
    const where = contentTypes?.length
      ? { content_type: { in: contentTypes as ContentType[] } }
      : {}
    return prisma.legalDocument.count({ where })
  },
  ['document-count'],
  {
    revalidate: 3600, // 1 hour TTL
    tags: ['browse', 'catalogue', 'laws'],
  }
)
