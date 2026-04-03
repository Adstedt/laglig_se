/**
 * Story 8.8, Task 3.2
 *
 * Tests for the enrich-amendment-summaries cron route.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStartJobRun = vi.fn().mockResolvedValue('run-456')
const mockCompleteJobRun = vi.fn().mockResolvedValue(undefined)
const mockFailJobRun = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/admin/job-logger', () => ({
  startJobRun: (...args: unknown[]) => mockStartJobRun(...args),
  completeJobRun: (...args: unknown[]) => mockCompleteJobRun(...args),
  failJobRun: (...args: unknown[]) => mockFailJobRun(...args),
}))

const mockQueryRaw = vi.fn()
const mockUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
const mockUpdate = vi.fn().mockResolvedValue({})
const mockFindMany = vi.fn().mockResolvedValue([])

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    changeEvent: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    legalDocument: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    sectionChange: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate }
    },
  }
})

// Import after mocks
const { GET } = await import('@/app/api/cron/enrich-amendment-summaries/route')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): Request {
  return new Request('http://localhost/api/cron/enrich-amendment-summaries', {
    headers: { 'x-triggered-by': 'test' },
  })
}

function makeLlmResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
  }
}

const SAMPLE_ROW = {
  amendment_sfs: 'SFS 2026:109',
  change_event_ids: ['ce-1', 'ce-2'],
  base_law_id: 'bl-1',
  base_law_title: 'Skattebrottslag (1971:69)',
  base_law_summary: 'Reglerar skattebrott.',
  amendment_id: 'ad-1',
  amendment_title: 'Lag om ändring i skattebrottslagen',
  amendment_markdown: '# SFS 2026:109\n\nÄndringstext...',
  amendment_effective_date: new Date('2026-04-01'),
  amendment_legal_doc_id: 'ald-1',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('enrich-amendment-summaries cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'development')
    mockFindMany.mockResolvedValue([])
  })

  it('enriches amendment and stores on ChangeEvent + LegalDocument', async () => {
    mockQueryRaw.mockResolvedValue([SAMPLE_ROW])
    mockCreate.mockResolvedValue(
      makeLlmResponse(
        'Tolv paragrafer i skattebrottslagen ändras med skärpta straffskalor.'
      )
    )

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.stats.enriched).toBe(1)

    // Should update all related ChangeEvents
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['ce-1', 'ce-2'] } },
        data: expect.objectContaining({
          ai_summary:
            'Tolv paragrafer i skattebrottslagen ändras med skärpta straffskalor.',
        }),
      })
    )

    // Should update amendment LegalDocument
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ald-1' },
        data: {
          summary:
            'Tolv paragrafer i skattebrottslagen ändras med skärpta straffskalor.',
        },
      })
    )
  })

  it('returns success with 0 enriched when nothing needs processing', async () => {
    mockQueryRaw.mockResolvedValue([])

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.stats.enriched).toBe(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('skips amendments without markdown', async () => {
    mockQueryRaw.mockResolvedValue([
      { ...SAMPLE_ROW, amendment_markdown: null },
    ])

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.stats.skipped).toBe(1)
    expect(body.stats.enriched).toBe(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it(
    'handles LLM failure gracefully — retries once then skips',
    { timeout: 15000 },
    async () => {
      mockQueryRaw.mockResolvedValue([
        SAMPLE_ROW,
        {
          ...SAMPLE_ROW,
          amendment_sfs: 'SFS 2026:200',
          change_event_ids: ['ce-3'],
          amendment_id: 'ad-2',
          amendment_legal_doc_id: 'ald-2',
        },
      ])
      mockCreate
        // First amendment: fail twice (attempt 1 + retry)
        .mockRejectedValueOnce(new Error('API rate limit'))
        .mockRejectedValueOnce(new Error('API rate limit'))
        // Second amendment: succeed
        .mockResolvedValueOnce(makeLlmResponse('En paragraf ändras.'))

      const res = await GET(makeRequest())
      const body = await res.json()

      expect(body.stats.failed).toBe(1)
      expect(body.stats.enriched).toBe(1)
      expect(body.stats.failures[0].sfsNumber).toBe('SFS 2026:109')
    }
  )

  it(
    'handles empty LLM response — retries once',
    { timeout: 15000 },
    async () => {
      mockQueryRaw.mockResolvedValue([SAMPLE_ROW])
      // Empty on both attempts
      mockCreate
        .mockResolvedValueOnce({ content: [] })
        .mockResolvedValueOnce({ content: [] })

      const res = await GET(makeRequest())
      const body = await res.json()

      expect(body.stats.failed).toBe(1)
      expect(body.stats.enriched).toBe(0)
    }
  )

  it('instruments with job logger', async () => {
    mockQueryRaw.mockResolvedValue([])

    await GET(makeRequest())

    expect(mockStartJobRun).toHaveBeenCalledWith(
      'enrich-amendment-summaries',
      'test'
    )
    expect(mockCompleteJobRun).toHaveBeenCalledWith('run-456', {
      itemsProcessed: 0,
      itemsFailed: 0,
    })
  })

  it('skips LegalDocument update when amendment_legal_doc_id is null', async () => {
    mockQueryRaw.mockResolvedValue([
      { ...SAMPLE_ROW, amendment_legal_doc_id: null },
    ])
    mockCreate.mockResolvedValue(makeLlmResponse('En ändring i lagen.'))

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.stats.enriched).toBe(1)
    expect(mockUpdateMany).toHaveBeenCalled() // ChangeEvent updated
    expect(mockUpdate).not.toHaveBeenCalled() // No LegalDocument to update
  })
})
