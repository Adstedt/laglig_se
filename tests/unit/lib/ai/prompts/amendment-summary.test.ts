/**
 * Story 8.8, Task 3.1
 *
 * Tests for amendment summary prompt and context assembly.
 */
import { describe, it, expect } from 'vitest'
import {
  buildAmendmentSummaryPrompt,
  buildAmendmentContext,
  type AmendmentSummaryInput,
  type BaseLawContext,
  type SectionChangeInfo,
} from '@/lib/ai/prompts/amendment-summary'

const SAMPLE_AMENDMENT: AmendmentSummaryInput = {
  sfsNumber: '2026:109',
  title: 'Lag om ändring i skattebrottslagen (1971:69)',
  markdownContent:
    '# SFS 2026:109\n\nLag om ändring i skattebrottslagen (1971:69)\n\n### 2 §\n\nDen som uppsåtligen...',
  effectiveDate: new Date('2026-04-01'),
}

const SAMPLE_BASE_LAW: BaseLawContext = {
  title: 'Skattebrottslag (1971:69)',
  summary:
    'Skattebrottslagen reglerar straff för skattebrott, vårdslös skatteuppgift och skatteredovisningsbrott.',
}

const SAMPLE_SECTION_CHANGES: SectionChangeInfo[] = [
  { chapter: null, section: '2', changeType: 'AMENDED' },
  { chapter: null, section: '4', changeType: 'AMENDED' },
  { chapter: null, section: '5', changeType: 'AMENDED' },
  { chapter: '8', section: '1', changeType: 'NEW' },
]

describe('Amendment Summary Prompt', () => {
  describe('buildAmendmentSummaryPrompt', () => {
    it('returns a non-empty system prompt', () => {
      const prompt = buildAmendmentSummaryPrompt()
      expect(prompt.length).toBeGreaterThan(100)
    })

    it('instructs max 60 words', () => {
      const prompt = buildAmendmentSummaryPrompt()
      expect(prompt).toContain('max 60 ord')
    })

    it('prohibits "Vi ska" formulations', () => {
      const prompt = buildAmendmentSummaryPrompt()
      expect(prompt).toContain('Skriv INTE "Vi ska"')
    })

    it('requests plain text output (no JSON)', () => {
      const prompt = buildAmendmentSummaryPrompt()
      expect(prompt).toContain('ingen JSON')
    })

    it('asks for ikraftträdandedatum', () => {
      const prompt = buildAmendmentSummaryPrompt()
      expect(prompt).toContain('Ikraftträdandedatum')
    })

    it('includes anti-hallucination instructions', () => {
      const prompt = buildAmendmentSummaryPrompt()
      expect(prompt).toContain('anti-hallucination')
      expect(prompt).toContain('ALDRIG specifika siffror')
      expect(prompt).toContain('utelämna den hellre än att gissa')
    })
  })

  describe('buildAmendmentContext', () => {
    it('includes amendment SFS number', () => {
      const ctx = buildAmendmentContext(
        SAMPLE_AMENDMENT,
        SAMPLE_BASE_LAW,
        SAMPLE_SECTION_CHANGES
      )
      expect(ctx).toContain('SFS 2026:109')
    })

    it('includes amendment title', () => {
      const ctx = buildAmendmentContext(
        SAMPLE_AMENDMENT,
        SAMPLE_BASE_LAW,
        SAMPLE_SECTION_CHANGES
      )
      expect(ctx).toContain('skattebrottslagen')
    })

    it('includes effective date in ISO format', () => {
      const ctx = buildAmendmentContext(
        SAMPLE_AMENDMENT,
        SAMPLE_BASE_LAW,
        SAMPLE_SECTION_CHANGES
      )
      expect(ctx).toContain('2026-04-01')
    })

    it('includes base law title', () => {
      const ctx = buildAmendmentContext(
        SAMPLE_AMENDMENT,
        SAMPLE_BASE_LAW,
        SAMPLE_SECTION_CHANGES
      )
      expect(ctx).toContain('Skattebrottslag (1971:69)')
    })

    it('includes base law summary when available', () => {
      const ctx = buildAmendmentContext(
        SAMPLE_AMENDMENT,
        SAMPLE_BASE_LAW,
        SAMPLE_SECTION_CHANGES
      )
      expect(ctx).toContain('Skattebrottslagen reglerar straff')
    })

    it('omits base law summary when null', () => {
      const ctx = buildAmendmentContext(
        SAMPLE_AMENDMENT,
        { title: 'Testlag', summary: null },
        SAMPLE_SECTION_CHANGES
      )
      expect(ctx).not.toContain('Sammanfattning av baslagen')
    })

    it('includes section change count', () => {
      const ctx = buildAmendmentContext(
        SAMPLE_AMENDMENT,
        SAMPLE_BASE_LAW,
        SAMPLE_SECTION_CHANGES
      )
      expect(ctx).toContain('4 st')
    })

    it('formats section changes with Swedish labels', () => {
      const ctx = buildAmendmentContext(
        SAMPLE_AMENDMENT,
        SAMPLE_BASE_LAW,
        SAMPLE_SECTION_CHANGES
      )
      expect(ctx).toContain('2 § — ändrad')
      expect(ctx).toContain('8 kap. 1 § — ny')
    })

    it('includes full amendment markdown', () => {
      const ctx = buildAmendmentContext(
        SAMPLE_AMENDMENT,
        SAMPLE_BASE_LAW,
        SAMPLE_SECTION_CHANGES
      )
      expect(ctx).toContain('Den som uppsåtligen')
    })

    it('handles empty section changes', () => {
      const ctx = buildAmendmentContext(SAMPLE_AMENDMENT, SAMPLE_BASE_LAW, [])
      expect(ctx).not.toContain('Berörda paragrafer')
      expect(ctx).toContain('Ändringstext')
    })

    it('handles missing effective date', () => {
      const ctx = buildAmendmentContext(
        { ...SAMPLE_AMENDMENT, effectiveDate: null },
        SAMPLE_BASE_LAW,
        SAMPLE_SECTION_CHANGES
      )
      expect(ctx).not.toContain('Ikraftträdande')
    })

    it('handles missing amendment title', () => {
      const ctx = buildAmendmentContext(
        { ...SAMPLE_AMENDMENT, title: null },
        SAMPLE_BASE_LAW,
        SAMPLE_SECTION_CHANGES
      )
      expect(ctx).not.toContain('Titel:')
    })

    it('truncates long markdown content', () => {
      const longMarkdown = 'A'.repeat(5000)
      const ctx = buildAmendmentContext(
        { ...SAMPLE_AMENDMENT, markdownContent: longMarkdown },
        SAMPLE_BASE_LAW,
        SAMPLE_SECTION_CHANGES
      )
      expect(ctx).toContain('[...resterande ändringstext utelämnad]')
      expect(ctx).toContain('(utdrag)')
      expect(ctx.length).toBeLessThan(longMarkdown.length)
    })

    it('does not truncate short markdown content', () => {
      const shortMarkdown = 'Kort ändringstext'
      const ctx = buildAmendmentContext(
        { ...SAMPLE_AMENDMENT, markdownContent: shortMarkdown },
        SAMPLE_BASE_LAW,
        SAMPLE_SECTION_CHANGES
      )
      expect(ctx).toContain('Kort ändringstext')
      expect(ctx).not.toContain('utdrag')
      expect(ctx).not.toContain('utelämnad')
    })
  })
})
