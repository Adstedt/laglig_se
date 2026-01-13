'use server'

import { prisma } from '@/lib/prisma'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { z } from 'zod'
import { headers } from 'next/headers'
import { safeTrack } from '@/lib/analytics'

// Rate limiter: 10 requests per minute for anonymous users
// Only initialize if Redis is configured
const ratelimit = isRedisConfigured()
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
    })
  : null

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

const SearchInputSchema = z.object({
  query: z.string().max(200),
  contentTypes: z.array(ContentTypeEnum).optional(),
  status: z.array(DocumentStatusEnum).optional(),
  businessType: BusinessTypeEnum.optional(),
  subjectCodes: z.array(z.string()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
})

export type SearchInput = z.infer<typeof SearchInputSchema>

export interface SearchResult {
  id: string
  title: string
  documentNumber: string
  contentType: string
  category: string | null
  summary: string | null
  effectiveDate: string | null
  status: string
  slug: string
  snippet: string
  rank: number
}

export interface SearchResponse {
  success: boolean
  results: SearchResult[]
  total: number
  page: number
  totalPages: number
  queryTimeMs: number
  cached?: boolean
  error?: string
}

export async function searchDocumentsAction(
  input: SearchInput
): Promise<SearchResponse> {
  const startTime = performance.now()

  // Rate limiting (if configured)
  if (ratelimit) {
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for') ?? 'anonymous'
    const { success: rateLimitSuccess } = await ratelimit.limit(ip)

    if (!rateLimitSuccess) {
      return {
        success: false,
        results: [],
        total: 0,
        page: 1,
        totalPages: 0,
        queryTimeMs: 0,
        error: 'For manga forfragan. Forsok igen om en minut.',
      }
    }
  }

  const parsed = SearchInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      results: [],
      total: 0,
      page: 1,
      totalPages: 0,
      queryTimeMs: 0,
      error: 'Ogiltiga sokparametrar',
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
  } = parsed.data

  // Handle empty query - return recent documents
  if (!query || query.trim().length === 0) {
    return getRecentDocuments(page, limit, startTime)
  }

  // Check cache for common queries
  const cacheKey = `search:${JSON.stringify({ query, contentTypes, status, businessType, subjectCodes, dateFrom, dateTo, page, limit })}`

  if (isRedisConfigured()) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached && typeof cached === 'string') {
        const parsedCache = JSON.parse(cached) as SearchResponse
        // Track cache hit
        await safeTrack('search_cache_hit', { query: query.substring(0, 50) })
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

  // Business type filter - check metadata field
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

  // Execute search with relevance ranking
  // Using ts_rank_cd for cover density ranking (better for weighted search)
  const searchQuery = `
    WITH search_results AS (
      SELECT
        ld.id,
        ld.title,
        ld.document_number,
        ld.content_type::text as content_type,
        ld.summary,
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
    ORDER BY rank DESC, effective_date DESC NULLS LAST
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

    const response: SearchResponse = {
      success: true,
      results: results.map((r) => ({
        id: r.id,
        title: r.title,
        documentNumber: r.document_number,
        contentType: r.content_type,
        category: r.category,
        summary: r.summary,
        effectiveDate: r.effective_date?.toISOString() ?? null,
        status: r.status,
        slug: r.slug,
        snippet: r.snippet || r.summary || '',
        rank: r.rank,
      })),
      total,
      page,
      totalPages,
      queryTimeMs: performance.now() - startTime,
    }

    // Cache successful results for 5 minutes
    if (isRedisConfigured() && results.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(response), { ex: 300 })
      } catch {
        // Cache error, continue without caching
      }
    }

    // Track search analytics (Epic AC12)
    await safeTrack('search_query', {
      query: query.substring(0, 50),
      resultsCount: total,
      queryTimeMs: Math.round(response.queryTimeMs),
      filters: JSON.stringify({ contentTypes, status, businessType }),
    })

    return response
  } catch (error) {
    console.error('Search error:', error)
    return {
      success: false,
      results: [],
      total: 0,
      page: 1,
      totalPages: 0,
      queryTimeMs: performance.now() - startTime,
      error: 'Soktjansten ar tillfalligt otillganglig',
    }
  }
}

// Helper function for empty queries - returns recent documents
async function getRecentDocuments(
  page: number,
  limit: number,
  startTime: number
): Promise<SearchResponse> {
  const offset = (page - 1) * limit

  try {
    const [results, count] = await Promise.all([
      prisma.legalDocument.findMany({
        take: limit,
        skip: offset,
        orderBy: { created_at: 'desc' },
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
      prisma.legalDocument.count(),
    ])

    return {
      success: true,
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
        snippet: r.summary || '',
        rank: 0,
      })),
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      queryTimeMs: performance.now() - startTime,
    }
  } catch (error) {
    console.error('Recent documents error:', error)
    return {
      success: false,
      results: [],
      total: 0,
      page: 1,
      totalPages: 0,
      queryTimeMs: performance.now() - startTime,
      error: 'Kunde inte hamta senaste dokument',
    }
  }
}

// Autocomplete for typeahead (faster, simpler query)
export async function searchAutocompleteAction(query: string): Promise<{
  suggestions: Array<{
    title: string
    slug: string
    type: string
    category: string | null
  }>
}> {
  if (!query || query.length < 2) {
    return { suggestions: [] }
  }

  try {
    const results = await prisma.legalDocument.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { document_number: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        title: true,
        slug: true,
        content_type: true,
        subjects: {
          select: { subject_name: true },
          take: 1,
        },
      },
      take: 5,
      orderBy: { title: 'asc' },
    })

    return {
      suggestions: results.map((r) => ({
        title: r.title,
        slug: r.slug,
        type: r.content_type,
        category: r.subjects[0]?.subject_name ?? null,
      })),
    }
  } catch (error) {
    console.error('Autocomplete error:', error)
    return { suggestions: [] }
  }
}

// Track search result clicks (Epic AC12)
export async function trackSearchClickAction(
  query: string,
  documentId: string,
  position: number
): Promise<void> {
  await safeTrack('search_result_click', {
    query: query.substring(0, 50),
    documentId,
    position,
  })
}
