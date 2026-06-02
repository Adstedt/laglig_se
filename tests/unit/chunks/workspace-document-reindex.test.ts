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
      current_version: { content_html: '<h1>Policy</h1>' },
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
      current_version: { content_html: '<p>x</p>' },
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
