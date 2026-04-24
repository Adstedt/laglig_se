/**
 * Story 21.9 — tests for check-evidence-references.ts.
 * Mocks Prisma; exercises both exported functions + the NH-5 overflow cap.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  findActiveSnapshotReferences,
  formatBlockedByCyclesError,
  type CycleRef,
} from '@/lib/compliance-audit/check-evidence-references'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    complianceEvidenceSnapshot: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

const FILE_ID = '11111111-1111-4111-8111-111111111111'
const DOCUMENT_ID = '22222222-2222-4222-8222-222222222222'

function mockSnapshots(
  cycles: Array<{ id: string; name: string; status: string }>
) {
  vi.mocked(prisma.complianceEvidenceSnapshot.findMany).mockResolvedValueOnce(
    cycles.map((c) => ({ cycle: c })) as unknown as Awaited<
      ReturnType<typeof prisma.complianceEvidenceSnapshot.findMany>
    >
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('findActiveSnapshotReferences', () => {
  it('returns one entry for a file referenced by a SEALED cycle', async () => {
    mockSnapshots([{ id: 'c1', name: 'Q1 revision', status: 'SEALED' }])
    const refs = await findActiveSnapshotReferences({ fileId: FILE_ID })
    expect(refs).toEqual([
      { cycleId: 'c1', cycleName: 'Q1 revision', status: 'SEALED' },
    ])
  })

  it('returns one entry for a document referenced by a SEALED cycle', async () => {
    mockSnapshots([{ id: 'c1', name: 'Q1 revision', status: 'SEALED' }])
    const refs = await findActiveSnapshotReferences({ documentId: DOCUMENT_ID })
    expect(refs).toHaveLength(1)
    expect(refs[0]?.cycleId).toBe('c1')
  })

  it('returns empty array when only AVSLUTAD cycles reference (MVP scope gate)', async () => {
    // The prisma query filters to SEALED at the where clause, so this is
    // implicit in the mock — returning an empty array models the filter.
    mockSnapshots([])
    const refs = await findActiveSnapshotReferences({ fileId: FILE_ID })
    expect(refs).toEqual([])
  })

  it('throws when both fileId and documentId are provided', async () => {
    await expect(
      findActiveSnapshotReferences({
        fileId: FILE_ID,
        documentId: DOCUMENT_ID,
      })
    ).rejects.toThrow(/exactly one of fileId or documentId/)
  })

  it('throws when neither fileId nor documentId is provided', async () => {
    await expect(findActiveSnapshotReferences({})).rejects.toThrow(
      /exactly one of fileId or documentId/
    )
  })

  it('dedupes multiple snapshots from the same cycle + sorts by cycleName', async () => {
    mockSnapshots([
      { id: 'c2', name: 'Beta kontroll', status: 'SEALED' },
      { id: 'c1', name: 'Alfa kontroll', status: 'SEALED' },
      { id: 'c1', name: 'Alfa kontroll', status: 'SEALED' }, // dup — same cycle
    ])
    const refs = await findActiveSnapshotReferences({ fileId: FILE_ID })
    expect(refs).toHaveLength(2)
    expect(refs.map((r) => r.cycleName)).toEqual([
      'Alfa kontroll',
      'Beta kontroll',
    ])
  })
})

describe('formatBlockedByCyclesError (NH-5)', () => {
  function makeRefs(n: number): CycleRef[] {
    return Array.from({ length: n }, (_, i) => ({
      cycleId: `c${i + 1}`,
      cycleName: `Kontroll ${String.fromCharCode(65 + i)}`,
      status: 'SEALED' as const,
    }))
  }

  it('formats a single cycle with singular "kontroll"', () => {
    const msg = formatBlockedByCyclesError(makeRefs(1))
    expect(msg).toBe(
      'Filen används som bevis i fastställd kontroll: Kontroll A. Radering blockerad.'
    )
  })

  it('formats three cycles with plural "kontroller" and no overflow', () => {
    const msg = formatBlockedByCyclesError(makeRefs(3))
    expect(msg).toBe(
      'Filen används som bevis i fastställda kontroller: Kontroll A, Kontroll B, Kontroll C. Radering blockerad.'
    )
  })

  it('caps at 3 cycle names with "…och N fler" overflow for 30 cycles', () => {
    const msg = formatBlockedByCyclesError(makeRefs(30))
    expect(msg).toBe(
      'Filen används som bevis i fastställda kontroller: Kontroll A, Kontroll B, Kontroll C …och 27 fler. Radering blockerad.'
    )
  })

  it('throws when called with an empty refs array', () => {
    expect(() => formatBlockedByCyclesError([])).toThrow(/must be non-empty/)
  })
})
