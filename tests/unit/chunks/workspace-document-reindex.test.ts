/**
 * Tests for styrdokument RAG re-index hooks (Story 17.9b → extended by 17.10b)
 * - decideReindexOnStatusChange: AC 1 (new 3-way: DELETE / METADATA_UPDATE / NONE)
 * - decideReindexOnContentChange: AC 1 (new helper)
 * - hashDocumentContent: deterministic sha256 (unchanged)
 * - indexWorkspaceDocument: now writes version_number into chunk metadata (AC 3)
 * - deindexWorkspaceDocument: unchanged
 * - updateWorkspaceDocumentStatusMetadata: NEW (AC 4) — cheap UPDATE, no embed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: {
      findFirst: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}))

vi.mock('@/lib/transforms/html-to-markdown', () => ({
  htmlToMarkdown: vi.fn((html: string) => `MD:${html}`),
}))

vi.mock('@/lib/chunks/sync-workspace-chunks', () => ({
  syncWorkspaceChunks: vi.fn().mockResolvedValue({ skipped: false }),
  updateChunkMetadata: vi
    .fn()
    .mockResolvedValue({ chunksUpdated: 3, duration: 5 }),
}))

import { prisma } from '@/lib/prisma'
import {
  syncWorkspaceChunks,
  updateChunkMetadata,
} from '@/lib/chunks/sync-workspace-chunks'
import { htmlToMarkdown } from '@/lib/transforms/html-to-markdown'
import {
  DRAFT_REINDEX_DEBOUNCE_MS,
  decideReindexOnStatusChange,
  decideReindexOnContentChange,
  hashDocumentContent,
  indexWorkspaceDocument,
  deindexWorkspaceDocument,
  updateWorkspaceDocumentStatusMetadata,
  markWorkspaceDocumentDirty,
} from '@/lib/chunks/workspace-document-reindex'

const mockFindFirst = (
  prisma as unknown as {
    workspaceDocument: { findFirst: ReturnType<typeof vi.fn> }
  }
).workspaceDocument.findFirst
const mockUpdateMany = (
  prisma as unknown as {
    workspaceDocument: { updateMany: ReturnType<typeof vi.fn> }
  }
).workspaceDocument.updateMany
const mockSync = syncWorkspaceChunks as ReturnType<typeof vi.fn>
const mockUpdateMeta = updateChunkMetadata as ReturnType<typeof vi.fn>

/**
 * AGENT-001 defense: indexWorkspaceDocument gates on content_json (the editor's
 * source of truth). Tests that exercise the "this tier has content → index it"
 * path must populate content_json with a non-empty Tiptap doc; tests that
 * exercise the empty-tier cleanup path can leave content_json missing or set
 * it to {} (the legacy divergence shape).
 */
const NON_EMPTY_TIPTAP_DOC = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'placeholder' }] },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DRAFT_REINDEX_DEBOUNCE_MS', () => {
  it('is the 17.10b 60s named constant per DEC-4', () => {
    expect(DRAFT_REINDEX_DEBOUNCE_MS).toBe(60_000)
  })
})

describe('decideReindexOnStatusChange — 17.10b AC 1 (3-way)', () => {
  it.each([
    ['DRAFT', 'ARCHIVED'],
    ['IN_REVIEW', 'ARCHIVED'],
    ['APPROVED', 'ARCHIVED'],
    ['SUPERSEDED', 'ARCHIVED'],
    ['DRAFT', 'SUPERSEDED'],
    ['APPROVED', 'SUPERSEDED'],
  ])('DELETE when entering terminal state (%s → %s)', (oldS, newS) => {
    expect(decideReindexOnStatusChange(oldS, newS)).toBe('DELETE')
  })

  it.each([
    ['DRAFT', 'IN_REVIEW'],
    ['IN_REVIEW', 'DRAFT'],
    ['IN_REVIEW', 'APPROVED'],
    ['APPROVED', 'DRAFT'],
    ['DRAFT', 'APPROVED'],
  ])(
    'METADATA_UPDATE for non-terminal status change (%s → %s)',
    (oldS, newS) => {
      expect(decideReindexOnStatusChange(oldS, newS)).toBe('METADATA_UPDATE')
    }
  )

  it.each([
    ['DRAFT', 'DRAFT'],
    ['APPROVED', 'APPROVED'],
    ['ARCHIVED', 'ARCHIVED'],
  ])('NONE when status did not actually change (%s → %s)', (oldS, newS) => {
    expect(decideReindexOnStatusChange(oldS, newS)).toBe('NONE')
  })
})

describe('decideReindexOnContentChange — 17.10b AC 1', () => {
  it('NONE when both hashes are equal non-empty strings', () => {
    expect(decideReindexOnContentChange('abc', 'abc')).toBe('NONE')
  })

  it('REINDEX when hashes differ', () => {
    expect(decideReindexOnContentChange('abc', 'xyz')).toBe('REINDEX')
  })

  it.each([
    [null, 'abc'],
    ['abc', null],
    [undefined, 'abc'],
    [null, null],
  ])('REINDEX when either side is nullish (%s, %s)', (a, b) => {
    expect(decideReindexOnContentChange(a, b)).toBe('REINDEX')
  })
})

describe('hashDocumentContent', () => {
  it('is deterministic and content-sensitive (sha256 hex)', () => {
    const a = hashDocumentContent('<p>policy</p>')
    expect(a).toMatch(/^[a-f0-9]{64}$/)
    expect(hashDocumentContent('<p>policy</p>')).toBe(a)
    expect(hashDocumentContent('<p>changed</p>')).not.toBe(a)
  })
})

describe('indexWorkspaceDocument — 17.10b AC 3 (version_number in metadata)', () => {
  it('passes status + version_number into chunk metadata', async () => {
    mockFindFirst.mockResolvedValue({
      title: 'Dataskyddspolicy',
      document_type: 'POLICY',
      status: 'DRAFT',
      current_version_number: 3,
      current_version: {
        content_html: '<h1>Policy</h1>',
        content_json: NON_EMPTY_TIPTAP_DOC,
      },
    })

    await indexWorkspaceDocument('doc-1', 'ws-1')

    expect(htmlToMarkdown).toHaveBeenCalledWith('<h1>Policy</h1>')
    expect(mockSync).toHaveBeenCalledWith(
      'doc-1',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'MD:<h1>Policy</h1>',
      expect.objectContaining({
        title: 'Dataskyddspolicy',
        document_type: 'POLICY',
        status: 'DRAFT',
        version_number: 3,
        content_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    )
  })

  it('indexes APPROVED documents (existing 17.9b behavior preserved)', async () => {
    mockFindFirst.mockResolvedValue({
      title: 'Diskrimineringspolicy',
      document_type: 'POLICY',
      status: 'APPROVED',
      current_version_number: 1,
      current_version: {
        content_html: '<p>x</p>',
        content_json: NON_EMPTY_TIPTAP_DOC,
      },
    })

    await indexWorkspaceDocument('doc-2', 'ws-1')

    expect(mockSync).toHaveBeenCalledWith(
      'doc-2',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'MD:<p>x</p>',
      expect.objectContaining({ status: 'APPROVED', version_number: 1 })
    )
  })

  it('no-ops when the document is not found (workspace-scoped miss)', async () => {
    mockFindFirst.mockResolvedValue(null)
    await indexWorkspaceDocument('doc-x', 'ws-1')
    expect(mockSync).not.toHaveBeenCalled()
  })
})

// ============================================================================
// Story 17.18 AC 1 / AC 2 — dual-tier indexing (load-bearing)
// ============================================================================
//
// Each test verifies the correct sync calls fire for a given pointer state:
//   APPROVED-only → 1 APPROVED-tier index + 1 DRAFT-tier cleanup
//   DRAFT-only    → 1 APPROVED-tier cleanup + 1 DRAFT-tier index
//   dual-state    → 1 APPROVED-tier index + 1 DRAFT-tier index
//   transition (promote / discardDraft) is the dual-state → APPROVED-only case;
//   the DRAFT-tier cleanup call (SF-1 — physical deletion of orphaned chunks)
//   is the load-bearing assertion that makes Story 17.16's after(reindex)
//   contract land DRAFT chunks correctly.

describe('indexWorkspaceDocument — Story 17.18 AC 1 dual-tier indexing', () => {
  it('APPROVED-only doc: indexes APPROVED tier + cleans up DRAFT tier (null markdown)', async () => {
    mockFindFirst.mockResolvedValue({
      title: 'Arbetsmiljöpolicy',
      document_type: 'POLICY',
      status: 'APPROVED',
      current_version_number: 5,
      current_approved_version_id: 'v_5',
      current_draft_version_id: null,
      draft_status: null,
      current_approved_version: {
        content_html: '<h1>v5</h1>',
        content_json: NON_EMPTY_TIPTAP_DOC,
        version_number: 5,
      },
      current_draft_version: null,
      current_version: null,
    })

    await indexWorkspaceDocument('doc-1', 'ws-1')

    // APPROVED tier indexed
    expect(mockSync).toHaveBeenCalledWith(
      'doc-1',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'MD:<h1>v5</h1>',
      expect.objectContaining({
        tier: 'APPROVED',
        status: 'APPROVED',
        version_number: 5,
        content_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    )
    // DRAFT tier cleanup — null markdown + tier scope deletes orphans
    expect(mockSync).toHaveBeenCalledWith(
      'doc-1',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      null,
      expect.objectContaining({ content_hash: null, tier: 'DRAFT' })
    )
    expect(mockSync).toHaveBeenCalledTimes(2)
  })

  it('Dual-state doc: indexes BOTH tiers with correct metadata', async () => {
    mockFindFirst.mockResolvedValue({
      title: 'Almåsa toaletter',
      document_type: 'POLICY',
      status: 'APPROVED',
      current_version_number: 9,
      current_approved_version_id: 'v_8',
      current_draft_version_id: 'v_9',
      draft_status: 'DRAFT',
      current_approved_version: {
        content_html: '<p>approved v8</p>',
        content_json: NON_EMPTY_TIPTAP_DOC,
        version_number: 8,
      },
      current_draft_version: {
        content_html: '<p>draft v9</p>',
        content_json: NON_EMPTY_TIPTAP_DOC,
        version_number: 9,
      },
      current_version: null,
    })

    await indexWorkspaceDocument('doc-dual', 'ws-1')

    expect(mockSync).toHaveBeenCalledWith(
      'doc-dual',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'MD:<p>approved v8</p>',
      expect.objectContaining({
        tier: 'APPROVED',
        status: 'APPROVED',
        version_number: 8,
      })
    )
    expect(mockSync).toHaveBeenCalledWith(
      'doc-dual',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'MD:<p>draft v9</p>',
      expect.objectContaining({
        tier: 'DRAFT',
        status: 'DRAFT',
        version_number: 9,
      })
    )
    expect(mockSync).toHaveBeenCalledTimes(2)
  })

  it('Dual-state IN_REVIEW: draft tier carries status=IN_REVIEW from draft_status', async () => {
    mockFindFirst.mockResolvedValue({
      title: 'Policy under granskning',
      document_type: 'POLICY',
      status: 'APPROVED',
      current_version_number: 4,
      current_approved_version_id: 'v_3',
      current_draft_version_id: 'v_4',
      draft_status: 'IN_REVIEW',
      current_approved_version: {
        content_html: '<p>v3</p>',
        content_json: NON_EMPTY_TIPTAP_DOC,
        version_number: 3,
      },
      current_draft_version: {
        content_html: '<p>v4</p>',
        content_json: NON_EMPTY_TIPTAP_DOC,
        version_number: 4,
      },
      current_version: null,
    })

    await indexWorkspaceDocument('doc-ir', 'ws-1')

    expect(mockSync).toHaveBeenCalledWith(
      'doc-ir',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'MD:<p>v4</p>',
      expect.objectContaining({ tier: 'DRAFT', status: 'IN_REVIEW' })
    )
  })

  it('Never-approved DRAFT doc: indexes DRAFT tier + cleans up APPROVED tier', async () => {
    mockFindFirst.mockResolvedValue({
      title: 'Nytt utkast',
      document_type: 'POLICY',
      status: 'DRAFT',
      current_version_number: 1,
      current_approved_version_id: null,
      current_draft_version_id: 'v_1',
      draft_status: 'DRAFT',
      current_approved_version: null,
      current_draft_version: {
        content_html: '<p>brand new</p>',
        content_json: NON_EMPTY_TIPTAP_DOC,
        version_number: 1,
      },
      current_version: null,
    })

    await indexWorkspaceDocument('doc-new', 'ws-1')

    // APPROVED tier cleanup
    expect(mockSync).toHaveBeenCalledWith(
      'doc-new',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      null,
      expect.objectContaining({ content_hash: null, tier: 'APPROVED' })
    )
    // DRAFT tier indexed
    expect(mockSync).toHaveBeenCalledWith(
      'doc-new',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'MD:<p>brand new</p>',
      expect.objectContaining({
        tier: 'DRAFT',
        status: 'DRAFT',
        version_number: 1,
      })
    )
    expect(mockSync).toHaveBeenCalledTimes(2)
  })

  it('SF-1 transition (post-Förkasta / post-promote): orphaned DRAFT tier physically deleted', async () => {
    // The "after Förkasta" state — Story 17.16 AC 7 nulls the draft pointer.
    // Story 17.18's reindex should now delete the orphan DRAFT chunks
    // (NOT mark-stale per SF-1).
    mockFindFirst.mockResolvedValue({
      title: 'Förkastat utkast återställt',
      document_type: 'POLICY',
      status: 'APPROVED',
      current_version_number: 7, // counter stays at the discarded draft's number
      current_approved_version_id: 'v_6',
      current_draft_version_id: null, // Förkasta cleared this
      draft_status: null,
      current_approved_version: {
        content_html: '<p>v6</p>',
        content_json: NON_EMPTY_TIPTAP_DOC,
        version_number: 6,
      },
      current_draft_version: null,
      current_version: null,
    })

    await indexWorkspaceDocument('doc-post-forkasta', 'ws-1')

    // DRAFT tier cleanup — passes null markdown which triggers
    // tier-scoped deleteMany inside syncWorkspaceChunks (SF-1: physical removal)
    expect(mockSync).toHaveBeenCalledWith(
      'doc-post-forkasta',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      null,
      expect.objectContaining({ content_hash: null, tier: 'DRAFT' })
    )
  })

  it('Both pointers null + alias has content: legacy fallback path (defensive)', async () => {
    // Pre-Story 17.16 doc that somehow escaped the backfill — should still
    // index via the untiered legacy path. Both tier-scoped cleanups still
    // fire (deleting any orphans of either tier), THEN the legacy index.
    mockFindFirst.mockResolvedValue({
      title: 'Legacy doc',
      document_type: 'POLICY',
      status: 'DRAFT',
      current_version_number: 1,
      current_approved_version_id: null,
      current_draft_version_id: null,
      draft_status: null,
      current_approved_version: null,
      current_draft_version: null,
      current_version: {
        content_html: '<p>legacy</p>',
        content_json: NON_EMPTY_TIPTAP_DOC,
      },
    })

    await indexWorkspaceDocument('doc-legacy', 'ws-1')

    // Both tiers cleaned up first (null markdown)
    expect(mockSync).toHaveBeenCalledWith(
      'doc-legacy',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      null,
      expect.objectContaining({ tier: 'APPROVED', content_hash: null })
    )
    expect(mockSync).toHaveBeenCalledWith(
      'doc-legacy',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      null,
      expect.objectContaining({ tier: 'DRAFT', content_hash: null })
    )
    // Then legacy index with untagged meta (no tier field)
    const legacyCall = mockSync.mock.calls.find(
      (c: unknown[]) =>
        c[3] === 'MD:<p>legacy</p>' &&
        !('tier' in ((c[4] as Record<string, unknown>) ?? {}))
    )
    expect(legacyCall).toBeDefined()
  })
})

describe('deindexWorkspaceDocument', () => {
  it('syncs with null content (clears all WORKSPACE_DOCUMENT chunks)', async () => {
    await deindexWorkspaceDocument('doc-1', 'ws-1')
    expect(mockSync).toHaveBeenCalledWith(
      'doc-1',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      null,
      expect.objectContaining({ content_hash: null })
    )
  })
})

describe('updateWorkspaceDocumentStatusMetadata — 17.10b AC 4 (cheap UPDATE path)', () => {
  it('calls updateChunkMetadata with workspace-scoped status patch (AC 28 defence-in-depth)', async () => {
    await updateWorkspaceDocumentStatusMetadata('doc-1', 'ws-1', 'IN_REVIEW')

    expect(mockUpdateMeta).toHaveBeenCalledWith(
      'doc-1',
      'WORKSPACE_DOCUMENT',
      { status: 'IN_REVIEW' },
      'ws-1'
    )
    // NEVER calls syncWorkspaceChunks (no re-embed) — that's the whole point.
    expect(mockSync).not.toHaveBeenCalled()
  })

  it('passes the workspaceId through as the 4th positional arg (cross-tenant required)', async () => {
    await updateWorkspaceDocumentStatusMetadata('doc-a', 'ws-X', 'APPROVED')
    const args = mockUpdateMeta.mock.calls[0]!
    expect(args[3]).toBe('ws-X')
  })
})

describe('markWorkspaceDocumentDirty — 17.10b AC 6 (cron-sweep dirty-mark)', () => {
  it('issues an UPDATE filtered by id + workspace_id with notIn for terminal states', async () => {
    await markWorkspaceDocumentDirty('doc-1', 'ws-1')

    expect(mockUpdateMany).toHaveBeenCalledTimes(1)
    const arg = mockUpdateMany.mock.calls[0]![0]
    expect(arg.where.id).toBe('doc-1')
    expect(arg.where.workspace_id).toBe('ws-1')
    expect(arg.where.status).toEqual({ notIn: ['SUPERSEDED', 'ARCHIVED'] })
    expect(arg.data.needs_reindex).toBe(true)
    expect(arg.data.last_marked_dirty_at).toBeInstanceOf(Date)
  })

  it('cross-tenant: doc-A in workspace-A is unaffected when called with workspace-B (no rows matched)', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 }) // simulated: workspace mismatch
    await markWorkspaceDocumentDirty('doc-A', 'ws-B')

    const arg = mockUpdateMany.mock.calls[0]![0]
    // The workspace_id predicate is what guarantees isolation.
    expect(arg.where.workspace_id).toBe('ws-B')
  })

  it('is idempotent: bumps last_marked_dirty_at on every call (multiple autosaves within the window)', async () => {
    await markWorkspaceDocumentDirty('doc-1', 'ws-1')
    await markWorkspaceDocumentDirty('doc-1', 'ws-1')
    await markWorkspaceDocumentDirty('doc-1', 'ws-1')

    expect(mockUpdateMany).toHaveBeenCalledTimes(3)
    // Every call sets needs_reindex = true and a fresh timestamp; the cron
    // sweep is the only thing that clears the flag.
    for (const call of mockUpdateMany.mock.calls) {
      const arg = call[0]
      expect(arg.data.needs_reindex).toBe(true)
      expect(arg.data.last_marked_dirty_at).toBeInstanceOf(Date)
    }
  })
})

// ============================================================================
// AGENT-001 defensive content_json gate
//
// Surfaced during 17.11c smoke 2026-06-06: two Nordviken docs had empty
// content_json ({}) but rich content_html (~1000 chars each from a legacy
// seed). The indexer was sourcing chunks from content_html and producing
// 4 phantom chunks per doc. The agent then read those chunks via
// search_workspace_documents and presented them as truth — directly
// contradicting the editor's "0 ord · Sparad" status.
//
// Fix: indexer gates chunking on content_json (the editor's source of truth).
// If a tier's content_json is empty/missing/`{}`, that tier is treated as
// empty regardless of what content_html says, and chunks for that tier are
// cleaned up via the existing tier-scoped delete.
//
// Critical safety property: per-tier evaluation. An accidentally-cleared
// DRAFT does NOT cascade to APPROVED-tier chunks (which the user expects
// to keep surfacing the in-force policy via 17.16's alias-freeze).
// ============================================================================

describe('indexWorkspaceDocument — AGENT-001 defensive content_json gate', () => {
  const EMPTY_JSON_SHAPES = [
    null,
    undefined,
    {}, // The exact shape observed on the Nordviken docs
    { type: 'doc' }, // No content array
    { type: 'doc', content: [] }, // Empty content array
    { type: 'doc', content: [{ type: 'paragraph' }] }, // Single empty paragraph (editor default)
  ]

  for (const [idx, emptyJson] of EMPTY_JSON_SHAPES.entries()) {
    it(`APPROVED tier with empty content_json shape #${idx} (${JSON.stringify(emptyJson)}) cleans up + does NOT index`, async () => {
      mockFindFirst.mockResolvedValue({
        title: 'Diskrimineringspolicy',
        document_type: 'POLICY',
        status: 'APPROVED',
        current_version_number: 1,
        current_approved_version_id: 'v_approved',
        current_draft_version_id: null,
        draft_status: null,
        current_approved_version: {
          content_html:
            '<h1>Phantom legacy content</h1><p>Stale from old seed</p>',
          content_json: emptyJson,
          version_number: 1,
        },
        current_draft_version: null,
        current_version: null,
      })

      await indexWorkspaceDocument('doc-divergent', 'ws-1')

      // No content-bearing index call for the APPROVED tier — content_json says empty.
      const approvedIndexCall = mockSync.mock.calls.find(
        (c: unknown[]) => typeof c[3] === 'string' && c[3] !== null
      )
      expect(approvedIndexCall).toBeUndefined()

      // Both tier cleanups still fire (null markdown, tier-scoped).
      expect(mockSync).toHaveBeenCalledWith(
        'doc-divergent',
        'WORKSPACE_DOCUMENT',
        'ws-1',
        null,
        expect.objectContaining({ tier: 'APPROVED', content_hash: null })
      )
      expect(mockSync).toHaveBeenCalledWith(
        'doc-divergent',
        'WORKSPACE_DOCUMENT',
        'ws-1',
        null,
        expect.objectContaining({ tier: 'DRAFT', content_hash: null })
      )
    })
  }

  it('SAFETY PROPERTY: empty DRAFT does NOT cascade to APPROVED chunks (17.16 alias-freeze respected)', async () => {
    // User accidentally clears all content in the draft editor.
    // Autosave fires → indexer runs.
    // Expected: APPROVED chunks remain intact (sourced from the unchanged
    // approved version row); only DRAFT chunks get cleaned.
    mockFindFirst.mockResolvedValue({
      title: 'Arbetsmiljöpolicy',
      document_type: 'POLICY',
      status: 'APPROVED',
      current_version_number: 5,
      current_approved_version_id: 'v_4',
      current_draft_version_id: 'v_5',
      draft_status: 'DRAFT',
      current_approved_version: {
        content_html:
          '<h1>Approved Arbetsmiljöpolicy</h1><p>Den gällande policyn.</p>',
        content_json: NON_EMPTY_TIPTAP_DOC, // Untouched, immutable per 17.16 AC 4
        version_number: 4,
      },
      current_draft_version: {
        content_html: '', // User cleared everything; saveDocumentVersion synced html too
        content_json: { type: 'doc', content: [] }, // User-cleared empty state
        version_number: 5,
      },
      current_version: null,
    })

    await indexWorkspaceDocument('doc-cleared-draft', 'ws-1')

    // APPROVED tier: indexed with content (full chunk regeneration call).
    expect(mockSync).toHaveBeenCalledWith(
      'doc-cleared-draft',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'MD:<h1>Approved Arbetsmiljöpolicy</h1><p>Den gällande policyn.</p>',
      expect.objectContaining({
        tier: 'APPROVED',
        status: 'APPROVED',
        version_number: 4,
      })
    )

    // DRAFT tier: cleaned up (null markdown, tier-scoped delete).
    expect(mockSync).toHaveBeenCalledWith(
      'doc-cleared-draft',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      null,
      expect.objectContaining({ tier: 'DRAFT', content_hash: null })
    )

    // Sanity: NO call cleaning the APPROVED tier with null markdown.
    const approvedCleanup = mockSync.mock.calls.find((c: unknown[]) => {
      const meta = c[4] as Record<string, unknown> | undefined
      return c[3] === null && meta?.tier === 'APPROVED'
    })
    expect(approvedCleanup).toBeUndefined()
  })

  it('SAFETY PROPERTY (continued): empty APPROVED + content-bearing DRAFT preserves DRAFT chunks', async () => {
    // Mirror of the above: if somehow the APPROVED tier is empty (e.g. an
    // empty approved policy, which is intentionally approved) and the DRAFT
    // has content, draft chunks must remain intact.
    mockFindFirst.mockResolvedValue({
      title: 'Edge case doc',
      document_type: 'POLICY',
      status: 'APPROVED',
      current_version_number: 2,
      current_approved_version_id: 'v_1',
      current_draft_version_id: 'v_2',
      draft_status: 'DRAFT',
      current_approved_version: {
        content_html: '',
        content_json: {},
        version_number: 1,
      },
      current_draft_version: {
        content_html: '<p>New content the user is working on.</p>',
        content_json: NON_EMPTY_TIPTAP_DOC,
        version_number: 2,
      },
      current_version: null,
    })

    await indexWorkspaceDocument('doc-empty-approved', 'ws-1')

    // DRAFT tier: indexed with content.
    expect(mockSync).toHaveBeenCalledWith(
      'doc-empty-approved',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'MD:<p>New content the user is working on.</p>',
      expect.objectContaining({ tier: 'DRAFT' })
    )

    // APPROVED tier: cleaned up.
    expect(mockSync).toHaveBeenCalledWith(
      'doc-empty-approved',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      null,
      expect.objectContaining({ tier: 'APPROVED', content_hash: null })
    )
  })

  it('non-divergent case: content_json matches content_html → normal indexing unchanged', async () => {
    // Regression guard: the defensive check must not affect well-formed docs.
    mockFindFirst.mockResolvedValue({
      title: 'Healthy policy',
      document_type: 'POLICY',
      status: 'APPROVED',
      current_version_number: 1,
      current_approved_version_id: 'v_1',
      current_draft_version_id: null,
      draft_status: null,
      current_approved_version: {
        content_html: '<h1>Healthy policy</h1>',
        content_json: NON_EMPTY_TIPTAP_DOC,
        version_number: 1,
      },
      current_draft_version: null,
      current_version: null,
    })

    await indexWorkspaceDocument('doc-healthy', 'ws-1')

    expect(mockSync).toHaveBeenCalledWith(
      'doc-healthy',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'MD:<h1>Healthy policy</h1>',
      expect.objectContaining({ tier: 'APPROVED', status: 'APPROVED' })
    )
  })
})
