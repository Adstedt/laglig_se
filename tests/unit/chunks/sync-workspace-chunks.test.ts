/**
 * Tests for workspace chunk lifecycle sync (Story 17.9, Task 2)
 * Mocks Prisma + the embedding batch. chunkUserFile runs for real (pure).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contentChunk: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/chunks/embed-chunks', () => ({
  generateEmbeddingsBatch: vi.fn().mockResolvedValue({
    embeddings: [new Array(1536).fill(0.1)],
    totalTokensUsed: 10,
  }),
  vectorToString: vi.fn((v: number[]) => `[${v.join(',')}]`),
}))

import { prisma } from '@/lib/prisma'
import {
  syncWorkspaceChunks,
  updateChunkMetadata,
} from '@/lib/chunks/sync-workspace-chunks'
import { generateEmbeddingsBatch } from '@/lib/chunks/embed-chunks'

const mockPrisma = prisma as unknown as {
  contentChunk: {
    findFirst: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    deleteMany: ReturnType<typeof vi.fn>
    createMany: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
  $executeRaw: ReturnType<typeof vi.fn>
  $queryRaw: ReturnType<typeof vi.fn>
}
const mockEmbed = generateEmbeddingsBatch as ReturnType<typeof vi.fn>

const META = { filename: 'rutin.pdf', category: 'POLICY', content_hash: 'h1' }

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.contentChunk.findFirst.mockResolvedValue(null)
  mockPrisma.contentChunk.deleteMany.mockResolvedValue({ count: 0 })
  mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 1 }])
  // REL-001 null-embedding count — default to 0 (all chunks embedded → skip is safe).
  mockPrisma.$queryRaw.mockResolvedValue([{ count: 0 }])
  mockPrisma.contentChunk.findMany.mockResolvedValue([
    { id: 'chunk-1', content: 'text', contextual_header: 'rutin.pdf (POLICY)' },
  ])
})

describe('syncWorkspaceChunks — write-side isolation', () => {
  it('throws (never indexes) when workspace_id is empty', async () => {
    await expect(
      syncWorkspaceChunks('file-1', 'USER_FILE', '', 'innehåll här', META)
    ).rejects.toThrow(/workspace_id is required/)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})

describe('syncWorkspaceChunks — re-index (delete-then-insert)', () => {
  it('deletes old chunks and creates new ones in a single transaction, then embeds', async () => {
    const result = await syncWorkspaceChunks(
      'file-1',
      'USER_FILE',
      'ws-1',
      'Ett stycke med tillräckligt med text för en chunk.',
      META
    )
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mockEmbed).toHaveBeenCalledTimes(1)
    expect(mockPrisma.$executeRaw).toHaveBeenCalled()
    expect(result.chunksCreated).toBe(1)
    expect(result.chunksEmbedded).toBe(1)
    expect(result.skipped).toBe(false)
  })

  it('embeds with an empty contextPrefix (no LLM prefix step for files)', async () => {
    await syncWorkspaceChunks(
      'file-1',
      'USER_FILE',
      'ws-1',
      'Ett stycke text här.',
      META
    )
    expect(mockEmbed).toHaveBeenCalledWith([
      expect.objectContaining({
        contextPrefix: '',
        contextualHeader: 'rutin.pdf (POLICY)',
      }),
    ])
  })
})

describe('syncWorkspaceChunks — content-hash dedupe (AC 9)', () => {
  it('skips the whole re-embed when an existing chunk carries the same content_hash', async () => {
    mockPrisma.contentChunk.findFirst.mockResolvedValue({
      metadata: { content_hash: 'h1' },
    })
    const result = await syncWorkspaceChunks(
      'file-1',
      'USER_FILE',
      'ws-1',
      'text',
      META
    )
    expect(result.skipped).toBe(true)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockEmbed).not.toHaveBeenCalled()
  })

  it('re-indexes when the stored content_hash differs', async () => {
    mockPrisma.contentChunk.findFirst.mockResolvedValue({
      metadata: { content_hash: 'OLD' },
    })
    const result = await syncWorkspaceChunks(
      'file-1',
      'USER_FILE',
      'ws-1',
      'Ett nytt stycke med innehåll.',
      META
    )
    expect(result.skipped).toBe(false)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  // REL-001 (Story 17.9c): dedupe must not defeat embed-failure recovery.
  it('re-embeds (does NOT skip) when content_hash matches but chunks carry null embeddings', async () => {
    mockPrisma.contentChunk.findFirst.mockResolvedValue({
      metadata: { content_hash: 'h1' }, // same hash as META → would skip pre-fix
    })
    mockPrisma.$queryRaw.mockResolvedValue([{ count: 2 }]) // 2 chunks lack embeddings
    const result = await syncWorkspaceChunks(
      'file-1',
      'USER_FILE',
      'ws-1',
      'Ett stycke text här.',
      META
    )
    expect(result.skipped).toBe(false)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1) // delete-then-insert ran
    expect(mockEmbed).toHaveBeenCalledTimes(1) // self-healed the failed embed
  })

  it('still skips when content_hash matches AND all chunks have embeddings', async () => {
    mockPrisma.contentChunk.findFirst.mockResolvedValue({
      metadata: { content_hash: 'h1' },
    })
    mockPrisma.$queryRaw.mockResolvedValue([{ count: 0 }]) // none null
    const result = await syncWorkspaceChunks(
      'file-1',
      'USER_FILE',
      'ws-1',
      'text',
      META
    )
    expect(result.skipped).toBe(true)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockEmbed).not.toHaveBeenCalled()
  })
})

describe('syncWorkspaceChunks — empty content + reliability', () => {
  it('clears stale chunks (no transaction/embed) when markdown is empty', async () => {
    mockPrisma.contentChunk.deleteMany.mockResolvedValue({ count: 4 })
    const result = await syncWorkspaceChunks(
      'file-1',
      'USER_FILE',
      'ws-1',
      '',
      META
    )
    expect(mockPrisma.contentChunk.deleteMany).toHaveBeenCalledWith({
      where: { source_type: 'USER_FILE', source_id: 'file-1' },
    })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(result.chunksDeleted).toBe(4)
  })

  it('does not roll back created chunks when embedding fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockEmbed.mockRejectedValueOnce(new Error('OpenAI down'))
    const result = await syncWorkspaceChunks(
      'file-1',
      'USER_FILE',
      'ws-1',
      'Ett stycke text här.',
      META
    )
    expect(result.chunksCreated).toBe(1)
    expect(result.chunksEmbedded).toBe(0)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('embedding failed')
    )
    errorSpy.mockRestore()
  })

  it('indexes WORKSPACE_DOCUMENT styrdokument (Story 17.9b — no longer throws)', async () => {
    const result = await syncWorkspaceChunks(
      'doc-1',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'Ett stycke styrdokumenttext med tillräckligt innehåll.',
      {
        title: 'Dataskyddspolicy',
        document_type: 'POLICY',
        status: 'APPROVED',
        content_hash: 'd1',
      }
    )
    expect(result.chunksCreated).toBe(1)
    expect(result.chunksEmbedded).toBe(1)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)

    // The branch produced real WORKSPACE_DOCUMENT chunks (createMany is invoked to
    // build the $transaction arg, so its data is the actual chunkWorkspaceDocument output).
    const createArg = mockPrisma.contentChunk.createMany.mock.calls[0]?.[0] as
      | {
          data: Array<{
            source_type: string
            source_id: string
            contextual_header: string
          }>
        }
      | undefined
    expect(createArg?.data[0]?.source_type).toBe('WORKSPACE_DOCUMENT')
    expect(createArg?.data[0]?.source_id).toBe('doc-1')
    expect(createArg?.data[0]?.contextual_header).toBe(
      'Dataskyddspolicy (POLICY)'
    )
  })
})

// ---------------------------------------------------------------------------
// Story 17.10b AC 4 + AC 28: updateChunkMetadata — cheap UPDATE, no re-embed
// ---------------------------------------------------------------------------

describe('updateChunkMetadata — 17.10b AC 4', () => {
  beforeEach(() => {
    // $executeRaw resolves to the row count for an UPDATE.
    mockPrisma.$executeRaw.mockResolvedValue(3)
  })

  it('runs a single UPDATE and returns chunksUpdated count', async () => {
    const result = await updateChunkMetadata(
      'doc-1',
      'WORKSPACE_DOCUMENT',
      { status: 'IN_REVIEW' },
      'ws-1'
    )

    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1)
    expect(result.chunksUpdated).toBe(3)
    expect(typeof result.duration).toBe('number')
  })

  it('does NOT trigger any embedding work (the whole point of the cheap path)', async () => {
    await updateChunkMetadata(
      'doc-1',
      'WORKSPACE_DOCUMENT',
      { status: 'APPROVED' },
      'ws-1'
    )

    expect(mockEmbed).not.toHaveBeenCalled()
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockPrisma.contentChunk.createMany).not.toHaveBeenCalled()
  })

  it('throws when workspaceId is empty — AC 28 cross-tenant defence', async () => {
    await expect(
      updateChunkMetadata(
        'doc-1',
        'WORKSPACE_DOCUMENT',
        { status: 'APPROVED' },
        ''
      )
    ).rejects.toThrow(/workspace_id is required/i)

    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('cross-tenant proof: passes workspaceId into the UPDATE statement', async () => {
    await updateChunkMetadata(
      'doc-a',
      'WORKSPACE_DOCUMENT',
      { status: 'DRAFT' },
      'ws-target'
    )

    // The raw-SQL tagged template embeds workspaceId as a parameter — verify
    // it appears in the executeRaw call's interpolated values.
    const call = mockPrisma.$executeRaw.mock.calls[0]!
    const joined = JSON.stringify(call)
    expect(joined).toContain('ws-target')
    expect(joined).toContain('doc-a')
  })
})
