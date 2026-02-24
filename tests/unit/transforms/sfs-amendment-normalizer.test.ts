/**
 * Tests for SFS Amendment HTML Normalizer
 * Story 14.1 — Converts Notisum-style amendment HTML to canonical flat structure
 */

import { describe, it, expect } from 'vitest'
import * as cheerio from 'cheerio'
import { normalizeSfsAmendment } from '@/lib/transforms/normalizers/sfs-amendment-normalizer'

// ============================================================================
// Helper
// ============================================================================

function $(html: string) {
  return cheerio.load(html)
}

const OPTS = {
  documentNumber: 'SFS 2025:732',
  title: 'Lag om ändring i arbetsmiljölagen (1977:1160)',
}

// ============================================================================
// Fixtures — Notisum-style amendment HTML (old LLM output format)
// ============================================================================

/** Minimal single-section amendment with full Notisum nesting */
const SINGLE_SECTION_NOTISUM = `<html><head></head><body><article class="legal-document" id="SFS2025-732">
  <div class="lovhead">
    <h1><p class="text">SFS 2025:732</p></h1>
  </div>
  <div class="body">
    <p class="text">Härigenom föreskrivs att 6 kap. 17 § arbetsmiljölagen (1977:1160) ska ha följande lydelse.</p>
    <section class="kapitel" id="SFS2025-732_K6">
      <h2>6 kap.</h2>
      <div class="N2">
        <section class="ann">
          <div class="element-body annzone">
            <h3 class="paragraph" id="SFS2025-732_K6_P17">
              <span class="kapitel">6 kap.</span> 17 §
            </h3>
            <p class="text">Arbetsgivaren ska se till att arbetstagaren får god kännedom.</p>
          </div>
        </section>
      </div>
    </section>
  </div>
  <footer class="back">
    <h2>Ikraftträdande- och övergångsbestämmelser</h2>
    <p class="text"><strong>2025:732</strong></p>
    <p class="text">Denna lag träder i kraft den 1 juli 2025.</p>
  </footer>
</article></body></html>`

/** Multi-section amendment with group headings */
const MULTI_SECTION_NOTISUM = `<html><head></head><body><article class="legal-document" id="SFS2025-100">
  <div class="lovhead">
    <h1><p class="text">SFS 2025:100</p></h1>
  </div>
  <div class="body">
    <section class="kapitel" id="SFS2025-100_K3">
      <h2>3 kap.</h2>
      <section class="group">
        <h3 class="group" id="SFS2025-100_K3_allman">Allmänna bestämmelser</h3>
      </section>
      <div class="N2">
        <section class="ann">
          <div class="element-body annzone">
            <h3 class="paragraph" id="SFS2025-100_K3_P1">
              <span class="kapitel">3 kap.</span> 1 §
            </h3>
            <p class="text">First section text.</p>
          </div>
        </section>
      </div>
      <div class="N2">
        <section class="ann">
          <div class="element-body annzone">
            <h3 class="paragraph" id="SFS2025-100_K3_P2">
              <span class="kapitel">3 kap.</span> 2 §
            </h3>
            <p class="text">Second section text.</p>
            <p class="text">Second stycke.</p>
          </div>
        </section>
      </div>
    </section>
  </div>
</article></body></html>`

/** Amendment with footnotes on § headings */
const FOOTNOTE_NOTISUM = `<html><head></head><body><article class="legal-document" id="SFS2025-200">
  <div class="lovhead">
    <h1><p class="text">SFS 2025:200</p></h1>
  </div>
  <div class="body">
    <section class="kapitel" id="SFS2025-200_K1">
      <h2>1 kap.</h2>
      <div class="N2">
        <section class="ann">
          <div class="element-body annzone">
            <h3 class="paragraph" id="SFS2025-200_K1_P5">
              <span class="kapitel">1 kap.</span> 5 §<sup class="footnote-ref" data-note="1" title="Senaste lydelse 2020:123.">1</sup>
            </h3>
            <p class="text">Paragraph text with footnote on heading.</p>
          </div>
        </section>
      </div>
    </section>
  </div>
</article></body></html>`

/** Old class="sfs" wrapper (pre-rename) — common in existing DB */
const OLD_SFS_CLASS = `<html><head></head><body><article class="sfs" id="SFS2025-400">
  <div class="lovhead">
    <h1><p class="text">SFS 2025:400</p></h1>
  </div>
  <div class="body">
    <section class="kapitel" id="SFS2025-400_K1">
      <h2>1 kap.</h2>
      <div class="N2">
        <section class="ann">
          <div class="element-body annzone">
            <h3 class="paragraph" id="SFS2025-400_K1_P3">
              <span class="kapitel">1 kap.</span> 3 §
            </h3>
            <p class="text">Text with old sfs class wrapper.</p>
          </div>
        </section>
      </div>
    </section>
  </div>
</article></body></html>`

/** Already-canonical HTML (has a.paragraf) */
const ALREADY_CANONICAL = `<html><head></head><body><article class="legal-document" id="SFS2025-300">
  <div class="lovhead">
    <h1><p class="text">SFS 2025:300</p></h1>
  </div>
  <div class="body">
    <section class="kapitel" id="SFS2025-300_K1">
      <h2 class="kapitel-rubrik">1 kap.</h2>
      <h3 class="paragraph">
        <a class="paragraf" id="SFS2025-300_K1_P1" name="SFS2025-300_K1_P1">1 §</a>
      </h3>
      <p class="text">Already canonical.</p>
    </section>
  </div>
</article></body></html>`

// ============================================================================
// Tests
// ============================================================================

describe('normalizeSfsAmendment', () => {
  describe('idempotency and edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(normalizeSfsAmendment('', OPTS)).toBe('')
    })

    it('returns unchanged for null-ish input', () => {
      expect(normalizeSfsAmendment('   ', OPTS)).toBe('   ')
    })

    it('returns unchanged for already-canonical HTML (has a.paragraf)', () => {
      const result = normalizeSfsAmendment(ALREADY_CANONICAL, OPTS)
      expect(result).toBe(ALREADY_CANONICAL)
    })

    it('returns unchanged for non-amendment HTML (no legal-document class)', () => {
      const nonAmendment = '<div><p>Not a legal document</p></div>'
      expect(normalizeSfsAmendment(nonAmendment, OPTS)).toBe(nonAmendment)
    })

    it('returns unchanged if no Notisum markers (no annzone or section.ann)', () => {
      const noMarkers = `<article class="legal-document"><div class="body"><p>Simple</p></div></article>`
      expect(normalizeSfsAmendment(noMarkers, OPTS)).toBe(noMarkers)
    })

    it('returns unchanged for HTML without article wrapper', () => {
      const plain = '<div class="annzone"><p>No article wrapper</p></div>'
      expect(normalizeSfsAmendment(plain, OPTS)).toBe(plain)
    })
  })

  describe('class="sfs" rename', () => {
    it('renames class="sfs" to class="legal-document"', () => {
      const result = normalizeSfsAmendment(OLD_SFS_CLASS, OPTS)
      const doc = $(result)
      expect(doc('article.legal-document').length).toBe(1)
      expect(doc('article.sfs').length).toBe(0)
    })

    it('normalizes Notisum wrappers in class="sfs" documents', () => {
      const result = normalizeSfsAmendment(OLD_SFS_CLASS, OPTS)
      const doc = $(result)
      expect(doc('div.N2').length).toBe(0)
      expect(doc('section.ann').length).toBe(0)
      expect(doc('div.annzone').length).toBe(0)
      expect(doc('a.paragraf').length).toBe(1)
      expect(doc('a.paragraf').text().trim()).toBe('3 §')
    })

    it('adds kapitel-rubrik to chapters in class="sfs" documents', () => {
      const result = normalizeSfsAmendment(OLD_SFS_CLASS, OPTS)
      const doc = $(result)
      expect(doc('h2.kapitel-rubrik').length).toBe(1)
    })
  })

  describe('wrapper unwrapping', () => {
    it('removes div.N2 wrappers', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      expect(doc('div.N2').length).toBe(0)
    })

    it('removes section.ann wrappers', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      expect(doc('section.ann').length).toBe(0)
    })

    it('removes div.annzone wrappers', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      expect(doc('div.annzone').length).toBe(0)
    })

    it('removes div.element-body wrappers', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      expect(doc('div.element-body').length).toBe(0)
    })

    it('unwraps all layers in multi-section document', () => {
      const result = normalizeSfsAmendment(MULTI_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      expect(doc('div.N2').length).toBe(0)
      expect(doc('section.ann').length).toBe(0)
      expect(doc('div.annzone').length).toBe(0)
      expect(doc('section.group').length).toBe(0)
    })
  })

  describe('a.paragraf anchor creation', () => {
    it('converts h3.paragraph bare text to h3 > a.paragraf', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      const anchors = doc('a.paragraf')
      expect(anchors.length).toBe(1)
      expect(anchors.first().text().trim()).toBe('17 §')
    })

    it('sets id and name attributes on a.paragraf', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      const anchor = doc('a.paragraf').first()
      expect(anchor.attr('id')).toBe('SFS2025-732_K6_P17')
      expect(anchor.attr('name')).toBe('SFS2025-732_K6_P17')
    })

    it('removes id from h3 after moving to anchor', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      const h3 = doc('h3.paragraph').first()
      expect(h3.attr('id')).toBeUndefined()
    })

    it('creates anchors for multiple sections', () => {
      const result = normalizeSfsAmendment(MULTI_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      const anchors = doc('a.paragraf')
      expect(anchors.length).toBe(2)
      expect(anchors.eq(0).text().trim()).toBe('1 §')
      expect(anchors.eq(1).text().trim()).toBe('2 §')
    })
  })

  describe('span.kapitel removal', () => {
    it('removes span.kapitel from § headings', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      expect(doc('span.kapitel').length).toBe(0)
    })

    it('§ text does not include chapter prefix after removal', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      const anchor = doc('a.paragraf').first()
      expect(anchor.text()).not.toContain('kap.')
      expect(anchor.text().trim()).toBe('17 §')
    })
  })

  describe('chapter heading upgrade', () => {
    it('adds kapitel-rubrik class to chapter h2', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      const h2 = doc('section.kapitel > h2')
      expect(h2.hasClass('kapitel-rubrik')).toBe(true)
    })

    it('does not double-add kapitel-rubrik class', () => {
      // Run twice to test idempotency of the class addition
      // (though second run would be caught by the a.paragraf check)
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      const h2 = doc('section.kapitel > h2')
      expect(h2.attr('class')).toBe('kapitel-rubrik')
    })
  })

  describe('group heading handling', () => {
    it('unwraps section.group wrappers', () => {
      const result = normalizeSfsAmendment(MULTI_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      expect(doc('section.group').length).toBe(0)
    })

    it('removes group class from h3 headings', () => {
      const result = normalizeSfsAmendment(MULTI_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      expect(doc('h3.group').length).toBe(0)
    })

    it('preserves group heading text', () => {
      const result = normalizeSfsAmendment(MULTI_SECTION_NOTISUM, OPTS)
      expect(result).toContain('Allmänna bestämmelser')
    })

    it('removes class attribute entirely when empty', () => {
      const result = normalizeSfsAmendment(MULTI_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      // The group heading should have no class attribute at all
      const groupH3 = doc('h3#SFS2025-100_K3_allman')
      expect(groupH3.attr('class')).toBeUndefined()
    })
  })

  describe('footnote handling', () => {
    it('preserves canonical footnote-ref sup elements on § headings', () => {
      const result = normalizeSfsAmendment(FOOTNOTE_NOTISUM, OPTS)
      const doc = $(result)
      const h3 = doc('h3.paragraph').first()
      expect(h3.find('sup.footnote-ref').length).toBe(1)
    })

    it('footnote-ref sup is outside the a.paragraf anchor', () => {
      const result = normalizeSfsAmendment(FOOTNOTE_NOTISUM, OPTS)
      const doc = $(result)
      const anchor = doc('a.paragraf').first()
      // sup should be a sibling of the anchor, not inside it
      expect(anchor.find('sup').length).toBe(0)
      expect(anchor.text().trim()).toBe('5 §')
    })

    it('preserves footnote-ref data-note and title attributes', () => {
      const result = normalizeSfsAmendment(FOOTNOTE_NOTISUM, OPTS)
      const doc = $(result)
      const sup = doc('sup.footnote-ref').first()
      expect(sup.attr('data-note')).toBe('1')
      expect(sup.attr('title')).toBe('Senaste lydelse 2020:123.')
    })

    it('removes old-style Notisum sup.footnote from headings', () => {
      // Old format: <sup class="footnote"><a class="footnote-link">2) </a></sup>
      const notisumFootnoteHtml = `<html><head></head><body><article class="legal-document" id="SFS2025-500">
        <div class="body">
          <section class="ann">
            <div class="element-body annzone">
              <h3 class="paragraph" id="SFS2025-500_P5">
                <sup class="footnote"><a class="footnote-link" data-toggle="popover">2) </a></sup>
                5 §
              </h3>
              <dl class="collapse footnote-content"><dt>2) </dt><dd><p class="text">Senaste lydelse 2024:547.</p></dd></dl>
              <p class="text">Paragraph text.</p>
            </div>
          </section>
        </div>
      </article></body></html>`
      const result = normalizeSfsAmendment(notisumFootnoteHtml, OPTS)
      const doc = $(result)
      // Old-style footnote should be removed from h3
      expect(doc('h3.paragraph sup.footnote').length).toBe(0)
      // The anchor should have clean text
      expect(doc('a.paragraf').text().trim()).toBe('5 §')
      // The dl.footnote-content should still exist
      expect(doc('dl.footnote-content').length).toBe(1)
    })
  })

  describe('content preservation', () => {
    it('preserves paragraph text content', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      expect(result).toContain(
        'Arbetsgivaren ska se till att arbetstagaren får god kännedom.'
      )
    })

    it('preserves preamble text', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      expect(result).toContain('Härigenom föreskrivs att')
    })

    it('preserves footer/transition provisions', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      expect(doc('footer.back').length).toBe(1)
      expect(result).toContain('Denna lag träder i kraft den 1 juli 2025.')
    })

    it('preserves lovhead', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      expect(doc('div.lovhead').length).toBe(1)
      expect(result).toContain('SFS 2025:732')
    })

    it('preserves multi-stycke paragraphs', () => {
      const result = normalizeSfsAmendment(MULTI_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      // The second section should have 2 p.text elements
      const texts = doc('p.text')
      const allTexts = texts.map((_, el) => doc(el).text()).get()
      expect(allTexts).toContain('Second section text.')
      expect(allTexts).toContain('Second stycke.')
    })

    it('preserves article.legal-document root', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      const doc = $(result)
      expect(doc('article.legal-document').length).toBe(1)
      expect(doc('article.legal-document').attr('id')).toBe('SFS2025-732')
    })
  })

  describe('split h3.paragraph merge (footnote in separate h3)', () => {
    // When the LLM puts the footnote in one h3 and the § text in another,
    // the footnote-removal step leaves the first h3 empty. The normalizer
    // should merge the empty h3 (carrying its ID) into the next h3 sibling.
    const SPLIT_H3_NOTISUM = `<html><head></head><body><article class="legal-document" id="SFS2025-99">
      <div class="body">
        <section class="kapitel" id="SFS2025-99_K2">
          <div class="N2">
            <section class="ann">
              <div class="element-body annzone">
                <h3 class="paragraph" id="SFS2025-99_K2_P1B">
                  <sup class="footnote"><a class="footnote-link" data-toggle="popover">2) </a></sup>
                </h3>
                <h3 class="paragraph">1 b §</h3>
                <p class="text">Paragraph text for 1 b.</p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </article></body></html>`

    it('merges empty h3 with next h3 sibling after footnote removal', () => {
      const result = normalizeSfsAmendment(SPLIT_H3_NOTISUM, OPTS)
      const doc = $(result)
      // Should only have 1 h3.paragraph, not 2
      expect(doc('h3.paragraph').length).toBe(1)
    })

    it('transfers ID from empty h3 to merged a.paragraf anchor', () => {
      const result = normalizeSfsAmendment(SPLIT_H3_NOTISUM, OPTS)
      const doc = $(result)
      const anchor = doc('a.paragraf').first()
      expect(anchor.attr('id')).toBe('SFS2025-99_K2_P1B')
      expect(anchor.attr('name')).toBe('SFS2025-99_K2_P1B')
    })

    it('creates correct a.paragraf text after merge', () => {
      const result = normalizeSfsAmendment(SPLIT_H3_NOTISUM, OPTS)
      const doc = $(result)
      expect(doc('a.paragraf').text().trim()).toBe('1 b §')
    })

    it('preserves paragraph text content after merge', () => {
      const result = normalizeSfsAmendment(SPLIT_H3_NOTISUM, OPTS)
      expect(result).toContain('Paragraph text for 1 b.')
    })

    it('handles multiple split h3 pairs in same document', () => {
      const multiSplit = `<html><head></head><body><article class="legal-document" id="SFS2025-99">
        <div class="body">
          <section class="kapitel" id="SFS2025-99_K2">
            <div class="N2"><section class="ann"><div class="element-body annzone">
              <h3 class="paragraph" id="SFS2025-99_K2_P1B">
                <sup class="footnote"><a class="footnote-link">2) </a></sup>
              </h3>
              <h3 class="paragraph">1 b §</h3>
              <p class="text">First section.</p>
            </div></section></div>
          </section>
          <section class="kapitel" id="SFS2025-99_K11">
            <div class="N2"><section class="ann"><div class="element-body annzone">
              <h3 class="paragraph" id="SFS2025-99_K11_P3">
                <sup class="footnote"><a class="footnote-link">3) </a></sup>
              </h3>
              <h3 class="paragraph">3 §</h3>
              <p class="text">Second section.</p>
            </div></section></div>
          </section>
        </div>
      </article></body></html>`

      const result = normalizeSfsAmendment(multiSplit, OPTS)
      const doc = $(result)
      expect(doc('h3.paragraph').length).toBe(2)
      expect(doc('a.paragraf').length).toBe(2)
      expect(doc('a.paragraf').eq(0).attr('id')).toBe('SFS2025-99_K2_P1B')
      expect(doc('a.paragraf').eq(0).text().trim()).toBe('1 b §')
      expect(doc('a.paragraf').eq(1).attr('id')).toBe('SFS2025-99_K11_P3')
      expect(doc('a.paragraf').eq(1).text().trim()).toBe('3 §')
    })
  })

  describe('repair of broken canonical HTML (empty h3 + empty a.paragraf IDs)', () => {
    // Documents previously normalized with the old code that didn't merge split h3s.
    // They have a.paragraf (so pass the old idempotency check) but with empty id/name.
    const BROKEN_CANONICAL = `<html><head></head><body><article class="legal-document" id="SFS2025-99">
      <div class="body">
        <section class="kapitel" id="SFS2025-99_K2">
          <h3 class="paragraph" id="SFS2025-99_K2_P1B"></h3>
          <h3 class="paragraph"><a class="paragraf" id="" name="">1 b §</a></h3>
          <p class="text">Paragraph text.</p>
        </section>
        <section class="kapitel" id="SFS2025-99_K11">
          <h3 class="paragraph" id="SFS2025-99_K11_P3"></h3>
          <h3 class="paragraph"><a class="paragraf" id="" name="">3 §</a></h3>
          <p class="text">Another paragraph.</p>
        </section>
      </div>
    </article></body></html>`

    it('repairs empty h3 + empty-ID a.paragraf (does not skip as idempotent)', () => {
      const result = normalizeSfsAmendment(BROKEN_CANONICAL, OPTS)
      const doc = $(result)
      // Empty h3 elements should be removed
      const emptyH3s = doc('h3.paragraph').filter(
        (_, el) => doc(el).text().trim() === ''
      )
      expect(emptyH3s.length).toBe(0)
    })

    it('transfers ID from empty h3 to a.paragraf anchor during repair', () => {
      const result = normalizeSfsAmendment(BROKEN_CANONICAL, OPTS)
      const doc = $(result)
      const anchors = doc('a.paragraf')
      expect(anchors.eq(0).attr('id')).toBe('SFS2025-99_K2_P1B')
      expect(anchors.eq(0).attr('name')).toBe('SFS2025-99_K2_P1B')
      expect(anchors.eq(1).attr('id')).toBe('SFS2025-99_K11_P3')
      expect(anchors.eq(1).attr('name')).toBe('SFS2025-99_K11_P3')
    })

    it('preserves content during repair', () => {
      const result = normalizeSfsAmendment(BROKEN_CANONICAL, OPTS)
      expect(result).toContain('1 b §')
      expect(result).toContain('3 §')
      expect(result).toContain('Paragraph text.')
      expect(result).toContain('Another paragraph.')
    })

    it('is idempotent after repair (running again returns same result)', () => {
      const first = normalizeSfsAmendment(BROKEN_CANONICAL, OPTS)
      const second = normalizeSfsAmendment(first, OPTS)
      expect(second).toBe(first)
    })
  })

  describe('whitespace cleanup', () => {
    it('collapses excessive blank lines', () => {
      const result = normalizeSfsAmendment(SINGLE_SECTION_NOTISUM, OPTS)
      // Should not have 3+ consecutive newlines
      expect(result).not.toMatch(/\n\s*\n\s*\n\s*\n/)
    })
  })
})
