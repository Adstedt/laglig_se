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

// Story 17.18: dualState + draft.version_number lookup on workspace_documents.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

import { retrieveContext } from '@/lib/agent/retrieval'
import { prisma } from '@/lib/prisma'
import { createSearchWorkspaceDocumentsTool } from '@/lib/agent/tools/search-workspace-documents'

const mockRetrieve = retrieveContext as ReturnType<typeof vi.fn>
const mockWdFindMany = (
  prisma as unknown as {
    workspaceDocument: { findMany: ReturnType<typeof vi.fn> }
  }
).workspaceDocument.findMany

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
  // Story 17.18: default to no dual-state docs found (single-tier hits don't
  // need a dualState match). Tests that exercise the dual-state path override
  // this with mockResolvedValueOnce.
  mockWdFindMany.mockResolvedValue([])
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
    // Story 17.18 AC 3: tool pulls 2× topK from retrieval to allow tier dedup
    // without silently halving the post-dedup result count.
    expect(options).toEqual({
      sourceTypes: ['WORKSPACE_DOCUMENT'],
      topK: 10,
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
      // Story 17.18 AC 2: tier defaults to 'APPROVED' for legacy chunks without
      // metadata.tier (the existing 17.10b mock doesn't set it).
      tier: 'APPROVED',
      // Story 17.18 AC 3: dualState is false because the workspaceDocument
      // findMany mock returns empty (no dual-state doc found).
      dualState: false,
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

    // Story 17.18 AC 3: topK = limit × 2 to absorb tier dedup.
    expect(mockRetrieve.mock.calls[0]?.[2]).toEqual({
      sourceTypes: ['WORKSPACE_DOCUMENT'],
      topK: 6,
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

  // ==========================================================================
  // Story 17.18 AC 2 + AC 3 — dual-tier hits + dedup + dualState + citationKey
  // ==========================================================================

  describe('Story 17.18 — dual-tier hits', () => {
    it('AC 2: passes through metadata.tier on each result', async () => {
      mockRetrieve.mockResolvedValue({
        results: [
          resultRow({
            sourceId: 'doc-1',
            metadata: {
              title: 'Policy',
              document_type: 'POLICY',
              status: 'APPROVED',
              tier: 'APPROVED',
            },
          }),
          resultRow({
            sourceId: 'doc-2',
            metadata: {
              title: 'Annan policy',
              document_type: 'POLICY',
              status: 'DRAFT',
              tier: 'DRAFT',
            },
          }),
        ],
        legalRefs: { sfs: [], rf: [] },
        timings: [],
        reranked: false,
      })
      mockWdFindMany.mockResolvedValueOnce([
        // doc-2 has both pointers → dualState true
        {
          id: 'doc-2',
          current_approved_version_id: 'v-app',
          current_draft_version_id: 'v-draft',
          current_draft_version: { version_number: 4 },
        },
      ])

      const out = (await makeTool().execute({ query: 'q' })) as {
        data: Array<{
          documentId: string
          tier: 'APPROVED' | 'DRAFT'
          dualState: boolean
          citationKey: string
        }>
      }

      expect(out.data).toHaveLength(2)
      expect(out.data[0]).toMatchObject({
        documentId: 'doc-1',
        tier: 'APPROVED',
        dualState: false,
        citationKey: 'Policy',
      })
      expect(out.data[1]).toMatchObject({
        documentId: 'doc-2',
        tier: 'DRAFT',
        dualState: true,
        // SF-2: uses draft.version_number (4), NOT approved+1
        citationKey: 'Annan policy (utkast v4)',
      })
    })

    it('AC 3 dedup: dual-state doc with multiple same-tier hits keeps only the highest-ranked one per tier', async () => {
      // Same doc-1, three hits across both tiers — should dedup to two.
      mockRetrieve.mockResolvedValue({
        results: [
          resultRow({
            sourceId: 'doc-1',
            content: 'approved chunk A',
            relevanceScore: 0.9,
            metadata: { title: 'Policy', tier: 'APPROVED', status: 'APPROVED' },
          }),
          resultRow({
            sourceId: 'doc-1',
            content: 'approved chunk B (lower rank)',
            relevanceScore: 0.7,
            metadata: { title: 'Policy', tier: 'APPROVED', status: 'APPROVED' },
          }),
          resultRow({
            sourceId: 'doc-1',
            content: 'draft chunk',
            relevanceScore: 0.8,
            metadata: { title: 'Policy', tier: 'DRAFT', status: 'DRAFT' },
          }),
        ],
        legalRefs: { sfs: [], rf: [] },
        timings: [],
        reranked: false,
      })
      mockWdFindMany.mockResolvedValueOnce([
        {
          id: 'doc-1',
          current_approved_version_id: 'v-app',
          current_draft_version_id: 'v-draft',
          current_draft_version: { version_number: 7 },
        },
      ])

      const out = (await makeTool().execute({ query: 'q', limit: 5 })) as {
        data: Array<{
          tier: string
          snippet: string
          citationKey: string
          dualState: boolean
        }>
      }

      // 3 hits → 2 after dedup (one per tier)
      expect(out.data).toHaveLength(2)
      // Higher-ranked approved kept (rank 0.9, "chunk A"); the 0.7 dup dropped.
      const approved = out.data.find((d) => d.tier === 'APPROVED')!
      expect(approved.snippet).toBe('approved chunk A')
      expect(approved.citationKey).toBe('Policy')
      expect(approved.dualState).toBe(true)
      // Draft tier kept
      const draft = out.data.find((d) => d.tier === 'DRAFT')!
      expect(draft.snippet).toBe('draft chunk')
      expect(draft.citationKey).toBe('Policy (utkast v7)')
      expect(draft.dualState).toBe(true)
    })

    it('SF-2 citationKey: draft tier uses draft.version_number directly (NOT approved+1)', async () => {
      // The Almåsa toilets policy from the 17.17 smoke ended at approved v8 +
      // draft v9 → approved+1 = 9, draft.version_number = 9. Match here.
      // But if multi-cycle promote/Förkasta diverged, draft.version_number
      // could be 12 over approved v8 — and this test confirms the tool uses
      // the actual draft number, not the v(approved+1) shortcut.
      mockRetrieve.mockResolvedValue({
        results: [
          resultRow({
            sourceId: 'doc-multi',
            metadata: {
              title: 'Multi-cycle policy',
              tier: 'DRAFT',
              status: 'DRAFT',
            },
          }),
        ],
        legalRefs: { sfs: [], rf: [] },
        timings: [],
        reranked: false,
      })
      mockWdFindMany.mockResolvedValueOnce([
        {
          id: 'doc-multi',
          current_approved_version_id: 'v-old-approved',
          current_draft_version_id: 'v-current-draft',
          // Multi-cycle: draft.version_number = 12, NOT approved+1 = 9
          current_draft_version: { version_number: 12 },
        },
      ])

      const out = (await makeTool().execute({ query: 'q' })) as {
        data: Array<{ citationKey: string }>
      }

      expect(out.data[0]!.citationKey).toBe('Multi-cycle policy (utkast v12)')
    })

    it('never-approved DRAFT doc: tier=DRAFT, dualState=false, citationKey with version', async () => {
      mockRetrieve.mockResolvedValue({
        results: [
          resultRow({
            sourceId: 'doc-fresh',
            metadata: { title: 'Nytt utkast', tier: 'DRAFT', status: 'DRAFT' },
          }),
        ],
        legalRefs: { sfs: [], rf: [] },
        timings: [],
        reranked: false,
      })
      mockWdFindMany.mockResolvedValueOnce([
        {
          id: 'doc-fresh',
          // never-approved → only draft pointer set
          current_approved_version_id: null,
          current_draft_version_id: 'v-1',
          current_draft_version: { version_number: 1 },
        },
      ])

      const out = (await makeTool().execute({ query: 'q' })) as {
        data: Array<{ tier: string; dualState: boolean; citationKey: string }>
      }

      expect(out.data[0]).toMatchObject({
        tier: 'DRAFT',
        dualState: false,
        // SF-2 never-approved fallback: same shape, uses draft.version_number
        citationKey: 'Nytt utkast (utkast v1)',
      })
    })

    it('legacy chunks (no metadata.tier): default to APPROVED tier, no citationKey suffix', async () => {
      mockRetrieve.mockResolvedValue({
        results: [
          resultRow({
            sourceId: 'doc-legacy',
            metadata: {
              title: 'Legacy policy',
              document_type: 'POLICY',
              status: 'APPROVED',
              // tier OMITTED — pre-17.18 chunk
            },
          }),
        ],
        legalRefs: { sfs: [], rf: [] },
        timings: [],
        reranked: false,
      })

      const out = (await makeTool().execute({ query: 'q' })) as {
        data: Array<{ tier: string; citationKey: string }>
      }

      expect(out.data[0]).toMatchObject({
        tier: 'APPROVED',
        citationKey: 'Legacy policy',
      })
    })

    it('draft-tier hit with missing dualState lookup: defensive citationKey fallback', async () => {
      mockRetrieve.mockResolvedValue({
        results: [
          resultRow({
            sourceId: 'doc-missing-state',
            metadata: { title: 'Orphan', tier: 'DRAFT', status: 'DRAFT' },
          }),
        ],
        legalRefs: { sfs: [], rf: [] },
        timings: [],
        reranked: false,
      })
      // No matching doc returned from findMany (defensive — should not happen
      // post-17.16 backfill, but the tool degrades gracefully).
      mockWdFindMany.mockResolvedValueOnce([])

      const out = (await makeTool().execute({ query: 'q' })) as {
        data: Array<{ tier: string; dualState: boolean; citationKey: string }>
      }

      expect(out.data[0]).toMatchObject({
        tier: 'DRAFT',
        dualState: false,
        // Fallback: versionless "(utkast)" suffix
        citationKey: 'Orphan (utkast)',
      })
    })
  })
})
