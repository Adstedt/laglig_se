/**
 * Story 17.18 AC 9 / AC 10 — DEC-2 dual-state hold (adversarial).
 *
 * The 17.10b DEC-2 contract: the agent NEVER cites a DRAFT as canonical
 * policy. Under Story 17.16's dual-pointer model, this gets a new test
 * surface: the agent now has BOTH an approved AND a draft for the same doc
 * available simultaneously, and the LLM's natural tendency to summarize-
 * and-blend could conflate them in response text even if the chunks are
 * tagged correctly.
 *
 * This unit test asserts the TOOL-LEVEL contract that makes the DEC-2 hold
 * possible at the model layer:
 *
 *  1. `search_workspace_documents` returns BOTH tiers as separate hits with
 *     distinct `tier` and `citationKey`s — never merging the two into one
 *     hit, never silently dropping the approved when only the draft matches
 *     more strongly.
 *  2. The approved-tier hit's `citationKey` is the clean title (routes
 *     `[Källa:]` — canonical).
 *  3. The draft-tier hit's `citationKey` carries the explicit `(utkast v<N>)`
 *     suffix (routes `[Utkast:]` — visible-by-design hedge).
 *  4. Both hits carry `dualState: true` so the agent's prompt-driven
 *     framing logic knows to apply the "Ert godkända X kräver A. Ett
 *     pågående utkast föreslår B" pattern.
 *  5. `get_workspace_document` returns BOTH tiers in nested `approved` +
 *     `draft` objects with `dualState: true` — never a single conflated
 *     `content` field for dual-state docs.
 *
 * The model-layer test (a real LLM call against a seeded dual-state doc
 * asking "Vad är vår officiella X-policy?") is deferred to the owner-led
 * live smoke per the Story 17.16 / 17.17 precedent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agent/retrieval', () => ({
  retrieveContext: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/transforms/html-to-markdown', () => ({
  htmlToMarkdown: vi.fn((html: string) => `MD:${html}`),
}))

import { retrieveContext } from '@/lib/agent/retrieval'
import { prisma } from '@/lib/prisma'
import { createSearchWorkspaceDocumentsTool } from '@/lib/agent/tools/search-workspace-documents'
import { createGetWorkspaceDocumentTool } from '@/lib/agent/tools/get-workspace-document'

const mockRetrieve = retrieveContext as ReturnType<typeof vi.fn>
const mockWdFindMany = (
  prisma as unknown as {
    workspaceDocument: { findMany: ReturnType<typeof vi.fn> }
  }
).workspaceDocument.findMany
const mockWdFindFirst = (
  prisma as unknown as {
    workspaceDocument: { findFirst: ReturnType<typeof vi.fn> }
  }
).workspaceDocument.findFirst

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DEC-2 dual-state hold — search_workspace_documents', () => {
  // The adversarial setup: a dual-state Arbetsmiljöpolicy where the APPROVED
  // tier (v8) says "annual" and the DRAFT tier (v9) says "semi-annual" risk
  // assessment. A naive agent confronted with both chunks might respond
  // "Arbetsmiljöpolicy kräver halvårsvis bedömning" — citing the DRAFT as
  // canonical. This test asserts the TOOL distinguishes the two tiers so the
  // agent's prompt-driven framing has the structured signal it needs to
  // avoid that conflation.

  it('returns BOTH tiers as distinct hits with tier=APPROVED + tier=DRAFT + dualState=true', async () => {
    mockRetrieve.mockResolvedValue({
      results: [
        {
          sourceId: 'doc-amp',
          content: 'Årlig riskbedömning av kontorsmiljön krävs.',
          contextualHeader: 'Arbetsmiljöpolicy (POLICY)',
          contextPrefix: null,
          path: 'wd.chunk1',
          sourceType: 'WORKSPACE_DOCUMENT',
          documentNumber: null,
          slug: null,
          similarity: 0.92,
          relevanceScore: 0.91,
          tokenCount: 80,
          metadata: {
            title: 'Arbetsmiljöpolicy',
            document_type: 'POLICY',
            status: 'APPROVED',
            tier: 'APPROVED',
            version_number: 8,
          },
        },
        {
          sourceId: 'doc-amp',
          content: 'Halvårsvis bedömning av distansarbetsplatser föreslås.',
          contextualHeader: 'Arbetsmiljöpolicy (POLICY)',
          contextPrefix: null,
          path: 'wd.chunk2',
          sourceType: 'WORKSPACE_DOCUMENT',
          documentNumber: null,
          slug: null,
          similarity: 0.88,
          relevanceScore: 0.87,
          tokenCount: 80,
          metadata: {
            title: 'Arbetsmiljöpolicy',
            document_type: 'POLICY',
            status: 'DRAFT',
            tier: 'DRAFT',
            version_number: 9,
          },
        },
      ],
      legalRefs: { sfs: [], rf: [] },
      timings: [],
      reranked: false,
    })
    mockWdFindMany.mockResolvedValue([
      {
        id: 'doc-amp',
        current_approved_version_id: 'v-8',
        current_draft_version_id: 'v-9',
        current_draft_version: { version_number: 9 },
      },
    ])

    const tool = createSearchWorkspaceDocumentsTool('ws-1') as unknown as {
      execute: (_a: { query: string; limit?: number }) => Promise<unknown>
    }
    const out = (await tool.execute({
      query: 'Vad kräver vår arbetsmiljöpolicy?',
    })) as {
      data: Array<{
        documentId: string
        tier: 'APPROVED' | 'DRAFT'
        dualState: boolean
        citationKey: string
        snippet: string
        status: string
      }>
    }

    expect(out.data).toHaveLength(2)

    const approved = out.data.find((d) => d.tier === 'APPROVED')!
    const draft = out.data.find((d) => d.tier === 'DRAFT')!

    // Both must be distinct hits — NEVER conflated into one.
    expect(approved).toBeDefined()
    expect(draft).toBeDefined()
    expect(approved.documentId).toBe('doc-amp')
    expect(draft.documentId).toBe('doc-amp')

    // Both carry dualState=true so the agent's prompt framing knows to apply
    // the "Ert godkända X kräver A. Ett pågående utkast föreslår B" pattern.
    expect(approved.dualState).toBe(true)
    expect(draft.dualState).toBe(true)

    // citationKey routing: approved clean → [Källa:], draft suffixed → [Utkast:].
    expect(approved.citationKey).toBe('Arbetsmiljöpolicy')
    // SF-2: draft.version_number (9), NOT approved+1.
    expect(draft.citationKey).toBe('Arbetsmiljöpolicy (utkast v9)')

    // status field is also tier-correct so the legacy 17.10b citation
    // routing (status → bracket form) still functions even if the agent
    // ignores the tier field.
    expect(approved.status).toBe('APPROVED')
    expect(draft.status).toBe('DRAFT')

    // The actual snippets are distinct content — proves the tool didn't
    // dedupe across tiers (which would have hidden the draft's proposal).
    expect(approved.snippet).toContain('Årlig')
    expect(draft.snippet).toContain('Halvårsvis')
  })

  it('does NOT silently drop the approved-tier hit when the draft scores higher', async () => {
    // The naive concern: rerank places the draft chunk at rank #1 and the
    // approved at rank #2. With aggressive top-1 routing the agent would
    // see ONLY the draft and might cite it as canonical. The tool's tier
    // dedup must keep BOTH (one per tier).
    mockRetrieve.mockResolvedValue({
      results: [
        // Draft scored HIGHER than approved — adversarial ordering
        {
          sourceId: 'doc-x',
          content: 'draft content',
          contextualHeader: 'X (POLICY)',
          contextPrefix: null,
          path: 'wd.chunk1',
          sourceType: 'WORKSPACE_DOCUMENT',
          documentNumber: null,
          slug: null,
          similarity: 0.95,
          relevanceScore: 0.94,
          tokenCount: 80,
          metadata: { title: 'X', tier: 'DRAFT', status: 'DRAFT' },
        },
        {
          sourceId: 'doc-x',
          content: 'approved content',
          contextualHeader: 'X (POLICY)',
          contextPrefix: null,
          path: 'wd.chunk2',
          sourceType: 'WORKSPACE_DOCUMENT',
          documentNumber: null,
          slug: null,
          similarity: 0.88,
          relevanceScore: 0.87,
          tokenCount: 80,
          metadata: { title: 'X', tier: 'APPROVED', status: 'APPROVED' },
        },
      ],
      legalRefs: { sfs: [], rf: [] },
      timings: [],
      reranked: false,
    })
    mockWdFindMany.mockResolvedValue([
      {
        id: 'doc-x',
        current_approved_version_id: 'v-1',
        current_draft_version_id: 'v-2',
        current_draft_version: { version_number: 2 },
      },
    ])

    const tool = createSearchWorkspaceDocumentsTool('ws-1') as unknown as {
      execute: (_a: { query: string; limit?: number }) => Promise<unknown>
    }
    const out = (await tool.execute({ query: 'q' })) as {
      data: Array<{ tier: string }>
    }

    // BOTH tiers present — never silent-drop the approved.
    expect(out.data).toHaveLength(2)
    expect(out.data.find((d) => d.tier === 'APPROVED')).toBeDefined()
    expect(out.data.find((d) => d.tier === 'DRAFT')).toBeDefined()
  })

  it('approved-only doc (no dual state): single hit, dualState=false, clean citationKey', async () => {
    // Sanity check on the non-dual case: the tool must NOT spuriously claim
    // dualState=true when no draft pointer is set.
    mockRetrieve.mockResolvedValue({
      results: [
        {
          sourceId: 'doc-stable',
          content: 'content',
          contextualHeader: 'Stable',
          contextPrefix: null,
          path: 'wd.chunk1',
          sourceType: 'WORKSPACE_DOCUMENT',
          documentNumber: null,
          slug: null,
          similarity: 0.9,
          relevanceScore: 0.89,
          tokenCount: 80,
          metadata: { title: 'Stable', tier: 'APPROVED', status: 'APPROVED' },
        },
      ],
      legalRefs: { sfs: [], rf: [] },
      timings: [],
      reranked: false,
    })
    mockWdFindMany.mockResolvedValue([
      {
        id: 'doc-stable',
        current_approved_version_id: 'v-1',
        current_draft_version_id: null, // no draft
        current_draft_version: null,
      },
    ])

    const tool = createSearchWorkspaceDocumentsTool('ws-1') as unknown as {
      execute: (_a: { query: string; limit?: number }) => Promise<unknown>
    }
    const out = (await tool.execute({ query: 'q' })) as {
      data: Array<{ tier: string; dualState: boolean; citationKey: string }>
    }

    expect(out.data).toHaveLength(1)
    expect(out.data[0]).toMatchObject({
      tier: 'APPROVED',
      dualState: false,
      citationKey: 'Stable',
    })
  })
})

describe('DEC-2 dual-state hold — get_workspace_document', () => {
  it('returns distinct approved + draft objects + dualState=true for dual-state docs', async () => {
    mockWdFindFirst.mockResolvedValue({
      id: 'doc-amp',
      title: 'Arbetsmiljöpolicy',
      document_type: 'POLICY',
      status: 'APPROVED',
      document_number: null,
      review_date: null,
      approved_at: new Date('2026-05-22T10:00:00.000Z'),
      current_version_number: 9,
      approver: { name: 'Anna' },
      current_approved_version_id: 'v-8',
      current_draft_version_id: 'v-9',
      draft_status: 'DRAFT',
      current_approved_version: {
        content_html: '<p>Årlig riskbedömning.</p>',
        version_number: 8,
        approved_at: new Date('2026-05-22T10:00:00.000Z'),
      },
      current_draft_version: {
        content_html: '<p>Halvårsvis bedömning.</p>',
        version_number: 9,
        created_at: new Date('2026-06-04T12:00:00.000Z'),
      },
      current_version: { content_html: '<p>x</p>', version_number: 8 },
      task_links: [],
      list_item_links: [],
    })

    const tool = createGetWorkspaceDocumentTool('ws-1') as unknown as {
      execute: (_a: { document_id: string }) => Promise<unknown>
    }
    const out = (await tool.execute({ document_id: 'doc-amp' })) as {
      data: {
        approved: {
          citationKey: string
          content: string
          versionNumber: number
        }
        draft: {
          citationKey: string
          content: string
          versionNumber: number
          draftStatus: string
        }
        dualState: boolean
        content: string
      }
    }

    // BOTH tier objects populated — distinct content, distinct citationKey.
    expect(out.data.dualState).toBe(true)
    expect(out.data.approved).toBeDefined()
    expect(out.data.draft).toBeDefined()

    // Distinct content per tier — never conflated.
    expect(out.data.approved.content).toContain('Årlig')
    expect(out.data.draft.content).toContain('Halvårsvis')

    // citationKey routing — same shapes as search_workspace_documents.
    expect(out.data.approved.citationKey).toBe('Arbetsmiljöpolicy')
    expect(out.data.draft.citationKey).toBe('Arbetsmiljöpolicy (utkast v9)')

    // SF-2: draft.versionNumber is the actual row number, not approved+1.
    expect(out.data.draft.versionNumber).toBe(9)

    // Backward-compat top-level content defaults to APPROVED (the
    // "currently effective" content) — never the draft.
    expect(out.data.content).toContain('Årlig')
    expect(out.data.content).not.toContain('Halvårsvis')

    // Draft sub-status surfaces so the agent can hedge correctly.
    expect(out.data.draft.draftStatus).toBe('DRAFT')
  })
})
