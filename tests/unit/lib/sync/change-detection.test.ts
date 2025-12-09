/**
 * Unit Tests for Change Detection
 *
 * Tests the text diff and change detection functionality including:
 * - computeDiff (line-by-line diff computation)
 * - generateUnifiedDiff (git-style diff generation)
 * - hasSubstantiveChanges (whitespace-normalized comparison)
 *
 * Story 2.11 - Task 12: Unit Tests
 */

import { describe, it, expect } from 'vitest'
import {
  computeDiff,
  generateUnifiedDiff,
  hasSubstantiveChanges,
} from '@/lib/sync/change-detection'

describe('Change Detection', () => {
  describe('computeDiff', () => {
    it('should detect added lines', () => {
      const oldText = 'Line 1\nLine 2\n'
      const newText = 'Line 1\nLine 2\nLine 3\n'

      const result = computeDiff(oldText, newText)

      // The diff library may count things differently
      expect(result.added).toBeGreaterThan(0)
    })

    it('should detect removed lines', () => {
      const oldText = 'Line 1\nLine 2\nLine 3\n'
      const newText = 'Line 1\nLine 2\n'

      const result = computeDiff(oldText, newText)

      expect(result.removed).toBeGreaterThan(0)
    })

    it('should detect unchanged content', () => {
      const text = 'Line 1\nLine 2\nLine 3'

      const result = computeDiff(text, text)

      expect(result.added).toBe(0)
      expect(result.removed).toBe(0)
      expect(result.unchanged).toBeGreaterThan(0)
    })

    it('should detect mixed changes', () => {
      const oldText = 'Line 1\nLine 2\nLine 3'
      const newText = 'Line 1\nModified Line 2\nLine 3\nLine 4'

      const result = computeDiff(oldText, newText)

      // Should have both added and removed
      expect(result.added).toBeGreaterThan(0)
      expect(result.removed).toBeGreaterThan(0)
    })

    it('should generate human-readable summary', () => {
      const oldText = 'Line 1\nLine 2'
      const newText = 'Line 1\nLine 2\nLine 3\nLine 4'

      const result = computeDiff(oldText, newText)

      expect(result.summary).toContain('+')
      expect(result.summary).toContain('lines')
    })

    it('should handle empty old text (new content)', () => {
      const oldText = ''
      const newText = 'New content here'

      const result = computeDiff(oldText, newText)

      expect(result.added).toBeGreaterThan(0)
      expect(result.removed).toBe(0)
    })

    it('should handle empty new text (deleted content)', () => {
      const oldText = 'Old content here'
      const newText = ''

      const result = computeDiff(oldText, newText)

      expect(result.added).toBe(0)
      expect(result.removed).toBeGreaterThan(0)
    })

    it('should handle both empty texts', () => {
      const result = computeDiff('', '')

      expect(result.added).toBe(0)
      expect(result.removed).toBe(0)
      expect(result.summary).toContain('No text changes')
    })

    it('should return change objects in changes array', () => {
      const oldText = 'Line 1'
      const newText = 'Line 1\nLine 2'

      const result = computeDiff(oldText, newText)

      expect(result.changes).toBeDefined()
      expect(Array.isArray(result.changes)).toBe(true)
    })
  })

  describe('generateUnifiedDiff', () => {
    it('should generate diff header', () => {
      const oldText = 'Line 1'
      const newText = 'Line 2'

      const result = generateUnifiedDiff(oldText, newText)

      expect(result).toContain('---')
      expect(result).toContain('+++')
    })

    it('should show added lines with + prefix', () => {
      const oldText = 'Line 1'
      const newText = 'Line 1\nAdded line'

      const result = generateUnifiedDiff(oldText, newText)

      expect(result).toContain('+Added line')
    })

    it('should show removed lines with - prefix', () => {
      const oldText = 'Line 1\nRemoved line'
      const newText = 'Line 1'

      const result = generateUnifiedDiff(oldText, newText)

      expect(result).toContain('-Removed line')
    })

    it('should include context lines', () => {
      const oldText = 'Context 1\nContext 2\nOld line\nContext 3\nContext 4'
      const newText = 'Context 1\nContext 2\nNew line\nContext 3\nContext 4'

      const result = generateUnifiedDiff(oldText, newText, 2)

      // Should include surrounding context
      expect(result).toContain('Context')
    })

    it('should handle Swedish characters', () => {
      const oldText = '1 § Äldre bestämmelser'
      const newText = '1 § Nya bestämmelser för övergång'

      const result = generateUnifiedDiff(oldText, newText)

      expect(result).toContain('bestämmelser')
    })
  })

  describe('hasSubstantiveChanges', () => {
    it('should return false for identical texts', () => {
      const text = 'Same content here'

      const result = hasSubstantiveChanges(text, text)

      expect(result).toBe(false)
    })

    it('should return true for different texts', () => {
      const oldText = 'Old content'
      const newText = 'New content'

      const result = hasSubstantiveChanges(oldText, newText)

      expect(result).toBe(true)
    })

    it('should ignore extra whitespace', () => {
      const oldText = 'Some   text   here'
      const newText = 'Some text here'

      const result = hasSubstantiveChanges(oldText, newText)

      expect(result).toBe(false)
    })

    it('should ignore trailing whitespace', () => {
      const oldText = 'Some text   '
      const newText = 'Some text'

      const result = hasSubstantiveChanges(oldText, newText)

      expect(result).toBe(false)
    })

    it('should ignore leading whitespace', () => {
      const oldText = '   Some text'
      const newText = 'Some text'

      const result = hasSubstantiveChanges(oldText, newText)

      expect(result).toBe(false)
    })

    it('should normalize newlines to spaces', () => {
      const oldText = 'Line 1\nLine 2'
      const newText = 'Line 1 Line 2'

      const result = hasSubstantiveChanges(oldText, newText)

      expect(result).toBe(false)
    })

    it('should detect changes through whitespace normalization', () => {
      const oldText = 'Word1   Word2'
      const newText = 'Word1 DifferentWord2'

      const result = hasSubstantiveChanges(oldText, newText)

      expect(result).toBe(true)
    })

    it('should handle empty strings', () => {
      expect(hasSubstantiveChanges('', '')).toBe(false)
      expect(hasSubstantiveChanges('text', '')).toBe(true)
      expect(hasSubstantiveChanges('', 'text')).toBe(true)
    })

    it('should handle whitespace-only strings', () => {
      expect(hasSubstantiveChanges('   ', '')).toBe(false)
      expect(hasSubstantiveChanges('\n\n', '\t\t')).toBe(false)
    })
  })
})

describe('Diff Summary Generation', () => {
  describe('Summary formats', () => {
    it('should show additions in summary when lines are added', () => {
      const oldText = 'Original\n'
      const newText = 'Original\nNew line 1\nNew line 2\n'

      const result = computeDiff(oldText, newText)

      // Should show some additions (diff library behavior may vary)
      expect(result.added).toBeGreaterThan(0)
      expect(result.summary).toBeDefined()
    })

    it('should show removals in summary when lines are removed', () => {
      const oldText = 'Original\nOld line 1\nOld line 2\n'
      const newText = 'Original\n'

      const result = computeDiff(oldText, newText)

      // Should show some removals
      expect(result.removed).toBeGreaterThan(0)
      expect(result.summary).toBeDefined()
    })

    it('should show percentage changed', () => {
      const oldText = 'Line 1\nLine 2\nLine 3\nLine 4'
      const newText = 'Line 1\nModified 2\nLine 3\nLine 4'

      const result = computeDiff(oldText, newText)

      expect(result.summary).toMatch(/\d+(\.\d+)?% changed/)
    })
  })
})

describe('Real-World Diff Scenarios', () => {
  describe('Swedish law amendment changes', () => {
    it('should detect section text modifications', () => {
      const oldText = `
1 § Denna lag innehåller bestämmelser om arbetsmiljön.
Lag (2020:100).

2 § Lagen gäller för arbetsgivare och arbetstagare.
Lag (2020:100).
`

      const newText = `
1 § Denna lag innehåller bestämmelser om arbetsmiljön och
hälsa på arbetsplatsen.
Lag (2025:200).

2 § Lagen gäller för arbetsgivare och arbetstagare.
Lag (2020:100).
`

      const result = computeDiff(oldText, newText)

      expect(result.added).toBeGreaterThan(0)
      expect(result.removed).toBeGreaterThan(0)
      expect(hasSubstantiveChanges(oldText, newText)).toBe(true)
    })

    it('should detect new sections added', () => {
      const oldText = `
1 § First section.
Lag (2020:100).

2 § Second section.
Lag (2020:100).
`

      const newText = `
1 § First section.
Lag (2020:100).

1 a § New inserted section.
Lag (2025:200).

2 § Second section.
Lag (2020:100).
`

      const result = computeDiff(oldText, newText)

      expect(result.added).toBeGreaterThan(0)
      expect(hasSubstantiveChanges(oldText, newText)).toBe(true)
    })

    it('should detect sections being repealed', () => {
      const oldText = `
1 § Active section.
Lag (2020:100).

2 § Another active section.
Lag (2020:100).

3 § Third section that will be removed.
Lag (2020:100).
`

      const newText = `
1 § Active section.
Lag (2020:100).

2 § Another active section.
Lag (2020:100).

3 § har upphävts genom Lag (2025:200).
`

      const result = computeDiff(oldText, newText)

      expect(result.added).toBeGreaterThan(0)
      expect(result.removed).toBeGreaterThan(0)
      expect(hasSubstantiveChanges(oldText, newText)).toBe(true)
    })
  })

  describe('Large document handling', () => {
    it('should handle large documents efficiently', () => {
      // Generate a large document
      const lines = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`)
      const oldText = lines.join('\n')

      // Modify a few lines in the middle
      lines[500] = 'Modified line 501'
      lines[501] = 'Modified line 502'
      const newText = lines.join('\n')

      const startTime = Date.now()
      const result = computeDiff(oldText, newText)
      const endTime = Date.now()

      // Should complete in reasonable time (< 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000)
      expect(result.added).toBeGreaterThan(0)
      expect(result.removed).toBeGreaterThan(0)
    })
  })
})
