/**
 * Tests for Canonical HTML → JSON Parser
 * Story 14.1, Task 6 (AC: 23)
 */

import { describe, it, expect } from 'vitest'
import { parseCanonicalHtml } from '@/lib/transforms/canonical-html-parser'

// ============================================================================
// Test Fixtures
// ============================================================================

/** Chaptered SFS law (2-level hierarchy) */
const CHAPTERED_HTML = `<article class="legal-document" id="SFS1977-1160">
  <div class="lovhead">
    <h1>
      <p class="text">SFS 1977:1160</p>
      <p class="text">Arbetsmiljölag</p>
    </h1>
  </div>
  <div class="body">
    <section class="kapitel" id="SFS1977-1160_K1">
      <h2 class="kapitel-rubrik">1 kap. Lagens ändamål</h2>
      <h3 class="paragraph"><a class="paragraf" id="SFS1977-1160_K1_P1" name="SFS1977-1160_K1_P1">1 §</a></h3>
      <p class="text">Lagens ändamål är att förebygga ohälsa.</p>
      <p class="text">Lagen gäller även i övrigt.</p>
      <h3 class="paragraph"><a class="paragraf" id="SFS1977-1160_K1_P2" name="SFS1977-1160_K1_P2">2 §</a></h3>
      <p class="text">Denna lag gäller varje verksamhet.</p>
    </section>
    <section class="kapitel" id="SFS1977-1160_K2">
      <h2 class="kapitel-rubrik">2 kap. Arbetsmiljöns beskaffenhet</h2>
      <h3 class="paragraph"><a class="paragraf" id="SFS1977-1160_K2_P1" name="SFS1977-1160_K2_P1">1 §</a></h3>
      <p class="text">Arbetsmiljön ska vara tillfredsställande.</p>
      <div class="allmanna-rad">
        <p class="allmanna-rad-heading"><strong>Allmänna råd</strong></p>
        <p class="text">Vägledning för tillämpning.</p>
      </div>
    </section>
  </div>
  <footer class="back">
    <h2>Övergångsbestämmelser</h2>
    <p class="text">Denna lag träder i kraft den 1 januari 1978.</p>
  </footer>
</article>`

/** Flat document (no chapters) */
const FLAT_HTML = `<article class="legal-document" id="MSBFS2020-1">
  <div class="lovhead">
    <h1>
      <p class="text">MSBFS 2020:1</p>
      <p class="text">Föreskrifter om test</p>
    </h1>
  </div>
  <div class="body">
    <h3 class="paragraph"><a class="paragraf" id="MSBFS2020-1_P1" name="MSBFS2020-1_P1">1 §</a></h3>
    <p class="text">Denna föreskrift gäller.</p>
    <h3 class="paragraph"><a class="paragraf" id="MSBFS2020-1_P2" name="MSBFS2020-1_P2">2 §</a></h3>
    <p class="text">Definitioner i denna föreskrift.</p>
  </div>
</article>`

/** 3-level hierarchy with avdelningar */
const AVDELNING_HTML = `<article class="legal-document" id="AFS2023-10">
  <div class="lovhead">
    <h1>
      <p class="text">AFS 2023:10</p>
      <p class="text">Risker i arbetsmiljön</p>
    </h1>
  </div>
  <div class="body">
    <section class="avdelning" id="AFS2023-10_AVD1">
      <h2 class="avdelning-rubrik">Avdelning 1 Gemensamma bestämmelser</h2>
      <section class="kapitel" id="AFS2023-10_K1">
        <h3 class="kapitel-rubrik">1 kap. Allmänna bestämmelser</h3>
        <h3 class="paragraph"><a class="paragraf" id="AFS2023-10_K1_P1" name="AFS2023-10_K1_P1">1 §</a></h3>
        <p class="text">Dessa föreskrifter gäller.</p>
      </section>
    </section>
    <section class="avdelning" id="AFS2023-10_AVD2">
      <h2 class="avdelning-rubrik">Avdelning 2 Fysikaliska riskkällor</h2>
      <section class="kapitel" id="AFS2023-10_K2">
        <h3 class="kapitel-rubrik">2 kap. Buller</h3>
        <h3 class="paragraph"><a class="paragraf" id="AFS2023-10_K2_P1" name="AFS2023-10_K2_P1">1 §</a></h3>
        <p class="text">Arbetsgivaren ska undersöka.</p>
      </section>
    </section>
  </div>
</article>`

/** EU document with preamble */
const EU_HTML = `<article class="legal-document" id="eu-32016r0679">
  <div class="lovhead">
    <h1>
      <p class="text">(EU) 2016/679</p>
      <p class="text">GDPR</p>
    </h1>
  </div>
  <div class="preamble">
    <p>EUROPAPARLAMENTET HAR ANTAGIT DENNA FÖRORDNING</p>
  </div>
  <div class="body">
    <section class="kapitel" id="eu-32016r0679_K1">
      <h2 class="kapitel-rubrik">KAPITEL I — Allmänna bestämmelser</h2>
      <h3 class="paragraph"><a class="paragraf" id="eu-32016r0679_art1" name="eu-32016r0679_art1">Artikel 1 — <em>Syfte</em></a></h3>
      <p class="text">I denna förordning fastställs bestämmelser.</p>
    </section>
  </div>
</article>`

/** Document with table */
const TABLE_HTML = `<article class="legal-document" id="SFS2025-1">
  <div class="lovhead">
    <h1>
      <p class="text">SFS 2025:1</p>
      <p class="text">Testlag</p>
    </h1>
  </div>
  <div class="body">
    <h3 class="paragraph"><a class="paragraf" id="SFS2025-1_P1" name="SFS2025-1_P1">1 §</a></h3>
    <p class="text">Se tabellen:</p>
    <table class="legal-table"><thead><tr><th>Kolumn</th></tr></thead><tbody><tr><td>Värde</td></tr></tbody></table>
  </div>
</article>`

/** Document with appendices */
const APPENDIX_HTML = `<article class="legal-document" id="AFS2023-1">
  <div class="lovhead">
    <h1>
      <p class="text">AFS 2023:1</p>
      <p class="text">Test</p>
    </h1>
  </div>
  <div class="body">
    <h3 class="paragraph"><a class="paragraf" id="AFS2023-1_P1" name="AFS2023-1_P1">1 §</a></h3>
    <p class="text">Content.</p>
  </div>
  <div class="appendices">
    <h2>Bilaga 1 Arbetstagare</h2>
    <p>Bilaga content.</p>
  </div>
</article>`

// ============================================================================
// Tests
// ============================================================================

describe('parseCanonicalHtml', () => {
  describe('chaptered document', () => {
    const result = parseCanonicalHtml(CHAPTERED_HTML)

    it('extracts document number and title', () => {
      expect(result.documentNumber).toBe('SFS 1977:1160')
      expect(result.title).toBe('Arbetsmiljölag')
    })

    it('infers SFS_LAW document type', () => {
      expect(result.documentType).toBe('SFS_LAW')
    })

    it('extracts chapters', () => {
      expect(result.divisions).toBeNull()
      expect(result.chapters).toHaveLength(2)
      expect(result.chapters[0]!.number).toBe('1')
      expect(result.chapters[0]!.title).toBe('Lagens ändamål')
      expect(result.chapters[1]!.number).toBe('2')
    })

    it('extracts sections within chapters', () => {
      const ch1 = result.chapters[0]!
      expect(ch1.sections).toHaveLength(2)
      expect(ch1.sections[0]!.number).toBe('1')
      expect(ch1.sections[1]!.number).toBe('2')
    })

    it('extracts paragraphs from sections', () => {
      const sec1 = result.chapters[0]!.sections[0]!
      expect(sec1.paragraphs).toHaveLength(2)
      expect(sec1.paragraphs[0]!.text).toContain('förebygga ohälsa')
      expect(sec1.paragraphs[0]!.role).toBe('PARAGRAPH')
      expect(sec1.paragraphs[1]!.text).toContain('gäller även i övrigt')
    })

    it('extracts allmänna råd with correct role', () => {
      const ch2 = result.chapters[1]!
      const sec1 = ch2.sections[0]!
      const arParagraphs = sec1.paragraphs.filter(
        (p) => p.role === 'ALLMANT_RAD'
      )
      expect(arParagraphs.length).toBeGreaterThanOrEqual(1)
      expect(arParagraphs[0]!.text).toContain('Allmänna råd')
    })

    it('extracts transition provisions', () => {
      expect(result.transitionProvisions).not.toBeNull()
      expect(result.transitionProvisions![0]!.role).toBe('TRANSITION_PROVISION')
      expect(result.transitionProvisions![0]!.text).toContain('träder i kraft')
    })

    it('sets schema version', () => {
      expect(result.schemaVersion).toBe('1.0')
    })
  })

  describe('flat document (implicit chapter)', () => {
    const result = parseCanonicalHtml(FLAT_HTML)

    it('creates implicit chapter with null number', () => {
      expect(result.chapters).toHaveLength(1)
      expect(result.chapters[0]!.number).toBeNull()
      expect(result.chapters[0]!.title).toBeNull()
    })

    it('extracts flat sections', () => {
      const sections = result.chapters[0]!.sections
      expect(sections).toHaveLength(2)
      expect(sections[0]!.number).toBe('1')
      expect(sections[1]!.number).toBe('2')
    })

    it('infers AGENCY_REGULATION type from MSBFS prefix', () => {
      expect(result.documentType).toBe('AGENCY_REGULATION')
    })
  })

  describe('avdelningar (3-level hierarchy)', () => {
    const result = parseCanonicalHtml(AVDELNING_HTML)

    it('extracts divisions', () => {
      expect(result.divisions).not.toBeNull()
      expect(result.divisions).toHaveLength(2)
      expect(result.divisions![0]!.number).toBe('1')
      expect(result.divisions![0]!.title).toBe('Gemensamma bestämmelser')
    })

    it('has empty chapters when divisions is populated', () => {
      expect(result.chapters).toHaveLength(0)
    })

    it('nests chapters inside divisions', () => {
      const avd1 = result.divisions![0]!
      expect(avd1.chapters).toHaveLength(1)
      expect(avd1.chapters[0]!.number).toBe('1')
      expect(avd1.chapters[0]!.title).toBe('Allmänna bestämmelser')
    })

    it('extracts sections within division chapters', () => {
      const sec = result.divisions![0]!.chapters[0]!.sections[0]!
      expect(sec.number).toBe('1')
      expect(sec.paragraphs[0]!.text).toContain('föreskrifter gäller')
    })
  })

  describe('EU document with preamble', () => {
    const result = parseCanonicalHtml(EU_HTML)

    it('extracts preamble as opaque content', () => {
      expect(result.preamble).not.toBeNull()
      expect(result.preamble!.text).toContain('EUROPAPARLAMENTET')
    })

    it('infers EU_REGULATION type from eu- prefix', () => {
      expect(result.documentType).toBe('EU_REGULATION')
    })

    it('parses EU article numbers as artN', () => {
      const sec = result.chapters[0]!.sections[0]!
      expect(sec.number).toBe('art1')
    })

    it('extracts EU article subtitle as heading', () => {
      const sec = result.chapters[0]!.sections[0]!
      expect(sec.heading).toBe('Syfte')
    })
  })

  describe('table content', () => {
    const result = parseCanonicalHtml(TABLE_HTML)

    it('extracts table with TABLE role', () => {
      const sec = result.chapters[0]!.sections[0]!
      const tableParagraphs = sec.paragraphs.filter((p) => p.role === 'TABLE')
      expect(tableParagraphs).toHaveLength(1)
      expect(tableParagraphs[0]!.htmlContent).toContain('legal-table')
    })
  })

  describe('appendices', () => {
    const result = parseCanonicalHtml(APPENDIX_HTML)

    it('extracts appendices', () => {
      expect(result.appendices).not.toBeNull()
      expect(result.appendices).toHaveLength(1)
      expect(result.appendices![0]!.title).toContain('Bilaga 1')
    })
  })

  describe('empty / invalid input', () => {
    it('returns empty document for empty string', () => {
      const result = parseCanonicalHtml('')
      expect(result.chapters).toHaveLength(0)
      expect(result.title).toBeNull()
      expect(result.schemaVersion).toBe('1.0')
    })

    it('returns empty document for non-canonical HTML', () => {
      const result = parseCanonicalHtml('<div>Not a legal document</div>')
      expect(result.chapters).toHaveLength(0)
    })

    it('respects options override for document type', () => {
      const result = parseCanonicalHtml(FLAT_HTML, {
        documentType: 'SFS_AMENDMENT',
      })
      expect(result.documentType).toBe('SFS_AMENDMENT')
    })
  })
})
