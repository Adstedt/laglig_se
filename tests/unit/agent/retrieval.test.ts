import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.mock factories are hoisted above imports)
// ---------------------------------------------------------------------------

const {
  mockQueryRaw,
  mockExecuteRaw,
  mockExecuteRawUnsafe,
  mockTransaction,
  mockRerank,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockExecuteRawUnsafe: vi.fn(),
  mockTransaction: vi.fn(),
  mockRerank: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    $executeRawUnsafe: mockExecuteRawUnsafe,
  },
}))

vi.mock('@/lib/chunks/embed-chunks', () => ({
  generateEmbedding: vi.fn().mockResolvedValue({
    embedding: new Array(1536).fill(0.1),
    tokensUsed: 10,
  }),
  vectorToString: vi.fn((v: number[]) => `[${v.join(',')}]`),
}))

vi.mock('@/lib/search/rerank', () => ({
  rerank: (...args: unknown[]) => mockRerank(...args),
  buildRerankText: vi.fn(
    (c: string, p: string | null, h: string) => `${h}\n${p ?? ''}\n\n${c}`
  ),
}))

import { retrieveContext, RetrievalError } from '@/lib/agent/retrieval'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chunk-1',
    content: 'Arbetsgivaren ska...',
    contextual_header: 'Arbetsmiljölagen > Kap 2 > 3 §',
    context_prefix: 'Lag om arbetsmiljö',
    path: 'kap2.§3',
    source_type: 'LEGAL_DOCUMENT',
    source_id: 'doc-1',
    token_count: 80,
    metadata: null,
    document_number: 'SFS 1977:1160',
    slug: null,
    similarity: 0.85,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('retrieveContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: transaction executes the callback
    mockTransaction.mockImplementation(
      async (fn: (..._args: unknown[]) => unknown) => {
        const tx = {
          $executeRaw: mockExecuteRaw,
          $executeRawUnsafe: mockExecuteRawUnsafe,
          $queryRaw: mockQueryRaw,
        }
        return fn(tx)
      }
    )

    // Default: vector search returns 2 candidates
    mockQueryRaw.mockResolvedValue([
      makeRow({ id: 'c1', similarity: 0.85 }),
      makeRow({ id: 'c2', similarity: 0.7, content: 'Arbetstagaren ska...' }),
    ])

    // Default: rerank returns reordered results
    mockRerank.mockResolvedValue({
      results: [
        { ...makeRow({ id: 'c2' }), text: 'rerank-text', relevanceScore: 0.95 },
        { ...makeRow({ id: 'c1' }), text: 'rerank-text', relevanceScore: 0.88 },
      ],
      reranked: true,
      latencyMs: 420,
    })
  })

  it('executes two-stage pipeline: vector search → rerank', async () => {
    const result = await retrieveContext('arbetsmiljö', 'ws-1')

    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockRerank).toHaveBeenCalledTimes(1)
    expect(result.results).toHaveLength(2)
    expect(result.reranked).toBe(true)
  })

  it('over-fetches candidates for rerank (default 4×)', async () => {
    await retrieveContext('arbetsmiljö', 'ws-1', { topK: 5 })

    // rerank should be called with topN: 5
    expect(mockRerank).toHaveBeenCalledWith('arbetsmiljö', expect.any(Array), {
      topN: 5,
    })
  })

  it('maps raw rows to RetrievalResult shape', async () => {
    const response = await retrieveContext('test', 'ws-1')
    const first = response.results[0]!

    expect(first).toMatchObject({
      id: expect.any(String),
      content: expect.any(String),
      contextualHeader: expect.any(String),
      sourceType: 'LEGAL_DOCUMENT',
      relevanceScore: expect.any(Number),
      similarity: expect.any(Number),
    })
  })

  it('returns timings for each stage', async () => {
    const response = await retrieveContext('test', 'ws-1')

    expect(response.timings).toHaveLength(3)
    expect(response.timings.map((t) => t.stage)).toEqual([
      'embed',
      'vectorSearch',
      'rerank',
    ])
    for (const t of response.timings) {
      expect(t.latencyMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('graceful degradation: rerank returns reranked=false', async () => {
    mockRerank.mockResolvedValue({
      results: [
        { ...makeRow({ id: 'c1' }), text: 'x', relevanceScore: 0 },
        { ...makeRow({ id: 'c2' }), text: 'x', relevanceScore: 0 },
      ],
      reranked: false,
      latencyMs: 0,
    })

    const result = await retrieveContext('test', 'ws-1')
    expect(result.reranked).toBe(false)
    expect(result.results).toHaveLength(2)
    expect(result.results[0]!.relevanceScore).toBe(0)
  })

  it('filters by minRelevanceScore when reranked', async () => {
    mockRerank.mockResolvedValue({
      results: [
        { ...makeRow({ id: 'c1' }), text: 'x', relevanceScore: 0.95 },
        { ...makeRow({ id: 'c2' }), text: 'x', relevanceScore: 0.3 },
      ],
      reranked: true,
      latencyMs: 100,
    })

    const result = await retrieveContext('test', 'ws-1', {
      minRelevanceScore: 0.5,
    })
    expect(result.results).toHaveLength(1)
    expect(result.results[0]!.relevanceScore).toBe(0.95)
  })

  it('does not filter by minRelevanceScore when not reranked', async () => {
    mockRerank.mockResolvedValue({
      results: [{ ...makeRow({ id: 'c1' }), text: 'x', relevanceScore: 0 }],
      reranked: false,
      latencyMs: 0,
    })

    const result = await retrieveContext('test', 'ws-1', {
      minRelevanceScore: 0.5,
    })
    // Should not filter since reranked=false
    expect(result.results).toHaveLength(1)
  })

  it('returns empty results when vector search finds nothing', async () => {
    mockQueryRaw.mockResolvedValue([])

    const result = await retrieveContext('obscure query', 'ws-1')
    expect(result.results).toEqual([])
    expect(result.reranked).toBe(false)
    expect(mockRerank).not.toHaveBeenCalled()
  })

  it('throws RetrievalError on embedding failure', async () => {
    const { generateEmbedding } = await import('@/lib/chunks/embed-chunks')
    vi.mocked(generateEmbedding).mockRejectedValueOnce(
      new Error('OpenAI API timeout')
    )

    await expect(retrieveContext('test', 'ws-1')).rejects.toThrow(
      RetrievalError
    )
  })

  it('RetrievalError includes descriptive message', async () => {
    const { generateEmbedding } = await import('@/lib/chunks/embed-chunks')
    vi.mocked(generateEmbedding).mockRejectedValueOnce(
      new Error('OpenAI API timeout')
    )

    await expect(retrieveContext('test', 'ws-1')).rejects.toThrow(
      /Embedding generation failed/
    )
  })

  it('uses embedding cache when provided', async () => {
    const { generateEmbedding } = await import('@/lib/chunks/embed-chunks')
    const cache = new Map<string, number[]>()
    cache.set('cached query', new Array(1536).fill(0.2))

    await retrieveContext('cached query', 'ws-1', { embeddingCache: cache })

    // Should not call generateEmbedding since query was in cache
    expect(generateEmbedding).not.toHaveBeenCalled()
  })

  it('detects legal references in query', async () => {
    const result = await retrieveContext(
      'Vad säger 3 kap. 2 § i SFS 1977:1160?',
      'ws-1'
    )
    expect(result.legalRefs.sfsNumbers).toEqual(['1977:1160'])
    expect(result.legalRefs.sectionRefs).toContainEqual({
      chapter: 3,
      section: '2',
    })
  })
})
