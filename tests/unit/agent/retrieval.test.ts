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

  // ---------------------------------------------------------------------------
  // Story 17.9: sourceTypes multi-type filter
  //
  // $queryRaw is mocked, so this asserts the SQL *parameters* (the array is bound
  // and the workspace is scoped) rather than real-row isolation. A true
  // cross-tenant read test belongs in an integration suite against a test DB —
  // see the story's Testing note.
  // ---------------------------------------------------------------------------
  it('binds the sourceTypes array + the workspace id as SQL parameters', async () => {
    await retrieveContext('arbetsmiljö', 'ws-42', {
      sourceTypes: ['USER_FILE'],
    })

    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    const params = mockQueryRaw.mock.calls[0]!.slice(1) // drop the template strings
    // The enum-array param is bound (drives `= ANY(...::"SourceType"[])`).
    expect(params).toContainEqual(['USER_FILE'])
    // ...and the query is still scoped to the caller's workspace.
    expect(params).toContain('ws-42')
  })

  it('back-compat: sourceTypes defaults to null (no multi-type filter) when omitted', async () => {
    await retrieveContext('arbetsmiljö', 'ws-1')

    const params = mockQueryRaw.mock.calls[0]!.slice(1)
    // Null array param → the `::text[] IS NULL` guard passes → no source filter.
    expect(params).toContain(null)
    expect(params).not.toContainEqual(['USER_FILE'])
  })

  // ---------------------------------------------------------------------------
  // Story 7.7: sourceId single-source hard filter (assigned-agreement bias).
  // Same caveat as the sourceTypes block above: $queryRaw is mocked, so these
  // assert the bound SQL parameters; the live-DB isolation check is the
  // scripts/eval-ca-grounding.ts cross-workspace probe.
  // ---------------------------------------------------------------------------
  describe('sourceId filter (Story 7.7)', () => {
    it('binds the sourceId as a SQL parameter alongside the workspace id', async () => {
      await retrieveContext('uppsägningstid', 'ws-42', {
        sourceId: 'agreement-1',
      })

      const params = mockQueryRaw.mock.calls[0]!.slice(1)
      expect(params).toContain('agreement-1')
      // Workspace isolation clause unchanged.
      expect(params).toContain('ws-42')
    })

    it('combines with sourceTypes (both params bound)', async () => {
      await retrieveContext('uppsägningstid', 'ws-42', {
        sourceTypes: ['COLLECTIVE_AGREEMENT'],
        sourceId: 'agreement-1',
      })

      const params = mockQueryRaw.mock.calls[0]!.slice(1)
      expect(params).toContainEqual(['COLLECTIVE_AGREEMENT'])
      expect(params).toContain('agreement-1')
      expect(params).toContain('ws-42')
    })

    it('null-safe: defaults to null (no single-source filter) when omitted', async () => {
      await retrieveContext('uppsägningstid', 'ws-1', {
        sourceTypes: ['COLLECTIVE_AGREEMENT'],
      })

      const params = mockQueryRaw.mock.calls[0]!.slice(1)
      // The sourceId slot is bound as null → `::text IS NULL` guard passes.
      expect(params).toContain(null)
      expect(params).not.toContain('agreement-1')
    })
  })
})
