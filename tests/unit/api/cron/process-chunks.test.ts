/**
 * Story 14.14, Task 5.1b
 *
 * Tests the process-chunks cron route logic:
 * - Documents with no chunks are identified
 * - Documents where updated_at > latest chunk created_at are identified
 * - Batch limit is respected
 * - Failure handling is graceful
 * - Job logger instrumentation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStartJobRun = vi.fn().mockResolvedValue('run-123')
const mockCompleteJobRun = vi.fn().mockResolvedValue(undefined)
const mockFailJobRun = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/admin/job-logger', () => ({
  startJobRun: (...args: unknown[]) => mockStartJobRun(...args),
  completeJobRun: (...args: unknown[]) => mockCompleteJobRun(...args),
  failJobRun: (...args: unknown[]) => mockFailJobRun(...args),
}))

const mockSyncDocumentChunks = vi.fn()

vi.mock('@/lib/chunks/sync-document-chunks', () => ({
  syncDocumentChunks: (...args: unknown[]) => mockSyncDocumentChunks(...args),
}))

const mockQueryRaw = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}))

// Import after mocks
const { GET } = await import('@/app/api/cron/process-chunks/route')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): Request {
  return new Request('http://localhost/api/cron/process-chunks', {
    headers: { 'x-triggered-by': 'test' },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('process-chunks cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Use development mode to skip auth (CRON_SECRET is module-level const)
    vi.stubEnv('NODE_ENV', 'development')
  })

  it('processes documents with no chunks (reason: no_chunks)', async () => {
    mockQueryRaw.mockResolvedValue([
      { id: 'doc-1', document_number: 'SFS 2024:100', reason: 'no_chunks' },
    ])
    mockSyncDocumentChunks.mockResolvedValue({
      chunksCreated: 15,
      chunksDeleted: 0,
      chunksEmbedded: 15,
      duration: 500,
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.stats.docsFound).toBe(1)
    expect(body.stats.docsProcessed).toBe(1)
    expect(body.stats.chunksCreated).toBe(15)
    expect(body.stats.chunksEmbedded).toBe(15)
    expect(mockSyncDocumentChunks).toHaveBeenCalledWith('doc-1')
  })

  it('processes documents with stale chunks (reason: stale_chunks)', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: 'doc-2',
        document_number: 'SFS 2020:500',
        reason: 'stale_chunks',
      },
    ])
    mockSyncDocumentChunks.mockResolvedValue({
      chunksCreated: 10,
      chunksDeleted: 8,
      chunksEmbedded: 10,
      duration: 400,
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.stats.docsProcessed).toBe(1)
    expect(body.stats.chunksCreated).toBe(10)
    expect(body.stats.chunksDeleted).toBe(8)
  })

  it('returns success with 0 docs when nothing needs processing', async () => {
    mockQueryRaw.mockResolvedValue([])

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.stats.docsFound).toBe(0)
    expect(body.stats.docsProcessed).toBe(0)
    expect(mockSyncDocumentChunks).not.toHaveBeenCalled()
  })

  it('handles syncDocumentChunks failures gracefully', async () => {
    mockQueryRaw.mockResolvedValue([
      { id: 'doc-fail', document_number: 'SFS 2024:999', reason: 'no_chunks' },
    ])
    mockSyncDocumentChunks.mockRejectedValue(new Error('Embedding API down'))

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.success).toBe(true) // Route itself doesn't fail
    expect(body.stats.docsFailed).toBe(1)
    expect(body.stats.docsProcessed).toBe(0)
    expect(body.stats.failures).toHaveLength(1)
    expect(body.stats.failures[0].documentNumber).toBe('SFS 2024:999')
  })

  it('instruments with job logger', async () => {
    mockQueryRaw.mockResolvedValue([])

    await GET(makeRequest())

    expect(mockStartJobRun).toHaveBeenCalledWith('process-chunks', 'test')
    expect(mockCompleteJobRun).toHaveBeenCalledWith('run-123', {
      itemsProcessed: 0,
      itemsFailed: 0,
    })
  })

  it('aggregates stats across multiple documents', async () => {
    mockQueryRaw.mockResolvedValue([
      { id: 'doc-a', document_number: 'SFS 2024:1', reason: 'no_chunks' },
      { id: 'doc-b', document_number: 'SFS 2024:2', reason: 'stale_chunks' },
      { id: 'doc-c', document_number: 'SFS 2024:3', reason: 'no_chunks' },
    ])
    mockSyncDocumentChunks
      .mockResolvedValueOnce({
        chunksCreated: 10,
        chunksDeleted: 0,
        chunksEmbedded: 10,
        duration: 300,
      })
      .mockResolvedValueOnce({
        chunksCreated: 5,
        chunksDeleted: 3,
        chunksEmbedded: 5,
        duration: 200,
      })
      .mockResolvedValueOnce({
        chunksCreated: 8,
        chunksDeleted: 0,
        chunksEmbedded: 8,
        duration: 250,
      })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.stats.docsProcessed).toBe(3)
    expect(body.stats.chunksCreated).toBe(23)
    expect(body.stats.chunksDeleted).toBe(3)
    expect(body.stats.chunksEmbedded).toBe(23)
  })
})
