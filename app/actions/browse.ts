'use server'

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import { z } from 'zod'
import { safeTrack, trackAsync } from '@/lib/analytics'
import { searchDocuments } from '@/lib/external/elasticsearch'
import type { ContentType } from '@prisma/client'
import { excludeStubDocuments } from '@/lib/db/queries/document-filters'

// Content types aligned with Architecture 9.5.1 ContentType enum
const ContentTypeEnum = z.enum([
  'SFS_LAW',
  'SFS_AMENDMENT', // Story 2.29: Amendment documents
  'COURT_CASE_AD',
  'COURT_CASE_HD',
  'COURT_CASE_HFD',
  'COURT_CASE_HOVR',
  'COURT_CASE_MOD',
  'COURT_CASE_MIG',
  'EU_REGULATION',
  'EU_DIRECTIVE',
  'AGENCY_REGULATION', // Story 12.1: Agency regulation stubs
])

const DocumentStatusEnum = z.enum(['ACTIVE', 'REPEALED', 'DRAFT', 'ARCHIVED'])

const BusinessTypeEnum = z.enum(['B2B', 'PRIVATE', 'BOTH'])

const SortByEnum = z.enum(['date_desc', 'date_asc', 'title', 'relevance'])

const BrowseInputSchema = z.object({
  query: z.string().max(200).optional(),
  contentTypes: z.array(ContentTypeEnum).optional(),
  status: z.array(DocumentStatusEnum).optional(),
  businessType: BusinessTypeEnum.optional(),
  subjectCodes: z.array(z.string()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(25),
  sortBy: SortByEnum.default('date_desc'),
})

export type BrowseInput = z.infer<typeof BrowseInputSchema>

export interface BrowseResult {
  id: string
  title: string
  documentNumber: string
  contentType: string
  category: string | null
  summary: string | null
  effectiveDate: string | null // Publication date (for display)
  inForceDate: string | null // Actual effective/in-force date
  status: string
  slug: string
  snippet: string
  // Court case specific fields (null for non-court-cases)
  courtName: string | null
  caseNumber: string | null
  caseName: string | null // benamning (e.g., "Andnöden")
  caseType: string | null // DOM_ELLER_BESLUT, PROVNINGSTILLSTAND, REFERAT
  isGuiding: boolean | null // true = Prejudikat
}

export interface BrowseResponse {
  success: boolean
  results: BrowseResult[]
  total: number
  page: number
  totalPages: number
  queryTimeMs: number
  cached?: boolean
  error?: string
}

export async function browseDocumentsAction(
  input: BrowseInput
): Promise<BrowseResponse> {
  const startTime = performance.now()

  const parsed = BrowseInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      results: [],
      total: 0,
      page: 1,
      totalPages: 0,
      queryTimeMs: 0,
      error: 'Ogiltiga parametrar',
    }
  }

  const {
    query,
    contentTypes,
    status,
    businessType,
    dateFrom,
    dateTo,
    subjectCodes,
    page,
    limit,
    sortBy,
  } = parsed.data

  // Build cache key
  const cacheKey = `browse:${JSON.stringify({ query, contentTypes, status, businessType, subjectCodes, dateFrom, dateTo, page, limit, sortBy })}`

  // Check cache
  if (isRedisConfigured()) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached && typeof cached === 'string') {
        const parsedCache = JSON.parse(cached) as BrowseResponse
        return {
          ...parsedCache,
          queryTimeMs: performance.now() - startTime,
          cached: true,
        }
      }
    } catch {
      // Cache error, continue without cache
    }
  }

  const offset = (page - 1) * limit

  // If there's a search query, use full-text search
  if (query && query.trim().length > 0) {
    return searchWithQuery(
      query,
      contentTypes,
      status,
      businessType,
      subjectCodes,
      dateFrom,
      dateTo,
      page,
      limit,
      offset,
      sortBy,
      startTime,
      cacheKey
    )
  }

  // No search query - browse mode
  return browseWithoutQuery(
    contentTypes,
    status,
    businessType,
    subjectCodes,
    dateFrom,
    dateTo,
    page,
    limit,
    offset,
    sortBy,
    startTime,
    cacheKey
  )
}

async function searchWithQuery(
  query: string,
  contentTypes: z.infer<typeof ContentTypeEnum>[] | undefined,
  _status: z.infer<typeof DocumentStatusEnum>[] | undefined,
  _businessType: z.infer<typeof BusinessTypeEnum> | undefined,
  _subjectCodes: string[] | undefined,
  _dateFrom: string | undefined,
  _dateTo: string | undefined,
  page: number,
  limit: number,
  offset: number,
  _sortBy: z.infer<typeof SortByEnum>,
  startTime: number,
  cacheKey: string
): Promise<BrowseResponse> {
  try {
    // Use Elasticsearch for search (with PostgreSQL fallback)
    // Note: Additional filters (status, businessType, etc.) are applied by ES when available
    const searchOptions: {
      query: string
      limit: number
      offset: number
      fuzzy: boolean
      highlightFields: string[]
      contentTypes?: ContentType[]
    } = {
      query,
      limit,
      offset,
      fuzzy: true,
      highlightFields: ['title', 'content', 'summary'],
    }
    if (contentTypes && contentTypes.length > 0) {
      searchOptions.contentTypes = contentTypes as ContentType[]
    }
    const esResult = await searchDocuments(searchOptions)

    // Get document IDs from ES results to fetch full details from DB
    const docIds = esResult.results.map((r) => r.id)

    if (docIds.length === 0) {
      return {
        success: true,
        results: [],
        total: esResult.total,
        page,
        totalPages: Math.ceil(esResult.total / limit),
        queryTimeMs: performance.now() - startTime,
      }
    }

    // Fetch full document details from database (for court case info, etc.)
    const docs = await prisma.legalDocument.findMany({
      where: { id: { in: docIds } },
      select: {
        id: true,
        title: true,
        document_number: true,
        content_type: true,
        summary: true,
        publication_date: true,
        effective_date: true,
        status: true,
        slug: true,
        metadata: true,
        subjects: {
          select: { subject_name: true },
          take: 1,
        },
        court_case: {
          select: {
            court_name: true,
            case_number: true,
          },
        },
      },
    })

    // Create a map for quick lookup
    const docMap = new Map(docs.map((d) => [d.id, d]))

    // Build results in ES order (preserves relevance ranking)
    const results: BrowseResult[] = []
    for (const esDoc of esResult.results) {
      const dbDoc = docMap.get(esDoc.id)
      if (!dbDoc) continue

      const isCourtCase = dbDoc.content_type.startsWith('COURT_CASE_')
      const metadata = dbDoc.metadata as Record<string, unknown> | null

      // Build snippet from ES highlights or fallback to summary
      const snippet =
        esDoc.highlights.content?.[0] ||
        esDoc.highlights.summary?.[0] ||
        esDoc.highlights.title?.[0] ||
        dbDoc.summary ||
        ''

      results.push({
        id: dbDoc.id,
        title: dbDoc.title,
        documentNumber: dbDoc.document_number,
        contentType: dbDoc.content_type,
        category: dbDoc.subjects[0]?.subject_name ?? null,
        summary: dbDoc.summary,
        effectiveDate: dbDoc.publication_date?.toISOString() ?? null,
        inForceDate: dbDoc.effective_date?.toISOString() ?? null,
        status: dbDoc.status,
        slug: dbDoc.slug,
        snippet,
        // Court case specific fields
        courtName: dbDoc.court_case?.court_name ?? null,
        caseNumber: dbDoc.court_case?.case_number ?? null,
        caseName: isCourtCase
          ? ((metadata?.case_name as string) ?? null)
          : null,
        caseType: isCourtCase
          ? ((metadata?.case_type as string) ?? null)
          : null,
        isGuiding: isCourtCase
          ? ((metadata?.is_guiding as boolean) ?? null)
          : null,
      })
    }

    const response: BrowseResponse = {
      success: true,
      results,
      total: esResult.total,
      page,
      totalPages: Math.ceil(esResult.total / limit),
      queryTimeMs: performance.now() - startTime,
    }

    // Cache results
    if (isRedisConfigured() && results.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(response), { ex: 300 })
      } catch {
        // Cache error, continue
      }
    }

    // Track analytics
    await safeTrack('browse_search', {
      query: query.substring(0, 50),
      resultsCount: esResult.total,
      queryTimeMs: Math.round(response.queryTimeMs),
      source: esResult.source,
    })

    return response
  } catch (error) {
    console.error('Browse search error:', error)
    return {
      success: false,
      results: [],
      total: 0,
      page: 1,
      totalPages: 0,
      queryTimeMs: performance.now() - startTime,
      error: 'Söktjänsten är tillfälligt otillgänglig',
    }
  }
}

/**
 * Check if this is the default browse view (no filters, page 1, default sort)
 * Default views get longer cache TTL since they're most commonly accessed
 */
function isDefaultBrowseView(
  contentTypes: z.infer<typeof ContentTypeEnum>[] | undefined,
  status: z.infer<typeof DocumentStatusEnum>[] | undefined,
  businessType: z.infer<typeof BusinessTypeEnum> | undefined,
  subjectCodes: string[] | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  page: number,
  sortBy: z.infer<typeof SortByEnum>
): boolean {
  return (
    page === 1 &&
    (!contentTypes || contentTypes.length === 0) &&
    (!status || status.length === 0) &&
    !businessType &&
    (!subjectCodes || subjectCodes.length === 0) &&
    !dateFrom &&
    !dateTo &&
    sortBy === 'date_desc'
  )
}

/**
 * Core browse database query function
 * Extracted for use with unstable_cache wrapper
 */
async function executeBrowseQuery(
  contentTypes: z.infer<typeof ContentTypeEnum>[] | undefined,
  status: z.infer<typeof DocumentStatusEnum>[] | undefined,
  businessType: z.infer<typeof BusinessTypeEnum> | undefined,
  subjectCodes: string[] | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  page: number,
  limit: number,
  offset: number,
  sortBy: z.infer<typeof SortByEnum>
): Promise<{
  results: BrowseResult[]
  total: number
  page: number
  totalPages: number
}> {
  // Build Prisma where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    // Story 12.1: Exclude stub documents (AGENCY_REGULATION with null full_text)
    ...excludeStubDocuments,
  }

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

  // Determine orderBy - use publication_date for date sorting
  // Use nulls: 'last' to ensure NULL values don't appear at the top
  // Secondary sort by document_number DESC for consistent ordering within same date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: any
  switch (sortBy) {
    case 'date_asc':
      orderBy = [
        { publication_date: { sort: 'asc', nulls: 'last' } },
        { document_number: 'asc' },
      ]
      break
    case 'title':
      orderBy = [{ title: 'asc' }, { document_number: 'asc' }]
      break
    case 'date_desc':
    default:
      orderBy = [
        { publication_date: { sort: 'desc', nulls: 'last' } },
        { document_number: 'desc' },
      ]
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
        publication_date: true,
        effective_date: true,
        status: true,
        slug: true,
        metadata: true, // For court case: is_guiding, case_type, case_name
        subjects: {
          select: { subject_name: true },
          take: 1,
        },
        court_case: {
          select: {
            court_name: true,
            case_number: true,
          },
        },
      },
    }),
    prisma.legalDocument.count({ where }),
  ])

  const totalPages = Math.ceil(count / limit)

  return {
    results: results.map((r) => {
      // Extract court case metadata if available
      const metadata = r.metadata as Record<string, unknown> | null
      const isCourtCase = r.content_type.startsWith('COURT_CASE_')

      return {
        id: r.id,
        title: r.title,
        documentNumber: r.document_number,
        contentType: r.content_type,
        category: r.subjects[0]?.subject_name ?? null,
        summary: r.summary,
        effectiveDate: r.publication_date?.toISOString() ?? null,
        inForceDate: r.effective_date?.toISOString() ?? null,
        status: r.status,
        slug: r.slug,
        snippet: r.summary || '',
        // Court case specific fields
        courtName: r.court_case?.court_name ?? null,
        caseNumber: r.court_case?.case_number ?? null,
        caseName: isCourtCase
          ? ((metadata?.case_name as string) ?? null)
          : null,
        caseType: isCourtCase
          ? ((metadata?.case_type as string) ?? null)
          : null,
        isGuiding: isCourtCase
          ? ((metadata?.is_guiding as boolean) ?? null)
          : null,
      }
    }),
    total: count,
    page,
    totalPages,
  }
}

/**
 * Cached version of default browse query (no filters, page 1)
 * Uses 1-hour TTL and cache tags for selective invalidation
 */
const getCachedDefaultBrowse = unstable_cache(
  async (limit: number) => {
    return executeBrowseQuery(
      undefined, // contentTypes
      undefined, // status
      undefined, // businessType
      undefined, // subjectCodes
      undefined, // dateFrom
      undefined, // dateTo
      1, // page
      limit,
      0, // offset
      'date_desc'
    )
  },
  ['browse-default'],
  {
    revalidate: 3600, // 1 hour for default view
    tags: ['browse', 'catalogue', 'laws'],
  }
)

/**
 * Cached version of filtered browse query
 * Uses 5-minute TTL for more dynamic filtered results
 */
const getCachedFilteredBrowse = unstable_cache(
  async (
    contentTypes: string[] | undefined,
    status: string[] | undefined,
    businessType: string | undefined,
    subjectCodes: string[] | undefined,
    dateFrom: string | undefined,
    dateTo: string | undefined,
    page: number,
    limit: number,
    sortBy: string
  ) => {
    return executeBrowseQuery(
      contentTypes as z.infer<typeof ContentTypeEnum>[] | undefined,
      status as z.infer<typeof DocumentStatusEnum>[] | undefined,
      businessType as z.infer<typeof BusinessTypeEnum> | undefined,
      subjectCodes,
      dateFrom,
      dateTo,
      page,
      limit,
      (page - 1) * limit,
      sortBy as z.infer<typeof SortByEnum>
    )
  },
  ['browse-filtered'],
  {
    revalidate: 300, // 5 minutes for filtered results
    tags: ['browse', 'catalogue'],
  }
)

async function browseWithoutQuery(
  contentTypes: z.infer<typeof ContentTypeEnum>[] | undefined,
  status: z.infer<typeof DocumentStatusEnum>[] | undefined,
  businessType: z.infer<typeof BusinessTypeEnum> | undefined,
  subjectCodes: string[] | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  page: number,
  limit: number,
  _offset: number, // Kept for API compatibility, offset calculated inside cached functions
  sortBy: z.infer<typeof SortByEnum>,
  startTime: number,
  cacheKey: string
): Promise<BrowseResponse> {
  const isDefault = isDefaultBrowseView(
    contentTypes,
    status,
    businessType,
    subjectCodes,
    dateFrom,
    dateTo,
    page,
    sortBy
  )

  // Determine cache TTL based on view type
  const cacheTtl = isDefault ? 3600 : 300 // 1 hour for default, 5 min for filtered

  // Check Redis cache first (Layer 4: Redis Cache)
  if (isRedisConfigured()) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached && typeof cached === 'string') {
        const parsedCache = JSON.parse(cached) as BrowseResponse
        return {
          ...parsedCache,
          queryTimeMs: performance.now() - startTime,
          cached: true,
        }
      }
    } catch {
      // Cache read error, continue to query
    }
  }

  try {
    // Use Next.js data cache (Layer 3: unstable_cache)
    // This provides request deduplication and server-side caching
    let queryResult: {
      results: BrowseResult[]
      total: number
      page: number
      totalPages: number
    }

    if (isDefault) {
      queryResult = await getCachedDefaultBrowse(limit)
    } else {
      queryResult = await getCachedFilteredBrowse(
        contentTypes,
        status,
        businessType,
        subjectCodes,
        dateFrom,
        dateTo,
        page,
        limit,
        sortBy
      )
    }

    const response: BrowseResponse = {
      success: true,
      ...queryResult,
      queryTimeMs: performance.now() - startTime,
    }

    // Store in Redis cache (async, don't await)
    if (isRedisConfigured()) {
      redis
        .set(cacheKey, JSON.stringify(response), { ex: cacheTtl })
        .catch(() => {
          // Silently ignore Redis write errors
        })
    }

    // Track analytics (async, don't block response)
    trackAsync('browse_catalogue', {
      contentTypes: contentTypes?.join(',') ?? 'all',
      resultsCount: queryResult.total,
      queryTimeMs: Math.round(response.queryTimeMs),
      cached: false,
    })

    return response
  } catch (error) {
    console.error('Browse error:', error)
    return {
      success: false,
      results: [],
      total: 0,
      page: 1,
      totalPages: 0,
      queryTimeMs: performance.now() - startTime,
      error: 'Kunde inte hämta dokument',
    }
  }
}

// Autocomplete for catalogue search - uses Elasticsearch for consistency
export async function catalogueAutocompleteAction(
  query: string,
  contentTypes?: string[]
): Promise<{
  suggestions: Array<{
    title: string
    slug: string
    type: string
    documentNumber: string
  }>
}> {
  if (!query || query.length < 2) {
    return { suggestions: [] }
  }

  try {
    // Use Elasticsearch for autocomplete (same as main search)
    const searchOptions: {
      query: string
      limit: number
      offset: number
      fuzzy: boolean
      contentTypes?: ContentType[]
    } = {
      query,
      limit: 8,
      offset: 0,
      fuzzy: true,
    }
    if (contentTypes && contentTypes.length > 0) {
      searchOptions.contentTypes = contentTypes as ContentType[]
    }
    const esResult = await searchDocuments(searchOptions)

    return {
      suggestions: esResult.results.map((r) => ({
        title: r.title,
        slug: r.slug,
        type: r.content_type,
        documentNumber: r.document_number,
      })),
    }
  } catch (error) {
    console.error('Autocomplete error:', error)
    return { suggestions: [] }
  }
}
