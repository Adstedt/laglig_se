/**
 * Story 9.1, Task 5: Unit Tests for AFS Chapter Splitter
 *
 * Tests splitting transformed HTML at chapter boundaries, kap. 1 preamble
 * prepending, parent TOC generation, and bilaga assignment.
 */

import { describe, it, expect } from 'vitest'
import { splitByChapters } from '@/lib/agency/afs-chapter-splitter'
import type { AfsDocument } from '@/lib/agency/afs-registry'

// ============================================================================
// Test Helpers
// ============================================================================

function makeSplitDoc(overrides: Partial<AfsDocument> = {}): AfsDocument {
  return {
    documentNumber: 'AFS 2023:2',
    title: 'Planering och organisering',
    tier: 'SPLIT',
    chapterCount: 4,
    chapters: [
      { number: 2, title: 'Organisatorisk och social arbetsmiljö' },
      { number: 3, title: 'Arbetsanpassning' },
      { number: 4, title: 'Första hjälpen och krisstöd' },
    ],
    hasAvdelningar: false,
    consolidatedThrough: null,
    amendments: [],
    ...overrides,
  }
}

// ============================================================================
// Test Fixtures — Transformed HTML (output of afs-html-transformer)
// ============================================================================

/** A simple SPLIT doc with chapters-only pattern (no avdelningar) */
const CHAPTERS_ONLY_HTML = `<article class="legal-document" id="AFS2023-2">
  <div class="lovhead">
    <h1>
      <p class="text">AFS 2023:2</p>
      <p class="text">Planering och organisering</p>
    </h1>
  </div>
  <div class="body">
    <h2 id="kap1" data-menu="true">1 kap. Allmänna bestämmelser</h2>
    <a class="paragraf" id="kap1-1" name="kap1-1">1 §</a>
    <p>Dessa föreskrifter gäller för alla arbetsgivare.</p>
    <a class="paragraf" id="kap1-2" name="kap1-2">2 §</a>
    <p>Med arbetstagare avses den som utför arbete.</p>

    <h2 id="kap2" data-menu="true">2 kap. Organisatorisk och social arbetsmiljö</h2>
    <a class="paragraf" id="kap2-1" name="kap2-1">1 §</a>
    <p>Arbetsgivaren ska se till att arbetsbelastningen inte ger upphov till ohälsa.</p>
    <div class="allmanna-rad"><p class="allmanna-rad-heading"><strong>Allmänna råd</strong></p>
      <p>Ohälsosam arbetsbelastning kan uppstå vid för hög arbetsbelastning.</p>
    </div>

    <h2 id="kap3" data-menu="true">3 kap. Arbetsanpassning</h2>
    <a class="paragraf" id="kap3-1" name="kap3-1">1 §</a>
    <p>Arbetsgivaren ska anpassa arbetsförhållandena.</p>

    <h2 id="kap4" data-menu="true">4 kap. Första hjälpen och krisstöd</h2>
    <a class="paragraf" id="kap4-1" name="kap4-1">1 §</a>
    <p>Det ska finnas beredskap för första hjälpen.</p>
  </div>
  <footer class="back">
    <h2>Övergångsbestämmelser</h2>
    <p>Träder i kraft 1 jan 2025.</p>
  </footer>
</article>`

/** A SPLIT doc with avdelningar + chapters (like AFS 2023:10) */
const AVDELNINGAR_HTML = `<article class="legal-document" id="AFS2023-10">
  <div class="lovhead">
    <h1>
      <p class="text">AFS 2023:10</p>
      <p class="text">Risker i arbetsmiljön</p>
    </h1>
  </div>
  <div class="body">
    <h2 id="avd1" data-menu="true">Avdelning 1 Gemensamma bestämmelser</h2>
    <h3 id="kap1" data-menu="true">1 kap. Allmänna bestämmelser</h3>
    <a class="paragraf" id="k1-1" name="k1-1">1 §</a>
    <p>Gemensamma bestämmelser gäller.</p>

    <h2 id="avd2" data-menu="true">Avdelning 2 Fysikaliska riskkällor</h2>
    <h3 id="kap2" data-menu="true">2 kap. Buller</h3>
    <a class="paragraf" id="k2-1" name="k2-1">1 §</a>
    <p>Buller ska begränsas.</p>

    <h3 id="kap3" data-menu="true">3 kap. Vibrationer</h3>
    <a class="paragraf" id="k3-1" name="k3-1">1 §</a>
    <p>Vibrationer ska begränsas.</p>
  </div>
  <div class="appendices">
    <h2>Bilaga 1</h2>
    <p>Bilaga till 2 kap. Bullervärden.</p>
    <h2>Bilaga 2</h2>
    <p>Allmän bilaga som inte hör till specifikt kapitel.</p>
  </div>
  <footer class="back">
    <h2>Övergångsbestämmelser</h2>
    <p>Träder i kraft 1 jan 2025.</p>
  </footer>
</article>`

// ============================================================================
// Tests
// ============================================================================

describe('afs-chapter-splitter', () => {
  describe('splitByChapters — chapters-only pattern', () => {
    const doc = makeSplitDoc()
    const result = splitByChapters(CHAPTERS_ONLY_HTML, doc)

    it('creates parent entry with correct document number', () => {
      expect(result.parent.documentNumber).toBe('AFS 2023:2')
      expect(result.parent.title).toBe('Planering och organisering')
    })

    it('creates one entry per registered chapter (kap. 2+)', () => {
      expect(result.chapters).toHaveLength(3)
      expect(result.chapters.map((c) => c.chapterNumber)).toEqual([2, 3, 4])
    })

    it('does NOT create a separate entry for kap. 1', () => {
      expect(result.chapters.find((c) => c.chapterNumber === 1)).toBeUndefined()
    })

    it('formats chapter document numbers correctly', () => {
      expect(result.chapters[0]!.documentNumber).toBe('AFS 2023:2 kap. 2')
      expect(result.chapters[1]!.documentNumber).toBe('AFS 2023:2 kap. 3')
      expect(result.chapters[2]!.documentNumber).toBe('AFS 2023:2 kap. 4')
    })

    it('formats chapter titles correctly', () => {
      expect(result.chapters[0]!.title).toBe(
        'Planering och organisering — kap. 2: Organisatorisk och social arbetsmiljö'
      )
    })

    it('includes kap. 1 content in parent HTML', () => {
      expect(result.parent.html).toContain('Allmänna bestämmelser')
      expect(result.parent.html).toContain('1 §')
      expect(result.parent.html).toContain('arbetsgivare')
    })

    it('includes kap. 1 as preamble in each chapter', () => {
      for (const ch of result.chapters) {
        expect(ch.html).toContain('class="general-provisions-preamble"')
        expect(ch.html).toContain(
          'Dessa föreskrifter gäller för alla arbetsgivare'
        )
      }
    })

    it('includes chapter-specific content in each chapter', () => {
      expect(result.chapters[0]!.html).toContain('arbetsbelastningen')
      expect(result.chapters[0]!.html).toContain('allmanna-rad')
      expect(result.chapters[1]!.html).toContain('anpassa arbetsförhållandena')
      expect(result.chapters[2]!.html).toContain('första hjälpen')
    })

    it('includes TOC in parent HTML', () => {
      expect(result.parent.html).toContain('class="chapter-toc"')
      expect(result.parent.html).toContain('kap. 2: Organisatorisk')
      expect(result.parent.html).toContain('kap. 3: Arbetsanpassning')
      expect(result.parent.html).toContain('kap. 4: Första hjälpen')
    })

    it('stores övergångsbestämmelser on parent', () => {
      expect(result.parent.transitionalHtml).toContain('Övergångsbestämmelser')
      expect(result.parent.transitionalHtml).toContain('Träder i kraft')
    })

    it('wraps each chapter in article.legal-document', () => {
      for (const ch of result.chapters) {
        expect(ch.html).toContain('<article class="legal-document"')
        expect(ch.html).toContain('</article>')
      }
    })

    it('includes lovhead in parent', () => {
      expect(result.parent.html).toContain('class="lovhead"')
      expect(result.parent.html).toContain('AFS 2023:2')
    })
  })

  describe('splitByChapters — avdelningar + chapters pattern', () => {
    const doc = makeSplitDoc({
      documentNumber: 'AFS 2023:10',
      title: 'Risker i arbetsmiljön',
      chapterCount: 3,
      hasAvdelningar: true,
      chapters: [
        { number: 2, title: 'Buller' },
        { number: 3, title: 'Vibrationer' },
      ],
    })
    const result = splitByChapters(AVDELNINGAR_HTML, doc)

    it('creates 2 chapter entries', () => {
      expect(result.chapters).toHaveLength(2)
    })

    it('splits at h3 boundaries (not h2 avdelning headers)', () => {
      expect(result.chapters[0]!.html).toContain('Buller')
      expect(result.chapters[0]!.html).toContain('Buller ska begränsas')
      expect(result.chapters[1]!.html).toContain('Vibrationer')
      expect(result.chapters[1]!.html).toContain('Vibrationer ska begränsas')
    })

    it('includes kap. 1 preamble in each chapter', () => {
      for (const ch of result.chapters) {
        expect(ch.html).toContain('general-provisions-preamble')
        expect(ch.html).toContain('Gemensamma bestämmelser gäller')
      }
    })

    it('assigns bilaga to correct chapter when text mentions "till N kap."', () => {
      // Bilaga 1 says "till 2 kap." — should be in chapter 2
      expect(result.chapters[0]!.html).toContain('Bullervärden')
      expect(result.chapters[0]!.html).toContain('class="appendices"')
    })

    it('does not assign unrelated bilagor to chapters', () => {
      // Bilaga 2 doesn't mention a chapter — should be unassigned
      expect(result.parent.unassignedAppendicesHtml).toContain('Allmän bilaga')
    })
  })

  describe('error handling', () => {
    it('throws when no div.body found', () => {
      expect(() =>
        splitByChapters(
          '<article class="legal-document"><p>no body</p></article>',
          makeSplitDoc()
        )
      ).toThrow('No div.body found')
    })
  })
})
