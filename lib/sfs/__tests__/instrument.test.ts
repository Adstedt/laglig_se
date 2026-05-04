import { describe, it, expect } from 'vitest'
import { inferSfsInstrument } from '../instrument'

describe('inferSfsInstrument', () => {
  it('classifies bare lag titles as LAG', () => {
    expect(inferSfsInstrument('Aktiebolagslag (1975:1385)')).toBe('LAG')
    expect(inferSfsInstrument('Lag (2017:900) om förvaltning')).toBe('LAG')
  })

  it('classifies bare förordning titles as FORORDNING', () => {
    expect(
      inferSfsInstrument('Förordning (1998:899) om miljöfarlig verksamhet')
    ).toBe('FORORDNING')
    expect(inferSfsInstrument('Förordningen (2021:757) om tidsfrister')).toBe(
      'FORORDNING'
    )
  })

  it('classifies kungörelse titles as KUNGORELSE', () => {
    expect(inferSfsInstrument('Kungörelse (1974:152) om beslutad ny RF')).toBe(
      'KUNGORELSE'
    )
  })

  it('classifies "balk" as LAG', () => {
    expect(inferSfsInstrument('Brottsbalk (1962:700)')).toBe('LAG')
    expect(inferSfsInstrument('Miljöbalk (1998:808)')).toBe('LAG')
  })

  it('classifies amendments by their own prefix, not the target', () => {
    // The amendment is itself a Lag, even though it modifies a förordning
    expect(
      inferSfsInstrument(
        'Lag (2024:407) om ändring i förordningen (1998:899) om miljöfarlig verksamhet'
      )
    ).toBe('LAG')
    // The amendment is itself a Förordning, even though it modifies a lag
    expect(
      inferSfsInstrument(
        'Förordning (2024:500) om ändring i aktiebolagslagen (2005:551)'
      )
    ).toBe('FORORDNING')
  })

  it('classifies repeals by their own prefix', () => {
    expect(
      inferSfsInstrument(
        'Lag (2026:407) om upphävande av lagen (2021:755) med bemyndiganden'
      )
    ).toBe('LAG')
  })

  it('falls back to OTHER for low-confidence titles', () => {
    // Fallback patterns (stadga/instruktion/reglemente) are 0.7 confidence —
    // below our 0.9 threshold, so they should land in OTHER.
    expect(inferSfsInstrument('Stadga om något (1990:100)')).toBe('OTHER')
    expect(inferSfsInstrument('Instruktion för myndighet (2010:50)')).toBe(
      'OTHER'
    )
  })

  it('returns OTHER for empty or non-string input', () => {
    expect(inferSfsInstrument('')).toBe('OTHER')
    // @ts-expect-error — testing runtime safety against bad inputs
    expect(inferSfsInstrument(null)).toBe('OTHER')
    // @ts-expect-error — testing runtime safety against bad inputs
    expect(inferSfsInstrument(undefined)).toBe('OTHER')
  })
})
