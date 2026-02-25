/**
 * Embedding generation for content chunks
 * Story 14.3, Task 3 (AC: 6-8)
 *
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 * Input combines: contextual_header + context_prefix + content
 */

import OpenAI from 'openai'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const MAX_EMBEDDING_TOKENS = 8191
// Conservative char limit: ~4 chars per token, leave room for tokenizer variance
const MAX_EMBEDDING_CHARS = MAX_EMBEDDING_TOKENS * 3

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY not set. Provide via environment variable.'
      )
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

/** Exported for testing — allows injecting a mock client */
export function setOpenAIClient(client: OpenAI | null): void {
  openaiClient = client
}

/**
 * Combine the three layers of context into a single embedding input string.
 */
export function buildEmbeddingInput(
  content: string,
  contextPrefix: string,
  contextualHeader: string
): string {
  // Single newline between header and prefix (tight coupling)
  // Double newline before content (visual separation)
  const parts: string[] = []
  if (contextualHeader) parts.push(contextualHeader)
  if (contextPrefix) parts.push(contextPrefix)

  const headerBlock = parts.join('\n')
  let result: string
  if (headerBlock) {
    result = headerBlock + '\n\n' + content
  } else {
    result = content
  }

  // Truncate to stay within OpenAI's 8191 token limit
  if (result.length > MAX_EMBEDDING_CHARS) {
    result = result.substring(0, MAX_EMBEDDING_CHARS)
  }
  return result
}

export interface EmbeddingInput {
  text: string
  contextPrefix: string
  contextualHeader: string
}

export interface EmbeddingResult {
  embedding: number[]
  tokensUsed: number
}

/**
 * Generate embedding for a single chunk.
 */
export async function generateEmbedding(
  text: string,
  contextPrefix: string,
  contextualHeader: string
): Promise<EmbeddingResult> {
  const client = getOpenAIClient()
  const input = buildEmbeddingInput(text, contextPrefix, contextualHeader)

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input,
    })

    const data = response.data[0]
    if (!data) {
      throw new Error('No embedding data in OpenAI response')
    }

    return {
      embedding: data.embedding,
      tokensUsed: response.usage?.total_tokens ?? 0,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Failed to generate embedding (input length: ${input.length} chars): ${message}`
    )
  }
}

export interface BatchEmbeddingResult {
  embeddings: number[][]
  totalTokensUsed: number
}

/**
 * Generate embeddings for a batch of chunks (up to 100 per call).
 * Returns embeddings in the same order as input items.
 */
export async function generateEmbeddingsBatch(
  items: EmbeddingInput[]
): Promise<BatchEmbeddingResult> {
  if (items.length === 0) {
    return { embeddings: [], totalTokensUsed: 0 }
  }

  if (items.length > 100) {
    throw new Error(
      `Batch size ${items.length} exceeds OpenAI limit of 100. Split into smaller batches.`
    )
  }

  const client = getOpenAIClient()
  const inputs = items.map((item) =>
    buildEmbeddingInput(item.text, item.contextPrefix, item.contextualHeader)
  )

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: inputs,
    })

    // OpenAI returns embeddings with index field — sort by index to guarantee order
    const sorted = [...response.data].sort((a, b) => a.index - b.index)
    const embeddings = sorted.map((d) => d.embedding)

    return {
      embeddings,
      totalTokensUsed: response.usage?.total_tokens ?? 0,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Failed to generate batch embeddings (${items.length} items): ${message}`
    )
  }
}

/**
 * Convert a number[] vector to pgvector string format: [0.1,0.2,...]
 */
export function vectorToString(vector: number[]): string {
  return `[${vector.join(',')}]`
}

/**
 * HNSW Index Parameters (set in migration 20260224000000):
 *   m = 16              — connections per node, good for <1M vectors
 *   ef_construction = 64 — build quality, default
 *
 * Query-time tuning via: SET hnsw.ef_search = 100
 *   Default ef_search = 40 provides >95% recall@10 for ~300K vectors.
 *   Increase for better recall at the cost of latency.
 */
