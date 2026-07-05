/**
 * Unit tests for the search_collective_agreements tool (Story 7.7, Tasks 2 + 7).
 * Mocks retrieveContext — asserts:
 *  - EXACTLY sourceTypes: ['COLLECTIVE_AGREEMENT'] (never LEGAL_DOCUMENT,
 *    search_laws stays unwidened);
 *  - agreement-bias precedence: model-supplied agreementId param > closure
 *    biasAgreementId > none;
 *  - a foreign/hallucinated id is passed through as-is (safety = retrieval's
 *    workspace clause → zero rows, asserted via the empty-result error path);
 *  - result mapping incl. citationKey = the contextual header.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agent/retrieval', () => ({
  retrieveContext: vi.fn(),
}))

import { retrieveContext } from '@/lib/agent/retrieval'
import { createSearchCollectiveAgreementsTool } from '@/lib/agent/tools/search-collective-agreements'

const mockRetrieve = retrieveContext as ReturnType<typeof vi.fn>

type ToolWithExecute = {
  execute: (
    _args: { query: string; agreementId?: string; limit?: number },
    _opts?: unknown
  ) => Promise<unknown>
}

function makeTool(workspaceId = 'ws-1', biasAgreementId?: string) {
  return createSearchCollectiveAgreementsTool(
    workspaceId,
    biasAgreementId
  ) as unknown as ToolWithExecute
}

function resultRow(over: Record<string, unknown> = {}) {
  return {
    id: 'chunk-1',
    content: 'Uppsägningstiden är enligt avtalet minst tre månader.',
    contextualHeader: 'Teknikavtalet (Kollektivavtal) > § 12 Uppsägning',
    contextPrefix: null,
    path: 'avtal.chunk1',
    sourceType: 'COLLECTIVE_AGREEMENT',
    sourceId: 'agreement-42',
    documentNumber: null,
    slug: null,
    similarity: 0.9,
    relevanceScore: 0.912345,
    tokenCount: 100,
    metadata: {
      agreement_name: 'Teknikavtalet',
      workspace_file_id: 'file-9',
    },
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('search_collective_agreements — retrieveContext invocation', () => {
  it('calls retrieveContext with exactly sourceTypes: [COLLECTIVE_AGREEMENT] + workspace + limit', async () => {
    mockRetrieve.mockResolvedValue({ results: [resultRow()] })
    const tool = makeTool('ws-77')

    await tool.execute({ query: 'uppsägningstid', limit: 7 })

    expect(mockRetrieve).toHaveBeenCalledTimes(1)
    const [query, workspaceId, options] = mockRetrieve.mock.calls[0]!
    expect(query).toBe('uppsägningstid')
    expect(workspaceId).toBe('ws-77')
    expect(options).toEqual({
      sourceTypes: ['COLLECTIVE_AGREEMENT'],
      topK: 7,
    })
  })

  it('NEVER passes LEGAL_DOCUMENT (search_laws stays unwidened)', async () => {
    mockRetrieve.mockResolvedValue({ results: [resultRow()] })
    const tool = makeTool()

    await tool.execute({ query: 'q', limit: 5 })

    const options = mockRetrieve.mock.calls[0]![2] as Record<string, unknown>
    expect(options.sourceType).toBeUndefined()
    expect(options.sourceTypes).toEqual(['COLLECTIVE_AGREEMENT'])
    expect(JSON.stringify(options)).not.toContain('LEGAL_DOCUMENT')
  })
})

describe('search_collective_agreements — bias precedence (AC 4)', () => {
  it('no param, no closure bias → no sourceId (all workspace agreements)', async () => {
    mockRetrieve.mockResolvedValue({ results: [resultRow()] })
    const tool = makeTool('ws-1')

    await tool.execute({ query: 'q', limit: 5 })

    const options = mockRetrieve.mock.calls[0]![2] as Record<string, unknown>
    expect(options.sourceId).toBeUndefined()
  })

  it('closure biasAgreementId → passed as sourceId (pill-selected employee)', async () => {
    mockRetrieve.mockResolvedValue({ results: [resultRow()] })
    const tool = makeTool('ws-1', 'agreement-pill')

    await tool.execute({ query: 'q', limit: 5 })

    const options = mockRetrieve.mock.calls[0]![2] as Record<string, unknown>
    expect(options.sourceId).toBe('agreement-pill')
  })

  it('model-supplied agreementId param OVERRIDES the closure bias', async () => {
    mockRetrieve.mockResolvedValue({ results: [resultRow()] })
    const tool = makeTool('ws-1', 'agreement-pill')

    await tool.execute({
      query: 'q',
      agreementId: 'agreement-from-lookup',
      limit: 5,
    })

    const options = mockRetrieve.mock.calls[0]![2] as Record<string, unknown>
    expect(options.sourceId).toBe('agreement-from-lookup')
  })

  it('foreign/hallucinated id is passed through unchanged; zero rows surface as the Swedish empty error (workspace clause is the safety net)', async () => {
    mockRetrieve.mockResolvedValue({ results: [] })
    const tool = makeTool('ws-1')

    const out = (await tool.execute({
      query: 'q',
      agreementId: 'foreign-agreement-id',
      limit: 5,
    })) as { error: boolean; message: string; guidance: string }

    const options = mockRetrieve.mock.calls[0]![2] as Record<string, unknown>
    // The tool does no id validation of its own — retrieval's workspace
    // clause filters a foreign id to zero chunks.
    expect(options.sourceId).toBe('foreign-agreement-id')
    expect(mockRetrieve.mock.calls[0]![1]).toBe('ws-1')
    expect(out.error).toBe(true)
    expect(out.message).toMatch(/inga resultat/i)
    expect(out.guidance).toMatch(/utan agreementId/i)
  })
})

describe('search_collective_agreements — result mapping', () => {
  it('maps a chunk to agreementId/agreementName/workspaceFileId/snippet/relevanceScore/citationKey', async () => {
    mockRetrieve.mockResolvedValue({ results: [resultRow()] })
    const tool = makeTool()

    const out = (await tool.execute({ query: 'q', limit: 5 })) as {
      data: Array<Record<string, unknown>>
    }

    expect(out.data).toHaveLength(1)
    expect(out.data[0]).toEqual({
      agreementId: 'agreement-42',
      agreementName: 'Teknikavtalet',
      workspaceFileId: 'file-9',
      snippet: 'Uppsägningstiden är enligt avtalet minst tre månader.',
      relevanceScore: 0.912, // rounded to 3 decimals
      citationKey: 'Teknikavtalet (Kollektivavtal) > § 12 Uppsägning',
    })
  })

  it('citationKey = the contextual header (transparency.ts CA convention)', async () => {
    mockRetrieve.mockResolvedValue({ results: [resultRow()] })
    const tool = makeTool()

    const out = (await tool.execute({ query: 'q', limit: 5 })) as {
      data: Array<{ citationKey: string }>
    }
    expect(out.data[0]!.citationKey).toBe(
      'Teknikavtalet (Kollektivavtal) > § 12 Uppsägning'
    )
  })

  it('falls back to name-derived citationKey + sourceId name when metadata/header are missing', async () => {
    mockRetrieve.mockResolvedValue({
      results: [
        resultRow({ metadata: null, contextualHeader: '' }),
        resultRow({
          sourceId: 'agreement-99',
          metadata: { agreement_name: 'Byggavtalet' },
          contextualHeader: '',
        }),
      ],
    })
    const tool = makeTool()

    const out = (await tool.execute({ query: 'q', limit: 5 })) as {
      data: Array<{
        agreementName: string
        workspaceFileId: string | null
        citationKey: string
      }>
    }
    expect(out.data[0]!.agreementName).toBe('agreement-42')
    expect(out.data[0]!.workspaceFileId).toBeNull()
    expect(out.data[1]!.agreementName).toBe('Byggavtalet')
    expect(out.data[1]!.citationKey).toBe('Byggavtalet (Kollektivavtal)')
  })
})

describe('search_collective_agreements — empty + error paths', () => {
  it('unbiased empty → Swedish error steering toward search_laws for legal minimums', async () => {
    mockRetrieve.mockResolvedValue({ results: [] })
    const tool = makeTool()

    const out = (await tool.execute({ query: 'okänt', limit: 5 })) as {
      error: boolean
      message: string
      guidance: string
    }
    expect(out.error).toBe(true)
    expect(out.message).toMatch(/inga resultat/i)
    expect(out.guidance).toMatch(/search_laws/)
  })

  it('wraps a thrown retrieval error rather than throwing', async () => {
    mockRetrieve.mockRejectedValue(new Error('pgvector exploded'))
    const tool = makeTool()

    const out = (await tool.execute({ query: 'q', limit: 5 })) as {
      error: boolean
      message: string
    }
    expect(out.error).toBe(true)
    expect(out.message).toMatch(/misslyckades.*pgvector exploded/i)
  })
})
