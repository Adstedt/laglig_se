/**
 * Story 9.1: Unit Tests for AFS LLM Prompts
 *
 * Verifies prompt templates produce valid system messages
 * and user prompts contain expected metadata.
 */

import { describe, it, expect } from 'vitest'
import {
  AFS_FULL_DOCUMENT_SYSTEM_PROMPT,
  AFS_SINGLE_PASS_SYSTEM_PROMPT,
  AFS_PER_CHAPTER_SYSTEM_PROMPT,
  AFS_MAX_TOKENS,
  AFS_DEFAULT_MODEL,
  getAfsFullDocumentUserPrompt,
  getAfsSinglePassUserPrompt,
  getAfsChapterExtractionUserPrompt,
  getAfsParentExtractionUserPrompt,
} from '@/lib/agency/afs-prompt'

describe('afs-prompt', () => {
  describe('system prompts', () => {
    it('full document prompt is non-empty and mentions AFS', () => {
      expect(AFS_FULL_DOCUMENT_SYSTEM_PROMPT.length).toBeGreaterThan(500)
      expect(AFS_FULL_DOCUMENT_SYSTEM_PROMPT).toContain('AFS')
      expect(AFS_FULL_DOCUMENT_SYSTEM_PROMPT).toContain('Arbetsmiljöverket')
    })

    it('full document prompt includes key HTML structure rules', () => {
      expect(AFS_FULL_DOCUMENT_SYSTEM_PROMPT).toContain(
        'class="legal-document"'
      )
      expect(AFS_FULL_DOCUMENT_SYSTEM_PROMPT).toContain('class="kapitel"')
      expect(AFS_FULL_DOCUMENT_SYSTEM_PROMPT).toContain('class="ann"')
      expect(AFS_FULL_DOCUMENT_SYSTEM_PROMPT).toContain('class="paragraph"')
    })

    it('full document prompt includes AFS-specific elements', () => {
      expect(AFS_FULL_DOCUMENT_SYSTEM_PROMPT).toContain('allmanna-rad')
      expect(AFS_FULL_DOCUMENT_SYSTEM_PROMPT).toContain('Allmänna råd')
      expect(AFS_FULL_DOCUMENT_SYSTEM_PROMPT).toContain('bilaga')
      expect(AFS_FULL_DOCUMENT_SYSTEM_PROMPT).toContain('avdelning')
    })

    it('single-pass prompt includes data-chapter marker instruction', () => {
      expect(AFS_SINGLE_PASS_SYSTEM_PROMPT).toContain('data-chapter')
      expect(AFS_SINGLE_PASS_SYSTEM_PROMPT).toContain(
        'EVERY CHAPTER gets data-chapter attribute'
      )
    })

    it('per-chapter prompt instructs to extract only requested chapter', () => {
      expect(AFS_PER_CHAPTER_SYSTEM_PROMPT).toContain(
        'EXTRACT ONLY THE REQUESTED CHAPTER'
      )
      expect(AFS_PER_CHAPTER_SYSTEM_PROMPT).toContain(
        'Do not include content from other chapters'
      )
    })
  })

  describe('user prompt builders', () => {
    it('getAfsFullDocumentUserPrompt includes document metadata', () => {
      const prompt = getAfsFullDocumentUserPrompt(
        'AFS 2023:1',
        'Systematiskt arbetsmiljöarbete'
      )
      expect(prompt).toContain('AFS 2023:1')
      expect(prompt).toContain('2023')
      expect(prompt).toContain('Systematiskt arbetsmiljöarbete')
      expect(prompt).toContain('Arbetsmiljöverket')
      expect(prompt).toContain('consolidated')
    })

    it('getAfsSinglePassUserPrompt includes chapter list', () => {
      const prompt = getAfsSinglePassUserPrompt(
        'AFS 2023:10',
        'Risker i arbetsmiljön',
        [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
      )
      expect(prompt).toContain('AFS 2023:10')
      expect(prompt).toContain('data-chapter')
      expect(prompt).toContain('13 chapters')
      expect(prompt).toContain('2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13')
    })

    it('getAfsChapterExtractionUserPrompt targets specific chapter', () => {
      const prompt = getAfsChapterExtractionUserPrompt(
        'AFS 2023:2',
        3,
        'Arbetsanpassning'
      )
      expect(prompt).toContain('chapter 3')
      expect(prompt).toContain('Arbetsanpassning')
      expect(prompt).toContain('AFS 2023:2')
      expect(prompt).toContain('ONLY the content of 3 kap.')
    })

    it('getAfsParentExtractionUserPrompt requests TOC + kap. 1', () => {
      const prompt = getAfsParentExtractionUserPrompt(
        'AFS 2023:2',
        'Planering och organisering',
        [
          { number: 2, title: 'Organisatorisk och social arbetsmiljö' },
          { number: 3, title: 'Arbetsanpassning' },
        ]
      )
      expect(prompt).toContain('Table of Contents')
      expect(prompt).toContain('Chapter 1')
      expect(prompt).toContain('Allmänna bestämmelser')
      expect(prompt).toContain('kap. 2: Organisatorisk och social arbetsmiljö')
      expect(prompt).toContain('kap. 3: Arbetsanpassning')
      expect(prompt).toContain('Do NOT extract content from chapters 2 onwards')
    })
  })

  describe('configuration', () => {
    it('max tokens are set for each prompt type', () => {
      expect(AFS_MAX_TOKENS.fullDocument).toBeGreaterThanOrEqual(8192)
      expect(AFS_MAX_TOKENS.singlePass).toBeGreaterThanOrEqual(32768)
      expect(AFS_MAX_TOKENS.perChapter).toBeGreaterThanOrEqual(8192)
      expect(AFS_MAX_TOKENS.parentExtraction).toBeGreaterThanOrEqual(4096)
    })

    it('single-pass has highest max tokens', () => {
      expect(AFS_MAX_TOKENS.singlePass).toBeGreaterThanOrEqual(
        AFS_MAX_TOKENS.fullDocument
      )
      expect(AFS_MAX_TOKENS.singlePass).toBeGreaterThan(
        AFS_MAX_TOKENS.perChapter
      )
    })

    it('default model is set', () => {
      expect(AFS_DEFAULT_MODEL).toContain('claude')
    })
  })
})
