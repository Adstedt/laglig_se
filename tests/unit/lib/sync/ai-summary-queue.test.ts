/**
 * Unit Tests for AI Summary Queue
 *
 * Tests the AI summary queue prompt generation and utility functions.
 * Database operations require integration tests.
 *
 * Story 2.11 - Task 12: Unit Tests
 */

import { describe, it, expect } from 'vitest'
import {
  generateAmendmentSummaryPrompt,
  generateRepealSummaryPrompt,
} from '@/lib/sync/ai-summary-queue'

describe('AI Summary Queue', () => {
  describe('generateAmendmentSummaryPrompt', () => {
    it('should generate Swedish prompt for amendment summary', () => {
      const prompt = generateAmendmentSummaryPrompt({
        lawTitle: 'Arbetsmiljölag',
        lawNumber: 'SFS 1977:1160',
        amendmentSfs: 'SFS 2025:100',
        affectedSections: ['1 §', '2 §', '3 a §'],
      })

      expect(prompt).toContain('Arbetsmiljölag')
      expect(prompt).toContain('SFS 1977:1160')
      expect(prompt).toContain('SFS 2025:100')
      expect(prompt).toContain('1 §, 2 §, 3 a §')
      expect(prompt).toContain('svenska')
    })

    it('should handle empty affected sections', () => {
      const prompt = generateAmendmentSummaryPrompt({
        lawTitle: 'Test Law',
        lawNumber: 'SFS 2020:100',
        amendmentSfs: 'SFS 2025:200',
        affectedSections: [],
      })

      expect(prompt).toContain('Ej specificerat')
    })

    it('should include diff summary when provided', () => {
      const prompt = generateAmendmentSummaryPrompt({
        lawTitle: 'Test Law',
        lawNumber: 'SFS 2020:100',
        amendmentSfs: 'SFS 2025:200',
        affectedSections: ['1 §'],
        diffSummary: '+15 lines, -10 lines (5% changed)',
      })

      expect(prompt).toContain('+15 lines')
    })

    it('should omit diff summary section when not provided', () => {
      const prompt = generateAmendmentSummaryPrompt({
        lawTitle: 'Test Law',
        lawNumber: 'SFS 2020:100',
        amendmentSfs: 'SFS 2025:200',
        affectedSections: ['1 §'],
      })

      expect(prompt).not.toContain('Ändringar:')
    })

    it('should request plain language without legal jargon', () => {
      const prompt = generateAmendmentSummaryPrompt({
        lawTitle: 'Skatteförfarandelag',
        lawNumber: 'SFS 2011:1244',
        amendmentSfs: 'SFS 2025:300',
        affectedSections: ['15 kap. 1 §'],
      })

      expect(prompt).toContain('utan juridisk jargong')
      expect(prompt).toContain('vanliga människor')
    })

    it('should specify 2-3 sentence length', () => {
      const prompt = generateAmendmentSummaryPrompt({
        lawTitle: 'Test Law',
        lawNumber: 'SFS 2020:100',
        amendmentSfs: 'SFS 2025:200',
        affectedSections: [],
      })

      expect(prompt).toContain('2-3 meningar')
    })
  })

  describe('generateRepealSummaryPrompt', () => {
    it('should generate Swedish prompt for repeal summary', () => {
      const prompt = generateRepealSummaryPrompt({
        lawTitle: 'Gammal lag om något',
        lawNumber: 'SFS 1990:500',
      })

      expect(prompt).toContain('Gammal lag om något')
      expect(prompt).toContain('SFS 1990:500')
      expect(prompt).toContain('upphävts')
      expect(prompt).toContain('svenska')
    })

    it('should include repealing law reference when provided', () => {
      const prompt = generateRepealSummaryPrompt({
        lawTitle: 'Old Law',
        lawNumber: 'SFS 1990:500',
        repealedBySfs: 'SFS 2025:100',
      })

      expect(prompt).toContain('SFS 2025:100')
      expect(prompt).toContain('Upphävdes genom')
    })

    it('should omit repealing law when not provided', () => {
      const prompt = generateRepealSummaryPrompt({
        lawTitle: 'Old Law',
        lawNumber: 'SFS 1990:500',
      })

      expect(prompt).not.toContain('Upphävdes genom:')
    })

    it('should explain what happens to existing provisions', () => {
      const prompt = generateRepealSummaryPrompt({
        lawTitle: 'Test Law',
        lawNumber: 'SFS 2000:100',
      })

      expect(prompt).toContain('bestämmelser')
    })
  })
})

describe('Prompt Content Quality', () => {
  describe('Swedish language usage', () => {
    it('should use correct Swedish terms', () => {
      const amendPrompt = generateAmendmentSummaryPrompt({
        lawTitle: 'Test',
        lawNumber: 'SFS 2020:1',
        amendmentSfs: 'SFS 2025:1',
        affectedSections: [],
      })

      const repealPrompt = generateRepealSummaryPrompt({
        lawTitle: 'Test',
        lawNumber: 'SFS 2020:1',
      })

      // Swedish legal terms
      expect(amendPrompt).toContain('Lag')
      expect(amendPrompt).toContain('Ändring')
      expect(amendPrompt).toContain('paragrafer')
      expect(repealPrompt).toContain('Upphävd')
    })

    it('should request focus on practical impact', () => {
      const prompt = generateAmendmentSummaryPrompt({
        lawTitle: 'Test',
        lawNumber: 'SFS 2020:1',
        amendmentSfs: 'SFS 2025:1',
        affectedSections: [],
      })

      expect(prompt).toContain('praktiken')
    })
  })
})

describe('Cost Estimation Helpers', () => {
  describe('Token estimation', () => {
    it('should keep prompts reasonably sized', () => {
      const prompt = generateAmendmentSummaryPrompt({
        lawTitle: 'Arbetsmiljölag',
        lawNumber: 'SFS 1977:1160',
        amendmentSfs: 'SFS 2025:100',
        affectedSections: ['1 §', '2 §', '3 §', '4 §', '5 §'],
        diffSummary: '+20 lines, -15 lines (8% changed)',
      })

      // Rough estimate: ~4 chars per token for Swedish
      const estimatedTokens = prompt.length / 4

      // Should be well under 500 tokens for input
      expect(estimatedTokens).toBeLessThan(500)
    })

    it('should handle very long section lists', () => {
      const manySections = Array.from({ length: 50 }, (_, i) => `${i + 1} §`)

      const prompt = generateAmendmentSummaryPrompt({
        lawTitle: 'Test Law',
        lawNumber: 'SFS 2020:100',
        amendmentSfs: 'SFS 2025:200',
        affectedSections: manySections,
      })

      // Should still generate a valid prompt
      expect(prompt).toContain('1 §')
      expect(prompt).toContain('50 §')
    })
  })
})

describe('Edge Cases', () => {
  describe('Special characters in law titles', () => {
    it('should handle ampersands and special chars', () => {
      const prompt = generateAmendmentSummaryPrompt({
        lawTitle: 'Lag om bank- & finansieringsrörelse',
        lawNumber: 'SFS 2004:297',
        amendmentSfs: 'SFS 2025:100',
        affectedSections: [],
      })

      expect(prompt).toContain('bank- & finansieringsrörelse')
    })

    it('should handle quotes in titles', () => {
      const prompt = generateAmendmentSummaryPrompt({
        lawTitle: 'Lag om "rätt till" vissa förmåner',
        lawNumber: 'SFS 2020:100',
        amendmentSfs: 'SFS 2025:200',
        affectedSections: [],
      })

      expect(prompt).toContain('"rätt till"')
    })
  })

  describe('Section number formats', () => {
    it('should handle various section formats', () => {
      const sections = [
        '1 §',
        '1 a §',
        '1 b §',
        '10 kap. 1 §',
        '10 kap. 1 a §',
        '10 §',
        '100 §',
      ]

      const prompt = generateAmendmentSummaryPrompt({
        lawTitle: 'Test',
        lawNumber: 'SFS 2020:1',
        amendmentSfs: 'SFS 2025:1',
        affectedSections: sections,
      })

      sections.forEach((section) => {
        expect(prompt).toContain(section)
      })
    })
  })
})
