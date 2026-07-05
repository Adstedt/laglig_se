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
  mockPrisma.contentChunk.createMany.mockResolvedValue({ count: 1 })
  mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 1 }])
  // Story 17.18: embed step now uses $queryRaw to fetch NULL-only chunks
  // instead of findMany. Default to "1 freshly-inserted chunk to embed" so the
  // happy paths in the legacy USER_FILE suite stay green.
  //
  // The same $queryRaw mock also covers the REL-001 null-embedding count check
  // (which returns [{ count: 0 }] when chunks already exist). Tests that need
  // a specific count override the mock per-call via mockResolvedValueOnce.
  mockPrisma.$queryRaw.mockResolvedValue([
    { id: 'chunk-1', content: 'text', contextual_header: 'rutin.pdf (POLICY)' },
  ])
  mockPrisma.$executeRaw.mockResolvedValue(0)
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
  it('deletes old chunks and creates new ones, then embeds', async () => {
    // Story 17.18: delete + create no longer wrapped in a single $transaction
    // (the tier-scoped delete uses raw SQL, so the transaction split into
    // sequential calls — see indexWorkspaceDocument JSDoc). Behavior is
    // functionally equivalent: deleteMany ran, createMany ran, embedding ran.
    const result = await syncWorkspaceChunks(
      'file-1',
      'USER_FILE',
      'ws-1',
      'Ett stycke med tillräckligt med text för en chunk.',
      META
    )
    expect(mockPrisma.contentChunk.deleteMany).toHaveBeenCalled()
    expect(mockPrisma.contentChunk.createMany).toHaveBeenCalled()
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
    // Story 17.18: split delete + create (no $transaction wrapper).
    expect(mockPrisma.contentChunk.deleteMany).toHaveBeenCalled()
    expect(mockPrisma.contentChunk.createMany).toHaveBeenCalled()
  })

  // REL-001 (Story 17.9c): dedupe must not defeat embed-failure recovery.
  it('re-embeds (does NOT skip) when content_hash matches but chunks carry null embeddings', async () => {
    mockPrisma.contentChunk.findFirst.mockResolvedValue({
      metadata: { content_hash: 'h1' }, // same hash as META → would skip pre-fix
    })
    // Story 17.18: first $queryRaw call is the null-embed-count check; second
    // is the embed-fetch (NULL-only chunks). Sequence via mockResolvedValueOnce.
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ count: 2 }]) // null-count check: 2 NULL embeddings → fall through
      .mockResolvedValueOnce([
        // embed fetch: NULL-only chunks to embed
        {
          id: 'chunk-1',
          content: 'text',
          contextual_header: 'rutin.pdf (POLICY)',
        },
      ])
    const result = await syncWorkspaceChunks(
      'file-1',
      'USER_FILE',
      'ws-1',
      'Ett stycke text här.',
      META
    )
    expect(result.skipped).toBe(false)
    expect(mockPrisma.contentChunk.deleteMany).toHaveBeenCalled() // delete-then-insert ran
    expect(mockPrisma.contentChunk.createMany).toHaveBeenCalled()
    expect(mockEmbed).toHaveBeenCalledTimes(1) // self-healed the failed embed
  })

  it('still skips when content_hash matches AND all chunks have embeddings', async () => {
    mockPrisma.contentChunk.findFirst.mockResolvedValue({
      metadata: { content_hash: 'h1' },
    })
    // First $queryRaw call: null-embed-count check returns 0 → SKIP.
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: 0 }])
    const result = await syncWorkspaceChunks(
      'file-1',
      'USER_FILE',
      'ws-1',
      'text',
      META
    )
    expect(result.skipped).toBe(true)
    expect(mockPrisma.contentChunk.deleteMany).not.toHaveBeenCalled()
    expect(mockPrisma.contentChunk.createMany).not.toHaveBeenCalled()
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
    // Story 17.18: split delete + create — explicitly mock createMany return
    // value so the result accounting reads correctly (no $transaction wrap).
    mockPrisma.contentChunk.createMany.mockResolvedValueOnce({ count: 1 })
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
    // Story 17.18: split delete + create (no $transaction wrapper).
    expect(mockPrisma.contentChunk.deleteMany).toHaveBeenCalled()
    expect(mockPrisma.contentChunk.createMany).toHaveBeenCalled()

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

// ---------------------------------------------------------------------------
// Story 17.18 AC 1 / AC 2 — tier-scoped delete + dedup
// ---------------------------------------------------------------------------

describe('syncWorkspaceChunks — Story 17.18 tier-scoped paths', () => {
  it('tier=APPROVED: uses raw SQL tier-scoped delete (NOT prisma.deleteMany)', async () => {
    await syncWorkspaceChunks(
      'doc-1',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'Ett stycke text för en APPROVED-tier chunk.',
      {
        title: 'Policy',
        document_type: 'POLICY',
        status: 'APPROVED',
        content_hash: 'hash-A',
        tier: 'APPROVED',
      }
    )

    // Tier-scoped path uses $executeRaw with the tier predicate — verify the
    // raw call fired and Prisma's deleteMany was NOT used.
    expect(mockPrisma.$executeRaw).toHaveBeenCalled()
    expect(mockPrisma.contentChunk.deleteMany).not.toHaveBeenCalled()

    // The tier=APPROVED string appears as an interpolated value in the call.
    const calls = mockPrisma.$executeRaw.mock.calls
    const tierAppears = calls.some((call: unknown[]) =>
      JSON.stringify(call).includes('APPROVED')
    )
    expect(tierAppears).toBe(true)
  })

  it('tier=DRAFT + null markdown: tier-scoped cleanup deletes orphans, no createMany', async () => {
    // This is the SF-1 cleanup path (post-Förkasta or post-promote): the
    // caller passes null markdown to wipe the orphaned tier's chunks.
    const result = await syncWorkspaceChunks(
      'doc-1',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      null,
      {
        title: 'Policy',
        document_type: 'POLICY',
        content_hash: null,
        tier: 'DRAFT',
      }
    )

    expect(mockPrisma.$executeRaw).toHaveBeenCalled() // tier-scoped delete fired
    expect(mockPrisma.contentChunk.createMany).not.toHaveBeenCalled()
    expect(mockEmbed).not.toHaveBeenCalled()
    expect(result.chunksCreated).toBe(0)
  })

  it('tier dedup: hash-match with same tier short-circuits (re-embed skipped)', async () => {
    // Hash check $queryRaw returns a row → match. Then null-count check
    // returns 0 → all chunks embedded → SKIP.
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ count: 1 }]) // tier hash-match found
      .mockResolvedValueOnce([{ count: 0 }]) // null-embed count: 0 → skip

    const result = await syncWorkspaceChunks(
      'doc-1',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'Same content.',
      {
        title: 'Policy',
        document_type: 'POLICY',
        status: 'APPROVED',
        content_hash: 'hash-A',
        tier: 'APPROVED',
      }
    )

    expect(result.skipped).toBe(true)
    expect(mockPrisma.contentChunk.createMany).not.toHaveBeenCalled()
    expect(mockEmbed).not.toHaveBeenCalled()
  })

  it('tier dedup: hash-match with DIFFERENT tier does NOT short-circuit', async () => {
    // The same content_hash on a DIFFERENT tier's chunks must NOT prevent
    // this tier's reindex. The tier-scoped query finds no rows → fall through.
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ count: 0 }]) // tier hash-match: 0 (different tier)
      .mockResolvedValueOnce([
        // embed fetch: NULL-only chunks just inserted
        {
          id: 'chunk-A1',
          content: 'text',
          contextual_header: 'Policy (POLICY)',
        },
      ])

    const result = await syncWorkspaceChunks(
      'doc-1',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'Same content, but different tier this time.',
      {
        title: 'Policy',
        document_type: 'POLICY',
        status: 'APPROVED',
        content_hash: 'hash-A',
        tier: 'APPROVED',
      }
    )

    expect(result.skipped).toBe(false)
    expect(mockPrisma.contentChunk.createMany).toHaveBeenCalled()
    expect(mockEmbed).toHaveBeenCalledTimes(1)
  })

  it('legacy untiered call (USER_FILE) preserves pre-17.18 deleteMany path', async () => {
    // No `tier` field → fall through to existing deleteMany behavior.
    await syncWorkspaceChunks(
      'file-1',
      'USER_FILE',
      'ws-1',
      'File content here.',
      META
    )

    expect(mockPrisma.contentChunk.deleteMany).toHaveBeenCalledWith({
      where: { source_type: 'USER_FILE', source_id: 'file-1' },
    })
  })

  it('embed step uses $queryRaw to fetch only NULL-embedding chunks (Story 17.18 cross-tier opt)', async () => {
    await syncWorkspaceChunks(
      'doc-1',
      'WORKSPACE_DOCUMENT',
      'ws-1',
      'Ett stycke text för en APPROVED-tier chunk.',
      {
        title: 'Policy',
        document_type: 'POLICY',
        status: 'APPROVED',
        content_hash: 'hash-A',
        tier: 'APPROVED',
      }
    )

    // Embed fetch should use $queryRaw (not findMany) so the WHERE clause can
    // include `embedding IS NULL` — which the Prisma model can't express
    // because embedding is Unsupported().
    expect(mockPrisma.contentChunk.findMany).not.toHaveBeenCalled()
    // $queryRaw fires for at least the embed fetch (once when no dedup hit).
    expect(mockPrisma.$queryRaw).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Story 7.5: COLLECTIVE_AGREEMENT routing through the agreement chunker
// ---------------------------------------------------------------------------

describe('syncWorkspaceChunks — COLLECTIVE_AGREEMENT (Story 7.5)', () => {
  const CA_META = {
    agreement_name: 'Byggavtalet 2024',
    personel_type: 'ARB',
    filename: 'byggavtalet.pdf',
    workspace_file_id: 'file-9',
    content_hash: 'ca-h1',
  }
  const CA_MARKDOWN =
    'Inledning om avtalets omfattning.\n\n## Arbetstid\n\nOrdinarie arbetstid utgör fyrtio timmar per helgfri vecka i genomsnitt.'

  it('routes through the agreement chunker: COLLECTIVE_AGREEMENT chunks with source_id = agreement id + section-aware headers', async () => {
    const result = await syncWorkspaceChunks(
      'agr-1',
      'COLLECTIVE_AGREEMENT',
      'ws-1',
      CA_MARKDOWN,
      CA_META
    )

    expect(result.chunksCreated).toBe(1)
    const createArg = mockPrisma.contentChunk.createMany.mock.calls[0]![0] as {
      data: Array<Record<string, unknown>>
    }
    expect(createArg.data.length).toBeGreaterThan(0)
    for (const chunk of createArg.data) {
      expect(chunk.source_type).toBe('COLLECTIVE_AGREEMENT')
      expect(chunk.source_id).toBe('agr-1') // agreement id, NOT file-9
      expect(chunk.workspace_id).toBe('ws-1')
      expect(chunk.contextual_header).toContain(
        'Byggavtalet 2024 (Kollektivavtal)'
      )
    }
    const sectionChunk = createArg.data.find((c) =>
      String(c.content).includes('Ordinarie arbetstid')
    )
    expect(sectionChunk).toBeDefined()
    expect(sectionChunk!.contextual_header).toBe(
      'Byggavtalet 2024 (Kollektivavtal) > Arbetstid'
    )
  })

  it('throws (never indexes) when workspace_id is empty — isolation invariant applies to agreements too', async () => {
    await expect(
      syncWorkspaceChunks(
        'agr-1',
        'COLLECTIVE_AGREEMENT',
        '',
        CA_MARKDOWN,
        CA_META
      )
    ).rejects.toThrow(/workspace_id is required/)
    expect(mockPrisma.contentChunk.createMany).not.toHaveBeenCalled()
  })

  it('content_hash dedupe short-circuits an unchanged agreement re-sync', async () => {
    mockPrisma.contentChunk.findFirst.mockResolvedValue({
      metadata: { content_hash: 'ca-h1' },
    })
    // REL-001 null-embedding count check → 0 nulls (fully embedded).
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: 0 }])

    const result = await syncWorkspaceChunks(
      'agr-1',
      'COLLECTIVE_AGREEMENT',
      'ws-1',
      CA_MARKDOWN,
      CA_META
    )

    expect(result.skipped).toBe(true)
    expect(mockPrisma.contentChunk.createMany).not.toHaveBeenCalled()
  })
})
