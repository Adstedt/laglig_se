import { describe, it, expect } from 'vitest'
import {
  transformEuHtml,
  detectStructure,
  type EuDocumentInfo,
} from '@/lib/eu/eu-html-transformer'
import * as cheerio from 'cheerio'

// ============================================================================
// Test fixtures
// ============================================================================

const GDPR_DOC: EuDocumentInfo = {
  celex: '32016R0679',
  documentNumber: '(EU) 2016/679',
  shortTitle: 'Allmän dataskyddsförordning (GDPR)',
}

const SIMPLE_DOC: EuDocumentInfo = {
  celex: '32006R0166',
  documentNumber: '(EG) nr 166/2006',
  shortTitle: 'E-PRTR-förordningen',
}

/** Chaptered HTML fixture (like GDPR) with chapters and articles */
const CHAPTERED_HTML = `
<div class="eli-container">
  <table><tr><td>Europeiska unionens officiella tidning L 119/1</td></tr></table>
  <hr class="oj-separator">
  <div class="eli-main-title" id="tit_1">
    <p class="oj-doc-ti">EUROPAPARLAMENTETS OCH RÅDETS FÖRORDNING (EU) 2016/679</p>
  </div>
  <div class="eli-subdivision" id="pbl_1">
    <p class="oj-normal">EUROPAPARLAMENTET OCH EUROPEISKA UNIONENS RÅD HAR ANTAGIT DENNA FÖRORDNING</p>
    <div class="eli-subdivision" id="cit_1">
      <p class="oj-normal">med beaktande av fördraget om Europeiska unionens funktionssätt,</p>
    </div>
    <div class="eli-subdivision" id="rct_1">
      <p class="oj-normal">(1) Skyddet för fysiska personer...</p>
    </div>
    <div class="eli-subdivision" id="rct_2">
      <p class="oj-normal">(2) Principerna för och reglerna om skydd...</p>
    </div>
  </div>
  <div class="eli-subdivision" id="chp_I">
    <p class="oj-ti-grseq-1">KAPITEL I</p>
    <p class="oj-sti-grseq-1">Allmänna bestämmelser</p>
    <div class="eli-subdivision" id="art_1">
      <p class="oj-ti-art">Artikel 1</p>
      <p class="oj-sti-art">Syfte</p>
      <div class="eli-subdivision" id="art_1.par_1">
        <p class="oj-normal">1. I denna förordning fastställs bestämmelser om skydd för fysiska personer.</p>
      </div>
      <div class="eli-subdivision" id="art_1.par_2">
        <p class="oj-normal">2. Denna förordning skyddar grundläggande rättigheter och friheter.</p>
      </div>
    </div>
    <div class="eli-subdivision" id="art_2">
      <p class="oj-ti-art">Artikel 2</p>
      <p class="oj-sti-art">Tillämpningsområde</p>
      <div class="eli-subdivision" id="art_2.par_1">
        <p class="oj-normal">1. Denna förordning ska tillämpas på behandling av personuppgifter.</p>
      </div>
    </div>
  </div>
  <div class="eli-subdivision" id="chp_II">
    <p class="oj-ti-grseq-1">KAPITEL II</p>
    <p class="oj-sti-grseq-1">Principer</p>
    <div class="eli-subdivision" id="art_5">
      <p class="oj-ti-art">Artikel 5</p>
      <p class="oj-sti-art">Principer för behandling av personuppgifter</p>
      <div class="eli-subdivision" id="art_5.par_1">
        <p class="oj-normal">1. Personuppgifter ska behandlas på ett lagligt, korrekt och öppet sätt.</p>
      </div>
    </div>
  </div>
</div>
`

/** Flat HTML fixture (articles without chapters) */
const FLAT_HTML = `
<div class="eli-container">
  <div class="eli-main-title" id="tit_1">
    <p class="oj-doc-ti">EUROPAPARLAMENTETS OCH RÅDETS FÖRORDNING (EG) nr 166/2006</p>
  </div>
  <div class="eli-subdivision" id="pbl_1">
    <p class="oj-normal">EUROPAPARLAMENTET OCH EUROPEISKA UNIONENS RÅD HAR ANTAGIT DENNA FÖRORDNING</p>
    <div class="eli-subdivision" id="rct_1">
      <p class="oj-normal">(1) Sjätte miljöhandlingsprogrammet...</p>
    </div>
  </div>
  <div class="eli-subdivision" id="art_1">
    <p class="oj-ti-art">Artikel 1</p>
    <p class="oj-sti-art">Syfte</p>
    <div class="eli-subdivision" id="art_1.par_1">
      <p class="oj-normal">1. Genom denna förordning inrättas ett europeiskt register.</p>
    </div>
  </div>
  <div class="eli-subdivision" id="art_2">
    <p class="oj-ti-art">Artikel 2</p>
    <p class="oj-sti-art">Tillämpningsområde</p>
    <div class="eli-subdivision" id="art_2.par_1">
      <p class="oj-normal">1. Denna förordning ska tillämpas på utsläpp.</p>
    </div>
  </div>
  <div class="eli-subdivision" id="art_3">
    <p class="oj-ti-art">Artikel 3</p>
    <p class="oj-sti-art">Definitioner</p>
    <p class="oj-normal">I denna förordning avses med...</p>
  </div>
</div>
`

/** Minimal HTML fixture (no eli-subdivision structure) */
const MINIMAL_HTML = `
<div class="eli-container">
  <div class="eli-main-title" id="tit_1">
    <p class="oj-doc-ti">KOMMISSIONENS FÖRORDNING</p>
  </div>
  <p class="oj-normal">EUROPEISKA KOMMISSIONEN HAR ANTAGIT DENNA FÖRORDNING</p>
  <p class="oj-normal">med beaktande av fördraget...</p>
  <p class="oj-normal">Denna förordning träder i kraft.</p>
</div>
`

/** Fixture with footnotes */
const FOOTNOTE_HTML = `
<div class="eli-container">
  <div class="eli-subdivision" id="art_1">
    <p class="oj-ti-art">Artikel 1</p>
    <p class="oj-normal">Text med fotnot <span class="oj-super oj-note-tag">(1)</span> och ännu en <a class="oj-note-tag" href="#ntr2">(2)</a>.</p>
  </div>
  <div class="eli-subdivision" id="art_2">
    <p class="oj-ti-art">Artikel 2</p>
    <p class="oj-normal">Mer text här.</p>
  </div>
  <div class="oj-final">
    <p>(1) Fotnot ett med text.</p>
    <p>(2) Fotnot två med text.</p>
  </div>
</div>
`

/** Fixture with a table */
const TABLE_HTML = `
<div class="eli-container">
  <div class="eli-subdivision" id="art_1">
    <p class="oj-ti-art">Artikel 1</p>
    <table>
      <thead><tr><th>Kolumn A</th><th>Kolumn B</th></tr></thead>
      <tbody><tr><td>Data 1</td><td>Data 2</td></tr></tbody>
    </table>
  </div>
  <div class="eli-subdivision" id="art_2">
    <p class="oj-ti-art">Artikel 2</p>
    <p class="oj-normal">Mer text.</p>
  </div>
</div>
`

// ============================================================================
// Tests
// ============================================================================

describe('EU HTML Transformer', () => {
  describe('detectStructure', () => {
    it('detects chaptered structure (chp_* elements)', () => {
      const $ = cheerio.load(CHAPTERED_HTML)
      expect(detectStructure($)).toBe('chaptered')
    })

    it('detects flat structure (art_* only)', () => {
      const $ = cheerio.load(FLAT_HTML)
      expect(detectStructure($)).toBe('flat')
    })

    it('detects minimal structure (no subdivisions)', () => {
      const $ = cheerio.load(MINIMAL_HTML)
      expect(detectStructure($)).toBe('minimal')
    })
  })

  describe('OJ header stripping', () => {
    it('removes OJ reference table and separator', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).not.toContain('officiella tidning')
      expect(result.html).not.toContain('oj-separator')
    })

    it('preserves document content after stripping', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).toContain('Allmänna bestämmelser')
      expect(result.html).toContain('Artikel 1')
    })
  })

  describe('Chapter transformation (chaptered docs)', () => {
    it('wraps chapters in section.kapitel with correct IDs', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).toContain('<section class="kapitel" id="chp-i">')
      expect(result.html).toContain('<section class="kapitel" id="chp-ii">')
    })

    it('creates h2 for chapter headings with title + subtitle', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).toContain(
        '<h2>KAPITEL I — Allmänna bestämmelser</h2>'
      )
      expect(result.html).toContain('<h2>KAPITEL II — Principer</h2>')
    })

    it('creates h3 with IDs for articles', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).toContain('<h3 id="art-1">')
      expect(result.html).toContain('<h3 id="art-2">')
      expect(result.html).toContain('<h3 id="art-5">')
    })

    it('counts chapters and articles correctly', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.stats.chapterCount).toBe(2)
      expect(result.stats.articleCount).toBe(3)
    })

    it('returns chaptered structure type', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.structureType).toBe('chaptered')
    })
  })

  describe('Article subtitles', () => {
    it('renders subtitles as em after article heading', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).toContain('Artikel 1 — <em>Syfte</em>')
      expect(result.html).toContain('Artikel 2 — <em>Tillämpningsområde</em>')
    })
  })

  describe('Flat document transformation', () => {
    it('uses a.paragraf anchors for articles', () => {
      const result = transformEuHtml(FLAT_HTML, SIMPLE_DOC)
      expect(result.html).toContain('<a class="paragraf" id="art-1"')
      expect(result.html).toContain('<a class="paragraf" id="art-2"')
      expect(result.html).toContain('<a class="paragraf" id="art-3"')
    })

    it('includes subtitle in anchor label', () => {
      const result = transformEuHtml(FLAT_HTML, SIMPLE_DOC)
      expect(result.html).toContain('Artikel 1 — Syfte')
    })

    it('returns flat structure type', () => {
      const result = transformEuHtml(FLAT_HTML, SIMPLE_DOC)
      expect(result.structureType).toBe('flat')
    })

    it('counts articles correctly', () => {
      const result = transformEuHtml(FLAT_HTML, SIMPLE_DOC)
      expect(result.stats.articleCount).toBe(3)
      expect(result.stats.chapterCount).toBe(0)
    })
  })

  describe('Preamble extraction', () => {
    it('wraps preamble in details.preamble-accordion > div.preamble', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      const $ = cheerio.load(result.html)
      const accordion = $('details.preamble-accordion')
      expect(accordion.length).toBe(1)
      expect(accordion.find('> summary').text()).toBe('Inledning och skäl')
      expect(accordion.find('> div.preamble').length).toBe(1)
    })

    it('includes preamble text', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).toContain(
        'EUROPAPARLAMENTET OCH EUROPEISKA UNIONENS RÅD HAR ANTAGIT'
      )
    })

    it('counts recitals', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.stats.recitalCount).toBe(2)
    })
  })

  describe('Footnote conversion', () => {
    it('converts oj-note-tag spans to sup.footnote-ref', () => {
      const result = transformEuHtml(FOOTNOTE_HTML, SIMPLE_DOC)
      expect(result.html).toContain('<sup class="footnote-ref" data-note="1"')
      expect(result.html).toContain('<sup class="footnote-ref" data-note="2"')
    })

    it('includes footnote text in title attribute', () => {
      const result = transformEuHtml(FOOTNOTE_HTML, SIMPLE_DOC)
      expect(result.html).toContain('title="Fotnot ett med text."')
    })

    it('counts footnotes correctly', () => {
      const result = transformEuHtml(FOOTNOTE_HTML, SIMPLE_DOC)
      expect(result.stats.footnoteCount).toBe(2)
    })
  })

  describe('Table transformation', () => {
    it('adds legal-table class to tables', () => {
      const result = transformEuHtml(TABLE_HTML, SIMPLE_DOC)
      expect(result.html).toContain('class="legal-table"')
    })

    it('counts tables correctly', () => {
      const result = transformEuHtml(TABLE_HTML, SIMPLE_DOC)
      expect(result.stats.tableCount).toBe(1)
    })

    it('preserves table content', () => {
      const result = transformEuHtml(TABLE_HTML, SIMPLE_DOC)
      expect(result.html).toContain('Kolumn A')
      expect(result.html).toContain('Data 1')
    })
  })

  describe('Document assembly', () => {
    it('wraps output in article.sfs with correct ID', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).toContain('<article class="sfs" id="eu-32016r0679">')
      expect(result.html).toContain('</article>')
    })

    it('includes lovhead with document number and short title', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).toContain('<div class="lovhead">')
      expect(result.html).toContain('(EU) 2016/679')
      expect(result.html).toContain('Allmän dataskyddsförordning (GDPR)')
    })

    it('wraps body content in div.body', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).toContain('<div class="body">')
    })

    it('has correct nesting: article > lovhead + preamble-accordion + body', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      const $ = cheerio.load(result.html)

      const article = $('article.sfs')
      expect(article.length).toBe(1)

      const lovhead = article.find('> div.lovhead')
      expect(lovhead.length).toBe(1)

      const accordion = article.find('> details.preamble-accordion')
      expect(accordion.length).toBe(1)
      expect(accordion.find('> div.preamble').length).toBe(1)

      const body = article.find('> div.body')
      expect(body.length).toBe(1)
    })
  })

  describe('Class cleanup', () => {
    it('removes oj-* classes from output', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).not.toMatch(/class="[^"]*oj-/)
    })

    it('removes eli-* classes from output', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).not.toMatch(/class="[^"]*eli-/)
    })

    it('preserves our added classes (kapitel, legal-table, etc)', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).toContain('class="kapitel"')

      const tableResult = transformEuHtml(TABLE_HTML, SIMPLE_DOC)
      expect(tableResult.html).toContain('class="legal-table"')
    })
  })

  describe('Minimal structure', () => {
    it('returns minimal structure type', () => {
      const result = transformEuHtml(MINIMAL_HTML, SIMPLE_DOC)
      expect(result.structureType).toBe('minimal')
    })

    it('still wraps in article.sfs', () => {
      const result = transformEuHtml(MINIMAL_HTML, SIMPLE_DOC)
      expect(result.html).toContain('<article class="sfs"')
    })

    it('preserves body text', () => {
      const result = transformEuHtml(MINIMAL_HTML, SIMPLE_DOC)
      expect(result.html).toContain('EUROPEISKA KOMMISSIONEN HAR ANTAGIT')
    })
  })

  describe('Real CELLAR cpt_* pattern', () => {
    /** Fixture matching the actual CELLAR HTML structure (cpt_*, oj-ti-section-*) */
    const CELLAR_CHAPTERED_HTML = `
<div class="eli-container">
  <div class="eli-subdivision" id="pbl_1">
    <p class="oj-normal">HAR ANTAGIT DENNA FÖRORDNING</p>
  </div>
  <div class="eli-subdivision" id="enc_1">
    <div id="cpt_I">
      <p class="oj-ti-section-1"><span class="oj-italic">KAPITEL I</span></p>
      <div class="eli-title" id="cpt_I.tit_1">
        <p class="oj-ti-section-2"><span class="oj-bold"><span class="oj-italic">Allmänna bestämmelser</span></span></p>
      </div>
      <div class="eli-subdivision" id="art_1">
        <p class="oj-ti-art">Artikel 1</p>
        <p class="oj-sti-art">Syfte</p>
        <p class="oj-normal">Text i artikel 1.</p>
      </div>
    </div>
    <div id="cpt_II">
      <p class="oj-ti-section-1"><span class="oj-italic">KAPITEL II</span></p>
      <div class="eli-title" id="cpt_II.tit_1">
        <p class="oj-ti-section-2"><span class="oj-bold"><span class="oj-italic">Principer</span></span></p>
      </div>
      <div class="eli-subdivision" id="art_5">
        <p class="oj-ti-art">Artikel 5</p>
        <p class="oj-normal">Text i artikel 5.</p>
      </div>
    </div>
  </div>
</div>`

    it('detects chaptered structure from cpt_* IDs', () => {
      const $ = cheerio.load(CELLAR_CHAPTERED_HTML)
      expect(detectStructure($)).toBe('chaptered')
    })

    it('extracts chapters and articles from cpt_* structure', () => {
      const result = transformEuHtml(CELLAR_CHAPTERED_HTML, GDPR_DOC)
      expect(result.structureType).toBe('chaptered')
      expect(result.stats.chapterCount).toBe(2)
      expect(result.stats.articleCount).toBe(2)
    })

    it('creates section.kapitel with chp-* IDs from cpt_* source', () => {
      const result = transformEuHtml(CELLAR_CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).toContain('id="chp-i"')
      expect(result.html).toContain('id="chp-ii"')
    })

    it('extracts chapter headings from oj-ti-section-1 and oj-ti-section-2', () => {
      const result = transformEuHtml(CELLAR_CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).toContain('KAPITEL I')
      expect(result.html).toContain('Allmänna bestämmelser')
      expect(result.html).toContain('KAPITEL II')
      expect(result.html).toContain('Principer')
    })
  })

  describe('Recital layout table removal', () => {
    const RECITAL_TABLE_HTML = `
<div class="eli-container">
  <div class="eli-subdivision" id="pbl_1">
    <div class="eli-subdivision" id="rct_1">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <colgroup><col width="4%"><col width="96%"></colgroup>
        <tbody><tr>
          <td valign="top"><p class="oj-normal">(1)</p></td>
          <td valign="top"><p class="oj-normal">Recital text here.</p></td>
        </tr></tbody>
      </table>
    </div>
  </div>
  <div class="eli-subdivision" id="art_1">
    <p class="oj-ti-art">Artikel 1</p>
    <p class="oj-normal">Article text.</p>
  </div>
  <div class="eli-subdivision" id="art_2">
    <p class="oj-ti-art">Artikel 2</p>
    <table><thead><tr><th>Real data</th></tr></thead><tbody><tr><td>Value</td></tr></tbody></table>
  </div>
</div>`

    it('removes layout tables from recitals (4%/96% pattern)', () => {
      const result = transformEuHtml(RECITAL_TABLE_HTML, SIMPLE_DOC)
      // Recital table should be removed, real table should remain
      expect(result.stats.tableCount).toBe(1)
    })

    it('preserves recital text content after removing layout table', () => {
      const result = transformEuHtml(RECITAL_TABLE_HTML, SIMPLE_DOC)
      expect(result.html).toContain('Recital text here')
    })
  })

  describe('Article body content', () => {
    it('includes numbered paragraph text', () => {
      const result = transformEuHtml(CHAPTERED_HTML, GDPR_DOC)
      expect(result.html).toContain(
        'I denna förordning fastställs bestämmelser om skydd'
      )
      expect(result.html).toContain(
        'Denna förordning skyddar grundläggande rättigheter'
      )
    })

    it('includes article body for flat docs', () => {
      const result = transformEuHtml(FLAT_HTML, SIMPLE_DOC)
      expect(result.html).toContain(
        'Genom denna förordning inrättas ett europeiskt register'
      )
    })
  })
})
