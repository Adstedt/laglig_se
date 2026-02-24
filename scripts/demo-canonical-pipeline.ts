#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Demo: Canonical HTML Pipeline
 *
 * Shows the full pipeline output for each document type:
 *   1. Input HTML (raw/pre-existing)
 *   2. Normalized canonical HTML (after normalizer)
 *   3. Derived JSON (from canonical parser)
 *   4. Derived Markdown (from markdown converter)
 *
 * Usage:
 *   npx tsx scripts/demo-canonical-pipeline.ts
 *   npx tsx scripts/demo-canonical-pipeline.ts --type sfs-law
 *   npx tsx scripts/demo-canonical-pipeline.ts --type afs
 *   npx tsx scripts/demo-canonical-pipeline.ts --type eu
 *   npx tsx scripts/demo-canonical-pipeline.ts --type amendment
 *   npx tsx scripts/demo-canonical-pipeline.ts --type flat
 */

import { normalizeSfsLaw } from '../lib/transforms/normalizers/sfs-law-normalizer'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import { validateCanonicalJson } from '../lib/transforms/validate-document-json'
import { htmlToMarkdown } from '../lib/transforms/html-to-markdown'

// ============================================================================
// Sample inputs — representative of real DB content
// ============================================================================

/** SFS Law — Riksdag API format (pre-normalization) */
const SFS_LAW_RAW = `<h3><a name="K1">1 kap.</a> Lagens ändamål och tillämpningsområde</h3>
<a class="paragraf" name="K1P1"><b>1 §</b></a>
<p>Lagens ändamål är att förebygga ohälsa och olycksfall i arbetet samt att även i övrigt uppnå en god arbetsmiljö.</p>
<a class="paragraf" name="K1P2"><b>2 §</b></a>
<p>Denna lag gäller varje verksamhet i vilken arbetstagare utför arbete för arbetsgivares räkning.</p>
<h3><a name="K2">2 kap.</a> Arbetsmiljöns beskaffenhet</h3>
<a class="paragraf" name="K2P1"><b>1 §</b></a>
<p>Arbetsmiljön skall vara tillfredsställande med hänsyn till arbetets natur och den sociala och tekniska utvecklingen i samhället.</p>
<a name="overgang"></a>
<b>Övergångsbestämmelser</b>
<p>Denna lag träder i kraft den 1 juli 1978.</p>
<p>Genom denna lag upphävs arbetarskyddslagen (1949:1).</p>`

/** SFS Amendment — already canonical (from Claude LLM) */
const SFS_AMENDMENT_CANONICAL = `<article class="legal-document" id="SFS2025-145">
  <div class="lovhead">
    <h1>
      <p class="text">SFS 2025:145</p>
      <p class="text">Lag om ändring i arbetsmiljölagen (1977:1160)</p>
    </h1>
  </div>
  <div class="body">
    <section class="kapitel" id="SFS2025-145_K1">
      <h2 class="kapitel-rubrik">1 kap.</h2>
      <h3 class="paragraph"><a class="paragraf" id="SFS2025-145_K1_P3" name="SFS2025-145_K1_P3">3 §</a></h3>
      <p class="text">Med arbetstagare likställs i denna lag den som genomgår utbildning.</p>
      <p class="text">Den som fullgör uppgift under sådana förhållanden likställs med arbetstagare.</p>
    </section>
  </div>
  <footer class="back">
    <h2>Övergångsbestämmelser</h2>
    <p class="text">Denna lag träder i kraft den 1 april 2025.</p>
  </footer>
</article>`

/** AFS regulation — post-transformer canonical output */
const AFS_CANONICAL = `<article class="legal-document" id="AFS2023-2">
  <div class="lovhead">
    <h1>
      <p class="text">AFS 2023:2</p>
      <p class="text">Arbetsplatsens utformning</p>
    </h1>
  </div>
  <div class="body">
    <section class="kapitel" id="AFS2023-2_K1">
      <h2 class="kapitel-rubrik">1 kap. Allmänna bestämmelser</h2>
      <h3 class="paragraph"><a class="paragraf" id="AFS2023-2_K1_P1" name="AFS2023-2_K1_P1">1 §</a></h3>
      <p class="text">Dessa föreskrifter gäller utformning av arbetsplatser.</p>
      <h3 class="paragraph"><a class="paragraf" id="AFS2023-2_K1_P2" name="AFS2023-2_K1_P2">2 §</a></h3>
      <p class="text">I dessa föreskrifter avses med</p>
      <p class="text"><em>arbetsplats</em>: varje plats, i eller utomhus, där arbete utförs,</p>
      <p class="text"><em>arbetsrum</em>: utrymme som arbetstagare vistas i mer än tillfälligt.</p>
      <div class="allmanna-rad">
        <p class="allmanna-rad-heading"><strong>Allmänna råd</strong></p>
        <p class="text">Till arbetsplats räknas hela det område som arbetstagaren har tillträde till.</p>
      </div>
    </section>
    <section class="kapitel" id="AFS2023-2_K2">
      <h2 class="kapitel-rubrik">2 kap. Arbetsplatsens utformning</h2>
      <h3 class="paragraph"><a class="paragraf" id="AFS2023-2_K2_P1" name="AFS2023-2_K2_P1">1 §</a></h3>
      <p class="text">Arbetsplatser ska ha en med hänsyn till verksamheten tillräcklig area och fri höjd.</p>
      <table class="legal-table">
        <thead><tr><th>Typ av arbete</th><th>Minsta fri höjd (m)</th></tr></thead>
        <tbody>
          <tr><td>Kontorsarbete</td><td>2,7</td></tr>
          <tr><td>Industriarbete</td><td>3,0</td></tr>
        </tbody>
      </table>
    </section>
  </div>
</article>`

/** EU regulation — post-transformer canonical output */
const EU_CANONICAL = `<article class="legal-document" id="eu-32016r0679">
  <div class="lovhead">
    <h1>
      <p class="text">(EU) 2016/679</p>
      <p class="text">Europaparlamentets och rådets förordning (EU) 2016/679 (dataskyddsförordningen)</p>
    </h1>
  </div>
  <div class="preamble">
    <p>EUROPAPARLAMENTET OCH EUROPEISKA UNIONENS RÅD HAR ANTAGIT DENNA FÖRORDNING</p>
    <p>med beaktande av fördraget om Europeiska unionens funktionssätt, särskilt artikel 16,</p>
    <p>med beaktande av Europeiska kommissionens förslag,</p>
  </div>
  <div class="body">
    <section class="kapitel" id="eu-32016r0679_K1">
      <h2 class="kapitel-rubrik">KAPITEL I — Allmänna bestämmelser</h2>
      <h3 class="paragraph"><a class="paragraf" id="eu-32016r0679_art1" name="eu-32016r0679_art1">Artikel 1 — <em>Syfte</em></a></h3>
      <p class="text">1. I denna förordning fastställs bestämmelser om skydd för fysiska personer med avseende på behandlingen av personuppgifter.</p>
      <p class="text">2. Denna förordning skyddar fysiska personers grundläggande rättigheter och friheter.</p>
      <h3 class="paragraph"><a class="paragraf" id="eu-32016r0679_art2" name="eu-32016r0679_art2">Artikel 2 — <em>Materiellt tillämpningsområde</em></a></h3>
      <p class="text">1. Denna förordning ska tillämpas på sådan behandling av personuppgifter som helt eller delvis företas på automatisk väg.</p>
    </section>
    <section class="kapitel" id="eu-32016r0679_K2">
      <h2 class="kapitel-rubrik">KAPITEL II — Principer</h2>
      <h3 class="paragraph"><a class="paragraf" id="eu-32016r0679_art5" name="eu-32016r0679_art5">Artikel 5 — <em>Principer för behandling</em></a></h3>
      <p class="text">1. Personuppgifter ska behandlas på ett lagligt, korrekt och öppet sätt i förhållande till den registrerade.</p>
    </section>
  </div>
</article>`

/** Flat agency regulation — no chapters */
const FLAT_CANONICAL = `<article class="legal-document" id="MSBFS2020-7">
  <div class="lovhead">
    <h1>
      <p class="text">MSBFS 2020:7</p>
      <p class="text">Föreskrifter om informationssäkerhet för statliga myndigheter</p>
    </h1>
  </div>
  <div class="body">
    <h3 class="paragraph"><a class="paragraf" id="MSBFS2020-7_P1" name="MSBFS2020-7_P1">1 §</a></h3>
    <p class="text">Dessa föreskrifter innehåller bestämmelser om informationssäkerhet.</p>
    <h3 class="paragraph"><a class="paragraf" id="MSBFS2020-7_P2" name="MSBFS2020-7_P2">2 §</a></h3>
    <p class="text">Föreskrifterna gäller för statliga myndigheter under regeringen.</p>
    <h3 class="paragraph"><a class="paragraf" id="MSBFS2020-7_P3" name="MSBFS2020-7_P3">3 §</a></h3>
    <p class="text">Myndigheten ska bedriva ett systematiskt och riskbaserat informationssäkerhetsarbete.</p>
  </div>
</article>`

// ============================================================================
// Demo runner
// ============================================================================

const DIVIDER = '─'.repeat(72)
const SECTION = '═'.repeat(72)

function demo(label: string, inputHtml: string, normalize?: () => string) {
  console.log(`\n${SECTION}`)
  console.log(`  ${label}`)
  console.log(SECTION)

  // Step 1: Normalize (if applicable)
  let canonicalHtml: string
  if (normalize) {
    canonicalHtml = normalize()
    console.log(`\n${DIVIDER}`)
    console.log('  STEP 1: Normalized Canonical HTML')
    console.log(DIVIDER)
    console.log(canonicalHtml.slice(0, 1500))
    if (canonicalHtml.length > 1500)
      console.log(`  ... (${canonicalHtml.length} chars total)`)
  } else {
    canonicalHtml = inputHtml
    console.log(`\n${DIVIDER}`)
    console.log('  INPUT: Already Canonical HTML')
    console.log(DIVIDER)
    console.log(canonicalHtml.slice(0, 1000))
    if (canonicalHtml.length > 1000)
      console.log(`  ... (${canonicalHtml.length} chars total)`)
  }

  // Step 2: Parse → JSON
  const json = parseCanonicalHtml(canonicalHtml)
  const validation = validateCanonicalJson(json)

  console.log(`\n${DIVIDER}`)
  console.log(`  STEP 2: Derived JSON (valid: ${validation.valid})`)
  console.log(DIVIDER)
  console.log(JSON.stringify(json, null, 2).slice(0, 2000))
  if (JSON.stringify(json).length > 2000)
    console.log(`  ... (${JSON.stringify(json).length} chars total)`)

  if (!validation.valid) {
    console.log('\n  VALIDATION ERRORS:')
    for (const err of validation.errors) {
      console.log(`    - ${err}`)
    }
  }

  // Step 3: Derive Markdown
  const markdown = htmlToMarkdown(canonicalHtml)

  console.log(`\n${DIVIDER}`)
  console.log('  STEP 3: Derived Markdown')
  console.log(DIVIDER)
  console.log(markdown.slice(0, 1000))
  if (markdown.length > 1000)
    console.log(`  ... (${markdown.length} chars total)`)

  // Summary
  console.log(`\n${DIVIDER}`)
  console.log('  Summary')
  console.log(DIVIDER)
  console.log(`  Document: ${json.documentNumber} — ${json.title}`)
  console.log(`  Type: ${json.documentType}`)
  console.log(`  Schema: ${json.schemaVersion}`)
  console.log(`  Divisions: ${json.divisions?.length ?? 'null'}`)
  console.log(`  Chapters: ${json.chapters.length}`)
  const sectionCount = [
    ...(json.divisions?.flatMap((d) => d.chapters) ?? []),
    ...json.chapters,
  ].reduce((sum, ch) => sum + ch.sections.length, 0)
  console.log(`  Sections: ${sectionCount}`)
  console.log(`  Preamble: ${json.preamble ? 'yes' : 'no'}`)
  console.log(`  Transitions: ${json.transitionProvisions?.length ?? 'none'}`)
  console.log(`  Appendices: ${json.appendices?.length ?? 'none'}`)
  console.log(`  Validation: ${validation.valid ? 'PASS' : 'FAIL'}`)
  console.log(`  HTML size: ${canonicalHtml.length} chars`)
  console.log(`  JSON size: ${JSON.stringify(json).length} chars`)
  console.log(`  Markdown size: ${markdown.length} chars`)
}

// ============================================================================
// Main
// ============================================================================

const typeFilter = process.argv.find((a) => a === '--type')
  ? process.argv[process.argv.indexOf('--type') + 1]
  : null

const demos: [string, string, (() => string) | undefined][] = [
  [
    'SFS LAW (Riksdag API → normalized)',
    SFS_LAW_RAW,
    () =>
      normalizeSfsLaw(SFS_LAW_RAW, {
        documentNumber: 'SFS 1977:1160',
        title: 'Arbetsmiljölag',
      }),
  ],
  ['SFS AMENDMENT (already canonical)', SFS_AMENDMENT_CANONICAL, undefined],
  [
    'AFS AGENCY REGULATION (chaptered + allmänna råd + table)',
    AFS_CANONICAL,
    undefined,
  ],
  ['EU REGULATION (chaptered + preamble)', EU_CANONICAL, undefined],
  ['FLAT AGENCY REGULATION (no chapters)', FLAT_CANONICAL, undefined],
]

const typeMap: Record<string, number[]> = {
  'sfs-law': [0],
  amendment: [1],
  afs: [2],
  eu: [3],
  flat: [4],
}

const indices =
  typeFilter && typeMap[typeFilter] ? typeMap[typeFilter] : [0, 1, 2, 3, 4]

console.log('Story 14.1 — Canonical Pipeline Demo')
console.log(`Running ${indices.length} demo(s)...\n`)

for (const i of indices) {
  const [label, html, normalizer] = demos[i]!
  demo(label, html, normalizer)
}

console.log(`\n${'═'.repeat(72)}`)
console.log('  Demo complete.')
console.log('═'.repeat(72))
