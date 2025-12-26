/**
 * Unit tests for SFS document classification
 *
 * Story 2.28: Unified SFS PDF Sync & Document Classification
 */

import { describe, it, expect } from 'vitest'
import {
  classifyLawType,
  extractSfsFromTitle,
  classificationToMetadata,
  type SfsClassification,
} from '@/lib/sfs/classify'

describe('classifyLawType', () => {
  describe('new laws (category: new)', () => {
    it('classifies "Arbetsmiljölag (1977:1160)" as lag/new', () => {
      const result = classifyLawType('Arbetsmiljölag (1977:1160)')

      expect(result.type).toBe('lag')
      expect(result.category).toBe('new')
      expect(result.targetType).toBeNull()
      expect(result.targetSfs).toBeNull()
      expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    })

    it('classifies "Förordning (2024:456) om miljöskydd" as förordning/new', () => {
      const result = classifyLawType('Förordning (2024:456) om miljöskydd')

      expect(result.type).toBe('förordning')
      expect(result.category).toBe('new')
      expect(result.targetType).toBeNull()
      expect(result.targetSfs).toBeNull()
      expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    })

    it('classifies "Kungörelse (1965:123) om..." as kungörelse/new', () => {
      const result = classifyLawType(
        'Kungörelse (1965:123) om allmänna handlingar'
      )

      expect(result.type).toBe('kungörelse')
      expect(result.category).toBe('new')
      expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    })

    it('classifies balkar as lag', () => {
      const result = classifyLawType('Brottsbalk (1962:700)')

      expect(result.type).toBe('lag')
      expect(result.category).toBe('new')
    })

    it('classifies "Miljöbalk" as lag', () => {
      const result = classifyLawType('Miljöbalk (1998:808)')

      expect(result.type).toBe('lag')
      expect(result.category).toBe('new')
    })
  })

  describe('amendments (category: amendment)', () => {
    it('classifies "Lag (2025:1581) om ändring i arbetsmiljölagen (1977:1160)" as lag/amendment', () => {
      const result = classifyLawType(
        'Lag (2025:1581) om ändring i arbetsmiljölagen (1977:1160)'
      )

      expect(result.type).toBe('lag')
      expect(result.category).toBe('amendment')
      expect(result.targetType).toBe('lag')
      expect(result.targetSfs).toBe('1977:1160')
      expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    })

    it('classifies "Förordning (2024:789) om ändring i miljöförordningen (2013:251)" as förordning/amendment', () => {
      const result = classifyLawType(
        'Förordning (2024:789) om ändring i miljöförordningen (2013:251)'
      )

      expect(result.type).toBe('förordning')
      expect(result.category).toBe('amendment')
      expect(result.targetType).toBe('förordning')
      expect(result.targetSfs).toBe('2013:251')
    })

    it('handles "om ändringar i" (plural)', () => {
      const result = classifyLawType(
        'Lag (2025:100) om ändringar i skatteförfarandelagen (2011:1244)'
      )

      expect(result.category).toBe('amendment')
      expect(result.targetSfs).toBe('2011:1244')
    })

    it('handles mixed document type amendments (lag amending förordning)', () => {
      const result = classifyLawType(
        'Lag (2025:50) om ändring i förordningen (2020:123) om dataskydd'
      )

      expect(result.type).toBe('lag')
      expect(result.category).toBe('amendment')
      expect(result.targetType).toBe('förordning')
      expect(result.targetSfs).toBe('2020:123')
    })

    it('handles "om ändrad lydelse av"', () => {
      const result = classifyLawType(
        'Förordning (2024:100) om ändrad lydelse av förordningen (2018:50)'
      )

      expect(result.category).toBe('amendment')
      expect(result.targetSfs).toBe('2018:50')
    })
  })

  describe('repeals (category: repeal)', () => {
    it('classifies "Lag (2024:100) om upphävande av lagen (1990:50)" as lag/repeal', () => {
      const result = classifyLawType(
        'Lag (2024:100) om upphävande av lagen (1990:50)'
      )

      expect(result.type).toBe('lag')
      expect(result.category).toBe('repeal')
      expect(result.targetType).toBe('lag')
      expect(result.targetSfs).toBe('1990:50')
    })

    it('classifies "Förordning (2024:200) om upphävande av förordningen (2010:75)" as förordning/repeal', () => {
      const result = classifyLawType(
        'Förordning (2024:200) om upphävande av förordningen (2010:75)'
      )

      expect(result.type).toBe('förordning')
      expect(result.category).toBe('repeal')
      expect(result.targetType).toBe('förordning')
      expect(result.targetSfs).toBe('2010:75')
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      const result = classifyLawType('')

      expect(result.type).toBe('other')
      expect(result.category).toBe('new')
      expect(result.confidence).toBe(0)
    })

    it('handles unknown document types', () => {
      const result = classifyLawType('Tillkännagivande (2024:500) om något')

      expect(result.type).toBe('other')
      expect(result.category).toBe('new')
    })

    it('handles case insensitivity', () => {
      const result = classifyLawType(
        'LAG (2024:100) OM ÄNDRING I LAGEN (2020:50)'
      )

      expect(result.type).toBe('lag')
      expect(result.category).toBe('amendment')
      expect(result.targetSfs).toBe('2020:50')
    })

    it('handles titles with "SFS" prefix in parentheses', () => {
      const result = classifyLawType(
        'Förordning (2024:100) om ändring i förordningen (SFS 2015:50)'
      )

      expect(result.targetSfs).toBe('2015:50')
    })

    it('handles titles starting with "Lag ("', () => {
      const result = classifyLawType('Lag (2025:100) om skatt på energi')

      expect(result.type).toBe('lag')
      expect(result.category).toBe('new')
    })

    it('returns low confidence for unclear documents', () => {
      const result = classifyLawType('Dokument utan tydlig typ (2024:999)')

      expect(result.confidence).toBeLessThanOrEqual(0.7)
    })
  })

  describe('real-world examples', () => {
    it('handles actual Riksdagen title format for new law', () => {
      const result = classifyLawType(
        'Lag (2024:1087) om producentansvar för bilar'
      )

      expect(result.type).toBe('lag')
      expect(result.category).toBe('new')
    })

    it('handles actual Riksdagen title format for amendment', () => {
      const result = classifyLawType(
        'Lag (2024:1189) om ändring i patientlagen (2014:821)'
      )

      expect(result.type).toBe('lag')
      expect(result.category).toBe('amendment')
      expect(result.targetType).toBe('lag')
      expect(result.targetSfs).toBe('2014:821')
    })

    it('handles förordning amendment', () => {
      const result = classifyLawType(
        'Förordning (2024:1147) om ändring i offentlighets- och sekretessförordningen (2009:641)'
      )

      expect(result.type).toBe('förordning')
      expect(result.category).toBe('amendment')
      expect(result.targetType).toBe('förordning')
      expect(result.targetSfs).toBe('2009:641')
    })

    it('handles amendment to balk', () => {
      const result = classifyLawType(
        'Lag (2024:1200) om ändring i miljöbalken (1998:808)'
      )

      expect(result.type).toBe('lag')
      expect(result.category).toBe('amendment')
      expect(result.targetType).toBe('lag')
      expect(result.targetSfs).toBe('1998:808')
    })
  })
})

describe('extractSfsFromTitle', () => {
  it('extracts SFS number from standard format', () => {
    expect(extractSfsFromTitle('Lag (2025:1581) om ändring...')).toBe(
      '2025:1581'
    )
  })

  it('extracts first SFS number when multiple present', () => {
    expect(
      extractSfsFromTitle('Lag (2025:100) om ändring i lagen (2020:50)')
    ).toBe('2025:100')
  })

  it('handles SFS prefix', () => {
    expect(extractSfsFromTitle('Lag (SFS 2025:100) om...')).toBe('2025:100')
  })

  it('returns null for titles without SFS number', () => {
    expect(extractSfsFromTitle('Allmän handling')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractSfsFromTitle('')).toBeNull()
  })
})

describe('classificationToMetadata', () => {
  it('converts classification to metadata format', () => {
    const classification: SfsClassification = {
      type: 'lag',
      category: 'amendment',
      targetType: 'lag',
      targetSfs: '1977:1160',
      confidence: 0.95,
    }

    const metadata = classificationToMetadata(classification)

    expect(metadata).toEqual({
      lawType: 'lag',
      documentCategory: 'amendment',
      baseLawSfs: '1977:1160',
      baseLawType: 'lag',
      classificationConfidence: 0.95,
    })
  })

  it('handles new document without target', () => {
    const classification: SfsClassification = {
      type: 'förordning',
      category: 'new',
      targetType: null,
      targetSfs: null,
      confidence: 0.9,
    }

    const metadata = classificationToMetadata(classification)

    expect(metadata.baseLawSfs).toBeNull()
    expect(metadata.baseLawType).toBeNull()
  })
})
