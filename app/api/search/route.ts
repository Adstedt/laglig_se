/**
 * Story P.3: Search API Endpoint
 *
 * Full-text search with Elasticsearch (falls back to PostgreSQL)
 * Supports Swedish language, fuzzy matching, and result highlighting.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  searchDocuments,
  type SearchResponse,
} from '@/lib/external/elasticsearch'
import type { ContentType } from '@prisma/client'

// ============================================================================
// Request Validation
// ============================================================================

const SearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').max(200, 'Query too long'),
  types: z
    .string()
    .optional()
    .transform((val) =>
      val ? (val.split(',').filter(Boolean) as ContentType[]) : undefined
    ),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(parseInt(val, 10), 100) : 20)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0)),
  fuzzy: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),
})

// ============================================================================
// Response Types
// ============================================================================

interface SearchAPIResponse {
  results: Array<{
    id: string
    title: string
    documentNumber: string
    slug: string
    contentType: ContentType
    score: number
    url: string
    highlights: {
      title?: string[]
      content?: string[]
      summary?: string[]
    }
  }>
  meta: {
    query: string
    total: number
    limit: number
    offset: number
    took: number
    source: 'elasticsearch' | 'postgresql'
  }
}

// ============================================================================
// Route Handler
// ============================================================================

/**
 * GET /api/search?q=arbetsmiljö&types=SFS_LAW&limit=20&offset=0&fuzzy=true
 *
 * Query Parameters:
 * - q: Search query (required)
 * - types: Comma-separated content types to filter (optional)
 * - limit: Max results (default 20, max 100)
 * - offset: Results offset for pagination (default 0)
 * - fuzzy: Enable fuzzy matching (default true)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const rawParams = {
      q: searchParams.get('q') ?? '',
      types: searchParams.get('types') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
      fuzzy: searchParams.get('fuzzy') ?? undefined,
    }

    const params = SearchQuerySchema.safeParse(rawParams)

    if (!params.success) {
      return NextResponse.json(
        {
          error: 'Invalid search parameters',
          details: params.error.issues.map((i) => i.message),
        },
        { status: 400 }
      )
    }

    const { q, types, limit, offset, fuzzy } = params.data

    // Execute search
    const searchResult: SearchResponse = await searchDocuments({
      query: q,
      ...(types && types.length > 0 && { contentTypes: types }),
      limit,
      offset,
      fuzzy,
      highlightFields: ['title', 'content', 'summary'],
    })

    // Transform results with URLs
    const response: SearchAPIResponse = {
      results: searchResult.results.map((result) => ({
        id: result.id,
        title: result.title,
        documentNumber: result.document_number,
        slug: result.slug,
        contentType: result.content_type,
        score: result.score,
        url: getDocumentUrl(result.content_type, result.slug),
        highlights: result.highlights,
      })),
      meta: {
        query: q,
        total: searchResult.total,
        limit,
        offset,
        took: searchResult.took,
        source: searchResult.source,
      },
    }

    // Add cache headers for performance
    const headers = new Headers()
    headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    )
    headers.set('X-Search-Source', searchResult.source)
    headers.set('X-Response-Time', `${Date.now() - startTime}ms`)

    return NextResponse.json(response, { headers })
  } catch (error) {
    console.error('[Search API] Error:', error)

    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate URL for document based on content type
 */
function getDocumentUrl(contentType: ContentType, slug: string): string {
  const basePath = getBasePath(contentType)
  return `${basePath}/${slug}`
}

function getBasePath(contentType: ContentType): string {
  switch (contentType) {
    case 'SFS_LAW':
      return '/lagar'
    case 'SFS_AMENDMENT':
      return '/lagar/andringar'
    case 'COURT_CASE_HD':
      return '/rattsfall/hd'
    case 'COURT_CASE_HOVR':
      return '/rattsfall/hovr'
    case 'COURT_CASE_HFD':
      return '/rattsfall/hfd'
    case 'COURT_CASE_AD':
      return '/rattsfall/ad'
    case 'COURT_CASE_MOD':
      return '/rattsfall/mod'
    case 'COURT_CASE_MIG':
      return '/rattsfall/mig'
    case 'EU_REGULATION':
      return '/eu/forordningar'
    case 'EU_DIRECTIVE':
      return '/eu/direktiv'
    case 'AGENCY_REGULATION':
      return '/foreskrifter'
    default:
      return '/dokument'
  }
}
