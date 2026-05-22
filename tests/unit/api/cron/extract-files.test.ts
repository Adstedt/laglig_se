/**
 * Story 17.8: Tests for the extract-files cron handler — idempotent claim,
 * stale re-enqueue, terminal transitions, telemetry, batch/folder scoping.
 * Prisma, storage, job-logger and extractFile are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  usageCreate: vi.fn(),
  download: vi.fn(),
  extractFile: vi.fn(),
  startJobRun: vi.fn(),
  completeJobRun: vi.fn(),
  failJobRun: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceFile: {
      updateMany: h.updateMany,
      findMany: h.findMany,
      update: h.update,
    },
    chatUsageEvent: { create: h.usageCreate },
  },
}))
vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: () => ({
    storage: { from: () => ({ download: h.download }) },
  }),
}))
vi.mock('@/lib/admin/job-logger', () => ({
  startJobRun: h.startJobRun,
  completeJobRun: h.completeJobRun,
  failJobRun: h.failJobRun,
}))
vi.mock('@/lib/documents/extract-file', () => ({ extractFile: h.extractFile }))

import { GET } from '@/app/api/cron/extract-files/route'

const blobOf = (text: string) => ({
  arrayBuffer: async () => new TextEncoder().encode(text).buffer,
})
const req = () =>
  new Request('http://localhost/api/cron/extract-files', {
    // Match the cron-secret the route captured at import (set in .env.local).
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
  })
const file = (over: Record<string, unknown> = {}) => ({
  id: 'f1',
  workspace_id: 'ws1',
  uploaded_by: 'u1',
  mime_type: 'application/pdf',
  storage_path: 'ws1/files/f1/a.pdf',
  filename: 'a.pdf',
  ...over,
})

// updateMany serves two callers: stale re-enqueue (where PROCESSING) and the
// per-file claim (where PENDING). Default: 0 stale, claim succeeds.
function wireUpdateMany(opts: { stale?: number; claim?: number } = {}) {
  h.updateMany.mockImplementation(
    ({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve({
        count:
          where.extraction_status === 'PROCESSING'
            ? (opts.stale ?? 0)
            : (opts.claim ?? 1),
      })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  h.startJobRun.mockResolvedValue('run1')
  h.completeJobRun.mockResolvedValue(undefined)
  h.findMany.mockResolvedValue([])
  h.update.mockResolvedValue({})
  h.usageCreate.mockResolvedValue({})
  h.download.mockResolvedValue({ data: blobOf('bytes'), error: null })
  wireUpdateMany()
})

describe('extract-files cron', () => {
  it('re-enqueues stale rows, claims + processes a PENDING file to DONE, writes telemetry', async () => {
    wireUpdateMany({ stale: 3, claim: 1 })
    h.findMany.mockResolvedValue([file()])
    h.extractFile.mockResolvedValue({
      status: 'DONE',
      markdown: '# md',
      usage: { model: 'claude-haiku-4-5', inputTokens: 100, outputTokens: 50 },
    })

    const res = await GET(req())
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.stats.reEnqueued).toBe(3)
    expect(body.stats.done).toBe(1)
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'f1' },
        data: expect.objectContaining({
          extraction_status: 'DONE',
          extracted_text: '# md',
        }),
      })
    )
    expect(h.usageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          context_type: 'FILE_EXTRACTION',
          workspace_id: 'ws1',
          user_id: 'u1',
          model: 'claude-haiku-4-5',
        }),
      })
    )
  })

  it('claims with an atomic PENDING→PROCESSING updateMany', async () => {
    h.findMany.mockResolvedValue([file()])
    h.extractFile.mockResolvedValue({ status: 'DONE', markdown: 'x' })
    await GET(req())
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: 'f1', extraction_status: 'PENDING' },
      data: { extraction_status: 'PROCESSING' },
    })
  })

  it('scopes the query to PENDING non-folder files with a batch limit', async () => {
    await GET(req())
    expect(h.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { extraction_status: 'PENDING', is_folder: false },
        take: 25,
      })
    )
  })

  it('skips a file when the claim is lost (another run won the race)', async () => {
    wireUpdateMany({ stale: 0, claim: 0 })
    h.findMany.mockResolvedValue([file()])

    const res = await GET(req())
    const body = await res.json()

    expect(body.stats.skipped).toBe(1)
    expect(h.download).not.toHaveBeenCalled()
    expect(h.extractFile).not.toHaveBeenCalled()
  })

  it('records a FAILED status and writes no telemetry (no usage)', async () => {
    h.findMany.mockResolvedValue([file()])
    h.extractFile.mockResolvedValue({ status: 'FAILED', markdown: null })

    const res = await GET(req())
    const body = await res.json()

    expect(body.stats.failed).toBe(1)
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ extraction_status: 'FAILED' }),
      })
    )
    expect(h.usageCreate).not.toHaveBeenCalled()
  })
})
