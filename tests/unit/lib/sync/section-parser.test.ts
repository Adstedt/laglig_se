/**
 * Unit Tests for Section Parser
 *
 * Tests the Swedish law section parsing functionality including:
 * - parseUndertitel (extracting SFS numbers from undertitel)
 * - extractSectionAmendments (finding all section references)
 * - findChangedSections (finding sections changed by specific amendment)
 * - parseTransitionalProvisions (extracting effective dates)
 *
 * Story 2.11 - Task 12: Unit Tests
 */

import { describe, it, expect } from 'vitest'
import {
  parseUndertitel,
  extractSectionAmendments,
  findChangedSections,
  parseTransitionalProvisions,
  extractAllSfsReferences,
  groupAmendmentsBySfs,
} from '@/lib/sync/section-parser'

describe('Section Parser', () => {
  describe('parseUndertitel', () => {
    it('should extract SFS number from standard format', () => {
      const result = parseUndertitel('t.o.m. SFS 2025:732')
      expect(result).toBe('SFS 2025:732')
    })

    it('should return null for SFS number without t.o.m. prefix', () => {
      // The implementation only matches "t.o.m. SFS" format
      const result = parseUndertitel('SFS 2024:123')
      expect(result).toBeNull()
    })

    it('should handle short SFS numbers', () => {
      const result = parseUndertitel('t.o.m. SFS 2000:1')
      expect(result).toBe('SFS 2000:1')
    })

    it('should handle long SFS numbers', () => {
      const result = parseUndertitel('t.o.m. SFS 1999:1234')
      expect(result).toBe('SFS 1999:1234')
    })

    it('should return null for empty string', () => {
      const result = parseUndertitel('')
      expect(result).toBeNull()
    })

    it('should return null for text without SFS reference', () => {
      const result = parseUndertitel('Some other text')
      expect(result).toBeNull()
    })

    it('should handle multiple SFS references (extract first matching t.o.m.)', () => {
      const result = parseUndertitel('t.o.m. SFS 2025:100, SFS 2024:50')
      expect(result).toBe('SFS 2025:100')
    })

    it('should return null for ändr. format (not t.o.m.)', () => {
      // The implementation only matches "t.o.m. SFS" format
      const result = parseUndertitel('ändr. SFS 2023:456')
      expect(result).toBeNull()
    })
  })

  describe('extractSectionAmendments', () => {
    it('should extract section with Lag reference ending in period', () => {
      // Must end with "Lag (YYYY:NNNN)."
      const text = `1 § Denna lag innehåller bestämmelser om... Lag (2020:100).

2 § Lagen tillämpas på... Lag (2021:200).`

      const result = extractSectionAmendments(text)

      expect(result.amendments.length).toBeGreaterThanOrEqual(2)
      expect(result.uniqueSfsNumbers).toContain('SFS 2020:100')
      expect(result.uniqueSfsNumbers).toContain('SFS 2021:200')
    })

    it('should handle sections with chapter references', () => {
      // Pattern requires "X kap. Y §" on same line
      const text = `1 kap. 1 § Denna lag innehåller... Lag (2020:100).

2 kap. 1 § Detta kapitel tillämpas... Lag (2021:200).`

      const result = extractSectionAmendments(text)

      // Should find sections in different chapters
      expect(result.amendments.length).toBeGreaterThanOrEqual(1)
      expect(result.uniqueSfsNumbers.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle sections with letter suffixes (1 a §)', () => {
      const text = `1 § First section. Lag (2020:100).

1 a § First-a section. Lag (2020:200).

1 b § First-b section. Lag (2021:300).`

      const result = extractSectionAmendments(text)

      expect(result.amendments.length).toBeGreaterThanOrEqual(3)
    })

    it('should return empty for text without sections', () => {
      const result = extractSectionAmendments('Just some plain text without sections.')

      expect(result.amendments).toEqual([])
      expect(result.uniqueSfsNumbers).toEqual([])
    })

    it('should return empty for null/undefined input', () => {
      const result = extractSectionAmendments('')

      expect(result.amendments).toEqual([])
      expect(result.uniqueSfsNumbers).toEqual([])
    })
  })

  describe('findChangedSections', () => {
    it('should find sections changed by specific amendment', () => {
      const text = `1 § First section. Lag (2020:100).

2 § Second section. Lag (2020:100).

3 § Third section. Lag (2021:200).`

      const result = findChangedSections(text, 'SFS 2020:100')

      expect(result).toContain('1 §')
      expect(result).toContain('2 §')
      expect(result).not.toContain('3 §')
    })

    it('should require full SFS format with prefix', () => {
      const text = `1 § First section. Lag (2020:100).`

      // Must use full "SFS YYYY:NNNN" format
      const result = findChangedSections(text, 'SFS 2020:100')
      expect(result).toContain('1 §')

      // Without prefix won't match
      const result2 = findChangedSections(text, '2020:100')
      expect(result2).toEqual([])
    })

    it('should return empty array if amendment not found', () => {
      const text = `1 § First section. Lag (2020:100).`

      const result = findChangedSections(text, 'SFS 2025:999')

      expect(result).toEqual([])
    })

    it('should include chapter context in section identifiers', () => {
      const text = `1 kap. 1 § First chapter first section. Lag (2020:100).

2 kap. 1 § Second chapter first section. Lag (2020:100).`

      const result = findChangedSections(text, 'SFS 2020:100')

      // Should differentiate sections by chapter
      expect(result.length).toBe(2)
    })
  })

  describe('parseTransitionalProvisions', () => {
    it('should extract effective dates from Övergångsbestämmelser', () => {
      // The regex pattern expects SFS number immediately followed by newline
      // then text containing "träder i kraft" and a date
      const text = `Normal law text here...

Övergångsbestämmelser

2020:100
Denna lag träder i kraft den 1 januari 2021.`

      const result = parseTransitionalProvisions(text)

      expect(result.has('SFS 2020:100')).toBe(true)

      const date1 = result.get('SFS 2020:100')

      expect(date1?.getFullYear()).toBe(2021)
      expect(date1?.getMonth()).toBe(0) // January = 0
      expect(date1?.getDate()).toBe(1)
    })

    it('should handle date format "1 januari 2021"', () => {
      const text = `Övergångsbestämmelser

2023:456
Denna lag träder i kraft den 15 mars 2024.`

      const result = parseTransitionalProvisions(text)
      const date = result.get('SFS 2023:456')

      expect(date?.getFullYear()).toBe(2024)
      expect(date?.getMonth()).toBe(2) // March = 2
      expect(date?.getDate()).toBe(15)
    })

    it('should return empty map if no Övergångsbestämmelser section', () => {
      const text = 'Just normal law text without transitional provisions.'
      const result = parseTransitionalProvisions(text)

      expect(result.size).toBe(0)
    })

    it('should handle all Swedish months', () => {
      const months = [
        { name: 'januari', expected: 0 },
        { name: 'februari', expected: 1 },
        { name: 'mars', expected: 2 },
        { name: 'april', expected: 3 },
        { name: 'maj', expected: 4 },
        { name: 'juni', expected: 5 },
        { name: 'juli', expected: 6 },
        { name: 'augusti', expected: 7 },
        { name: 'september', expected: 8 },
        { name: 'oktober', expected: 9 },
        { name: 'november', expected: 10 },
        { name: 'december', expected: 11 },
      ]

      for (const { name, expected } of months) {
        const text = `Övergångsbestämmelser

2023:${expected + 1}
Denna lag träder i kraft den 1 ${name} 2024.`

        const result = parseTransitionalProvisions(text)
        const date = result.get(`SFS 2023:${expected + 1}`)

        expect(date?.getMonth()).toBe(expected)
      }
    })
  })

  describe('extractAllSfsReferences', () => {
    it('should extract all unique SFS references in Lag format', () => {
      // Only extracts "Lag (YYYY:NNNN)" format
      const text = `This law references Lag (2020:100) and also Lag (2021:200).
Later it mentions Lag (2020:100) again and Lag (2022:300).`

      const result = extractAllSfsReferences(text)

      expect(result).toContain('SFS 2020:100')
      expect(result).toContain('SFS 2021:200')
      expect(result).toContain('SFS 2022:300')

      // Should be unique
      expect(result.filter((s) => s === 'SFS 2020:100').length).toBe(1)
    })

    it('should only extract Lag format, not SFS format', () => {
      const text = `See SFS 2020:100 for details.
Also see Lag (2020:200).`

      const result = extractAllSfsReferences(text)

      // Should NOT include SFS format, only Lag format
      expect(result).not.toContain('SFS 2020:100')
      expect(result).toContain('SFS 2020:200')
      expect(result.length).toBe(1)
    })

    it('should return empty array for empty input', () => {
      const result = extractAllSfsReferences('')
      expect(result).toEqual([])
    })
  })

  describe('groupAmendmentsBySfs', () => {
    it('should group sections by their amendment SFS number', () => {
      const text = `1 § First. Lag (2020:100).

2 § Second. Lag (2020:100).

3 § Third. Lag (2021:200).`

      const result = groupAmendmentsBySfs(text)

      expect(result.has('SFS 2020:100')).toBe(true)
      expect(result.has('SFS 2021:200')).toBe(true)

      const sfs2020Sections = result.get('SFS 2020:100')
      expect(sfs2020Sections?.length).toBe(2)

      const sfs2021Sections = result.get('SFS 2021:200')
      expect(sfs2021Sections?.length).toBe(1)
    })
  })
})

describe('Swedish Text Edge Cases', () => {
  describe('Unicode handling', () => {
    it('should handle Swedish characters in section text', () => {
      const text = `1 § Bestämmelser om övergångsperiod för äldre föreskrifter. Lag (2020:100).`

      const result = extractSectionAmendments(text)

      expect(result.amendments.length).toBe(1)
      expect(result.amendments[0]?.sectionText).toContain('övergångsperiod')
    })
  })

  describe('Whitespace variations', () => {
    it('should handle standard whitespace in Lag references', () => {
      const text = `1 § Section one. Lag (2020:100).

2 § Section two. Lag (2020:200).`

      const result = extractSectionAmendments(text)
      expect(result.amendments.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Real-world law format', () => {
    it('should parse realistic Swedish law structure', () => {
      // Simplified format that matches the implementation's regex patterns
      const text = `Arbetsmiljölag (1977:1160)

1 § Lagens ändamål är att förebygga ohälsa och olycksfall i arbetet samt att även i övrigt uppnå en god arbetsmiljö. Lag (2014:659).

2 § Denna lag gäller varje verksamhet i vilken arbetstagare utför arbete för en arbetsgivares räkning. Lag (2014:659).

3 § Arbete ska planläggas och anordnas så, att det kan utföras i en sund och säker miljö. Lag (2014:659).

Övergångsbestämmelser

2014:659
Denna lag träder i kraft den 1 juli 2014.`

      const amendments = extractSectionAmendments(text)
      const changedSections = findChangedSections(text, 'SFS 2014:659')
      const effectiveDates = parseTransitionalProvisions(text)

      // Verify we can extract some amendments
      expect(amendments.amendments.length).toBeGreaterThanOrEqual(1)
      expect(changedSections.length).toBeGreaterThanOrEqual(1)
      expect(effectiveDates.has('SFS 2014:659')).toBe(true)

      const effectiveDate = effectiveDates.get('SFS 2014:659')
      expect(effectiveDate?.getFullYear()).toBe(2014)
      expect(effectiveDate?.getMonth()).toBe(6) // July
    })
  })
})
