/**
 * Cohere Rerank v4 integration
 * Story 14.3 — Retrieval quality improvement
 *
 * Cross-encoder reranking re-scores vector search candidates by reading
 * query + document together, bridging the vocabulary gap between user
 * queries and legal terminology.
 *
 * Degrades gracefully: no API key, API failure, or ≤1 doc → original order.
 */

/* eslint-disable no-console */

const COHERE_RERANK_URL = 'https://api.cohere.com/v2/rerank'
const DEFAULT_MODEL = 'rerank-v4.0-pro'
const TIMEOUT_MS = 10_000
const MAX_DOCUMENTS = 1000

export interface RerankableDocument {
  text: string
  [key: string]: unknown
}

export interface RerankOptions {
  model?: 'rerank-v4.0-pro' | 'rerank-v4.0-fast'
  topN?: number
  maxTokensPerDoc?: number
}

export interface RerankResult<T> {
  results: Array<T & { relevanceScore: number }>
  reranked: boolean
  latencyMs: number
}

interface CohereRerankResponseResult {
  index: number
  relevance_score: number
}

interface CohereRerankResponse {
  results: CohereRerankResponseResult[]
}

/**
 * Build the text string sent to Cohere for reranking.
 * Mirrors buildEmbeddingInput() composition: header + prefix + content.
 */
export function buildRerankText(
  content: string,
  contextPrefix: string | null,
  contextualHeader: string
): string {
  const parts: string[] = []
  if (contextualHeader) parts.push(contextualHeader)
  if (contextPrefix) parts.push(contextPrefix)

  const headerBlock = parts.join('\n')
  if (headerBlock) {
    return headerBlock + '\n\n' + content
  }
  return content
}

/**
 * Rerank documents using Cohere's cross-encoder model.
 *
 * Guards:
 * - No COHERE_API_KEY → passthrough
 * - ≤1 document → passthrough
 * - >1000 documents → truncated to 1000
 * - API error or timeout → passthrough with console.error
 */
export async function rerank<T extends RerankableDocument>(
  query: string,
  documents: T[],
  options?: RerankOptions
): Promise<RerankResult<T>> {
  const passthrough = (
    reranked: boolean = false,
    latencyMs: number = 0
  ): RerankResult<T> => ({
    results: documents.map((doc) => ({ ...doc, relevanceScore: 0 })),
    reranked,
    latencyMs,
  })

  // Guard: no API key
  const apiKey = process.env.COHERE_API_KEY
  if (!apiKey) {
    return passthrough()
  }

  // Guard: ≤1 document
  if (documents.length <= 1) {
    return passthrough()
  }

  // Guard: truncate to max
  const docs =
    documents.length > MAX_DOCUMENTS
      ? documents.slice(0, MAX_DOCUMENTS)
      : documents

  const model = options?.model ?? DEFAULT_MODEL
  const topN = options?.topN ?? docs.length

  const body: Record<string, unknown> = {
    model,
    query,
    documents: docs.map((d) => d.text),
    top_n: topN,
  }
  if (options?.maxTokensPerDoc !== undefined) {
    body.max_tokens_per_doc = options.maxTokensPerDoc
  }

  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(COHERE_RERANK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const latencyMs = Date.now() - start

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error(
        `Cohere rerank failed (${response.status}): ${text.substring(0, 200)}`
      )
      return passthrough(false, latencyMs)
    }

    const data = (await response.json()) as CohereRerankResponse

    // Map results back to original documents with relevance scores
    const results: Array<T & { relevanceScore: number }> = data.results.map(
      (r) => ({
        ...docs[r.index]!,
        relevanceScore: r.relevance_score,
      })
    )

    return { results, reranked: true, latencyMs }
  } catch (err) {
    const latencyMs = Date.now() - start
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Cohere rerank error: ${message}`)
    return passthrough(false, latencyMs)
  } finally {
    clearTimeout(timeout)
  }
}
