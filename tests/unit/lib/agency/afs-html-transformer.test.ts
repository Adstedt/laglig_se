/**
 * Story 9.1, Task 4: Unit Tests for AFS HTML Transformer
 *
 * Tests the transformer's ability to map av.se CSS classes to our
 * Laglig schema, handling all 3 heading patterns and content types.
 */

import { describe, it, expect } from 'vitest'
import {
  transformAfsHtml,
  detectHeadingPattern,
} from '@/lib/agency/afs-html-transformer'
import type { AfsDocument } from '@/lib/agency/afs-registry'

// ============================================================================
// Test Helpers
// ============================================================================

function makeDoc(overrides: Partial<AfsDocument> = {}): AfsDocument {
  return {
    documentNumber: 'AFS 2023:1',
    title: 'Test Document',
    tier: 'STANDALONE',
    chapterCount: 1,
    chapters: [],
    hasAvdelningar: false,
    consolidatedThrough: null,
    amendments: [],
    ...overrides,
  }
}

// ============================================================================
// Test Fixtures — av.se HTML snippets
// ============================================================================

const FLAT_PROVISION = `
<div class="document"><div class="root">
  <div id="preamble" class="preamble">
    <p>Arbetsmiljöverket föreskriver<button class="footnote provision__opendialog" data-footnote="1" aria-label="Fotnot 1">1</button> följande.
      <div class="provision__dialog-wrapper">
        <button class="provision__closedialog"></button>
        <div class="provision__dialog">
          <div class="footnote" aria-hidden="true">
            <div class="paragraph"><p>Jämför direktiv 89/391/EEG.</p></div>
          </div>
        </div>
      </div>
    </p>
  </div>
  <div id="rules" class="rules">
    <h2 id="varfor" data-menu="true">Varför föreskrifterna finns</h2>
    <span id="varfor1" class="section-sign">1&nbsp;§</span>
    <div class="paragraph">
      <p>Syftet med dessa föreskrifter.</p>
    </div>
    <div class="general-recommendation">
      <div class="h2">Allmänna råd</div>
      <div class="paragraph"><p>Det systematiska arbetsmiljöarbetet.</p></div>
    </div>
    <span id="varfor2" class="section-sign">2&nbsp;§</span>
    <div class="paragraph">
      <p>Dessa föreskrifter gäller:</p>
      <ol style="--start: " class="provisionlist liststyle-decimal listsuffix-.">
        <li><div class="paragraph"><p>den som genomgår utbildning,</p></div></li>
        <li><div class="paragraph"><p>den som tjänstgör.</p></div></li>
      </ol>
    </div>
    <span class="provisioncmsurl">
      <a href="/stod/" class="arrow">Stöd och verktyg: SAM</a>
    </span>
  </div>
  <div class="transitionalregulations">
    <h2>Övergångsbestämmelser</h2>
    <div class="paragraph"><p>Denna författning träder i kraft den 1 januari 2025.</p></div>
    <div class="paragraph"><p><span class="signature">ERNA ZELMIN</span></p></div>
  </div>
  <div id="appendices" class="appendices">
    <h2>Bilaga 1 Arbetstagare med uppgifter</h2>
    <div class="paragraph"><p>Arbetsgivaren ska se till.</p></div>
  </div>
</div></div>`

const CHAPTER_PROVISION_WITH_TABLE = `
<div class="document"><div class="root">
  <div id="rules" class="rules">
    <h2 id="avd1" data-menu="true">Avdelning 1 Gemensamma bestämmelser</h2>
    <h3 id="kap1" data-menu="true">1 kap. Allmänna bestämmelser</h3>
    <span id="kap1-1" class="section-sign">1&nbsp;§</span>
    <div class="paragraph"><p>Dessa föreskrifter gäller.</p></div>
    <h2 id="avd2" data-menu="true">Avdelning 2 Fysikaliska riskkällor</h2>
    <h3 id="kap2" data-menu="true">2 kap. Buller</h3>
    <span id="kap2-1" class="section-sign">1&nbsp;§</span>
    <div class="paragraph"><p>Arbetsgivaren ska undersöka bullerexponering.</p>
      <button class="provision__table provision__opendialog">Visa hela tabellen</button>
      <div class="provision__dialog-wrapper">
        <button class="provision__closedialog"></button>
        <div class="provision__dialog">
          <div class="provision__table-overlay"></div>
          <table class="provision__table">
            <thead><tr><th>Exponeringsvärde</th><th>Nivå</th></tr></thead>
            <tbody><tr><td>Undre insatsvärde</td><td>80 dB(A)</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  <div class="transitionalregulations">
    <h2>Övergångsbestämmelser</h2>
    <div class="paragraph"><p>Träder i kraft 1 jan 2025.</p></div>
  </div>
  <div id="appendices" class="appendices">
    <h2>Bilaga 1</h2>
    <div class="paragraph"><p>Bilaga content.</p></div>
    <h2>Bilaga 2</h2>
    <div class="paragraph"><p>Bilaga 2 content.</p></div>
  </div>
</div></div>`

const NESTED_LIST_PROVISION = `
<div class="document"><div class="root">
  <div id="rules" class="rules">
    <span id="p1" class="section-sign">1&nbsp;§</span>
    <div class="paragraph">
      <p>Uppgifterna ska avse:</p>
      <ol style="--start: " class="provisionlist liststyle-decimal listsuffix-.">
        <li><div class="paragraph"><p>arbetsuppgifterna,</p></div></li>
        <li><div class="paragraph"><p>organisationen, med uppdelning i</p>
          <ol style="--start: " class="provisionlist liststyle-lower-alpha listsuffix-)">
            <li><div class="paragraph"><p>ansvarsfördelning,</p></div></li>
            <li><div class="paragraph"><p>rutiner.</p></div></li>
          </ol>
        </div></li>
      </ol>
    </div>
  </div>
</div></div>`

const SCIENTIFIC_NOTATION_PROVISION = `
<div class="document"><div class="root">
  <div id="rules" class="rules">
    <span id="p1" class="section-sign">1&nbsp;§</span>
    <div class="paragraph">
      <p>Gränsvärdet för CO<sub>2</sub> är 5000 mg/m<sup>3</sup>.</p>
    </div>
  </div>
</div></div>`

// ============================================================================
// Tests
// ============================================================================

describe('afs-html-transformer', () => {
  describe('detectHeadingPattern', () => {
    it('detects flat pattern for standalone documents', () => {
      expect(detectHeadingPattern(makeDoc({ chapterCount: 1 }))).toBe('flat')
    })

    it('detects chapters-only pattern', () => {
      expect(
        detectHeadingPattern(
          makeDoc({ chapterCount: 9, hasAvdelningar: false })
        )
      ).toBe('chapters-only')
    })

    it('detects avdelningar-chapters pattern', () => {
      expect(
        detectHeadingPattern(
          makeDoc({ chapterCount: 13, hasAvdelningar: true })
        )
      ).toBe('avdelningar-chapters')
    })
  })

  describe('transformAfsHtml — flat document', () => {
    const doc = makeDoc()
    const result = transformAfsHtml(FLAT_PROVISION, doc)

    it('wraps output in article.sfs', () => {
      expect(result.html).toContain('<article class="sfs"')
      expect(result.html).toContain('</article>')
    })

    it('includes lovhead with document number and title', () => {
      expect(result.html).toContain('class="lovhead"')
      expect(result.html).toContain('AFS 2023:1')
      expect(result.html).toContain('Test Document')
    })

    it('transforms section signs to a.paragraf', () => {
      expect(result.html).toContain('<a class="paragraf"')
      expect(result.html).toContain('1 §')
      expect(result.html).toContain('2 §')
      expect(result.html).not.toContain('class="section-sign"')
    })

    it('counts section signs correctly', () => {
      expect(result.stats.sectionSignCount).toBe(2)
    })

    it('transforms Allmänna råd with correct class', () => {
      expect(result.html).toContain('class="allmanna-rad"')
      expect(result.html).toContain('allmanna-rad-heading')
      expect(result.html).toContain('Allmänna råd')
      expect(result.html).not.toContain('class="general-recommendation"')
    })

    it('counts Allmänna råd correctly', () => {
      expect(result.stats.allmanaRadCount).toBe(1)
    })

    it('transforms footnotes to superscript refs', () => {
      expect(result.html).toContain('<sup class="footnote-ref"')
      expect(result.html).toContain('data-note="1"')
      expect(result.html).toContain('title="')
      expect(result.html).not.toContain('provision__opendialog')
      expect(result.html).not.toContain('provision__dialog-wrapper')
      expect(result.html).not.toContain('provision__closedialog')
    })

    it('counts footnotes correctly', () => {
      expect(result.stats.footnoteCount).toBe(1)
    })

    it('strips CMS editorial links', () => {
      expect(result.html).not.toContain('provisioncmsurl')
      expect(result.html).not.toContain('Stöd och verktyg')
    })

    it('transforms decimal lists correctly', () => {
      expect(result.html).toContain('type="1"')
      expect(result.html).not.toContain('liststyle-decimal')
      expect(result.html).not.toContain('listsuffix-')
      expect(result.html).not.toContain('--start')
    })

    it('unwraps div.paragraph wrappers', () => {
      expect(result.html).not.toContain('class="paragraph"')
    })

    it('includes övergångsbestämmelser in footer.back', () => {
      expect(result.html).toContain('<footer class="back">')
      expect(result.html).toContain('Övergångsbestämmelser')
      expect(result.stats.hasOvergangsbestammelser).toBe(true)
    })

    it('transforms signatures', () => {
      expect(result.html).toContain('<strong>ERNA ZELMIN</strong>')
      expect(result.html).not.toContain('class="signature"')
    })

    it('includes appendices', () => {
      expect(result.html).toContain('class="appendices"')
      expect(result.html).toContain('Bilaga 1')
      expect(result.stats.bilagaCount).toBe(1)
    })

    it('includes preamble', () => {
      expect(result.html).toContain('class="preamble"')
    })
  })

  describe('transformAfsHtml — chapter document with tables', () => {
    const doc = makeDoc({
      documentNumber: 'AFS 2023:10',
      title: 'Risker i arbetsmiljön',
      tier: 'SPLIT',
      chapterCount: 13,
      hasAvdelningar: true,
    })
    const result = transformAfsHtml(CHAPTER_PROVISION_WITH_TABLE, doc)

    it('transforms tables from provision__table to legal-table', () => {
      expect(result.html).toContain('class="legal-table"')
      expect(result.html).not.toContain('provision__table')
    })

    it('counts tables', () => {
      expect(result.stats.tableCount).toBe(1)
    })

    it('preserves table structure', () => {
      expect(result.html).toContain('<thead>')
      expect(result.html).toContain('<th>Exponeringsvärde</th>')
      expect(result.html).toContain('80 dB(A)')
    })

    it('counts bilagor', () => {
      expect(result.stats.bilagaCount).toBe(2)
    })

    it('preserves heading hierarchy', () => {
      expect(result.html).toContain('Avdelning 1')
      expect(result.html).toContain('1 kap. Allmänna bestämmelser')
      expect(result.html).toContain('2 kap. Buller')
    })

    it('extracts tables from provision__dialog-wrapper overlays', () => {
      // av.se wraps tables inside dialog wrappers (same class as footnote popups)
      expect(result.html).not.toContain('provision__dialog-wrapper')
      expect(result.html).not.toContain('provision__dialog')
      expect(result.html).not.toContain('provision__table-overlay')
      expect(result.html).not.toContain('provision__closedialog')
      // "Visa hela tabellen" trigger buttons are stripped
      expect(result.html).not.toContain('Visa hela tabellen')
      expect(result.html).not.toContain('provision__opendialog')
      // But the table itself survives
      expect(result.html).toContain('class="legal-table"')
      expect(result.html).toContain('80 dB(A)')
    })
  })

  describe('transformAfsHtml — nested lists', () => {
    const doc = makeDoc()
    const result = transformAfsHtml(NESTED_LIST_PROVISION, doc)

    it('transforms decimal lists', () => {
      expect(result.html).toContain('type="1"')
    })

    it('transforms alpha lists', () => {
      expect(result.html).toContain('type="a"')
    })

    it('removes all av.se list classes', () => {
      expect(result.html).not.toContain('provisionlist')
      expect(result.html).not.toContain('liststyle-')
      expect(result.html).not.toContain('listsuffix-')
    })
  })

  describe('transformAfsHtml — scientific notation', () => {
    const doc = makeDoc()
    const result = transformAfsHtml(SCIENTIFIC_NOTATION_PROVISION, doc)

    it('preserves <sub> elements', () => {
      expect(result.html).toContain('CO<sub>2</sub>')
    })

    it('preserves <sup> elements (non-footnote)', () => {
      expect(result.html).toContain('m<sup>3</sup>')
    })
  })
})
