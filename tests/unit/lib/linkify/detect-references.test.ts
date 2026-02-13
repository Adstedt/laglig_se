import { describe, it, expect } from 'vitest'
import {
  detectReferences,
  type DetectedReference,
} from '@/lib/linkify/detect-references'

/** Helper: extract just documentNumber from results */
function docNumbers(refs: DetectedReference[]): string[] {
  return refs.map((r) => r.documentNumber)
}

describe('detectReferences', () => {
  // --- SFS Law Patterns ---
  describe('SFS laws', () => {
    it('detects "lag (YYYY:NNN)"', () => {
      const refs = detectReferences('Se lag (2012:295) för detaljer.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 2012:295')
      expect(refs[0]!.contentType).toBe('SFS_LAW')
      expect(refs[0]!.matchedText).toBe('lag (2012:295)')
      expect(refs[0]!.chapter).toBeUndefined()
      expect(refs[0]!.section).toBeUndefined()
    })

    it('detects "lagen (YYYY:NNN)" with definite article', () => {
      const refs = detectReferences('enligt lagen (2012:295)')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 2012:295')
      expect(refs[0]!.matchedText).toBe('lagen (2012:295)')
    })

    it('detects "förordning (YYYY:NNN)"', () => {
      const refs = detectReferences('enligt förordning (2018:1472)')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 2018:1472')
    })

    it('detects "förordningen (YYYY:NNN)" with definite article', () => {
      const refs = detectReferences('i förordningen (2018:1472) anges')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 2018:1472')
      expect(refs[0]!.matchedText).toBe('förordningen (2018:1472)')
    })

    it('detects section + law reference: "5 § lagen (2012:295)"', () => {
      const refs = detectReferences('Se 5 § lagen (2012:295).')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 2012:295')
      expect(refs[0]!.matchedText).toBe('5 § lagen (2012:295)')
      expect(refs[0]!.section).toBe('5')
      expect(refs[0]!.chapter).toBeUndefined()
    })

    it('detects chapter + section + law: "2 kap. 3 § lagen (2012:295)"', () => {
      const refs = detectReferences('Se 2 kap. 3 § lagen (2012:295).')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 2012:295')
      expect(refs[0]!.matchedText).toBe('2 kap. 3 § lagen (2012:295)')
      expect(refs[0]!.chapter).toBe('2')
      expect(refs[0]!.section).toBe('3')
    })

    it('detects section range: "5–7 §§ lagen (2012:295)"', () => {
      const refs = detectReferences('Se 5–7 §§ lagen (2012:295).')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 2012:295')
      expect(refs[0]!.matchedText).toContain('5–7 §§ lagen (2012:295)')
      // Section captures the first number in the range
      expect(refs[0]!.section).toBe('5')
    })

    it('detects compound law name: "aktiebolagslagen (2005:551)"', () => {
      const refs = detectReferences(
        'Se aktiebolagslagen (2005:551) för detaljer.'
      )
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 2005:551')
      expect(refs[0]!.matchedText).toBe('aktiebolagslagen (2005:551)')
    })

    it('detects compound law name: "pantbankslagen (1995:1000)"', () => {
      const refs = detectReferences('enligt pantbankslagen (1995:1000)')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 1995:1000')
      expect(refs[0]!.matchedText).toBe('pantbankslagen (1995:1000)')
    })

    it('detects compound förordning: "skolförordningen (2011:185)"', () => {
      const refs = detectReferences('i skolförordningen (2011:185) anges')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 2011:185')
      expect(refs[0]!.matchedText).toBe('skolförordningen (2011:185)')
    })

    it('detects section + compound law: "2 kap. 31 § aktiebolagslagen (2005:551)"', () => {
      const refs = detectReferences(
        'Se 2 kap. 31 § aktiebolagslagen (2005:551).'
      )
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 2005:551')
      expect(refs[0]!.matchedText).toBe(
        '2 kap. 31 § aktiebolagslagen (2005:551)'
      )
      expect(refs[0]!.chapter).toBe('2')
      expect(refs[0]!.section).toBe('31')
    })

    it('detects "§ första stycket" with compound law', () => {
      const refs = detectReferences(
        'Se 4 kap. 49 § första stycket aktiebolagslagen (2005:551).'
      )
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 2005:551')
      expect(refs[0]!.matchedText).toBe(
        '4 kap. 49 § första stycket aktiebolagslagen (2005:551)'
      )
      expect(refs[0]!.chapter).toBe('4')
      expect(refs[0]!.section).toBe('49')
    })

    it('detects "§ första stycket N" with sub-point number', () => {
      const refs = detectReferences(
        'Se 2 kap. 30 § första stycket 1 aktiebolagslagen (2005:551).'
      )
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 2005:551')
      expect(refs[0]!.matchedText).toBe(
        '2 kap. 30 § första stycket 1 aktiebolagslagen (2005:551)'
      )
      expect(refs[0]!.chapter).toBe('2')
      expect(refs[0]!.section).toBe('30')
    })

    it('detects "§ andra stycket" variant', () => {
      const refs = detectReferences('enligt 5 § andra stycket lagen (2012:295)')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.matchedText).toBe('5 § andra stycket lagen (2012:295)')
      expect(refs[0]!.section).toBe('5')
    })

    it('detects standalone "Förordning (YYYY:NNN)"', () => {
      const refs = detectReferences('Förordning (2009:38).')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SFS 2009:38')
      expect(refs[0]!.matchedText).toBe('Förordning (2009:38)')
    })

    it('does NOT match bare "YYYY:NNN" without lag/förordning', () => {
      const refs = detectReferences('dokumentnummer 2012:295 är intressant')
      expect(refs).toHaveLength(0)
    })

    it('detects multiple SFS references in one text', () => {
      const text =
        'Enligt lagen (2012:295) och förordningen (2018:1472) gäller följande.'
      const refs = detectReferences(text)
      expect(refs).toHaveLength(2)
      expect(docNumbers(refs)).toEqual(['SFS 2012:295', 'SFS 2018:1472'])
    })
  })

  // --- Agency Regulation Patterns ---
  describe('Agency regulations', () => {
    it('detects "AFS 2001:1"', () => {
      const refs = detectReferences('Se AFS 2001:1 om arbetsmiljö.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('AFS 2001:1')
      expect(refs[0]!.contentType).toBe('AGENCY_REGULATION')
    })

    it('detects "MSBFS 2020:7"', () => {
      const refs = detectReferences('Enligt MSBFS 2020:7.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('MSBFS 2020:7')
    })

    it('detects "NFS 2016:8"', () => {
      const refs = detectReferences('NFS 2016:8 reglerar detta.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('NFS 2016:8')
    })

    it('detects "TSFS 2009:131"', () => {
      const refs = detectReferences('Se TSFS 2009:131.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('TSFS 2009:131')
    })

    it('detects "ELSÄK-FS 2022:1" (hyphenated prefix)', () => {
      const refs = detectReferences('ELSÄK-FS 2022:1 gäller.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('ELSÄK-FS 2022:1')
      expect(refs[0]!.contentType).toBe('AGENCY_REGULATION')
    })

    it('detects "SCB-FS 2025:19" (hyphenated prefix)', () => {
      const refs = detectReferences('Se SCB-FS 2025:19.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('SCB-FS 2025:19')
    })

    it('detects multiple agency regulations', () => {
      const text = 'AFS 2001:1 och MSBFS 2020:7 gäller.'
      const refs = detectReferences(text)
      expect(refs).toHaveLength(2)
      expect(docNumbers(refs)).toEqual(['AFS 2001:1', 'MSBFS 2020:7'])
    })
  })

  // --- Court Case Patterns ---
  describe('Court cases', () => {
    it('detects "NJA 2020 s. 45" (HD)', () => {
      const refs = detectReferences('Jfr NJA 2020 s. 45.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('NJA 2020 s. 45')
      expect(refs[0]!.contentType).toBe('COURT_CASE')
      expect(refs[0]!.courtId).toBe('hd')
    })

    it('detects "HFD 2020 ref. 5" (HFD)', () => {
      const refs = detectReferences('Se HFD 2020 ref. 5.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('HFD 2020 ref. 5')
      expect(refs[0]!.courtId).toBe('hfd')
    })

    it('detects "RÅ 2010 ref. 1" (old HFD)', () => {
      const refs = detectReferences('Jfr RÅ 2010 ref. 1.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('RÅ 2010 ref. 1')
      expect(refs[0]!.courtId).toBe('hfd')
    })

    it('detects "AD 2019 nr 45" (Labour)', () => {
      const refs = detectReferences('Se AD 2019 nr 45.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('AD 2019 nr 45')
      expect(refs[0]!.courtId).toBe('ad')
    })

    it('detects "MÖD 2018:3" (Environment)', () => {
      const refs = detectReferences('Jfr MÖD 2018:3.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('MÖD 2018:3')
      expect(refs[0]!.courtId).toBe('mod')
    })

    it('detects "MIG 2017:1" (Migration)', () => {
      const refs = detectReferences('Se MIG 2017:1.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.documentNumber).toBe('MIG 2017:1')
      expect(refs[0]!.courtId).toBe('mig')
    })
  })

  // --- Mixed References ---
  describe('mixed references', () => {
    it('detects SFS, agency reg, and court case in same text', () => {
      const text = 'Enligt lagen (1982:673) och AFS 2001:1 samt AD 2019 nr 45.'
      const refs = detectReferences(text)
      expect(refs).toHaveLength(3)
      expect(refs[0]!.contentType).toBe('SFS_LAW')
      expect(refs[1]!.contentType).toBe('AGENCY_REGULATION')
      expect(refs[2]!.contentType).toBe('COURT_CASE')
    })

    it('returns results sorted by position', () => {
      const text = 'AD 2019 nr 45 och lagen (2012:295) och AFS 2001:1.'
      const refs = detectReferences(text)
      expect(refs).toHaveLength(3)
      // Should be sorted by start position
      expect(refs[0]!.start).toBeLessThan(refs[1]!.start)
      expect(refs[1]!.start).toBeLessThan(refs[2]!.start)
    })
  })

  // --- Overlap Resolution ---
  describe('overlap resolution', () => {
    it('longer match wins: "5 § lagen (2012:295)" beats "lagen (2012:295)"', () => {
      // The regex should capture the full "5 § lagen" form as a single match
      const text = '5 § lagen (2012:295)'
      const refs = detectReferences(text)
      expect(refs).toHaveLength(1)
      expect(refs[0]!.matchedText).toBe('5 § lagen (2012:295)')
    })

    it('handles adjacent non-overlapping matches', () => {
      const text = 'lagen (2012:295) och förordningen (2018:1472)'
      const refs = detectReferences(text)
      expect(refs).toHaveLength(2)
    })
  })

  // --- Edge Cases ---
  describe('edge cases', () => {
    it('returns empty array for empty string', () => {
      expect(detectReferences('')).toHaveLength(0)
    })

    it('returns empty array for text with no references', () => {
      expect(detectReferences('Hej, detta är en vanlig text.')).toHaveLength(0)
    })

    it('handles references at start of text', () => {
      const refs = detectReferences('AFS 2001:1 gäller.')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.start).toBe(0)
    })

    it('handles references at end of text', () => {
      const refs = detectReferences('Se AFS 2001:1')
      expect(refs).toHaveLength(1)
      expect(refs[0]!.end).toBe('Se AFS 2001:1'.length)
    })

    it('provides correct start/end positions', () => {
      const text = 'Prefix lagen (2012:295) suffix'
      const refs = detectReferences(text)
      expect(refs).toHaveLength(1)
      const ref = refs[0]!
      expect(text.substring(ref.start, ref.end)).toBe(ref.matchedText)
    })

    it('handles multiple spaces in reference', () => {
      const refs = detectReferences('NJA  2020  s.  45')
      // Extra spaces may or may not match depending on pattern strictness
      // Our patterns use \s+ which matches multiple spaces
      expect(refs).toHaveLength(1)
    })

    it('is case-insensitive for SFS law keywords', () => {
      const refs = detectReferences('Lag (2012:295) och LAG (2013:100)')
      expect(refs).toHaveLength(2)
    })
  })
})
