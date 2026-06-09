/**
 * Story 17.10b: cron sweep that picks up workspace_documents marked dirty by
 * autosaveDocument and runs indexWorkspaceDocument on each, then clears the flag.
 *
 * Tests:
 * - Sweep query filters by needs_reindex + last_marked_dirty_at < cutoff
 * - Per-doc workspace-scoped UPDATE clears the flag (AC 28)
 * - 5-autosaves-1-reindex semantics (AC 16) — the debounce + cron alignment
 *   means rapid marks collapse to a single sweep-pass reindex
 * - Failures don't halt the batch; flag stays set so next sweep retries
 * - Production 401 without CRON_SECRET
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()
const mockUpdateMany = vi.fn()
const mockIndex = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}))

vi.mock('@/lib/chunks/workspace-document-reindex', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/chunks/workspace-document-reindex')
  >('@/lib/chunks/workspace-document-reindex')
  return {
    ...actual,
    indexWorkspaceDocument: (...args: unknown[]) => mockIndex(...args),
  }
})

const { GET } = await import('@/app/api/cron/sweep-draft-reindex/route')

function makeRequest(): Request {
  return new Request('http://localhost/api/cron/sweep-draft-reindex', {
    headers: { 'x-triggered-by': 'test' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFindMany.mockResolvedValue([])
  mockUpdateMany.mockResolvedValue({ count: 1 })
  mockIndex.mockResolvedValue(undefined)
  process.env.NODE_ENV = 'test'
})

describe('GET /api/cron/sweep-draft-reindex — 17.10b cron sweep', () => {
  it('finds dirty docs whose mark is older than the 60s debounce window', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const where = mockFindMany.mock.calls[0]![0].where
    expect(where.needs_reindex).toBe(true)
    expect(where.last_marked_dirty_at.lte).toBeInstanceOf(Date)
    // Cutoff must be ~60s in the past (give it a 5s wall-clock slack).
    const cutoffAge = Date.now() - where.last_marked_dirty_at.lte.getTime()
    expect(cutoffAge).toBeGreaterThanOrEqual(60_000 - 5_000)
    expect(cutoffAge).toBeLessThanOrEqual(60_000 + 5_000)
  })

  // Race regression (QA 2026-06-02): a doc can be marked dirty while DRAFT
  // and then transition to SUPERSEDED/ARCHIVED before the sweep fires. The
  // updateDocumentStatus DELETE branch deletes the chunks; without this
  // filter the sweep would re-CREATE them from the still-present content_html.
  it('REGRESSION: excludes docs in terminal states (SUPERSEDED/ARCHIVED) to close the autosave→archive race', async () => {
    await GET(makeRequest())
    const where = mockFindMany.mock.calls[0]![0].where
    expect(where.status).toEqual({ notIn: ['SUPERSEDED', 'ARCHIVED'] })
  })

  it('invokes indexWorkspaceDocument per candidate AND clears the dirty flag workspace-scoped (AC 28)', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'doc-1', workspace_id: 'ws-A' },
      { id: 'doc-2', workspace_id: 'ws-B' },
    ])

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.stats.candidates).toBe(2)
    expect(body.stats.processed).toBe(2)
    expect(body.stats.failed).toBe(0)

    // Each doc was indexed with its own workspace_id
    expect(mockIndex).toHaveBeenCalledTimes(2)
    expect(mockIndex).toHaveBeenNthCalledWith(1, 'doc-1', 'ws-A')
    expect(mockIndex).toHaveBeenNthCalledWith(2, 'doc-2', 'ws-B')

    // Each clear-UPDATE was scoped on BOTH id AND workspace_id (AC 28)
    expect(mockUpdateMany).toHaveBeenCalledTimes(2)
    expect(mockUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'doc-1', workspace_id: 'ws-A' },
      data: { needs_reindex: false, last_marked_dirty_at: null },
    })
    expect(mockUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'doc-2', workspace_id: 'ws-B' },
      data: { needs_reindex: false, last_marked_dirty_at: null },
    })
  })

  it('AC 16: 5 marks → 1 reindex (debounce + cron alignment collapse rapid edits)', async () => {
    // The cron sweep is the single consumer — the doc only appears as ONE row in
    // findMany regardless of how many autosaves marked it dirty (they're
    // idempotent UPDATEs to the same row). This is the load-shedding property.
    mockFindMany.mockResolvedValue([
      { id: 'doc-edited-5x', workspace_id: 'ws-1' },
    ])

    await GET(makeRequest())

    // Only one indexWorkspaceDocument call despite 5 simulated autosaves upstream.
    expect(mockIndex).toHaveBeenCalledTimes(1)
    expect(mockIndex).toHaveBeenCalledWith('doc-edited-5x', 'ws-1')
  })

  it('a failure on one doc does NOT halt the batch; the flag stays set so next sweep retries', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'doc-good', workspace_id: 'ws-A' },
      { id: 'doc-bad', workspace_id: 'ws-A' },
      { id: 'doc-good-2', workspace_id: 'ws-A' },
    ])
    mockIndex
      .mockResolvedValueOnce(undefined) // doc-good
      .mockRejectedValueOnce(new Error('embed API timeout')) // doc-bad
      .mockResolvedValueOnce(undefined) // doc-good-2

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.stats.processed).toBe(2)
    expect(body.stats.failed).toBe(1)
    expect(body.stats.failures[0].documentId).toBe('doc-bad')

    // Clearing UPDATEs ran only for the successful docs (1 + 1 = 2).
    // The failed doc keeps needs_reindex = true → next sweep retries.
    expect(mockUpdateMany).toHaveBeenCalledTimes(2)
    const clearedIds = mockUpdateMany.mock.calls.map(
      (c) => (c[0] as { where: { id: string } }).where.id
    )
    expect(clearedIds).toEqual(['doc-good', 'doc-good-2'])
    expect(clearedIds).not.toContain('doc-bad')
  })

  it('returns 401 in production without the Bearer token', async () => {
    const originalNodeEnv = process.env.NODE_ENV
    const originalSecret = process.env.CRON_SECRET
    try {
      process.env.NODE_ENV = 'production'
      process.env.CRON_SECRET = 'expected-secret'

      const res = await GET(makeRequest())
      expect(res.status).toBe(401)
      expect(mockFindMany).not.toHaveBeenCalled()
    } finally {
      process.env.NODE_ENV = originalNodeEnv
      if (originalSecret === undefined) {
        delete process.env.CRON_SECRET
      } else {
        process.env.CRON_SECRET = originalSecret
      }
    }
  })
})
