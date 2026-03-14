import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RetrievalResponse } from '@/lib/agent/retrieval'

vi.mock('@/lib/agent/retrieval', () => ({
  retrieveContext: vi.fn(),
}))

import { retrieveContext } from '@/lib/agent/retrieval'
import { createSearchLawsTool } from '@/lib/agent/tools/search-laws'

const mockRetrieveContext = vi.mocked(retrieveContext)

describe('search_laws tool', () => {
  const tool = createSearchLawsTool('workspace-1')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns mapped results with _meta on success', async () => {
    const mockResponse: RetrievalResponse = {
      results: [
        {
          id: 'chunk-1',
          content: 'Arbetsgivaren ska vidta åtgärder...',
          contextualHeader: 'Arbetsmiljölagen 3 kap. 2 §',
          contextPrefix: null,
          path: '/lagar/sfs-1977-1160',
          sourceType: 'LEGAL_DOCUMENT',
          sourceId: 'doc-1',
          documentNumber: 'SFS 1977:1160',
          similarity: 0.89,
          relevanceScore: 0.95,
          tokenCount: 120,
          metadata: null,
        },
      ],
      legalRefs: { sfsNumbers: [], agencyNumbers: [], euNumbers: [] },
      timings: [],
      reranked: true,
    }
    mockRetrieveContext.mockResolvedValue(mockResponse)

    const result = await tool.execute(
      { query: 'skyddsutrustning', limit: 5 },
      {
        toolCallId: 'tc-1',
        messages: [],
        abortSignal: undefined as unknown as AbortSignal,
      }
    )

    expect(result).toHaveProperty('_meta')
    expect(result._meta.tool).toBe('search_laws')
    expect(result._meta.resultCount).toBe(1)
    expect(result._meta.executionTimeMs).toBeGreaterThanOrEqual(0)

    expect(result).toHaveProperty('data')
    const data = (result as { data: unknown[] }).data
    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({
      contextualHeader: 'Arbetsmiljölagen 3 kap. 2 §',
      documentNumber: 'SFS 1977:1160',
      path: '/lagar/sfs-1977-1160',
    })
  })

  it('passes contentType and limit to retrieveContext', async () => {
    mockRetrieveContext.mockResolvedValue({
      results: [],
      legalRefs: { sfsNumbers: [], agencyNumbers: [], euNumbers: [] },
      timings: [],
      reranked: false,
    })

    await tool.execute(
      { query: 'test', contentType: 'SFS_LAW', limit: 10 },
      {
        toolCallId: 'tc-2',
        messages: [],
        abortSignal: undefined as unknown as AbortSignal,
      }
    )

    expect(mockRetrieveContext).toHaveBeenCalledWith('test', 'workspace-1', {
      sourceType: 'LEGAL_DOCUMENT',
      contentType: 'SFS_LAW',
      topK: 10,
    })
  })

  it('returns error with Swedish guidance when no results found', async () => {
    mockRetrieveContext.mockResolvedValue({
      results: [],
      legalRefs: { sfsNumbers: [], agencyNumbers: [], euNumbers: [] },
      timings: [],
      reranked: false,
    })

    const result = await tool.execute(
      { query: 'nonexistent', limit: 5 },
      {
        toolCallId: 'tc-3',
        messages: [],
        abortSignal: undefined as unknown as AbortSignal,
      }
    )

    expect(result).toMatchObject({
      error: true,
      message: 'Inga resultat hittades.',
      _meta: { tool: 'search_laws', resultCount: 0 },
    })
    expect(result).toHaveProperty('guidance')
  })

  it('returns error with Swedish guidance on retrieval failure', async () => {
    mockRetrieveContext.mockRejectedValue(new Error('Connection timeout'))

    const result = await tool.execute(
      { query: 'test', limit: 5 },
      {
        toolCallId: 'tc-4',
        messages: [],
        abortSignal: undefined as unknown as AbortSignal,
      }
    )

    expect(result).toMatchObject({
      error: true,
      _meta: { tool: 'search_laws' },
    })
    expect((result as { message: string }).message).toContain(
      'Connection timeout'
    )
  })
})
