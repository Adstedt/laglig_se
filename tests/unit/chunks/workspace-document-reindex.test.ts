/**
 * Tests for styrdokument RAG re-index hooks (Story 17.9b, Task 4)
 * - decideReindexOnStatusChange: the AC 4/5 status-gating (pure)
 * - hashDocumentContent: deterministic sha256
 * - indexWorkspaceDocument / deindexWorkspaceDocument: load → convert → sync
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/transforms/html-to-markdown', () => ({
  htmlToMarkdown: vi.fn((html: string) => `MD:${html}`),
}))

vi.mock('@/lib/chunks/sync-workspace-chunks', () => ({
  syncWorkspaceChunks: vi.fn().mockResolvedValue({ skipped: false }),
}))

import { prisma } from '@/lib/prisma'
import { syncWorkspaceChunks } from '@/lib/chunks/sync-workspace-chunks'
import { htmlToMarkdown } from '@/lib/transforms/html-to-markdown'
import {
  decideReindexOnStatusChange,
  hashDocumentContent,
  indexWorkspaceDocument,
  deindexWorkspaceDocument,
} from '@/lib/chunks/workspace-document-reindex'

const mockFindFirst = (
  prisma as unknown as {
    workspaceDocument: { findFirst: ReturnType<typeof vi.fn> }
  }
).workspaceDocument.findFirst
const mockSync = syncWorkspaceChunks as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('decideReindexOnStatusChange — AC 4/5 status gating', () => {
  it('INDEX when entering APPROVED (IN_REVIEW → APPROVED)', () => {
    expect(decideReindexOnStatusChange('IN_REVIEW', 'APPROVED')).toBe('INDEX')
  })

  it.each([
    ['APPROVED', 'SUPERSEDED'],
    ['APPROVED', 'ARCHIVED'],
    ['APPROVED', 'DRAFT'], // createDraftFromApproved
  ])('DEINDEX when leaving APPROVED (%s → %s)', (oldS, newS) => {
    expect(decideReindexOnStatusChange(oldS, newS)).toBe('DEINDEX')
  })

  it.each([
    ['DRAFT', 'IN_REVIEW'],
    ['IN_REVIEW', 'DRAFT'],
    ['DRAFT', 'ARCHIVED'],
    ['SUPERSEDED', 'ARCHIVED'],
  ])('NONE for non-boundary transitions (%s → %s)', (oldS, newS) => {
    expect(decideReindexOnStatusChange(oldS, newS)).toBe('NONE')
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

describe('indexWorkspaceDocument', () => {
  it('converts current-version content_html → markdown and syncs WORKSPACE_DOCUMENT chunks', async () => {
    mockFindFirst.mockResolvedValue({
      title: 'Dataskyddspolicy',
      document_type: 'POLICY',
      status: 'APPROVED',
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
        status: 'APPROVED',
        content_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
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
