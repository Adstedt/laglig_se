/**
 * Tests for chunk lifecycle sync
 * Story 14.2, Task 8 (AC: 17)
 * Story 14.3, Task 8 — updated to mock Anthropic + OpenAI for incremental embedding
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
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}))

// Mock context prefix generation (Story 14.3)
vi.mock('@/lib/chunks/generate-context-prefixes', () => ({
  generateContextPrefixes: vi.fn().mockResolvedValue(new Map()),
}))

// Mock embedding generation (Story 14.3)
vi.mock('@/lib/chunks/embed-chunks', () => ({
  generateEmbeddingsBatch: vi.fn().mockResolvedValue({
    embeddings: [],
    totalTokensUsed: 0,
  }),
  vectorToString: vi.fn((v: number[]) => `[${v.join(',')}]`),
}))

import { prisma } from '@/lib/prisma'
import { syncDocumentChunks } from '@/lib/chunks/sync-document-chunks'
import { generateContextPrefixes } from '@/lib/chunks/generate-context-prefixes'
import { generateEmbeddingsBatch } from '@/lib/chunks/embed-chunks'
import type { CanonicalDocumentJson } from '@/lib/transforms/document-json-schema'

const mockPrisma = prisma as unknown as {
  legalDocument: { findUnique: ReturnType<typeof vi.fn> }
  contentChunk: {
    deleteMany: ReturnType<typeof vi.fn>
    createMany: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
  $executeRaw: ReturnType<typeof vi.fn>
}

const mockGenerateContextPrefixes = generateContextPrefixes as ReturnType<
  typeof vi.fn
>
const mockGenerateEmbeddingsBatch = generateEmbeddingsBatch as ReturnType<
  typeof vi.fn
>

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
    slug: 'sfs-2025-1',
    json_content: json,
    markdown_content: '# Testlag\n\nDenna lag gäller.',
    html_content: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no chunks found for embedding phase
  mockPrisma.contentChunk.findMany.mockResolvedValue([])
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

  it('generates context prefixes and embeddings after chunk creation', async () => {
    const doc = makeDoc()
    mockPrisma.legalDocument.findUnique.mockResolvedValue(doc)
    mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 1 }])

    // Simulate chunks found after creation
    mockPrisma.contentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        path: 'kap1.§1',
        content: 'Denna lag gäller.',
        contextual_header: 'Testlag > 1 §',
      },
    ])

    mockGenerateContextPrefixes.mockResolvedValue(
      new Map([['kap1.§1', 'Inledande bestämmelse.']])
    )
    mockGenerateEmbeddingsBatch.mockResolvedValue({
      embeddings: [new Array(1536).fill(0.1)],
      totalTokensUsed: 50,
    })

    const result = await syncDocumentChunks('doc-1')

    expect(mockGenerateContextPrefixes).toHaveBeenCalledTimes(1)
    expect(mockGenerateEmbeddingsBatch).toHaveBeenCalledTimes(1)
    expect(mockPrisma.contentChunk.update).toHaveBeenCalledWith({
      where: { id: 'chunk-1' },
      data: { context_prefix: 'Inledande bestämmelse.' },
    })
    expect(mockPrisma.$executeRaw).toHaveBeenCalled()
    expect(result.chunksEmbedded).toBe(1)
  })

  it('does not roll back chunks when embedding fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const doc = makeDoc()
    mockPrisma.legalDocument.findUnique.mockResolvedValue(doc)
    mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 1 }])

    mockPrisma.contentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        path: 'kap1.§1',
        content: 'Text',
        contextual_header: 'H',
      },
    ])
    mockGenerateContextPrefixes.mockRejectedValue(
      new Error('Anthropic API down')
    )

    const result = await syncDocumentChunks('doc-1')

    // Chunks were still created
    expect(result.chunksCreated).toBe(1)
    // Embedding failed gracefully
    expect(result.chunksEmbedded).toBe(0)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Embedding failed')
    )
    errorSpy.mockRestore()
  })
})
