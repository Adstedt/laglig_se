import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Prisma singleton used by both the detector core and the emitter.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cronJobRun: { count: vi.fn() },
    legalDocument: { findMany: vi.fn(), update: vi.fn() },
    changeEvent: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { runSkolfsDetector } from '@/lib/agency/skolfs-detector'

// --- fake SKOLFS API (statute poll + per-doc enrichment) ---------------------

const STATUTE_HITS = [
  // base (consolidated) we already have
  {
    skolfsNumber: '2010:32',
    baseSkolfsNumber: '2010:32',
    statuteTitle: 'X',
    documentType: 'GRUNDFORFATTNING',
    validity: 'VALID',
  },
  {
    skolfsNumber: '2010:32',
    baseSkolfsNumber: '2010:32',
    statuteTitle: 'X',
    documentType: 'SENASTE_LYDELSE',
    validity: 'VALID',
  },
  // amendment already in our baseline
  {
    skolfsNumber: '2019:21',
    baseSkolfsNumber: '2010:32',
    statuteTitle: 'ändr.',
    documentType: 'ANDRINGSFORFATTNING',
    validity: 'VALID',
  },
  // NEW valid amendment not in baseline → AMENDMENT
  {
    skolfsNumber: '2026:99',
    baseSkolfsNumber: '2010:32',
    statuteTitle: 'ändr.',
    documentType: 'ANDRINGSFORFATTNING',
    validity: 'VALID',
  },
]

const fakeFetch = (async (url: string | URL) => {
  const u = String(url)
  if (u.includes('/statute')) {
    return {
      ok: true,
      json: async () => ({ searchGroups: [{ searchHits: STATUTE_HITS }] }),
    } as Response
  }
  if (u.includes('/document/')) {
    return {
      ok: true,
      json: async () => ({
        relatedDocumentMetadata: [
          {
            skolfsNumber: '2026:99',
            documentType: 'ANDRINGSFORFATTNING',
            validity: 'VALID',
            effectiveDate: '2026-09-01',
            change: 'ändr. 2 §',
          },
        ],
      }),
    } as Response
  }
  return { ok: false } as Response
}) as unknown as typeof fetch

const baselineDoc = {
  id: 'doc-1',
  document_number: 'SKOLFS 2010:32',
  status: 'ACTIVE',
  metadata: {
    skolfs: {
      validity: 'VALID',
      isConsolidated: true,
      latestChangeBySkolfsNo: '2019:21',
      amendmentChain: [
        {
          skolfsNumber: '2019:21',
          validity: 'VALID',
          effectiveDate: '2019-08-01',
          change: 'ändr.',
        },
      ],
      upcoming: [],
    },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  // Not first run → avoid UPCOMING backfill noise; isolate the AMENDMENT path.
  vi.mocked(prisma.cronJobRun.count).mockResolvedValue(1)
  vi.mocked(prisma.legalDocument.findMany).mockResolvedValue([
    baselineDoc,
  ] as never)
  vi.mocked(prisma.changeEvent.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.changeEvent.create).mockResolvedValue({
    id: 'ce-new',
  } as never)
  vi.mocked(prisma.legalDocument.update).mockResolvedValue({} as never)
})

describe('runSkolfsDetector', () => {
  it('dry-run (commit=false) classifies + counts but writes nothing', async () => {
    const stats = await runSkolfsDetector({
      commit: false,
      fetchImpl: fakeFetch,
    })

    expect(stats.committed).toBe(false)
    expect(stats.baselines).toBe(1)
    expect(stats.amendment).toBe(1)
    expect(stats.eventsCreated).toBe(0)
    // no writes at all
    expect(prisma.changeEvent.create).not.toHaveBeenCalled()
    expect(prisma.legalDocument.update).not.toHaveBeenCalled()
    // sample is populated for visibility
    expect(stats.sample.some((s) => s.kind === 'AMENDMENT')).toBe(true)
  })

  it("commit=true emits a dedup'd AMENDMENT ChangeEvent (enriched)", async () => {
    const stats = await runSkolfsDetector({
      commit: true,
      fetchImpl: fakeFetch,
    })

    expect(stats.committed).toBe(true)
    expect(stats.amendment).toBe(1)
    expect(stats.eventsCreated).toBe(1)
    expect(stats.eventsFailed).toBe(0)
    expect(prisma.changeEvent.create).toHaveBeenCalledTimes(1)

    const data = vi.mocked(prisma.changeEvent.create).mock.calls[0]![0].data
    expect(data.change_type).toBe('AMENDMENT')
    expect(data.amendment_sfs).toBe('SKOLFS 2026:99')
    expect(data.content_type).toBe('AGENCY_REGULATION')
    // enrichment folded the API change/effectiveDate into the summary
    expect(data.ai_summary).toContain('2026:99')
    expect(data.ai_summary).toContain('2026-09-01')
  })

  it('commit=true is idempotent — an existing event yields a duplicate, no create', async () => {
    vi.mocked(prisma.changeEvent.findFirst).mockResolvedValue({
      id: 'ce-existing',
    } as never)
    const stats = await runSkolfsDetector({
      commit: true,
      fetchImpl: fakeFetch,
    })
    expect(stats.eventsCreated).toBe(0)
    expect(stats.eventsDuplicate).toBe(1)
    expect(prisma.changeEvent.create).not.toHaveBeenCalled()
  })
})
