/**
 * Story 9.2: Unit Tests for Agency Regulation LLM Prompt
 *
 * Verifies prompt construction, user prompt builder output,
 * and token limit constants.
 */

import { describe, it, expect } from 'vitest'
import {
  AGENCY_REGULATION_SYSTEM_PROMPT,
  getAgencyPdfUserPrompt,
  AGENCY_MAX_TOKENS,
  AGENCY_DEFAULT_MODEL,
} from '@/lib/agency/agency-regulation-prompt'

describe('agency-regulation-prompt', () => {
  describe('AGENCY_REGULATION_SYSTEM_PROMPT', () => {
    it('is a non-empty string', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toBeTruthy()
      expect(typeof AGENCY_REGULATION_SYSTEM_PROMPT).toBe('string')
    })

    it('instructs output-only HTML', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain(
        'Output ONLY valid HTML'
      )
    })

    it('specifies article.legal-document root element', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain(
        '<article class="legal-document"'
      )
    })

    it('specifies div.lovhead structure', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain('<div class="lovhead">')
    })

    it('specifies div.body structure', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain('<div class="body">')
    })

    it('specifies section.kapitel for chapters', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain('class="kapitel"')
    })

    it('specifies a.paragraf for § anchors', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain('class="paragraf"')
    })

    it('specifies div.allmanna-rad for general guidance', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain('class="allmanna-rad"')
    })

    it('specifies table.legal-table for tables', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain('class="legal-table"')
    })

    it('specifies footer.back for transition provisions', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain('<footer class="back">')
    })

    it('specifies div.appendices for bilagor', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain('class="appendices"')
    })

    it('specifies footnote-ref for footnotes', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain('class="footnote-ref"')
    })

    it('specifies h3 with id for section headings', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain(
        '## SECTION HEADINGS (rubrik)'
      )
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain(
        '<h3 id="{DOC_ID}_{slug}">'
      )
    })

    it('specifies h4 with id for sub-section headings', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain(
        '## SUB-SECTION HEADINGS (underrubrik)'
      )
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain(
        '<h4 id="{DOC_ID}_{slug}">'
      )
    })

    it('reserves h2 for chapters and appendices only', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain(
        'Reserve `<h2>` for chapter headings (kap.) and appendices (Bilaga) only'
      )
    })

    it('requires id attributes on sub-section headings for TOC navigation', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain(
        'Every sub-section heading needs an id attribute for TOC navigation'
      )
    })

    it('instructs PDF artifact removal', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain('Page numbers')
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain('FIX HYPHENATION')
    })

    it('instructs Swedish character preservation', () => {
      expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain('å, ä, ö')
    })
  })

  describe('getAgencyPdfUserPrompt', () => {
    it('includes document number', () => {
      const result = getAgencyPdfUserPrompt(
        'MSBFS 2020:1',
        'Test title',
        'msbfs'
      )
      expect(result).toContain('MSBFS 2020:1')
    })

    it('includes article ID', () => {
      const result = getAgencyPdfUserPrompt(
        'MSBFS 2020:1',
        'Test title',
        'msbfs'
      )
      expect(result).toContain('MSBFS2020-1')
    })

    it('includes title', () => {
      const result = getAgencyPdfUserPrompt(
        'MSBFS 2020:1',
        'Brandfarlig gas',
        'msbfs'
      )
      expect(result).toContain('Brandfarlig gas')
    })

    it('includes MSB authority name', () => {
      const result = getAgencyPdfUserPrompt('MSBFS 2020:1', 'Test', 'msbfs')
      expect(result).toContain('Myndigheten för samhällsskydd och beredskap')
    })

    it('includes Naturvårdsverket authority name', () => {
      const result = getAgencyPdfUserPrompt('NFS 2023:2', 'Test', 'nfs')
      expect(result).toContain('Naturvårdsverket')
    })

    it('includes year and number', () => {
      const result = getAgencyPdfUserPrompt('NFS 2023:13', 'Test', 'nfs')
      expect(result).toContain('Year: 2023')
      expect(result).toContain('Number: 13')
    })

    it('includes anchor ID pattern instruction', () => {
      const result = getAgencyPdfUserPrompt('MSBFS 2020:1', 'Test', 'msbfs')
      expect(result).toContain('MSBFS2020-1_P{N}')
    })
  })

  describe('AGENCY_MAX_TOKENS', () => {
    it('has standard token limit of 64000', () => {
      expect(AGENCY_MAX_TOKENS.standard).toBe(64000)
    })

    it('has per-chapter token limit of 16384', () => {
      expect(AGENCY_MAX_TOKENS.perChapter).toBe(16384)
    })
  })

  describe('AGENCY_DEFAULT_MODEL', () => {
    it('uses Sonnet 4.5', () => {
      expect(AGENCY_DEFAULT_MODEL).toBe('claude-sonnet-4-5-20250929')
    })
  })
})
