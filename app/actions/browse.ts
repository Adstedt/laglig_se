'use server'

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import { z } from 'zod'
import { safeTrack, trackAsync } from '@/lib/analytics'

// Content types aligned with Architecture 9.5.1 ContentType enum
const ContentTypeEnum = z.enum([
  'SFS_LAW',
  'COURT_CASE_AD',
  'COURT_CASE_HD',
  'COURT_CASE_HFD',
  'COURT_CASE_HOVR',
  'COURT_CASE_MOD',
  'COURT_CASE_MIG',
  'EU_REGULATION',
  'EU_DIRECTIVE',
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
  if (isRedisConfigured) {
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
  status: z.infer<typeof DocumentStatusEnum>[] | undefined,
  businessType: z.infer<typeof BusinessTypeEnum> | undefined,
  subjectCodes: string[] | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  page: number,
  limit: number,
  offset: number,
  sortBy: z.infer<typeof SortByEnum>,
  startTime: number,
  cacheKey: string
): Promise<BrowseResponse> {
  // Build dynamic WHERE clauses for filters
  const whereConditions: string[] = []
  const params: unknown[] = [query]
  let paramIndex = 2

  if (contentTypes && contentTypes.length > 0) {
    whereConditions.push(`ld.content_type::text = ANY($${paramIndex}::text[])`)
    params.push(contentTypes)
    paramIndex++
  }

  if (status && status.length > 0) {
    whereConditions.push(`ld.status::text = ANY($${paramIndex}::text[])`)
    params.push(status)
    paramIndex++
  }

  if (businessType && businessType !== 'BOTH') {
    whereConditions.push(
      `(ld.metadata->>'businessType' = $${paramIndex} OR ld.metadata->>'businessType' = 'BOTH' OR ld.metadata->>'businessType' IS NULL)`
    )
    params.push(businessType)
    paramIndex++
  }

  if (subjectCodes && subjectCodes.length > 0) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM document_subjects ds
      WHERE ds.document_id = ld.id
      AND ds.subject_code = ANY($${paramIndex}::text[])
    )`)
    params.push(subjectCodes)
    paramIndex++
  }

  if (dateFrom) {
    whereConditions.push(`ld.effective_date >= $${paramIndex}::date`)
    params.push(dateFrom)
    paramIndex++
  }

  if (dateTo) {
    whereConditions.push(`ld.effective_date <= $${paramIndex}::date`)
    params.push(dateTo)
    paramIndex++
  }

  const whereClause =
    whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : ''

  // Determine ORDER BY based on sortBy
  // Secondary sort by document_number for consistent ordering within same date
  let orderByClause: string
  switch (sortBy) {
    case 'date_asc':
      orderByClause = 'publication_date ASC NULLS LAST, document_number ASC'
      break
    case 'title':
      orderByClause = 'title ASC, document_number ASC'
      break
    case 'relevance':
      orderByClause =
        'rank DESC, publication_date DESC NULLS LAST, document_number DESC'
      break
    case 'date_desc':
    default:
      // Date sorting should prioritize date, then document number (higher = newer)
      orderByClause = 'publication_date DESC NULLS LAST, document_number DESC'
      break
  }

  const searchQuery = `
    WITH search_results AS (
      SELECT
        ld.id,
        ld.title,
        ld.document_number,
        ld.content_type::text as content_type,
        ld.summary,
        ld.publication_date,
        ld.effective_date,
        ld.status::text as status,
        ld.slug,
        ds.subject_name as category,
        ts_rank_cd(ld.search_vector, plainto_tsquery('pg_catalog.swedish', $1)) AS rank,
        ts_headline(
          'pg_catalog.swedish',
          COALESCE(ld.summary, LEFT(ld.full_text, 500), ''),
          plainto_tsquery('pg_catalog.swedish', $1),
          'MaxWords=35, MinWords=15, ShortWord=3, HighlightAll=FALSE, StartSel=<mark>, StopSel=</mark>'
        ) AS snippet
      FROM legal_documents ld
      LEFT JOIN document_subjects ds ON ds.document_id = ld.id
      WHERE ld.search_vector @@ plainto_tsquery('pg_catalog.swedish', $1)
      ${whereClause}
    ),
    ranked_results AS (
      SELECT DISTINCT ON (id) *
      FROM search_results
      ORDER BY id, rank DESC
    )
    SELECT *, COUNT(*) OVER() AS total_count
    FROM ranked_results
    ORDER BY ${orderByClause}
    LIMIT ${limit}
    OFFSET ${offset}
  `

  try {
    interface RawSearchResult {
      id: string
      title: string
      document_number: string
      content_type: string
      summary: string | null
      publication_date: Date | null
      effective_date: Date | null
      status: string
      slug: string
      category: string | null
      rank: number
      snippet: string
      total_count: bigint | number
    }

    const results = await prisma.$queryRawUnsafe<RawSearchResult[]>(
      searchQuery,
      ...params
    )

    const firstResult = results[0]
    const total = firstResult ? Number(firstResult.total_count) : 0
    const totalPages = Math.ceil(total / limit)

    const response: BrowseResponse = {
      success: true,
      results: results.map((r) => ({
        id: r.id,
        title: r.title,
        documentNumber: r.document_number,
        contentType: r.content_type,
        category: r.category,
        summary: r.summary,
        effectiveDate: r.publication_date?.toISOString() ?? null,
        inForceDate: r.effective_date?.toISOString() ?? null,
        status: r.status,
        slug: r.slug,
        snippet: r.snippet || r.summary || '',
      })),
      total,
      page,
      totalPages,
      queryTimeMs: performance.now() - startTime,
    }

    // Cache results
    if (isRedisConfigured && results.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(response), { ex: 300 })
      } catch {
        // Cache error, continue
      }
    }

    // Track analytics
    await safeTrack('browse_search', {
      query: query.substring(0, 50),
      resultsCount: total,
      queryTimeMs: Math.round(response.queryTimeMs),
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
      effectiveDate: r.publication_date?.toISOString() ?? null,
      inForceDate: r.effective_date?.toISOString() ?? null,
      status: r.status,
      slug: r.slug,
      snippet: r.summary || '',
    })),
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
  if (isRedisConfigured) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached && typeof cached === 'string') {
        const parsedCache = JSON.parse(cached) as BrowseResponse
        console.log(`[CACHE HIT] Redis: ${cacheKey.substring(0, 50)}...`)
        return {
          ...parsedCache,
          queryTimeMs: performance.now() - startTime,
          cached: true,
        }
      }
      console.log(`[CACHE MISS] Redis: ${cacheKey.substring(0, 50)}...`)
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
    if (isRedisConfigured) {
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

// Autocomplete for catalogue search
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { document_number: { contains: query, mode: 'insensitive' } },
      ],
    }

    if (contentTypes && contentTypes.length > 0) {
      where.content_type = { in: contentTypes }
    }

    const results = await prisma.legalDocument.findMany({
      where,
      select: {
        title: true,
        slug: true,
        content_type: true,
        document_number: true,
      },
      take: 6,
      orderBy: { title: 'asc' },
    })

    return {
      suggestions: results.map((r) => ({
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
