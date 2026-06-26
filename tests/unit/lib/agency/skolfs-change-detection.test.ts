import { describe, it, expect } from 'vitest'
import {
  classifySkolfsDiff,
  snapshotFromBaselineMetadata,
  type SkolfsSnapshot,
  type SkolfsAmendmentRef,
} from '@/lib/agency/skolfs-change-detection'

// --- fixture helpers ---------------------------------------------------------

const amend = (
  skolfsNumber: string,
  validity: SkolfsAmendmentRef['validity'],
  effectiveDate: string | null = null,
  change: string | null = null
): SkolfsAmendmentRef => ({ skolfsNumber, validity, effectiveDate, change })

const snap = (over: Partial<SkolfsSnapshot> = {}): SkolfsSnapshot => ({
  documentNumber: 'SKOLFS 2024:616',
  validity: 'VALID',
  isConsolidated: false,
  latestChangeBySkolfsNo: null,
  effectiveDate: '2024-08-01',
  amendmentChain: [],
  upcoming: [],
  ...over,
})

// --- NEW_LAW -----------------------------------------------------------------

describe('classifySkolfsDiff — NEW_LAW', () => {
  it('emits NEW_LAW when a VALID base has no baseline', () => {
    const signals = classifySkolfsDiff(null, snap({ validity: 'VALID' }))
    expect(signals).toHaveLength(1)
    expect(signals[0]!.kind).toBe('NEW_LAW')
    expect(signals[0]!.documentNumber).toBe('SKOLFS 2024:616')
    expect(signals[0]!.amendmentSkolfsNo).toBeNull()
    expect(signals[0]!.effectiveDate).toBe('2024-08-01')
  })

  it('emits NEW_LAW for an UPCOMING→VALID base we did not previously have', () => {
    // We excluded it while UPCOMING (no baseline); now it is VALID.
    const signals = classifySkolfsDiff(null, snap({ validity: 'VALID' }))
    expect(signals.map((s) => s.kind)).toEqual(['NEW_LAW'])
  })

  it('emits nothing for a base we do not have that is still UPCOMING/EXPIRED', () => {
    expect(classifySkolfsDiff(null, snap({ validity: 'UPCOMING' }))).toEqual([])
    expect(classifySkolfsDiff(null, snap({ validity: 'EXPIRED' }))).toEqual([])
  })
})

// --- AMENDMENT ---------------------------------------------------------------

describe('classifySkolfsDiff — AMENDMENT', () => {
  it('emits AMENDMENT when latestChangeBySkolfsNo advances', () => {
    const baseline = snap({ latestChangeBySkolfsNo: '2024:616' })
    const current = snap({
      latestChangeBySkolfsNo: '2025:449',
      amendmentChain: [amend('2025:449', 'VALID', '2025-11-10', 'ändr. 14 §')],
    })
    const signals = classifySkolfsDiff(baseline, current)
    expect(signals).toHaveLength(1)
    expect(signals[0]!.kind).toBe('AMENDMENT')
    expect(signals[0]!.amendmentSkolfsNo).toBe('2025:449')
    expect(signals[0]!.effectiveDate).toBe('2025-11-10')
    expect(signals[0]!.changedSections).toBe('ändr. 14 §')
  })

  it('emits AMENDMENT when a chain amendment flips UPCOMING → VALID', () => {
    const baseline = snap({
      latestChangeBySkolfsNo: '2024:616',
      upcoming: [amend('2025:449', 'UPCOMING', '2025-11-10', 'ändr. 14 §')],
      amendmentChain: [
        amend('2025:449', 'UPCOMING', '2025-11-10', 'ändr. 14 §'),
      ],
    })
    const current = snap({
      // latestChangeBySkolfsNo unchanged on purpose — flip must still be caught
      latestChangeBySkolfsNo: '2024:616',
      upcoming: [],
      amendmentChain: [amend('2025:449', 'VALID', '2025-11-10', 'ändr. 14 §')],
    })
    const signals = classifySkolfsDiff(baseline, current)
    expect(signals.map((s) => s.kind)).toEqual(['AMENDMENT'])
    expect(signals[0]!.amendmentSkolfsNo).toBe('2025:449')
  })

  it('emits AMENDMENT for a brand-new immediately-VALID amendment (no latestChange, statute-only poll)', () => {
    // Published already in force, skipping our UPCOMING capture; the cheap
    // single-poll pass leaves latestChangeBySkolfsNo null.
    const baseline = snap({
      latestChangeBySkolfsNo: null,
      amendmentChain: [],
      upcoming: [],
    })
    const current = snap({
      latestChangeBySkolfsNo: null,
      amendmentChain: [amend('2026:100', 'VALID', '2026-09-01', 'ändr. 2 §')],
    })
    const signals = classifySkolfsDiff(baseline, current)
    expect(signals.map((s) => s.kind)).toEqual(['AMENDMENT'])
    expect(signals[0]!.amendmentSkolfsNo).toBe('2026:100')
  })

  it('emits AMENDMENT when a new VALID consolidation (SENASTE_LYDELSE) appears', () => {
    const baseline = snap({
      isConsolidated: false,
      latestChangeBySkolfsNo: '2019:21',
    })
    const current = snap({
      isConsolidated: true,
      latestChangeBySkolfsNo: '2019:21',
      amendmentChain: [
        amend('2019:21', 'VALID', '2019-08-01', 'ändr. 3, 4 §§'),
      ],
    })
    const signals = classifySkolfsDiff(baseline, current)
    expect(signals.map((s) => s.kind)).toEqual(['AMENDMENT'])
    expect(signals[0]!.amendmentSkolfsNo).toBe('2019:21')
  })
})

// --- REPEAL ------------------------------------------------------------------

describe('classifySkolfsDiff — REPEAL', () => {
  it('emits REPEAL when a base flips VALID → EXPIRED', () => {
    const baseline = snap({ validity: 'VALID' })
    const current = snap({ validity: 'EXPIRED' })
    const signals = classifySkolfsDiff(baseline, current)
    expect(signals).toHaveLength(1)
    expect(signals[0]!.kind).toBe('REPEAL')
    expect(signals[0]!.amendmentSkolfsNo).toBeNull()
  })

  it('does not also emit amendment/upcoming signals on repeal', () => {
    const baseline = snap({
      validity: 'VALID',
      upcoming: [amend('2027:1', 'UPCOMING', '2027-07-01')],
    })
    const current = snap({
      validity: 'EXPIRED',
      latestChangeBySkolfsNo: '2026:99',
    })
    expect(classifySkolfsDiff(baseline, current).map((s) => s.kind)).toEqual([
      'REPEAL',
    ])
  })
})

// --- UPCOMING_AMENDMENT ------------------------------------------------------

describe('classifySkolfsDiff — UPCOMING_AMENDMENT', () => {
  it('emits UPCOMING for a chain UPCOMING amendment not in the baseline', () => {
    const baseline = snap({ upcoming: [], amendmentChain: [] })
    const current = snap({
      amendmentChain: [
        amend('2024:617', 'UPCOMING', '2027-07-01', 'upph. 8 §'),
      ],
      upcoming: [amend('2024:617', 'UPCOMING', '2027-07-01', 'upph. 8 §')],
    })
    const signals = classifySkolfsDiff(baseline, current)
    expect(signals).toHaveLength(1)
    expect(signals[0]!.kind).toBe('UPCOMING_AMENDMENT')
    expect(signals[0]!.amendmentSkolfsNo).toBe('2024:617')
    expect(signals[0]!.effectiveDate).toBe('2027-07-01')
    expect(signals[0]!.changedSections).toBe('upph. 8 §')
  })

  it('first-run backfills UPCOMING events from the baseline upcoming[]', () => {
    // 9.7 captured the pending amendment into the baseline; the detector has
    // never emitted an event for it. firstRun must surface it (deduped at DB).
    const pending = amend(
      '2026:23',
      'UPCOMING',
      '2026-07-01',
      'ändr. ämnesplan'
    )
    const baseline = snap({ upcoming: [pending], amendmentChain: [pending] })
    const current = snap({ upcoming: [pending], amendmentChain: [pending] })

    expect(classifySkolfsDiff(baseline, current, { firstRun: true })).toEqual([
      expect.objectContaining({
        kind: 'UPCOMING_AMENDMENT',
        amendmentSkolfsNo: '2026:23',
        effectiveDate: '2026-07-01',
      }),
    ])
    // ...but a normal subsequent run treats the same pending amendment as known.
    expect(classifySkolfsDiff(baseline, current)).toEqual([])
  })

  it('can emit both an AMENDMENT and an UPCOMING_AMENDMENT for one base', () => {
    const baseline = snap({ latestChangeBySkolfsNo: '2024:616' })
    const current = snap({
      latestChangeBySkolfsNo: '2025:449',
      amendmentChain: [
        amend('2025:449', 'VALID', '2025-11-10', 'ändr. 14 §'),
        amend('2024:617', 'UPCOMING', '2027-07-01', 'upph. 8 §'),
      ],
      upcoming: [amend('2024:617', 'UPCOMING', '2027-07-01', 'upph. 8 §')],
    })
    const kinds = classifySkolfsDiff(baseline, current).map((s) => s.kind)
    expect(kinds).toContain('AMENDMENT')
    expect(kinds).toContain('UPCOMING_AMENDMENT')
    expect(kinds).toHaveLength(2)
  })
})

// --- NO CHANGE ---------------------------------------------------------------

describe('classifySkolfsDiff — no change', () => {
  it('emits nothing for identical baseline vs current', () => {
    const pending = amend('2026:23', 'UPCOMING', '2026-07-01')
    const baseline = snap({
      latestChangeBySkolfsNo: '2025:449',
      upcoming: [pending],
      amendmentChain: [amend('2025:449', 'VALID'), pending],
    })
    const current = snap({
      latestChangeBySkolfsNo: '2025:449',
      upcoming: [pending],
      amendmentChain: [amend('2025:449', 'VALID'), pending],
    })
    expect(classifySkolfsDiff(baseline, current)).toEqual([])
  })

  it('emits nothing when an already-known UPCOMING stays pending across runs', () => {
    const pending = amend('2024:617', 'UPCOMING', '2027-07-01')
    const baseline = snap({ upcoming: [pending], amendmentChain: [pending] })
    const current = snap({ upcoming: [pending], amendmentChain: [pending] })
    expect(classifySkolfsDiff(baseline, current)).toEqual([])
  })
})

// --- dedup across runs (classifier-level idempotency contract) ----------------

describe('classifySkolfsDiff — stable across repeated runs', () => {
  it('same diff twice yields the same single signal (DB dedup makes it one event)', () => {
    const baseline = snap({ latestChangeBySkolfsNo: '2024:616' })
    const current = snap({
      latestChangeBySkolfsNo: '2025:449',
      amendmentChain: [amend('2025:449', 'VALID', '2025-11-10', 'ändr. 14 §')],
    })
    const run1 = classifySkolfsDiff(baseline, current)
    const run2 = classifySkolfsDiff(baseline, current)
    expect(run1).toEqual(run2)
    expect(run1).toHaveLength(1)
    expect(run1[0]!.amendmentSkolfsNo).toBe('2025:449')
  })
})

// --- baseline projection -----------------------------------------------------

describe('snapshotFromBaselineMetadata', () => {
  it('projects a 9.7 metadata.skolfs block onto a snapshot', () => {
    const metadata = {
      effectiveDate: '2024-08-01',
      contentHash: 'abc',
      skolfs: {
        validity: 'VALID',
        isConsolidated: true,
        latestChangeBySkolfsNo: '2025:449',
        amendmentChain: [
          {
            skolfsNumber: '2025:449',
            validity: 'VALID',
            effectiveDate: '2025-11-10',
            change: 'ändr. 14 §',
          },
        ],
        upcoming: [
          {
            skolfsNumber: '2024:617',
            validity: 'UPCOMING',
            effectiveDate: '2027-07-01',
            change: 'upph. 8 §',
          },
        ],
      },
    }
    const s = snapshotFromBaselineMetadata('SKOLFS 2024:616', metadata)
    expect(s).not.toBeNull()
    expect(s!.documentNumber).toBe('SKOLFS 2024:616')
    expect(s!.validity).toBe('VALID')
    expect(s!.isConsolidated).toBe(true)
    expect(s!.latestChangeBySkolfsNo).toBe('2025:449')
    expect(s!.effectiveDate).toBe('2024-08-01')
    expect(s!.upcoming).toHaveLength(1)
  })

  it('returns null when there is no skolfs block (treat as not ingested)', () => {
    expect(snapshotFromBaselineMetadata('SKOLFS 1999:1', null)).toBeNull()
    expect(snapshotFromBaselineMetadata('SKOLFS 1999:1', {})).toBeNull()
    expect(
      snapshotFromBaselineMetadata('SKOLFS 1999:1', { skolfs: 'x' })
    ).toBeNull()
  })

  it('round-trips into the classifier to detect an amendment', () => {
    const baselineMeta = {
      skolfs: {
        validity: 'VALID',
        isConsolidated: true,
        latestChangeBySkolfsNo: '2024:616',
        amendmentChain: [],
        upcoming: [],
      },
    }
    const baseline = snapshotFromBaselineMetadata(
      'SKOLFS 2024:616',
      baselineMeta
    )
    const current = snap({
      latestChangeBySkolfsNo: '2025:449',
      isConsolidated: true,
      amendmentChain: [amend('2025:449', 'VALID', '2025-11-10', 'ändr. 14 §')],
    })
    const signals = classifySkolfsDiff(baseline, current)
    expect(signals.map((s) => s.kind)).toEqual(['AMENDMENT'])
  })
})
