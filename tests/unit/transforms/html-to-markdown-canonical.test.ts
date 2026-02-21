/**
 * Tests for HTML→Markdown with Canonical HTML input
 * Story 14.1, Task 8
 *
 * Verifies that the existing markdown converter produces correct output
 * for all canonical HTML structure patterns.
 */

import { describe, it, expect } from 'vitest'
import { htmlToMarkdown } from '@/lib/transforms/html-to-markdown'

// ============================================================================
// Canonical HTML Fixtures
// ============================================================================

const CHAPTERED_CANONICAL = `<article class="legal-document" id="SFS1977-1160">
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
    </section>
  </div>
  <footer class="back">
    <h2>Övergångsbestämmelser</h2>
    <p class="text">Denna lag träder i kraft den 1 januari 1978.</p>
  </footer>
</article>`

const FLAT_CANONICAL = `<article class="legal-document" id="MSBFS2020-1">
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

const AVDELNING_CANONICAL = `<article class="legal-document" id="AFS2023-10">
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
  </div>
</article>`

const ALLMANNA_RAD_CANONICAL = `<article class="legal-document" id="AFS2023-1">
  <div class="lovhead">
    <h1><p class="text">AFS 2023:1</p><p class="text">Test</p></h1>
  </div>
  <div class="body">
    <h3 class="paragraph"><a class="paragraf" id="AFS2023-1_P1" name="AFS2023-1_P1">1 §</a></h3>
    <p class="text">Arbetsgivaren ska.</p>
    <div class="allmanna-rad">
      <p class="allmanna-rad-heading"><strong>Allmänna råd</strong></p>
      <p class="text">Vägledning för tillämpning.</p>
    </div>
  </div>
</article>`

const TABLE_CANONICAL = `<article class="legal-document" id="SFS2025-1">
  <div class="lovhead">
    <h1><p class="text">SFS 2025:1</p><p class="text">Testlag</p></h1>
  </div>
  <div class="body">
    <h3 class="paragraph"><a class="paragraf" id="SFS2025-1_P1" name="SFS2025-1_P1">1 §</a></h3>
    <p class="text">Se tabellen:</p>
    <table class="legal-table"><thead><tr><th>Kolumn A</th><th>Kolumn B</th></tr></thead><tbody><tr><td>Rad 1A</td><td>Rad 1B</td></tr></tbody></table>
  </div>
</article>`

const EU_CANONICAL = `<article class="legal-document" id="eu-32016r0679">
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
      <h3 class="paragraph"><a class="paragraf" id="eu-32016r0679_art1" name="eu-32016r0679_art1">Artikel 1 — Syfte</a></h3>
      <p class="text">I denna förordning fastställs bestämmelser.</p>
    </section>
  </div>
</article>`

// ============================================================================
// Tests
// ============================================================================

describe('htmlToMarkdown — canonical HTML', () => {
  describe('chaptered document', () => {
    const md = htmlToMarkdown(CHAPTERED_CANONICAL)

    it('produces title as h1', () => {
      expect(md).toContain('# SFS 1977:1160')
    })

    it('produces chapter headings as h2', () => {
      expect(md).toContain('## 1 kap. Lagens ändamål')
      expect(md).toContain('## 2 kap. Arbetsmiljöns beskaffenhet')
    })

    it('produces section numbers as h3', () => {
      expect(md).toContain('### 1 §')
      expect(md).toContain('### 2 §')
    })

    it('includes paragraph text', () => {
      expect(md).toContain('Lagens ändamål är att förebygga ohälsa.')
      expect(md).toContain('Lagen gäller även i övrigt.')
    })

    it('includes transition provisions', () => {
      expect(md).toContain('## Övergångsbestämmelser')
      expect(md).toContain('Denna lag träder i kraft den 1 januari 1978.')
    })
  })

  describe('flat document', () => {
    const md = htmlToMarkdown(FLAT_CANONICAL)

    it('produces section headings', () => {
      expect(md).toContain('### 1 §')
      expect(md).toContain('### 2 §')
    })

    it('includes content', () => {
      expect(md).toContain('Denna föreskrift gäller.')
    })
  })

  describe('avdelningar (3-level)', () => {
    const md = htmlToMarkdown(AVDELNING_CANONICAL)

    it('produces avdelning heading as h2', () => {
      expect(md).toContain('## Avdelning 1 Gemensamma bestämmelser')
    })

    it('produces chapter heading', () => {
      // h3.kapitel-rubrik falls to default tag level = 3
      expect(md).toContain('### 1 kap. Allmänna bestämmelser')
    })

    it('produces section heading', () => {
      expect(md).toContain('### 1 §')
    })
  })

  describe('allmänna råd', () => {
    const md = htmlToMarkdown(ALLMANNA_RAD_CANONICAL)

    it('renders allmänna råd heading as bold', () => {
      expect(md).toContain('**Allmänna råd**')
    })

    it('includes råd text', () => {
      expect(md).toContain('Vägledning för tillämpning.')
    })
  })

  describe('tables', () => {
    const md = htmlToMarkdown(TABLE_CANONICAL)

    it('renders markdown table', () => {
      expect(md).toContain('| Kolumn A | Kolumn B |')
      expect(md).toContain('| --- | --- |')
      expect(md).toContain('| Rad 1A | Rad 1B |')
    })
  })

  describe('EU document with preamble', () => {
    const md = htmlToMarkdown(EU_CANONICAL)

    it('includes preamble text', () => {
      expect(md).toContain('EUROPAPARLAMENTET HAR ANTAGIT DENNA FÖRORDNING')
    })

    it('includes article heading', () => {
      expect(md).toContain('### Artikel 1 — Syfte')
    })

    it('includes article text', () => {
      expect(md).toContain('I denna förordning fastställs bestämmelser.')
    })
  })
})
