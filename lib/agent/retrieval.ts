/**
 * RAG Retrieval Pipeline
 * Story 14.8, Task 1 (AC: 1-9)
 *
 * Two-stage retrieval: pgvector HNSW cosine similarity → Cohere Rerank v4.
 * Workspace-scoped, source/content type filterable.
 */

import { prisma } from '@/lib/prisma'
import { generateEmbedding, vectorToString } from '@/lib/chunks/embed-chunks'
import { rerank, buildRerankText } from '@/lib/search/rerank'
import type { RerankableDocument } from '@/lib/search/rerank'
import { detectLegalReferences } from '@/lib/agent/legal-ref-detector'
import type { LegalReferences } from '@/lib/agent/legal-ref-detector'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetrievalOptions {
  topK?: number
  sourceType?: string
  contentType?: string
  overFetchMultiplier?: number
  minRelevanceScore?: number
  embeddingCache?: Map<string, number[]>
}

export interface RetrievalResult {
  id: string
  content: string
  contextualHeader: string
  contextPrefix: string | null
  path: string
  sourceType: string
  sourceId: string
  documentNumber: string | null
  slug: string | null
  similarity: number
  relevanceScore: number
  tokenCount: number
  metadata: Record<string, unknown> | null
}

export interface StageTiming {
  stage: 'embed' | 'vectorSearch' | 'rerank' | 'assembly'
  latencyMs: number
  itemsIn?: number
  itemsOut?: number
}

export interface RetrievalResponse {
  results: RetrievalResult[]
  legalRefs: LegalReferences
  timings: StageTiming[]
  reranked: boolean
}

export class RetrievalError extends Error {
  constructor(
    message: string,
    public readonly _query: string
  ) {
    super(message)
    this.name = 'RetrievalError'
  }
}

// ---------------------------------------------------------------------------
// Raw row shape from $queryRaw
// ---------------------------------------------------------------------------

interface VectorSearchRow {
  id: string
  content: string
  contextual_header: string
  context_prefix: string | null
  path: string
  source_type: string
  source_id: string
  token_count: number
  metadata: Record<string, unknown> | null
  document_number: string | null
  slug: string | null
  similarity: number
}

// ---------------------------------------------------------------------------
// Core retrieval
// ---------------------------------------------------------------------------

const DEFAULT_TOP_K = 5
const DEFAULT_OVER_FETCH_MULTIPLIER = 4
const DEFAULT_EF_SEARCH = 100

export async function retrieveContext(
  query: string,
  workspaceId: string,
  options: RetrievalOptions = {}
): Promise<RetrievalResponse> {
  const {
    topK = DEFAULT_TOP_K,
    sourceType = null,
    contentType = null,
    overFetchMultiplier = DEFAULT_OVER_FETCH_MULTIPLIER,
    minRelevanceScore,
    embeddingCache,
  } = options

  const timings: StageTiming[] = []

  // Detect legal references in query
  const legalRefs = detectLegalReferences(query)

  // Stage 1: Generate query embedding
  const embedStart = Date.now()
  let queryEmbedding: number[]

  if (embeddingCache?.has(query)) {
    queryEmbedding = embeddingCache.get(query)!
  } else {
    try {
      const { embedding } = await generateEmbedding(query, '', '')
      queryEmbedding = embedding
      embeddingCache?.set(query, embedding)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new RetrievalError(`Embedding generation failed: ${message}`, query)
    }
  }

  timings.push({
    stage: 'embed',
    latencyMs: Date.now() - embedStart,
  })

  // Stage 2: pgvector HNSW cosine similarity search (over-fetch for rerank)
  const fetchLimit = topK * overFetchMultiplier
  const queryVectorStr = vectorToString(queryEmbedding)

  const vectorStart = Date.now()

  const candidates = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL hnsw.ef_search = ${DEFAULT_EF_SEARCH}`
    )

    return tx.$queryRaw<VectorSearchRow[]>`
      SELECT
        cc.id,
        cc.content,
        cc.contextual_header,
        cc.context_prefix,
        cc.path,
        cc.source_type,
        cc.source_id,
        cc.token_count,
        cc.metadata,
        ld.document_number,
        ld.slug,
        1 - (cc.embedding <=> ${queryVectorStr}::vector) AS similarity
      FROM content_chunks cc
      LEFT JOIN legal_documents ld
        ON cc.source_type = 'LEGAL_DOCUMENT' AND cc.source_id = ld.id::text
      WHERE cc.embedding IS NOT NULL
        AND (cc.workspace_id IS NULL OR cc.workspace_id = ${workspaceId})
        AND (${sourceType}::text IS NULL OR cc.source_type = ${sourceType}::"SourceType")
        AND (${contentType}::text IS NULL OR ld.content_type = ${contentType}::"ContentType")
      ORDER BY cc.embedding <=> ${queryVectorStr}::vector ASC
      LIMIT ${fetchLimit}
    `
  })

  timings.push({
    stage: 'vectorSearch',
    latencyMs: Date.now() - vectorStart,
    itemsIn: 1,
    itemsOut: candidates.length,
  })

  if (candidates.length === 0) {
    return { results: [], legalRefs, timings, reranked: false }
  }

  // Stage 3: Cohere Rerank v4 cross-encoder
  const rerankStart = Date.now()

  const rerankDocs: Array<RerankableDocument & VectorSearchRow> =
    candidates.map((row) => ({
      ...row,
      text: buildRerankText(
        row.content,
        row.context_prefix,
        row.contextual_header
      ),
    }))

  const rerankResult = await rerank(query, rerankDocs, { topN: topK })

  timings.push({
    stage: 'rerank',
    latencyMs: Date.now() - rerankStart,
    itemsIn: candidates.length,
    itemsOut: rerankResult.results.length,
  })

  // Map to RetrievalResult[]
  let results: RetrievalResult[] = rerankResult.results.map((doc) => ({
    id: doc.id,
    content: doc.content,
    contextualHeader: doc.contextual_header,
    contextPrefix: doc.context_prefix,
    path: doc.path,
    sourceType: doc.source_type,
    sourceId: doc.source_id,
    documentNumber: doc.document_number,
    slug: doc.slug,
    similarity: doc.similarity,
    relevanceScore: doc.relevanceScore,
    tokenCount: doc.token_count,
    metadata: doc.metadata,
  }))

  // Apply minRelevanceScore filter if set
  if (minRelevanceScore !== undefined && rerankResult.reranked) {
    results = results.filter((r) => r.relevanceScore >= minRelevanceScore)
  }

  return {
    results,
    legalRefs,
    timings,
    reranked: rerankResult.reranked,
  }
}
