/**
 * Tests for chunk lifecycle sync
 * Story 14.2, Task 8 (AC: 17)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma before importing module
vi.mock('@/lib/prisma', () => ({
  prisma: {
    legalDocument: {
      findUnique: vi.fn(),
    },
    contentChunk: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import { syncDocumentChunks } from '@/lib/chunks/sync-document-chunks'
import type { CanonicalDocumentJson } from '@/lib/transforms/document-json-schema'

const mockPrisma = prisma as unknown as {
  legalDocument: { findUnique: ReturnType<typeof vi.fn> }
  contentChunk: {
    deleteMany: ReturnType<typeof vi.fn>
    createMany: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
}

function makeDoc(overrides: Record<string, unknown> = {}) {
  const json: CanonicalDocumentJson = {
    schemaVersion: '1.0',
    documentType: 'SFS_LAW',
    title: 'Testlag',
    documentNumber: 'SFS 2025:1',
    divisions: null,
    chapters: [
      {
        number: '1',
        title: 'Kap 1',
        paragrafer: [
          {
            number: '1',
            heading: null,
            content: 'Denna lag gäller.',
            amendedBy: null,
            stycken: [
              { number: 1, text: 'Denna lag gäller.', role: 'STYCKE' as const },
            ],
          },
        ],
      },
    ],
    preamble: null,
    transitionProvisions: null,
    appendices: null,
    metadata: {
      sfsNumber: 'SFS 2025:1',
      baseLawSfs: null,
      effectiveDate: null,
    },
  }

  return {
    id: 'doc-1',
    title: 'Testlag',
    document_number: 'SFS 2025:1',
    content_type: 'SFS_LAW',
    json_content: json,
    markdown_content: null,
    html_content: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('syncDocumentChunks', () => {
  it('deletes old chunks and creates new ones in a transaction', async () => {
    mockPrisma.legalDocument.findUnique.mockResolvedValue(makeDoc())
    mockPrisma.$transaction.mockResolvedValue([{ count: 5 }, { count: 1 }])

    const result = await syncDocumentChunks('doc-1')

    expect(mockPrisma.legalDocument.findUnique).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      select: expect.objectContaining({ json_content: true }),
    })
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(result.documentId).toBe('doc-1')
    expect(result.chunksDeleted).toBe(5)
    expect(result.chunksCreated).toBe(1)
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })

  it('returns zero counts when document has no content', async () => {
    mockPrisma.legalDocument.findUnique.mockResolvedValue(
      makeDoc({
        json_content: null,
        markdown_content: null,
        html_content: null,
      })
    )

    const result = await syncDocumentChunks('doc-1')

    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(result.chunksCreated).toBe(0)
    expect(result.chunksDeleted).toBe(0)
  })

  it('skips amendment documents with a warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockPrisma.legalDocument.findUnique.mockResolvedValue(
      makeDoc({ content_type: 'SFS_AMENDMENT' })
    )

    const result = await syncDocumentChunks('doc-1')

    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(result.chunksCreated).toBe(0)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('not in scope')
    )
    warnSpy.mockRestore()
  })

  it('processes AGENCY_REGULATION documents', async () => {
    mockPrisma.legalDocument.findUnique.mockResolvedValue(
      makeDoc({ content_type: 'AGENCY_REGULATION' })
    )
    mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 1 }])

    const result = await syncDocumentChunks('doc-1')

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(result.chunksCreated).toBe(1)
  })

  it('returns zero counts when document not found', async () => {
    mockPrisma.legalDocument.findUnique.mockResolvedValue(null)

    const result = await syncDocumentChunks('nonexistent')

    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(result.chunksCreated).toBe(0)
    expect(result.documentId).toBe('nonexistent')
  })
})
