/**
 * Story 7.5: extraction → RAG hand-off routing tests.
 *
 * The cron seam decision extracted into `indexExtractedFile`:
 *   - CA-backed file → COLLECTIVE_AGREEMENT chunks (source_id = agreement.id)
 *     with PENDING → PROCESSING → READY / FAILED status transitions
 *   - other files → unchanged USER_FILE path
 *   - all failure modes fail-safe (never throw — the batch must continue)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAgreementFindFirst = vi.fn()
const mockAgreementUpdateMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    collectiveAgreement: {
      findFirst: (...args: unknown[]) => mockAgreementFindFirst(...args),
      updateMany: (...args: unknown[]) => mockAgreementUpdateMany(...args),
    },
  },
}))

const mockSyncWorkspaceChunks = vi.fn()
vi.mock('@/lib/chunks/sync-workspace-chunks', () => ({
  syncWorkspaceChunks: (...args: unknown[]) => mockSyncWorkspaceChunks(...args),
}))

import {
  indexExtractedFile,
  markAgreementFailedForFile,
} from '@/lib/chunks/ingest-extracted-file'

const FILE = {
  id: 'file-1',
  workspace_id: 'ws-1',
  filename: 'byggavtalet.pdf',
  category: 'AVTAL',
  content_hash: 'h1',
}

const SYNC_OK = {
  sourceId: 'x',
  chunksDeleted: 0,
  chunksCreated: 3,
  chunksEmbedded: 3,
  skipped: false,
  duration: 5,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockAgreementFindFirst.mockResolvedValue(null)
  mockAgreementUpdateMany.mockResolvedValue({ count: 1 })
  mockSyncWorkspaceChunks.mockResolvedValue(SYNC_OK)
})

describe('indexExtractedFile — non-CA files (USER_FILE path unchanged)', () => {
  it('syncs as USER_FILE with the file id and never touches agreement status', async () => {
    const result = await indexExtractedFile(FILE, '# innehåll\n\ntext här')

    expect(result.routedAs).toBe('USER_FILE')
    expect(result.chunkError).toBe(false)
    expect(mockSyncWorkspaceChunks).toHaveBeenCalledWith(
      'file-1',
      'USER_FILE',
      'ws-1',
      '# innehåll\n\ntext här',
      { filename: 'byggavtalet.pdf', category: 'AVTAL', content_hash: 'h1' }
    )
    expect(mockAgreementUpdateMany).not.toHaveBeenCalled()
  })

  it('the agreement lookup is workspace-scoped (defense in depth)', async () => {
    await indexExtractedFile(FILE, 'text')
    expect(mockAgreementFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspace_file_id: 'file-1', workspace_id: 'ws-1' },
      })
    )
  })

  it('fail-safe: a USER_FILE chunk error is swallowed and reported', async () => {
    mockSyncWorkspaceChunks.mockRejectedValue(new Error('embed down'))
    const result = await indexExtractedFile(FILE, 'text')
    expect(result.routedAs).toBe('USER_FILE')
    expect(result.chunkError).toBe(true)
  })

  it('fail-safe: an agreement-lookup error degrades to the USER_FILE path', async () => {
    mockAgreementFindFirst.mockRejectedValue(new Error('db hiccup'))
    const result = await indexExtractedFile(FILE, 'text')
    expect(result.routedAs).toBe('USER_FILE')
    expect(mockSyncWorkspaceChunks).toHaveBeenCalledWith(
      'file-1',
      'USER_FILE',
      'ws-1',
      'text',
      expect.anything()
    )
  })
})

describe('indexExtractedFile — CA-backed files (Story 7.5 seam)', () => {
  const AGREEMENT = {
    id: 'agr-1',
    name: 'Byggavtalet 2024',
    personel_type: 'ARB',
  }

  beforeEach(() => {
    mockAgreementFindFirst.mockResolvedValue(AGREEMENT)
  })

  it('syncs as COLLECTIVE_AGREEMENT with source_id = AGREEMENT id and agreement meta', async () => {
    const result = await indexExtractedFile(FILE, '## Arbetstid\n\ntext')

    expect(result.routedAs).toBe('COLLECTIVE_AGREEMENT')
    expect(result.agreementId).toBe('agr-1')
    expect(result.chunkError).toBe(false)
    expect(mockSyncWorkspaceChunks).toHaveBeenCalledWith(
      'agr-1', // agreement id — NOT file-1
      'COLLECTIVE_AGREEMENT',
      'ws-1',
      '## Arbetstid\n\ntext',
      {
        agreement_name: 'Byggavtalet 2024',
        personel_type: 'ARB',
        filename: 'byggavtalet.pdf',
        workspace_file_id: 'file-1',
        content_hash: 'h1',
      }
    )
  })

  it('transitions status PROCESSING → READY on success (workspace-scoped writes)', async () => {
    await indexExtractedFile(FILE, 'text')

    expect(mockAgreementUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'agr-1', workspace_id: 'ws-1' },
      data: { status: 'PROCESSING' },
    })
    expect(mockAgreementUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'agr-1', workspace_id: 'ws-1' },
      data: { status: 'READY' },
    })
  })

  it('a chunk error lands the agreement on FAILED and is swallowed (batch continues)', async () => {
    mockSyncWorkspaceChunks.mockRejectedValue(new Error('chunker exploded'))

    const result = await indexExtractedFile(FILE, 'text')

    expect(result.routedAs).toBe('COLLECTIVE_AGREEMENT')
    expect(result.chunkError).toBe(true)
    const statuses = mockAgreementUpdateMany.mock.calls.map(
      (call) => (call[0] as { data: { status: string } }).data.status
    )
    expect(statuses).toEqual(['PROCESSING', 'FAILED'])
  })

  it('fail-safe: a status-write failure never throws', async () => {
    mockAgreementUpdateMany.mockRejectedValue(new Error('write refused'))
    await expect(indexExtractedFile(FILE, 'text')).resolves.toMatchObject({
      routedAs: 'COLLECTIVE_AGREEMENT',
    })
  })
})

describe('markAgreementFailedForFile — extraction-failure path', () => {
  it('marks the backing agreement FAILED when one exists', async () => {
    mockAgreementFindFirst.mockResolvedValue({ id: 'agr-1' })

    const result = await markAgreementFailedForFile(FILE)

    expect(result).toBe('agr-1')
    expect(mockAgreementUpdateMany).toHaveBeenCalledWith({
      where: { id: 'agr-1', workspace_id: 'ws-1' },
      data: { status: 'FAILED' },
    })
  })

  it('no-op (null) for files that do not back an agreement', async () => {
    mockAgreementFindFirst.mockResolvedValue(null)
    const result = await markAgreementFailedForFile(FILE)
    expect(result).toBeNull()
    expect(mockAgreementUpdateMany).not.toHaveBeenCalled()
  })

  it('fail-safe: lookup errors are swallowed', async () => {
    mockAgreementFindFirst.mockRejectedValue(new Error('down'))
    await expect(markAgreementFailedForFile(FILE)).resolves.toBeNull()
  })
})
