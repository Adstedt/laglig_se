/**
 * Tests for SFS Law Normalizer
 * Story 14.1, Task 2 (AC: 6, 9, 20)
 */

import { describe, it, expect } from 'vitest'
import * as cheerio from 'cheerio'
import {
  normalizeSfsLaw,
  generateDocId,
} from '@/lib/transforms/normalizers/sfs-law-normalizer'

// ============================================================================
// Helper
// ============================================================================

function $(html: string) {
  return cheerio.load(html)
}

const OPTS = { documentNumber: 'SFS 1977:1160', title: 'Arbetsmiljölag' }

// ============================================================================
// Tests
// ============================================================================

describe('generateDocId', () => {
  it('removes spaces and replaces colon with hyphen', () => {
    expect(generateDocId('SFS 1977:1160')).toBe('SFS1977-1160')
    expect(generateDocId('SFS 2025:732')).toBe('SFS2025-732')
    expect(generateDocId('MSBFS 2020:1')).toBe('MSBFS2020-1')
  })
})

describe('normalizeSfsLaw', () => {
  describe('chaptered law', () => {
    const CHAPTERED_HTML = `
      <h3><a name="K1">1 kap.</a> Lagens ändamål</h3>
      <a class="paragraf" name="K1P1"><b>1 §</b></a>
      <p>Lagens ändamål är att förebygga ohälsa.</p>
      <a name="K1P1S2"></a>Lagen gäller även i övrigt.
      <a class="paragraf" name="K1P2"><b>2 §</b></a>
      <p>Denna lag gäller varje verksamhet.</p>
      <h3><a name="K2">2 kap.</a> Arbetsmiljöns beskaffenhet</h3>
      <a class="paragraf" name="K2P1"><b>1 §</b></a>
      <p>Arbetsmiljön ska vara tillfredsställande.</p>
    `

    it('wraps in article.legal-document with correct ID', () => {
      const result = normalizeSfsLaw(CHAPTERED_HTML, OPTS)
      const doc = $(result)
      expect(doc('article.legal-document').length).toBe(1)
      expect(doc('article.legal-document').attr('id')).toBe('SFS1977-1160')
    })

    it('creates lovhead with document number and title', () => {
      const result = normalizeSfsLaw(CHAPTERED_HTML, OPTS)
      const doc = $(result)
      expect(doc('div.lovhead').length).toBe(1)
      const texts = doc('div.lovhead p.text')
      expect(texts.eq(0).text()).toContain('SFS 1977:1160')
      expect(texts.eq(1).text()).toContain('Arbetsmiljölag')
    })

    it('wraps chapters in section.kapitel with semantic IDs', () => {
      const result = normalizeSfsLaw(CHAPTERED_HTML, OPTS)
      const doc = $(result)
      const chapters = doc('section.kapitel')
      expect(chapters.length).toBe(2)
      expect(chapters.eq(0).attr('id')).toBe('SFS1977-1160_K1')
      expect(chapters.eq(1).attr('id')).toBe('SFS1977-1160_K2')
    })

    it('creates h2.kapitel-rubrik for chapter headings', () => {
      const result = normalizeSfsLaw(CHAPTERED_HTML, OPTS)
      const doc = $(result)
      const headings = doc('h2.kapitel-rubrik')
      expect(headings.length).toBe(2)
      expect(headings.eq(0).text()).toContain('1 kap.')
    })

    it('converts paragraf anchors to h3.paragraph > a.paragraf with semantic IDs', () => {
      const result = normalizeSfsLaw(CHAPTERED_HTML, OPTS)
      const doc = $(result)
      const anchors = doc('h3.paragraph a.paragraf')
      expect(anchors.length).toBeGreaterThanOrEqual(3)
      expect(anchors.eq(0).attr('id')).toBe('SFS1977-1160_K1_P1')
      expect(anchors.eq(0).text()).toContain('1 §')
    })

    it('adds class="text" to content paragraphs', () => {
      const result = normalizeSfsLaw(CHAPTERED_HTML, OPTS)
      const doc = $(result)
      const textParagraphs = doc('p.text')
      // Should have the lovhead texts + body texts
      expect(textParagraphs.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe('flat law (no chapters)', () => {
    const FLAT_HTML = `
      <a class="paragraf" name="P1"><b>1 §</b></a>
      <p>Denna lag innehåller bestämmelser om...</p>
      <a class="paragraf" name="P2"><b>2 §</b></a>
      <p>I denna lag avses med...</p>
    `

    it('creates sections directly in body with flat IDs', () => {
      const result = normalizeSfsLaw(FLAT_HTML, OPTS)
      const doc = $(result)
      expect(doc('section.kapitel').length).toBe(0)
      const anchors = doc('h3.paragraph a.paragraf')
      expect(anchors.eq(0).attr('id')).toBe('SFS1977-1160_P1')
      expect(anchors.eq(1).attr('id')).toBe('SFS1977-1160_P2')
    })
  })

  describe('2a § numbering', () => {
    const HTML_2A = `
      <a class="paragraf" name="K1P1"><b>1 §</b></a>
      <p>First section.</p>
      <a class="paragraf" name="K1P2a"><b>2 a §</b></a>
      <p>Section 2a content.</p>
    `

    it('correctly handles letter-suffixed section numbers', () => {
      const opts = { documentNumber: 'SFS 2000:1', title: 'Testlag' }
      const result = normalizeSfsLaw(
        `<h3><a name="K1">1 kap.</a> Test</h3>${HTML_2A}`,
        opts
      )
      const doc = $(result)
      const anchors = doc('h3.paragraph a.paragraf')
      expect(anchors.eq(1).attr('id')).toBe('SFS2000-1_K1_P2a')
      expect(anchors.eq(1).text()).toContain('2a §')
    })
  })

  describe('multi-stycke paragraph', () => {
    const MULTI_STYCKE = `
      <h3><a name="K1">1 kap.</a> Inledning</h3>
      <a class="paragraf" name="K1P1"><b>1 §</b></a>
      <p>Första stycket.</p>
      <p>Andra stycket.</p>
    `

    it('converts multiple stycken to p.text tags', () => {
      const result = normalizeSfsLaw(MULTI_STYCKE, OPTS)
      const doc = $(result)
      // Body text paragraphs (excluding lovhead)
      const bodyTexts = doc('div.body p.text')
      expect(bodyTexts.length).toBe(2)
      expect(bodyTexts.eq(0).text()).toContain('Första stycket')
      expect(bodyTexts.eq(1).text()).toContain('Andra stycket')
    })
  })

  describe('övergångsbestämmelser', () => {
    const WITH_TRANSITION = `
      <a class="paragraf" name="P1"><b>1 §</b></a>
      <p>Main content.</p>
      <a name="overgang"></a>
      <p>Denna lag träder i kraft den 1 januari 2026.</p>
      <p>Äldre bestämmelser gäller fortfarande.</p>
    `

    it('extracts transition provisions into footer.back', () => {
      const result = normalizeSfsLaw(WITH_TRANSITION, OPTS)
      const doc = $(result)
      expect(doc('footer.back').length).toBe(1)
      expect(doc('footer.back h2').text()).toContain('Övergångsbestämmelser')
      const transitionTexts = doc('footer.back p.text')
      expect(transitionTexts.length).toBeGreaterThanOrEqual(1)
    })

    it('does not include transition content in body', () => {
      const result = normalizeSfsLaw(WITH_TRANSITION, OPTS)
      const doc = $(result)
      const bodyText = doc('div.body').text()
      expect(bodyText).not.toContain('träder i kraft')
    })
  })

  describe('tables', () => {
    const WITH_TABLE = `
      <a class="paragraf" name="P1"><b>1 §</b></a>
      <p>See the table:</p>
      <table><thead><tr><th>Column</th></tr></thead><tbody><tr><td>Value</td></tr></tbody></table>
    `

    it('preserves tables in output', () => {
      const result = normalizeSfsLaw(WITH_TABLE, OPTS)
      const doc = $(result)
      expect(doc('table').length).toBe(1)
      expect(doc('table').html()).toContain('Column')
      expect(doc('table').html()).toContain('Value')
    })
  })

  describe('empty input', () => {
    it('returns minimal canonical structure', () => {
      const result = normalizeSfsLaw('', OPTS)
      const doc = $(result)
      expect(doc('article.legal-document').length).toBe(1)
      expect(doc('div.lovhead').length).toBe(1)
      expect(doc('div.body').length).toBe(1)
    })
  })

  describe('idempotent', () => {
    it('returns already-normalized HTML unchanged', () => {
      const alreadyNormalized = `<article class="legal-document" id="SFS1977-1160">
        <div class="lovhead"><h1><p class="text">SFS 1977:1160</p></h1></div>
        <div class="body"><p class="text">Content</p></div>
      </article>`

      const result = normalizeSfsLaw(alreadyNormalized, OPTS)
      expect(result).toBe(alreadyNormalized)
    })
  })

  describe('class-based format (LedParagraf)', () => {
    const LED_HTML = `
      <p class="LedKapitel">1 kap. Inledande bestämmelser</p>
      <p class="LedParagraf">1 §</p>
      <p class="LedParagrafText">Denna lag gäller för alla.</p>
      <p class="LedParagrafText">Lagen tillämpas även på...</p>
      <p class="LedParagraf">2 §</p>
      <p class="LedParagrafText">Definitioner.</p>
    `

    it('normalizes class-based HTML into canonical structure', () => {
      const result = normalizeSfsLaw(LED_HTML, OPTS)
      const doc = $(result)
      expect(doc('article.legal-document').length).toBe(1)
      expect(doc('section.kapitel').length).toBe(1)
      expect(doc('h2.kapitel-rubrik').text()).toContain('1 kap.')
      expect(doc('h3.paragraph a.paragraf').length).toBe(2)
      expect(doc('h3.paragraph a.paragraf').eq(0).attr('id')).toBe(
        'SFS1977-1160_K1_P1'
      )
    })
  })
})
