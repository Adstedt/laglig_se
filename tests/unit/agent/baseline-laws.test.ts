import { describe, it, expect } from 'vitest'
import {
  resolveBaselineForm,
  resolveBaselineLaws,
  baselineFormLabel,
  type BaselineForm,
} from '@/lib/agent/skills/baseline-laws'

// Canonical documentIds we assert on (corpus-verified).
const ABL = '3a1a8e98-2628-4282-8950-a330a3913cdb'
const HANDELSBOLAGSLAGEN = 'a17cb460-2ac4-4174-ab88-6b00e50f416b'
const HANDELSREGISTERLAG = '96d37616-b9b4-435d-af8d-5f9dc56acb8c'
const FORETAGSNAMN = '53e6640b-b676-4f95-825f-c84bcf515b8a'
const BOKFORING = '35df26f0-ffed-46ff-b9e1-9fb1d6c5841b'
const MBL = '3ea0659a-282e-4669-8aa9-827bd23babc8'
const STYRELSEREPR = 'f3dee92d-fc7b-4889-913c-33aacf257774'

const idsFor = (form: BaselineForm, employeeCount: number | null = null) =>
  resolveBaselineLaws({ form, employeeCount }).map((l) => l.documentId)

describe('resolveBaselineForm', () => {
  it('maps known raw legal_form values', () => {
    expect(resolveBaselineForm('AB')).toBe('AB')
    expect(resolveBaselineForm('EF')).toBe('EF')
    expect(resolveBaselineForm('STIFTELSE')).toBe('STIFTELSE')
    expect(resolveBaselineForm('IDEELL')).toBe('IDEELL')
  })

  it('collapses KB into HB_KB (shared law base, Lag 1980:1102)', () => {
    expect(resolveBaselineForm('HB')).toBe('HB_KB')
    expect(resolveBaselineForm('KB')).toBe('HB_KB')
  })

  it('is case-insensitive and trims', () => {
    expect(resolveBaselineForm('  ab ')).toBe('AB')
    expect(resolveBaselineForm('kb')).toBe('HB_KB')
  })

  it('falls back to OTHER for OVRIGT / unknown / null', () => {
    expect(resolveBaselineForm('OVRIGT')).toBe('OTHER')
    expect(resolveBaselineForm('BRF')).toBe('OTHER')
    expect(resolveBaselineForm(null)).toBe('OTHER')
    expect(resolveBaselineForm(undefined)).toBe('OTHER')
  })
})

describe('resolveBaselineLaws — universal layer', () => {
  it('applies the universal laws to every form', () => {
    const forms: BaselineForm[] = [
      'AB',
      'HB_KB',
      'EF',
      'EKONOMISK_FORENING',
      'STIFTELSE',
      'IDEELL',
      'OTHER',
    ]
    for (const form of forms) {
      const ids = idsFor(form)
      expect(ids).toContain(BOKFORING)
      expect(ids).toContain(FORETAGSNAMN)
    }
  })
})

describe('resolveBaselineLaws — form correctness (the bug fix)', () => {
  it('AB gets Aktiebolagslagen', () => {
    expect(idsFor('AB')).toContain(ABL)
  })

  it('non-AB forms NEVER get Aktiebolagslagen', () => {
    for (const form of [
      'HB_KB',
      'EF',
      'EKONOMISK_FORENING',
      'STIFTELSE',
      'IDEELL',
      'OTHER',
    ] as BaselineForm[]) {
      expect(idsFor(form)).not.toContain(ABL)
    }
  })

  it('HB/KB get Handelsbolagslagen, not ABL', () => {
    const ids = idsFor('HB_KB')
    expect(ids).toContain(HANDELSBOLAGSLAGEN)
    expect(ids).toContain(HANDELSREGISTERLAG)
    expect(ids).not.toContain(ABL)
  })

  it('EF runs on universal + handelsregister, no corporate statute', () => {
    const ids = idsFor('EF')
    expect(ids).toContain(HANDELSREGISTERLAG)
    expect(ids).not.toContain(ABL)
    expect(ids).not.toContain(HANDELSBOLAGSLAGEN)
  })

  it('IDEELL / OTHER get universal only', () => {
    // No corporate statute — the only non-universal thing that can appear is MBL
    // (conditional, unknown employees). Assert no corporate/form laws leak in.
    for (const form of ['IDEELL', 'OTHER'] as BaselineForm[]) {
      const ids = idsFor(form)
      expect(ids).not.toContain(ABL)
      expect(ids).not.toContain(HANDELSBOLAGSLAGEN)
    }
  })
})

describe('resolveBaselineLaws — conditional layer', () => {
  it('MBL applies when employees >= 1 or unknown, drops for known-solo', () => {
    expect(idsFor('AB', null)).toContain(MBL) // unknown -> keep (prior behavior)
    expect(idsFor('AB', 5)).toContain(MBL)
    expect(idsFor('EF', 3)).toContain(MBL)
    expect(idsFor('AB', 0)).not.toContain(MBL) // known-solo -> drop
    expect(idsFor('EF', 0)).not.toContain(MBL)
  })

  it('styrelserepresentation only for AB with >= 25 employees', () => {
    expect(idsFor('AB', 25)).toContain(STYRELSEREPR)
    expect(idsFor('AB', 24)).not.toContain(STYRELSEREPR)
    expect(idsFor('AB', null)).not.toContain(STYRELSEREPR) // unknown count -> no
    expect(idsFor('HB_KB', 100)).not.toContain(STYRELSEREPR) // non-AB -> no
  })
})

describe('resolveBaselineLaws — invariants', () => {
  it('never returns duplicate documentIds for any form', () => {
    for (const form of [
      'AB',
      'HB_KB',
      'EF',
      'EKONOMISK_FORENING',
      'STIFTELSE',
      'IDEELL',
      'OTHER',
    ] as BaselineForm[]) {
      for (const count of [null, 0, 1, 25, 500]) {
        const ids = resolveBaselineLaws({ form, employeeCount: count }).map(
          (l) => l.documentId
        )
        expect(ids.length).toBe(new Set(ids).size)
      }
    }
  })

  it('every law carries a group and a non-empty businessContext', () => {
    const laws = resolveBaselineLaws({ form: 'AB', employeeCount: 30 })
    for (const law of laws) {
      expect(law.group).toBeTruthy()
      expect(law.businessContext.length).toBeGreaterThan(10)
    }
  })
})

describe('baselineFormLabel', () => {
  it('returns Swedish labels for progress markers', () => {
    expect(baselineFormLabel('AB')).toBe('aktiebolag')
    expect(baselineFormLabel('HB_KB')).toBe('handels-/kommanditbolag')
    expect(baselineFormLabel('OTHER')).toBe('företag')
  })
})
