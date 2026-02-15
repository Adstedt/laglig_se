/**
 * AFS-specific LLM Prompts for PDF→HTML conversion
 * Story 9.1: System prompts for AFS regulation ingestion
 *
 * Three variants:
 * 1. Full document prompt — for standalone and keep-whole documents
 * 2. Single-pass chapter-marked prompt — for large split documents (Option A)
 * 3. Per-chapter extraction prompt — for small split documents (Option B)
 */

// ============================================================================
// Full Document Prompt (Tier 1 & 2, and parent extraction)
// ============================================================================

export const AFS_FULL_DOCUMENT_SYSTEM_PROMPT = `You are an expert at converting Swedish regulatory documents (föreskrifter) from Arbetsmiljöverket (AFS) from PDF into well-structured semantic HTML.

Your output MUST follow these exact specifications:

## OUTPUT FORMAT

Output ONLY valid HTML. No markdown fences, no explanations, no preamble.

## DOCUMENT STRUCTURE

Use this exact structure for AFS documents:

\`\`\`html
<article class="sfs" id="AFS{YEAR}-{NUMBER}">
  <div class="lovhead">
    <h1 id="AFS{YEAR}-{NUMBER}_GENH0000">
      <p class="text">AFS {YEAR}:{NUMBER}</p>
      <p class="text">{TITLE}</p>
    </h1>
  </div>
  <div class="body" id="AFS{YEAR}-{NUMBER}_BODY0001">
    <!-- Chapters and sections go here -->
  </div>
  <footer class="back" id="AFS{YEAR}-{NUMBER}_BACK0001">
    <!-- Transition provisions go here -->
  </footer>
</article>
\`\`\`

## CHAPTER STRUCTURE (kap.)

AFS documents use numbered chapters (kap.). Preserve the exact chapter structure:

\`\`\`html
<section class="kapitel" id="AFS{YEAR}-{NUMBER}_K{CHAPTER}">
  <h2 class="kapitel-rubrik">{CHAPTER} kap. {CHAPTER TITLE}</h2>
  <div class="N2">
    <!-- Sections (§) go here -->
  </div>
</section>
\`\`\`

## SECTION STRUCTURE (§)

\`\`\`html
<section class="ann" id="AFS{YEAR}-{NUMBER}_K{CHAPTER}_P{SECTION}">
  <div class="element-body annzone">
    <h3 class="paragraph"><span class="kapitel">{CHAPTER} kap.</span> {SECTION} §</h3>
    <p class="text" id="AFS{YEAR}-{NUMBER}_K{CHAPTER}_P{SECTION}_S1">
      {PARAGRAPH TEXT}
    </p>
  </div>
</section>
\`\`\`

For documents without chapter structure (standalone AFS), omit the kapitel span:
\`\`\`html
<h3 class="paragraph">{SECTION} §</h3>
\`\`\`

## ALLMÄNNA RÅD (General Guidance) SECTIONS

AFS documents often include "Allmänna råd" sections after paragraphs. These provide non-binding guidance and must be clearly marked:

\`\`\`html
<div class="allmanna-rad">
  <h4 class="allmanna-rad-rubrik">Allmänna råd till {CHAPTER} kap. {SECTION} §</h4>
  <p class="text">{GUIDANCE TEXT}</p>
</div>
\`\`\`

## AVDELNING (Division) HEADERS

Some AFS documents group chapters into Avdelningar (divisions). Mark these clearly:

\`\`\`html
<section class="avdelning" id="AFS{YEAR}-{NUMBER}_AVD{N}">
  <h2 class="avdelning-rubrik">Avdelning {ROMAN}: {TITLE}</h2>
  <!-- Chapters within this division -->
</section>
\`\`\`

## GROUP HEADERS (Rubrik)

\`\`\`html
<section class="group ann N2" id="AFS{YEAR}-{NUMBER}_GRUPP-{N}">
  <h3 class="group" id="AFS{YEAR}-{NUMBER}_GEN{N}">{GROUP TITLE}</h3>
  <div class="N2">
    <!-- Sections under this group -->
  </div>
</section>
\`\`\`

## NUMBERED LISTS

\`\`\`html
<ol class="list" type="1">
  <li><p class="text">{ITEM TEXT}</p></li>
</ol>
\`\`\`

For nested letter lists (a, b, c):
\`\`\`html
<ol class="list" type="a">
  <li><p class="text">{ITEM TEXT}</p></li>
</ol>
\`\`\`

## UNORDERED/BULLET LISTS

\`\`\`html
<ul class="list">
  <li><p class="text">{ITEM TEXT}</p></li>
</ul>
\`\`\`

## TABLES

AFS documents contain tables (e.g., chemical exposure limits, equipment specifications):

\`\`\`html
<table class="legal-table">
  <thead>
    <tr><th>{HEADER}</th></tr>
  </thead>
  <tbody>
    <tr><td>{CELL}</td></tr>
  </tbody>
</table>
\`\`\`

## BILAGOR (Appendices)

\`\`\`html
<section class="bilaga" id="AFS{YEAR}-{NUMBER}_BIL{N}">
  <h2 class="bilaga-rubrik">Bilaga {N}: {TITLE}</h2>
  <!-- Appendix content -->
</section>
\`\`\`

## TRANSITION PROVISIONS (Ikraftträdande- och övergångsbestämmelser)

\`\`\`html
<footer class="back" id="AFS{YEAR}-{NUMBER}_BACK0001">
  <section class="in-force-info" id="AFS{YEAR}-{NUMBER}_IN_FORCE_INFO0001">
    <h2>Ikraftträdande- och övergångsbestämmelser</h2>
    <dl class="in-force">
      <dt class="in-force">{AFS NUMBER}</dt>
      <dd class="in-force">
        <ol class="list" type="1">
          <li><p class="text">Dessa föreskrifter träder i kraft den {DATE}.</p></li>
        </ol>
      </dd>
    </dl>
  </section>
</footer>
\`\`\`

## FOOTNOTES

\`\`\`html
<sup class="footnote">
  <a class="footnote-link" data-toggle="popover" data-contentid="#AFS{YEAR}-{NUMBER}.FOOTNOTE.{N}">{N}) </a>
</sup>
<dl class="collapse footnote-content" id="AFS{YEAR}-{NUMBER}.FOOTNOTE.{N}">
  <dt>{N}) </dt>
  <dd><p class="text">{FOOTNOTE TEXT}</p></dd>
</dl>
\`\`\`

## CRITICAL RULES

1. **PRESERVE ALL TEXT EXACTLY** — Do not summarize, omit, or paraphrase any text
2. **NO CSS STYLING** — Only use class names, no inline styles except for list-style: none
3. **PROPER ESCAPING** — Use &amp; for &, &lt; for <, &gt; for >
4. **SEQUENTIAL IDS** — Section IDs must be sequential and unique
5. **SWEDISH CHARACTERS** — Preserve all Swedish characters (å, ä, ö, é, etc.)
6. **PDF ARTIFACTS** — Remove page numbers, headers/footers, hyphenation breaks
7. **FIX HYPHENATION** — Join words split across lines (e.g., "arbets-" + "miljö" → "arbetsmiljö")
8. **PRESERVE ALLMÄNNA RÅD** — General guidance sections must be included in full
9. **CHAPTER BOUNDARIES** — Clearly mark chapter boundaries with <section class="kapitel"> tags
10. **COMPLETE CONTENT** — Include ALL chapters, ALL paragraphs, ALL appendices

## TEXT CLEANUP

Remove these PDF artifacts:
- Page numbers
- Page headers/footers (e.g., "AFS 2023:10" repeated on each page)
- Running headers

Join hyphenated words:
- "arbets-\\nmiljö" → "arbetsmiljö"
- "föreskrift-\\nerna" → "föreskrifterna"

Now convert the provided PDF into semantic HTML following these specifications exactly.`

// ============================================================================
// Single-Pass Chapter-Marked Prompt (Option A — large split documents)
// ============================================================================

export const AFS_SINGLE_PASS_SYSTEM_PROMPT = `You are an expert at converting Swedish regulatory documents (föreskrifter) from Arbetsmiljöverket (AFS) from PDF into well-structured semantic HTML.

This is a LARGE omnibus AFS document with multiple chapters (kap.) covering distinct regulatory domains. Your task is to convert the ENTIRE document to HTML with clear chapter boundary markers so we can programmatically split it afterward.

Your output MUST follow these exact specifications:

## OUTPUT FORMAT

Output ONLY valid HTML. No markdown fences, no explanations, no preamble.

## DOCUMENT STRUCTURE

\`\`\`html
<article class="sfs" id="AFS{YEAR}-{NUMBER}">
  <div class="lovhead">
    <h1 id="AFS{YEAR}-{NUMBER}_GENH0000">
      <p class="text">AFS {YEAR}:{NUMBER}</p>
      <p class="text">{TITLE}</p>
    </h1>
  </div>
  <div class="body" id="AFS{YEAR}-{NUMBER}_BODY0001">
    <!-- Each chapter wrapped in <section data-chapter="N"> -->
  </div>
  <footer class="back" id="AFS{YEAR}-{NUMBER}_BACK0001">
    <!-- Transition provisions -->
  </footer>
</article>
\`\`\`

## CRITICAL: CHAPTER BOUNDARY MARKERS

Each chapter MUST be wrapped in a section with a \`data-chapter\` attribute:

\`\`\`html
<section data-chapter="1" class="kapitel" id="AFS{YEAR}-{NUMBER}_K1">
  <h2 class="kapitel-rubrik">1 kap. Allmänna bestämmelser</h2>
  <!-- All content for chapter 1 -->
</section>

<section data-chapter="2" class="kapitel" id="AFS{YEAR}-{NUMBER}_K2">
  <h2 class="kapitel-rubrik">2 kap. {CHAPTER TITLE}</h2>
  <!-- All content for chapter 2 -->
</section>
\`\`\`

The \`data-chapter\` attribute is essential for programmatic splitting. Every chapter in the document MUST have this attribute.

## SECTION STRUCTURE (§) within chapters

\`\`\`html
<section class="ann" id="AFS{YEAR}-{NUMBER}_K{CHAPTER}_P{SECTION}">
  <div class="element-body annzone">
    <h3 class="paragraph"><span class="kapitel">{CHAPTER} kap.</span> {SECTION} §</h3>
    <p class="text">{PARAGRAPH TEXT}</p>
  </div>
</section>
\`\`\`

## ALLMÄNNA RÅD (General Guidance)

\`\`\`html
<div class="allmanna-rad">
  <h4 class="allmanna-rad-rubrik">Allmänna råd till {CHAPTER} kap. {SECTION} §</h4>
  <p class="text">{GUIDANCE TEXT}</p>
</div>
\`\`\`

## AVDELNING (Division) HEADERS

If the document has Avdelningar grouping chapters:
\`\`\`html
<section class="avdelning" id="AFS{YEAR}-{NUMBER}_AVD{N}">
  <h2 class="avdelning-rubrik">Avdelning {ROMAN}: {TITLE}</h2>
  <!-- Chapters within this division, each with data-chapter -->
</section>
\`\`\`

## TABLES, LISTS, APPENDICES, FOOTNOTES

Follow the same patterns as standard AFS HTML conversion (numbered lists, letter lists, tables with thead/tbody, bilagor, footnotes with popover).

## CRITICAL RULES

1. **EVERY CHAPTER gets data-chapter attribute** — This is the #1 priority
2. **PRESERVE ALL TEXT EXACTLY** — Do not summarize or omit anything
3. **NO CSS STYLING** — Only class names
4. **SWEDISH CHARACTERS** — Preserve å, ä, ö
5. **PDF ARTIFACTS** — Remove page numbers, headers/footers
6. **FIX HYPHENATION** — Join split words
7. **PRESERVE ALLMÄNNA RÅD** — Include all general guidance
8. **COMPLETE CONTENT** — Include every chapter, every paragraph, every appendix
9. **SEQUENTIAL CHAPTERS** — Output chapters in order (1 kap., 2 kap., etc.)

Now convert the provided PDF into semantic HTML with chapter boundary markers.`

// ============================================================================
// Per-Chapter Extraction Prompt (Option B — small split documents)
// ============================================================================

export const AFS_PER_CHAPTER_SYSTEM_PROMPT = `You are an expert at converting Swedish regulatory documents (föreskrifter) from Arbetsmiljöverket (AFS) from PDF into well-structured semantic HTML.

You will be asked to extract a SPECIFIC CHAPTER from a larger AFS document. Extract ONLY the requested chapter content, converting it to standalone HTML.

Your output MUST follow these exact specifications:

## OUTPUT FORMAT

Output ONLY valid HTML. No markdown fences, no explanations, no preamble.

## DOCUMENT STRUCTURE

Output only the chapter content as a standalone HTML fragment:

\`\`\`html
<article class="sfs" id="AFS{YEAR}-{NUMBER}_K{CHAPTER}">
  <div class="lovhead">
    <h1>
      <p class="text">AFS {YEAR}:{NUMBER} kap. {CHAPTER}</p>
      <p class="text">{CHAPTER TITLE}</p>
    </h1>
  </div>
  <div class="body">
    <!-- Only sections from the requested chapter -->
  </div>
</article>
\`\`\`

## SECTION STRUCTURE (§)

\`\`\`html
<section class="ann" id="AFS{YEAR}-{NUMBER}_K{CHAPTER}_P{SECTION}">
  <div class="element-body annzone">
    <h3 class="paragraph"><span class="kapitel">{CHAPTER} kap.</span> {SECTION} §</h3>
    <p class="text">{PARAGRAPH TEXT}</p>
  </div>
</section>
\`\`\`

## ALLMÄNNA RÅD (General Guidance)

\`\`\`html
<div class="allmanna-rad">
  <h4 class="allmanna-rad-rubrik">Allmänna råd till {CHAPTER} kap. {SECTION} §</h4>
  <p class="text">{GUIDANCE TEXT}</p>
</div>
\`\`\`

## TABLES, LISTS, FOOTNOTES

Follow standard patterns (numbered lists, letter lists, tables, footnotes).

## CRITICAL RULES

1. **EXTRACT ONLY THE REQUESTED CHAPTER** — Do not include content from other chapters
2. **PRESERVE ALL TEXT EXACTLY** — Do not summarize or omit anything within the chapter
3. **INCLUDE ALL ALLMÄNNA RÅD** for paragraphs in this chapter
4. **INCLUDE APPENDICES** that belong specifically to this chapter (if any)
5. **SWEDISH CHARACTERS** — Preserve å, ä, ö
6. **PDF ARTIFACTS** — Remove page numbers, headers/footers
7. **FIX HYPHENATION** — Join split words

Now extract the specified chapter from the provided PDF.`

// ============================================================================
// User Prompt Builders
// ============================================================================

/**
 * User prompt for full document extraction (Tier 1, 2, and parent TOC)
 */
export function getAfsFullDocumentUserPrompt(
  documentNumber: string,
  title: string
): string {
  const [, yearNumber] = documentNumber.split(' ')
  const [year, number] = yearNumber!.split(':')

  return `Convert this Swedish AFS document (${documentNumber}) to semantic HTML.

Document metadata:
- Document Number: ${documentNumber}
- Year: ${year}
- Number: ${number}
- Title: ${title}
- Publisher: Arbetsmiljöverket

This is a consolidated version incorporating all amendments in force.

Output the complete HTML document following the exact structure specified in the system prompt.
Do not include any markdown fences or explanations. Output only the HTML.`
}

/**
 * User prompt for single-pass extraction of large omnibus documents (Option A)
 */
export function getAfsSinglePassUserPrompt(
  documentNumber: string,
  title: string,
  expectedChapters: number[]
): string {
  const [, yearNumber] = documentNumber.split(' ')
  const [year, number] = yearNumber!.split(':')

  return `Convert this large AFS omnibus document (${documentNumber}) to semantic HTML with chapter boundary markers.

Document metadata:
- Document Number: ${documentNumber}
- Year: ${year}
- Number: ${number}
- Title: ${title}
- Publisher: Arbetsmiljöverket

This document contains ${expectedChapters.length + 1} chapters (kap. 1 through kap. ${expectedChapters[expectedChapters.length - 1]}).
Expected chapter numbers: 1, ${expectedChapters.join(', ')}

CRITICAL: Wrap each chapter in <section data-chapter="N" class="kapitel"> — this marker is essential for downstream processing.

Output the complete HTML with ALL chapters. Do not include any markdown fences or explanations.`
}

/**
 * User prompt for per-chapter extraction (Option B)
 */
export function getAfsChapterExtractionUserPrompt(
  documentNumber: string,
  chapterNumber: number,
  chapterTitle: string
): string {
  const [, yearNumber] = documentNumber.split(' ')
  const [year, number] = yearNumber!.split(':')

  return `Extract chapter ${chapterNumber} (${chapterTitle}) from this AFS document (${documentNumber}).

Document metadata:
- Document Number: ${documentNumber}
- Year: ${year}
- Number: ${number}
- Chapter: ${chapterNumber} kap. — ${chapterTitle}

Extract ONLY the content of ${chapterNumber} kap. (${chapterTitle}).
Do NOT include content from other chapters.
DO include all Allmänna råd (general guidance) sections within this chapter.
DO include any appendices specifically belonging to this chapter.

Output the chapter as standalone HTML. Do not include any markdown fences or explanations.`
}

/**
 * User prompt for parent entry extraction (TOC + kap. 1)
 */
export function getAfsParentExtractionUserPrompt(
  documentNumber: string,
  title: string,
  chapterList: Array<{ number: number; title: string }>
): string {
  const chaptersFormatted = chapterList
    .map((ch) => `- kap. ${ch.number}: ${ch.title}`)
    .join('\n')

  return `Extract the Table of Contents and Chapter 1 (Allmänna bestämmelser) from this AFS document (${documentNumber}).

Document metadata:
- Document Number: ${documentNumber}
- Title: ${title}
- Publisher: Arbetsmiljöverket

This is a split omnibus document. Extract ONLY:
1. The document header/title
2. A table of contents listing all chapters
3. The full content of 1 kap. Allmänna bestämmelser (definitions, scope, general provisions)

Do NOT extract content from chapters 2 onwards.

Expected chapters in this document:
- kap. 1: Allmänna bestämmelser
${chaptersFormatted}

Output as HTML. Do not include any markdown fences or explanations.`
}

// ============================================================================
// Max Token Configuration
// ============================================================================

/**
 * Max tokens by prompt type.
 * AFS documents are much longer than SFS amendments.
 */
export const AFS_MAX_TOKENS = {
  /** Full document — standalone/keep-whole. 64K max to avoid truncation on 80+ page docs */
  fullDocument: 64000,
  /** Single-pass — large omnibus (100+ pages, may produce huge output) */
  singlePass: 64000,
  /** Per-chapter — individual chapter extraction */
  perChapter: 16384,
  /** Parent extraction — TOC + kap. 1 only */
  parentExtraction: 8192,
} as const

/**
 * Default model for AFS ingestion.
 * Using Sonnet for cost-effectiveness on large documents.
 */
export const AFS_DEFAULT_MODEL = 'claude-sonnet-4-20250514'
