import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock retrieval before importing the module under test
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

  it('includes citationKey derived from documentNumber + path', async () => {
    mockRetrieveContext.mockResolvedValue({
      results: [
        {
          id: 'chunk-1',
          content: 'Arbetsgivaren ska planera...',
          contextualHeader: 'Arbetsmiljölagen > Kap 3 > 2a §',
          contextPrefix: null,
          path: 'kap3.§2a',
          sourceType: 'LEGAL_DOCUMENT',
          sourceId: 'doc-1',
          documentNumber: 'SFS 1977:1160',
          slug: 'sfs-1977-1160',
          similarity: 0.92,
          relevanceScore: 0.85,
          tokenCount: 50,
          metadata: null,
        },
      ],
      legalRefs: { sfsNumbers: [], documentNumbers: [] },
      timings: [],
      reranked: false,
    })

    const result = (await tool.execute(
      { query: 'arbetsmiljö', limit: 5 },
      { toolCallId: 'tc-1', messages: [], abortSignal: undefined as never }
    )) as { data: Array<{ citationKey: string }> }

    expect(result.data).toHaveLength(1)
    expect(result.data[0]!.citationKey).toBe('SFS 1977:1160, Kap 3, 2a §')
  })

  it('falls back to documentNumber when path has no chapter/section format', async () => {
    mockRetrieveContext.mockResolvedValue({
      results: [
        {
          id: 'chunk-2',
          content: 'Övergångsbestämmelser...',
          contextualHeader: 'AML > Övergångsbestämmelser',
          contextPrefix: null,
          path: 'overgangsbest',
          sourceType: 'LEGAL_DOCUMENT',
          sourceId: 'doc-1',
          documentNumber: 'SFS 1977:1160',
          slug: 'sfs-1977-1160',
          similarity: 0.8,
          relevanceScore: 0.7,
          tokenCount: 40,
          metadata: null,
        },
      ],
      legalRefs: { sfsNumbers: [], documentNumbers: [] },
      timings: [],
      reranked: false,
    })

    const result = (await tool.execute(
      { query: 'övergångsbestämmelser', limit: 5 },
      { toolCallId: 'tc-2', messages: [], abortSignal: undefined as never }
    )) as { data: Array<{ citationKey: string }> }

    expect(result.data[0]!.citationKey).toBe('SFS 1977:1160')
  })

  it('citationKey format matches [Källa: ...] expected pattern for chaptered docs', async () => {
    mockRetrieveContext.mockResolvedValue({
      results: [
        {
          id: 'chunk-3',
          content: 'Text...',
          contextualHeader: 'Lag > Kap 5 > 1 §',
          contextPrefix: null,
          path: 'kap5.§1',
          sourceType: 'LEGAL_DOCUMENT',
          sourceId: 'doc-2',
          documentNumber: 'SFS 2008:567',
          slug: 'sfs-2008-567',
          similarity: 0.9,
          relevanceScore: 0.88,
          tokenCount: 30,
          metadata: null,
        },
      ],
      legalRefs: { sfsNumbers: [], documentNumbers: [] },
      timings: [],
      reranked: false,
    })

    const result = (await tool.execute(
      { query: 'diskriminering', limit: 5 },
      { toolCallId: 'tc-3', messages: [], abortSignal: undefined as never }
    )) as { data: Array<{ citationKey: string }> }

    // Should match format: "DOC_NUM, Kap N, M §"
    expect(result.data[0]!.citationKey).toMatch(
      /^SFS \d{4}:\d+, Kap \w+, \w+ §$/
    )
    expect(result.data[0]!.citationKey).toBe('SFS 2008:567, Kap 5, 1 §')
  })

  it('citationKey format for flat docs (no chapter)', async () => {
    mockRetrieveContext.mockResolvedValue({
      results: [
        {
          id: 'chunk-4',
          content: 'Text...',
          contextualHeader: 'Lag > 7 §',
          contextPrefix: null,
          path: 'kap0.§7',
          sourceType: 'LEGAL_DOCUMENT',
          sourceId: 'doc-3',
          documentNumber: 'SFS 1982:80',
          slug: 'sfs-1982-80',
          similarity: 0.85,
          relevanceScore: 0.8,
          tokenCount: 25,
          metadata: null,
        },
      ],
      legalRefs: { sfsNumbers: [], documentNumbers: [] },
      timings: [],
      reranked: false,
    })

    const result = (await tool.execute(
      { query: 'anställningsskydd', limit: 5 },
      { toolCallId: 'tc-4', messages: [], abortSignal: undefined as never }
    )) as { data: Array<{ citationKey: string }> }

    // Flat docs: "DOC_NUM, M §" (no Kap)
    expect(result.data[0]!.citationKey).toBe('SFS 1982:80, 7 §')
  })
})
