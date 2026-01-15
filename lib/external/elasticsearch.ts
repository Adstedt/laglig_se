/**
 * Story P.3: Elasticsearch Integration
 *
 * Full-text search with Swedish language support, fuzzy matching,
 * and highlighting. Falls back to PostgreSQL ILIKE when ES unavailable.
 */

import { Client as ElasticsearchClient } from '@elastic/elasticsearch'
import { prisma } from '@/lib/prisma'
import type { ContentType } from '@prisma/client'

// ============================================================================
// Configuration
// ============================================================================

const ES_INDEX_PREFIX = 'laglig'
const ES_DOCUMENTS_INDEX = `${ES_INDEX_PREFIX}_documents`

const ES_TIMEOUT_MS = 5000 // 5 seconds before fallback
const MAX_SEARCH_RESULTS = 100

// ============================================================================
// Client Singleton
// ============================================================================

let esClient: ElasticsearchClient | null = null
let isESAvailable = true
let lastHealthCheck = 0
const HEALTH_CHECK_INTERVAL = 60000 // 1 minute

/**
 * Get Elasticsearch client singleton
 * Returns null if ES is not configured
 */
export function getElasticsearchClient(): ElasticsearchClient | null {
  if (esClient) return esClient

  const esUrl = process.env.ELASTICSEARCH_URL
  const esApiKey = process.env.ELASTICSEARCH_API_KEY

  if (!esUrl) {
    console.warn(
      '[ES] ELASTICSEARCH_URL not configured, search will use PostgreSQL fallback'
    )
    isESAvailable = false
    return null
  }

  try {
    if (esApiKey) {
      esClient = new ElasticsearchClient({
        node: esUrl,
        auth: { apiKey: esApiKey },
        requestTimeout: ES_TIMEOUT_MS,
        maxRetries: 2,
      })
    } else {
      esClient = new ElasticsearchClient({
        node: esUrl,
        requestTimeout: ES_TIMEOUT_MS,
        maxRetries: 2,
      })
    }
    return esClient
  } catch (error) {
    console.error('[ES] Failed to create client:', error)
    isESAvailable = false
    return null
  }
}

/**
 * Check if Elasticsearch is available
 */
export async function isElasticsearchAvailable(): Promise<boolean> {
  const now = Date.now()

  // Use cached result if recent
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return isESAvailable
  }

  const client = getElasticsearchClient()
  if (!client) {
    isESAvailable = false
    lastHealthCheck = now
    return false
  }

  try {
    await client.ping()
    isESAvailable = true
  } catch {
    isESAvailable = false
  }

  lastHealthCheck = now
  return isESAvailable
}

// ============================================================================
// Index Management
// ============================================================================

/**
 * Swedish analyzer configuration for Elasticsearch
 */
const SWEDISH_ANALYZER_SETTINGS = {
  analysis: {
    analyzer: {
      swedish: {
        type: 'custom' as const,
        tokenizer: 'standard',
        filter: [
          'lowercase',
          'swedish_stop',
          'swedish_stemmer',
          'swedish_folding',
        ],
      },
      swedish_search: {
        type: 'custom' as const,
        tokenizer: 'standard',
        filter: ['lowercase', 'swedish_stop', 'swedish_folding'],
      },
    },
    filter: {
      swedish_stop: {
        type: 'stop' as const,
        stopwords: '_swedish_',
      },
      swedish_stemmer: {
        type: 'stemmer' as const,
        language: 'swedish',
      },
      swedish_folding: {
        type: 'asciifolding' as const,
        preserve_original: true,
      },
    },
  },
}

/**
 * Document index mapping
 */
const DOCUMENTS_MAPPING = {
  properties: {
    id: { type: 'keyword' },
    title: {
      type: 'text',
      analyzer: 'swedish',
      search_analyzer: 'swedish_search',
      fields: {
        exact: { type: 'keyword' },
      },
    },
    document_number: {
      type: 'text',
      analyzer: 'standard',
      fields: {
        exact: { type: 'keyword' },
      },
    },
    content: {
      type: 'text',
      analyzer: 'swedish',
      search_analyzer: 'swedish_search',
    },
    summary: {
      type: 'text',
      analyzer: 'swedish',
      search_analyzer: 'swedish_search',
    },
    content_type: { type: 'keyword' },
    slug: { type: 'keyword' },
    status: { type: 'keyword' },
    effective_date: { type: 'date' },
    publication_date: { type: 'date' },
    subjects: { type: 'keyword' },
    created_at: { type: 'date' },
    updated_at: { type: 'date' },
  },
}

/**
 * Create or update the documents index
 */
export async function ensureDocumentsIndex(): Promise<boolean> {
  const client = getElasticsearchClient()
  if (!client) return false

  try {
    const exists = await client.indices.exists({ index: ES_DOCUMENTS_INDEX })

    if (!exists) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      await client.indices.create({
        index: ES_DOCUMENTS_INDEX,
        settings: SWEDISH_ANALYZER_SETTINGS as any,
        mappings: DOCUMENTS_MAPPING as any,
      })
      /* eslint-enable @typescript-eslint/no-explicit-any */
      // eslint-disable-next-line no-console
      console.log(`[ES] Created index: ${ES_DOCUMENTS_INDEX}`)
    }

    return true
  } catch (error) {
    console.error('[ES] Failed to ensure index:', error)
    return false
  }
}

// ============================================================================
// Indexing
// ============================================================================

export interface DocumentToIndex {
  id: string
  title: string
  document_number: string
  content?: string | null
  summary?: string | null
  content_type: ContentType
  slug: string
  status: string
  effective_date?: Date | null
  publication_date?: Date | null
  subjects?: string[]
}

/**
 * Index a single document
 */
export async function indexDocument(doc: DocumentToIndex): Promise<boolean> {
  const client = getElasticsearchClient()
  if (!client) return false

  try {
    await client.index({
      index: ES_DOCUMENTS_INDEX,
      id: doc.id,
      document: {
        ...doc,
        effective_date: doc.effective_date?.toISOString(),
        publication_date: doc.publication_date?.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })
    return true
  } catch (error) {
    console.error(`[ES] Failed to index document ${doc.id}:`, error)
    return false
  }
}

/**
 * Bulk index multiple documents
 */
export async function bulkIndexDocuments(
  docs: DocumentToIndex[]
): Promise<{ success: number; failed: number }> {
  const client = getElasticsearchClient()
  if (!client) return { success: 0, failed: docs.length }

  if (docs.length === 0) return { success: 0, failed: 0 }

  try {
    const operations = docs.flatMap((doc) => [
      { index: { _index: ES_DOCUMENTS_INDEX, _id: doc.id } },
      {
        ...doc,
        effective_date: doc.effective_date?.toISOString(),
        publication_date: doc.publication_date?.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])

    const result = await client.bulk({
      operations,
      refresh: true,
    })

    const failed = result.items.filter((item) => item.index?.error).length
    return {
      success: docs.length - failed,
      failed,
    }
  } catch (error) {
    console.error('[ES] Bulk index failed:', error)
    return { success: 0, failed: docs.length }
  }
}

/**
 * Delete a document from the index
 */
export async function deleteDocumentFromIndex(docId: string): Promise<boolean> {
  const client = getElasticsearchClient()
  if (!client) return false

  try {
    await client.delete({
      index: ES_DOCUMENTS_INDEX,
      id: docId,
    })
    return true
  } catch (error) {
    // Ignore not found errors
    if ((error as { statusCode?: number }).statusCode === 404) {
      return true
    }
    console.error(`[ES] Failed to delete document ${docId}:`, error)
    return false
  }
}

// ============================================================================
// Search
// ============================================================================

export interface SearchOptions {
  query: string
  contentTypes?: ContentType[]
  limit?: number
  offset?: number
  fuzzy?: boolean
  highlightFields?: string[]
}

export interface SearchResultHighlights {
  title?: string[]
  content?: string[]
  summary?: string[]
}

export interface SearchResult {
  id: string
  title: string
  document_number: string
  slug: string
  content_type: ContentType
  score: number
  highlights: SearchResultHighlights
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  took: number
  source: 'elasticsearch' | 'postgresql'
}

/**
 * Search documents with Elasticsearch (with PostgreSQL fallback)
 */
export async function searchDocuments(
  options: SearchOptions
): Promise<SearchResponse> {
  const startTime = Date.now()

  // Try Elasticsearch first
  if (await isElasticsearchAvailable()) {
    try {
      const esResult = await elasticsearchSearch(options)
      return {
        ...esResult,
        took: Date.now() - startTime,
        source: 'elasticsearch',
      }
    } catch (error) {
      console.warn('[ES] Search failed, falling back to PostgreSQL:', error)
    }
  }

  // Fall back to PostgreSQL
  const pgResult = await postgresSearch(options)
  return {
    ...pgResult,
    took: Date.now() - startTime,
    source: 'postgresql',
  }
}

/**
 * Elasticsearch search implementation
 */
async function elasticsearchSearch(
  options: SearchOptions
): Promise<{ results: SearchResult[]; total: number }> {
  const client = getElasticsearchClient()
  if (!client) throw new Error('Elasticsearch client not available')

  const {
    query,
    contentTypes,
    limit = 20,
    offset = 0,
    fuzzy = true,
    highlightFields = ['title', 'content', 'summary'],
  } = options

  // Build query
  const must: object[] = [
    {
      multi_match: {
        query,
        fields: ['title^3', 'document_number^2', 'content', 'summary'],
        type: 'best_fields',
        fuzziness: fuzzy ? 'AUTO' : '0',
        prefix_length: 2,
      },
    },
  ]

  // Filter by content type if specified
  const filter: object[] = []
  if (contentTypes && contentTypes.length > 0) {
    filter.push({ terms: { content_type: contentTypes } })
  }

  const response = await client.search({
    index: ES_DOCUMENTS_INDEX,
    from: offset,
    size: Math.min(limit, MAX_SEARCH_RESULTS),
    query: {
      bool: {
        must,
        filter,
      },
    },
    highlight: {
      fields: Object.fromEntries(
        highlightFields.map((field) => [
          field,
          {
            fragment_size: 150,
            number_of_fragments: 3,
            pre_tags: ['<mark>'],
            post_tags: ['</mark>'],
          },
        ])
      ),
    },
    _source: ['id', 'title', 'document_number', 'slug', 'content_type'],
  })

  const total =
    typeof response.hits.total === 'number'
      ? response.hits.total
      : (response.hits.total?.value ?? 0)

  const results: SearchResult[] = response.hits.hits.map((hit) => {
    const source = hit._source as {
      id: string
      title: string
      document_number: string
      slug: string
      content_type: ContentType
    }

    const highlights: SearchResultHighlights = {}
    if (hit.highlight?.title) highlights.title = hit.highlight.title
    if (hit.highlight?.content) highlights.content = hit.highlight.content
    if (hit.highlight?.summary) highlights.summary = hit.highlight.summary

    return {
      id: source.id,
      title: source.title,
      document_number: source.document_number,
      slug: source.slug,
      content_type: source.content_type,
      score: hit._score ?? 0,
      highlights,
    }
  })

  return { results, total }
}

/**
 * PostgreSQL fallback search implementation
 * Uses ILIKE for basic search (slower but functional)
 */
async function postgresSearch(
  options: SearchOptions
): Promise<{ results: SearchResult[]; total: number }> {
  const { query, contentTypes, limit = 20, offset = 0 } = options

  // Build where clause
  // Note: Avoid searching full_text with ILIKE - too slow without index
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { document_number: { contains: query, mode: 'insensitive' } },
      { summary: { contains: query, mode: 'insensitive' } },
    ],
    ...(contentTypes &&
      contentTypes.length > 0 && { content_type: { in: contentTypes } }),
  }

  // Get total count
  const total = await prisma.legalDocument.count({ where })

  // Get results
  const docs = await prisma.legalDocument.findMany({
    where,
    take: Math.min(limit, MAX_SEARCH_RESULTS),
    skip: offset,
    select: {
      id: true,
      title: true,
      document_number: true,
      slug: true,
      content_type: true,
    },
    orderBy: { effective_date: 'desc' },
  })

  // Create simple highlights (PostgreSQL doesn't have built-in highlighting)
  const results: SearchResult[] = docs.map((doc, index) => {
    const highlights: SearchResultHighlights = {}
    const titleHighlight = highlightText(doc.title, query)
    if (titleHighlight) highlights.title = titleHighlight

    return {
      id: doc.id,
      title: doc.title,
      document_number: doc.document_number,
      slug: doc.slug,
      content_type: doc.content_type,
      score: 1 - index * 0.01, // Simple score based on position
      highlights,
    }
  })

  return { results, total }
}

/**
 * Simple text highlighting for PostgreSQL fallback
 */
function highlightText(text: string, query: string): string[] | undefined {
  if (!text || !query) return undefined

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) return undefined

  const highlighted = `${text.slice(0, index)}<mark>${text.slice(index, index + query.length)}</mark>${text.slice(index + query.length)}`
  return [highlighted]
}

// ============================================================================
// Sync Utilities
// ============================================================================

/**
 * Sync all documents from PostgreSQL to Elasticsearch
 * Should be run as a background job
 */
export async function syncAllDocuments(
  batchSize = 100,
  onProgress?: (_indexed: number, _total: number) => void
): Promise<{ success: number; failed: number; total: number }> {
  // Ensure index exists
  const indexReady = await ensureDocumentsIndex()
  if (!indexReady) {
    return { success: 0, failed: 0, total: 0 }
  }

  // Get total count
  const total = await prisma.legalDocument.count()
  let indexed = 0
  let failed = 0

  // Process in batches using cursor pagination
  let cursor: string | undefined

  while (true) {
    const docs = await prisma.legalDocument.findMany({
      take: batchSize,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true,
        title: true,
        document_number: true,
        full_text: true,
        summary: true,
        content_type: true,
        slug: true,
        status: true,
        effective_date: true,
        publication_date: true,
        subjects: {
          select: { subject_code: true },
        },
      },
      orderBy: { id: 'asc' },
    })

    if (docs.length === 0) break

    // Transform for indexing
    const docsToIndex: DocumentToIndex[] = docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      document_number: doc.document_number,
      content: doc.full_text,
      summary: doc.summary,
      content_type: doc.content_type,
      slug: doc.slug,
      status: doc.status,
      effective_date: doc.effective_date,
      publication_date: doc.publication_date,
      subjects: doc.subjects.map((s) => s.subject_code),
    }))

    const result = await bulkIndexDocuments(docsToIndex)
    indexed += result.success
    failed += result.failed

    // Update cursor for next batch
    cursor = docs[docs.length - 1]?.id

    // Report progress
    onProgress?.(indexed, total)

    // Small delay between batches
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return { success: indexed, failed, total }
}
