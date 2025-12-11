/**
 * Tests for PDF Parser
 * Story 2.13 Task 1.3: Prototype PDF parsing
 */

import { describe, it, expect } from 'vitest'
import {
  parseSwedishDate,
  extractBaseLaw,
  extractEffectiveDate,
  extractPublicationDate,
  extractAffectedSections,
  extractTitle,
  extractSfsNumber,
} from '../external/pdf-parser'

describe('parseSwedishDate', () => {
  it('should parse standard Swedish dates', () => {
    expect(parseSwedishDate('1 juli 2028')).toBe('2028-07-01')
    expect(parseSwedishDate('15 november 2019')).toBe('2019-11-15')
    expect(parseSwedishDate('8 januari 2025')).toBe('2025-01-08')
  })

  it('should handle all Swedish month names', () => {
    expect(parseSwedishDate('1 januari 2025')).toBe('2025-01-01')
    expect(parseSwedishDate('1 februari 2025')).toBe('2025-02-01')
    expect(parseSwedishDate('1 mars 2025')).toBe('2025-03-01')
    expect(parseSwedishDate('1 april 2025')).toBe('2025-04-01')
    expect(parseSwedishDate('1 maj 2025')).toBe('2025-05-01')
    expect(parseSwedishDate('1 juni 2025')).toBe('2025-06-01')
    expect(parseSwedishDate('1 juli 2025')).toBe('2025-07-01')
    expect(parseSwedishDate('1 augusti 2025')).toBe('2025-08-01')
    expect(parseSwedishDate('1 september 2025')).toBe('2025-09-01')
    expect(parseSwedishDate('1 oktober 2025')).toBe('2025-10-01')
    expect(parseSwedishDate('1 november 2025')).toBe('2025-11-01')
    expect(parseSwedishDate('1 december 2025')).toBe('2025-12-01')
  })

  it('should return null for invalid dates', () => {
    expect(parseSwedishDate('invalid')).toBeNull()
    expect(parseSwedishDate('')).toBeNull()
  })
})

describe('extractBaseLaw', () => {
  it('should extract base law from standard format', () => {
    const text = 'föreskrivs i fråga om arbetsmiljölagen (1977:1160)'
    const result = extractBaseLaw(text)
    expect(result).toEqual({
      name: 'arbetsmiljölagen',
      sfsNumber: '1977:1160',
    })
  })

  it('should extract base law with SFS prefix', () => {
    const text = 'föreskrivs i fråga om lagen (SFS 2023:875)'
    const result = extractBaseLaw(text)
    expect(result).toEqual({
      name: 'lagen',
      sfsNumber: '2023:875',
    })
  })

  it('should extract base law with complex name', () => {
    const text = 'ändringar i miljötillsynsförordningen (2011:13)'
    const result = extractBaseLaw(text)
    expect(result).toEqual({
      name: 'miljötillsynsförordningen',
      sfsNumber: '2011:13',
    })
  })

  it('should return null when no base law found', () => {
    const text = 'This is a document without a base law reference'
    expect(extractBaseLaw(text)).toBeNull()
  })
})

describe('extractEffectiveDate', () => {
  it('should extract effective date from "Denna lag träder i kraft" pattern', () => {
    const text = 'Denna lag träder i kraft den 1 juli 2028.'
    expect(extractEffectiveDate(text)).toBe('2028-07-01')
  })

  it('should extract effective date from "träder i kraft" pattern', () => {
    const text = 'Förordningen träder i kraft den 15 januari 2026.'
    expect(extractEffectiveDate(text)).toBe('2026-01-15')
  })

  it('should return null when no effective date found', () => {
    const text = 'This document has no effective date.'
    expect(extractEffectiveDate(text)).toBeNull()
  })
})

describe('extractPublicationDate', () => {
  it('should extract publication date from "Utfärdad den" pattern', () => {
    const text = 'Utfärdad den 4 december 2025'
    expect(extractPublicationDate(text)).toBe('2025-12-04')
  })

  it('should handle lowercase "utfärdad"', () => {
    const text = 'utfärdad den 10 oktober 2019'
    expect(extractPublicationDate(text)).toBe('2019-10-10')
  })

  it('should return null when no publication date found', () => {
    const text = 'No publication date here.'
    expect(extractPublicationDate(text)).toBeNull()
  })
})

describe('extractAffectedSections', () => {
  it('should extract amended sections', () => {
    const text = '2 kap. 8 § arbetsmiljölagen ska ha följande lydelse'
    const sections = extractAffectedSections(text)
    expect(sections).toContainEqual({
      chapter: '2',
      section: '8',
      type: 'amended',
    })
  })

  it('should extract amended sections with footnote markers', () => {
    // Real pattern from SFS 2019:614 PDF
    const text = '2 kap. 8 § arbetsmiljölagen (1977:1160)2 ska ha följande lydelse'
    const sections = extractAffectedSections(text)
    expect(sections).toContainEqual({
      chapter: '2',
      section: '8',
      type: 'amended',
    })
  })

  it('should extract amended sections with law name and SFS reference', () => {
    // Real pattern from SFS 2020:449 PDF
    const text = '6 kap. 17 § arbetsmiljölagen (1977:1160)2 ska ha följande lydelse'
    const sections = extractAffectedSections(text)
    expect(sections).toContainEqual({
      chapter: '6',
      section: '17',
      type: 'amended',
    })
  })

  it('should extract repealed sections', () => {
    const text = 'dels att 8 kap. 4 § ska upphävas'
    const sections = extractAffectedSections(text)
    expect(sections).toContainEqual({
      chapter: '8',
      section: '4',
      type: 'repealed',
    })
  })

  it('should extract sections without chapter reference', () => {
    const text = '27 § ska ha följande lydelse'
    const sections = extractAffectedSections(text)
    expect(sections).toContainEqual({
      chapter: null,
      section: '27',
      type: 'amended',
    })
  })

  it('should extract sections with letter suffixes', () => {
    const text = '3 kap. 2 a § ska ha följande lydelse'
    const sections = extractAffectedSections(text)
    expect(sections).toContainEqual({
      chapter: '3',
      section: '2a',
      type: 'amended',
    })
  })

  it('should extract multiple sections from complex text', () => {
    const text = `
      föreskrivs i fråga om arbetsmiljölagen
      dels att 8 kap. 4 § ska upphävas,
      dels att 6 kap. 17 § ska ha följande lydelse,
      dels att det ska införas en ny 9 kap. 5 §
    `
    const sections = extractAffectedSections(text)
    expect(sections).toHaveLength(3)
    expect(sections).toContainEqual({
      chapter: '8',
      section: '4',
      type: 'repealed',
    })
    expect(sections).toContainEqual({
      chapter: '6',
      section: '17',
      type: 'amended',
    })
  })

  it('should not duplicate sections', () => {
    const text = `
      6 kap. 17 § ska ha följande lydelse
      ...
      6 kap. 17 § ska ha följande lydelse
    `
    const sections = extractAffectedSections(text)
    expect(
      sections.filter((s) => s.chapter === '6' && s.section === '17')
    ).toHaveLength(1)
  })
})

describe('extractTitle', () => {
  it('should extract title for amendment law', () => {
    const text =
      'Lag om ändring i arbetsmiljölagen (1977:1160) Utfärdad den...'
    expect(extractTitle(text)).toBe(
      'Lag om ändring i arbetsmiljölagen (1977:1160)'
    )
  })

  it('should extract title for amendment regulation', () => {
    const text =
      'Förordning om ändring i miljötillsynsförordningen (2011:13) Utfärdad den...'
    expect(extractTitle(text)).toBe(
      'Förordning om ändring i miljötillsynsförordningen (2011:13)'
    )
  })
})

describe('extractSfsNumber', () => {
  it('should extract from filename', () => {
    expect(extractSfsNumber('SFS2025-1461.pdf', '')).toBe('2025:1461')
    expect(extractSfsNumber('SFS2019-614.pdf', '')).toBe('2019:614')
  })

  it('should extract from text if not in filename', () => {
    expect(extractSfsNumber('unknown.pdf', 'SFS 2025:1461')).toBe('2025:1461')
    expect(extractSfsNumber('unknown.pdf', 'nummer 2019:614')).toBe('2019:614')
  })

  it('should prefer filename over text', () => {
    expect(extractSfsNumber('SFS2025-1461.pdf', 'SFS 2019:999')).toBe(
      '2025:1461'
    )
  })

  it('should return null when not found', () => {
    expect(extractSfsNumber('unknown.pdf', 'no sfs number')).toBeNull()
  })
})
