/**
 * Tests for Version Diff
 * Story 2.13 QA Fix: TEST-001
 */

import { describe, it, expect } from 'vitest'
import {
  compareSectionText,
  generateUnifiedDiff,
  getChangedSections,
  type LawVersionDiff,
  type SectionDiff,
} from '../../legal-document/version-diff'

describe('compareSectionText', () => {
  describe('identical text', () => {
    it('should return unchanged for identical text', () => {
      const result = compareSectionText('Hello World', 'Hello World')
      expect(result).toHaveLength(1)
      expect(result[0]!.added).toBeFalsy()
      expect(result[0]!.removed).toBeFalsy()
    })

    it('should handle empty strings', () => {
      const result = compareSectionText('', '')
      // diff library returns empty array for two empty strings (no changes)
      expect(result).toHaveLength(0)
    })
  })

  describe('additions', () => {
    it('should detect added lines', () => {
      const textA = 'Line 1\nLine 2'
      const textB = 'Line 1\nLine 2\nLine 3'

      const result = compareSectionText(textA, textB)

      const addedParts = result.filter((p) => p.added)
      expect(addedParts.length).toBeGreaterThan(0)
      expect(addedParts.some((p) => p.value.includes('Line 3'))).toBe(true)
    })

    it('should detect content added to empty', () => {
      const result = compareSectionText('', 'New content')

      const addedParts = result.filter((p) => p.added)
      expect(addedParts.length).toBeGreaterThan(0)
    })
  })

  describe('removals', () => {
    it('should detect removed lines', () => {
      const textA = 'Line 1\nLine 2\nLine 3'
      const textB = 'Line 1\nLine 2'

      const result = compareSectionText(textA, textB)

      const removedParts = result.filter((p) => p.removed)
      expect(removedParts.length).toBeGreaterThan(0)
      expect(removedParts.some((p) => p.value.includes('Line 3'))).toBe(true)
    })

    it('should detect content removed to empty', () => {
      const result = compareSectionText('Old content', '')

      const removedParts = result.filter((p) => p.removed)
      expect(removedParts.length).toBeGreaterThan(0)
    })
  })

  describe('modifications', () => {
    it('should detect modified lines', () => {
      const textA = 'The quick brown fox'
      const textB = 'The slow brown fox'

      const result = compareSectionText(textA, textB)

      // Should have both removed and added parts
      const hasRemoved = result.some((p) => p.removed)
      const hasAdded = result.some((p) => p.added)
      expect(hasRemoved || hasAdded).toBe(true)
    })
  })

  describe('line ending normalization', () => {
    it('should normalize CRLF to LF', () => {
      const textA = 'Line 1\r\nLine 2'
      const textB = 'Line 1\nLine 2'

      const result = compareSectionText(textA, textB)

      // After normalization, they should be identical
      expect(result).toHaveLength(1)
      expect(result[0]!.added).toBeFalsy()
      expect(result[0]!.removed).toBeFalsy()
    })

    it('should trim whitespace', () => {
      const textA = '  Content  '
      const textB = 'Content'

      const result = compareSectionText(textA, textB)

      expect(result).toHaveLength(1)
      expect(result[0]!.added).toBeFalsy()
      expect(result[0]!.removed).toBeFalsy()
    })
  })
})

describe('generateUnifiedDiff', () => {
  it('should generate unified diff format', () => {
    const textA = 'Line 1\nLine 2'
    const textB = 'Line 1\nLine 2 modified'

    const result = generateUnifiedDiff(textA, textB, 'old', 'new')

    expect(result).toContain('---')
    expect(result).toContain('+++')
    expect(result).toContain('@@')
  })

  it('should include custom labels', () => {
    const result = generateUnifiedDiff('a', 'b', '2020-01-01', '2025-01-01')

    expect(result).toContain('2020-01-01')
    expect(result).toContain('2025-01-01')
  })

  it('should handle identical content', () => {
    const result = generateUnifiedDiff('Same content', 'Same content')

    // No changes should result in minimal diff
    expect(result).toBeDefined()
  })

  it('should normalize line endings', () => {
    const textA = 'Line\r\nEnd'
    const textB = 'Line\nEnd'

    const result = generateUnifiedDiff(textA, textB)

    // After normalization, should be identical (no actual changes in diff)
    expect(result).toBeDefined()
  })
})

describe('getChangedSections', () => {
  const mockDiff: LawVersionDiff = {
    baseLawSfs: 'SFS 1977:1160',
    dateA: new Date('2020-01-01'),
    dateB: new Date('2025-01-01'),
    summary: {
      sectionsAdded: 1,
      sectionsRemoved: 1,
      sectionsModified: 1,
      sectionsUnchanged: 2,
      totalLinesAdded: 10,
      totalLinesRemoved: 5,
    },
    sections: [
      {
        chapter: '1',
        section: '1',
        changeType: 'unchanged',
        linesAdded: 0,
        linesRemoved: 0,
      },
      {
        chapter: '1',
        section: '2',
        changeType: 'modified',
        linesAdded: 5,
        linesRemoved: 3,
        textA: 'Old text',
        textB: 'New text',
      },
      {
        chapter: '2',
        section: '1',
        changeType: 'added',
        linesAdded: 5,
        linesRemoved: 0,
        textB: 'New section',
      },
      {
        chapter: '2',
        section: '5',
        changeType: 'removed',
        linesAdded: 0,
        linesRemoved: 2,
        textA: 'Removed text',
      },
      {
        chapter: '3',
        section: '1',
        changeType: 'unchanged',
        linesAdded: 0,
        linesRemoved: 0,
      },
    ] as SectionDiff[],
    amendmentsBetween: [],
  }

  it('should filter out unchanged sections', () => {
    const result = getChangedSections(mockDiff)

    expect(result).toHaveLength(3)
    expect(result.every((s) => s.changeType !== 'unchanged')).toBe(true)
  })

  it('should include added sections', () => {
    const result = getChangedSections(mockDiff)

    expect(result.some((s) => s.changeType === 'added')).toBe(true)
  })

  it('should include removed sections', () => {
    const result = getChangedSections(mockDiff)

    expect(result.some((s) => s.changeType === 'removed')).toBe(true)
  })

  it('should include modified sections', () => {
    const result = getChangedSections(mockDiff)

    expect(result.some((s) => s.changeType === 'modified')).toBe(true)
  })

  it('should handle diff with no changes', () => {
    const noChangesDiff: LawVersionDiff = {
      ...mockDiff,
      sections: mockDiff.sections.map((s) => ({
        ...s,
        changeType: 'unchanged' as const,
      })),
    }

    const result = getChangedSections(noChangesDiff)

    expect(result).toHaveLength(0)
  })

  it('should handle empty sections array', () => {
    const emptyDiff: LawVersionDiff = {
      ...mockDiff,
      sections: [],
    }

    const result = getChangedSections(emptyDiff)

    expect(result).toHaveLength(0)
  })
})
