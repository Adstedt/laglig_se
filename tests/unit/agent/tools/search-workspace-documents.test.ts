/**
 * Unit tests for the search_workspace_documents tool (Story 17.10, Task 1 + 7).
 * Mocks retrieveContext — asserts result mapping, the empty-result error path,
 * and that the tool calls retrieveContext with EXACTLY
 * sourceTypes: ['WORKSPACE_DOCUMENT'] (never USER_FILE/LEGAL_DOCUMENT).
 *
 * Mirrors tests/unit/agent/tools/search-workspace-files.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agent/retrieval', () => ({
  retrieveContext: vi.fn(),
}))

import { retrieveContext } from '@/lib/agent/retrieval'
import { createSearchWorkspaceDocumentsTool } from '@/lib/agent/tools/search-workspace-documents'

const mockRetrieve = retrieveContext as ReturnType<typeof vi.fn>

type ToolWithExecute = {
  execute: (
    _args: { query: string; limit?: number },
    _opts?: unknown
  ) => Promise<unknown>
}

function makeTool(workspaceId = 'ws-1') {
  return createSearchWorkspaceDocumentsTool(
    workspaceId
  ) as unknown as ToolWithExecute
}

function resultRow(over: Record<string, unknown> = {}) {
  return {
    id: 'chunk-1',
    content: 'Vår dataskyddspolicy kräver kryptering av personuppgifter.',
    contextualHeader: 'Dataskyddspolicy (POLICY)',
    contextPrefix: null,
    path: 'wd.chunk1',
    sourceType: 'WORKSPACE_DOCUMENT',
    sourceId: 'wd-42',
    documentNumber: null,
    slug: null,
    similarity: 0.91,
    relevanceScore: 0.876543,
    tokenCount: 120,
    metadata: {
      title: 'Dataskyddspolicy',
      document_type: 'POLICY',
      status: 'APPROVED',
      content_hash: 'h1',
    },
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createSearchWorkspaceDocumentsTool', () => {
  it('calls retrieveContext with sourceTypes: [WORKSPACE_DOCUMENT] only — never widens', async () => {
    mockRetrieve.mockResolvedValue({
      results: [resultRow()],
      legalRefs: { sfs: [], rf: [] },
      timings: [],
      reranked: false,
    })

    // Direct execute() call bypasses the AI-SDK Zod parse (where .default(5)
    // applies), so pass limit explicitly to simulate the post-Zod input.
    await makeTool('ws-1').execute({ query: 'kryptering', limit: 5 })

    expect(mockRetrieve).toHaveBeenCalledTimes(1)
    const [query, workspaceId, options] = mockRetrieve.mock.calls[0]
    expect(query).toBe('kryptering')
    expect(workspaceId).toBe('ws-1')
    expect(options).toEqual({
      sourceTypes: ['WORKSPACE_DOCUMENT'],
      topK: 5,
    })
    // Strict guarantee: never widens to USER_FILE / LEGAL_DOCUMENT.
    expect(options.sourceTypes).not.toContain('USER_FILE')
    expect(options.sourceTypes).not.toContain('LEGAL_DOCUMENT')
  })

  it('maps result rows to {documentId, title, documentType, status, snippet, relevanceScore, citationKey}', async () => {
    mockRetrieve.mockResolvedValue({
      results: [resultRow()],
      legalRefs: { sfs: [], rf: [] },
      timings: [],
      reranked: false,
    })

    const out = (await makeTool().execute({ query: 'q' })) as {
      data: Array<{
        documentId: string
        title: string
        documentType: string | null
        status: string
        versionNumber: number | null
        snippet: string
        relevanceScore: number
        citationKey: string
      }>
    }

    expect(out.data).toHaveLength(1)
    expect(out.data[0]).toEqual({
      documentId: 'wd-42',
      title: 'Dataskyddspolicy',
      documentType: 'POLICY',
      // Story 17.10b: tool returns 'APPROVED' here because the mock metadata
      // sets status: 'APPROVED' explicitly. Missing-status default is exercised
      // in the AC-11 backwards-compat test below.
      status: 'APPROVED',
      // Story 17.10b: version_number is null because the mock metadata doesn't
      // include it. When chunks are produced by the new indexer it's a number.
      versionNumber: null,
      snippet: 'Vår dataskyddspolicy kräver kryptering av personuppgifter.',
      // 0.876543 → round(× 1000)/1000 = 0.877
      relevanceScore: 0.877,
      // DEC-2: citationKey = title (bare; the agent adds the [Källa:] /
      // [Utkast:] bracket form based on the `status` field).
      citationKey: 'Dataskyddspolicy',
    })
  })

  // Story 17.10b AC 11: backwards-compatibility for legacy 17.9b chunks that
  // were indexed without a `status` key in their metadata. The tool MUST
  // default to 'APPROVED' so the agent's bracket-form decision never falls
  // back to a null tier.
  it('AC 11 backwards-compat: missing metadata.status defaults to APPROVED', async () => {
    mockRetrieve.mockResolvedValue({
      results: [
        resultRow({
          metadata: {
            title: 'Legacy Policy',
            document_type: 'POLICY',
            // status DELIBERATELY OMITTED — legacy 17.9b chunk
          },
        }),
      ],
    })

    const out = (await makeTool().execute({ query: 'q' })) as {
      data: Array<{ status: string }>
    }
    expect(out.data[0]!.status).toBe('APPROVED')
  })

  it('falls back to contextualHeader, then sourceId, when metadata.title is missing', async () => {
    mockRetrieve.mockResolvedValue({
      results: [
        resultRow({
          metadata: {},
          contextualHeader: 'Brandskyddsrutin (RUTIN)',
        }),
        resultRow({
          sourceId: 'wd-99',
          metadata: {},
          contextualHeader: '',
        }),
      ],
      legalRefs: { sfs: [], rf: [] },
      timings: [],
      reranked: false,
    })

    const out = (await makeTool().execute({ query: 'q' })) as {
      data: Array<{ title: string; citationKey: string }>
    }

    expect(out.data[0]?.title).toBe('Brandskyddsrutin (RUTIN)')
    expect(out.data[0]?.citationKey).toBe('Brandskyddsrutin (RUTIN)')
    // empty header → falls all the way to sourceId, never citationless
    expect(out.data[1]?.title).toBe('wd-99')
    expect(out.data[1]?.citationKey).toBe('wd-99')
  })

  it('returns a Swedish ToolError on empty results (and never throws)', async () => {
    mockRetrieve.mockResolvedValue({
      results: [],
      legalRefs: { sfs: [], rf: [] },
      timings: [],
      reranked: false,
    })

    const out = (await makeTool().execute({ query: 'q' })) as {
      error: true
      message: string
      guidance?: string
    }

    expect(out.error).toBe(true)
    expect(out.message).toMatch(/inga resultat.*styrdokument/i)
    expect(out.guidance).toMatch(/omformulera|list_workspace_documents/i)
  })

  it('respects the limit argument and forwards it as topK', async () => {
    mockRetrieve.mockResolvedValue({
      results: [],
      legalRefs: { sfs: [], rf: [] },
      timings: [],
      reranked: false,
    })

    await makeTool().execute({ query: 'q', limit: 3 })

    expect(mockRetrieve.mock.calls[0]?.[2]).toEqual({
      sourceTypes: ['WORKSPACE_DOCUMENT'],
      topK: 3,
    })
  })

  it('wraps a retrieveContext throw as a Swedish ToolError (does not propagate)', async () => {
    mockRetrieve.mockRejectedValue(new Error('rerank API down'))

    const out = (await makeTool().execute({ query: 'q' })) as {
      error: true
      message: string
    }

    expect(out.error).toBe(true)
    expect(out.message).toContain('rerank API down')
  })
})
