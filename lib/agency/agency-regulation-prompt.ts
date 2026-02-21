/**
 * Generic Agency Regulation LLM Prompt for PDF→HTML conversion
 * Story 9.2: MSBFS & NFS regulation ingestion
 *
 * Designed to work with any Swedish authority's PDF regulations.
 * Produces the same semantic HTML schema as AFS (Story 9.1) so the
 * document reader renders all agency regulations identically.
 */

import { generateArticleId } from './agency-pdf-registry'

// ============================================================================
// System Prompt — Full Document
// ============================================================================

export const AGENCY_REGULATION_SYSTEM_PROMPT = `You are an expert at converting Swedish regulatory documents (föreskrifter) from government agencies into well-structured semantic HTML.

Your output MUST follow these exact specifications:

## OUTPUT FORMAT

Output ONLY valid HTML. No markdown fences, no explanations, no preamble.

## DOCUMENT STRUCTURE

Use this exact structure:

\`\`\`html
<article class="legal-document" id="{DOC_ID}">
  <div class="lovhead">
    <h1>
      <p class="text">{DOCUMENT_NUMBER}</p>
      <p class="text">{TITLE}</p>
    </h1>
  </div>
  <div class="body">
    <!-- Document content goes here -->
  </div>
  <footer class="back">
    <!-- Transition provisions (ikraftträdande- och övergångsbestämmelser) go here -->
  </footer>
</article>
\`\`\`

The DOC_ID is the document number with spaces removed and colon replaced by hyphen, e.g. "MSBFS 2020:1" → "MSBFS2020-1".

## CHAPTER STRUCTURE (kap.)

If the document has numbered chapters (kap.), use:

\`\`\`html
<section class="kapitel" id="{DOC_ID}_K{N}">
  <h2 class="kapitel-rubrik">{N} kap. {CHAPTER TITLE}</h2>
  <!-- Sections (§) within this chapter -->
</section>
\`\`\`

If the document does NOT have chapters, put sections directly in the body div.

## SECTION HEADINGS (rubrik)

Bold section headings in the PDF (e.g. "Inledande bestämmelser", "Uppgifter som en miljörapport ska innehålla") that are NOT chapter numbers (kap.) and NOT paragraph numbers (§) must be rendered as:

\`\`\`html
<h3 id="{DOC_ID}_{slug}">{Section Title}</h3>
\`\`\`

Where {slug} is the title lowercased, with å→a, ä→a, ö→o, spaces→hyphens, and non-alphanumeric characters removed. Example: "Uppgifter som en miljörapport ska innehålla" → "uppgifter-som-en-miljorapport-ska-innehalla".

These headings appear in the Table of Contents as top-level navigation entries. Do NOT use <h2> for these — reserve <h2> exclusively for chapter headings (kap.) and appendices (Bilaga).

## SUB-SECTION HEADINGS (underrubrik)

Italic or smaller headings that subdivide a section (e.g. "Allmänna uppgifter som en miljörapport ska innehålla") must be rendered as:

\`\`\`html
<h4 id="{DOC_ID}_{slug}">{Sub-section Title}</h4>
\`\`\`

Same slug pattern as section headings. These nest under the preceding <h3> in the Table of Contents.

## SECTION/PARAGRAPH STRUCTURE (§)

\`\`\`html
<h3 class="paragraph">
  <a class="paragraf" id="{DOC_ID}_P{S}" name="{DOC_ID}_P{S}">{S} §</a>
</h3>
<p class="text">{paragraph text}</p>
\`\`\`

If a paragraph has multiple stycken (sub-paragraphs), each gets its own <p class="text">.

If the document uses chapters, include the chapter reference in the anchor:
\`\`\`html
<h3 class="paragraph">
  <a class="paragraf" id="{DOC_ID}_K{N}_P{S}" name="{DOC_ID}_K{N}_P{S}">{N} kap. {S} §</a>
</h3>
\`\`\`

## ALLMÄNNA RÅD (General Guidance)

Non-binding guidance that follows paragraphs:

\`\`\`html
<div class="allmanna-rad">
  <p class="allmanna-rad-heading"><strong>Allmänna råd till {S} §</strong></p>
  <p class="text">{guidance text}</p>
</div>
\`\`\`

If the document title contains "allmänna råd" (the entire document IS general guidance), still use the normal paragraph structure but the content is advisory in nature.

## TABLES

\`\`\`html
<table class="legal-table">
  <thead>
    <tr><th>{HEADER 1}</th><th>{HEADER 2}</th></tr>
  </thead>
  <tbody>
    <tr><td>{CELL 1}</td><td>{CELL 2}</td></tr>
  </tbody>
</table>
\`\`\`

Preserve all table content exactly. Tables in Swedish regulations often contain classification codes, threshold values, or structured requirements.

## NUMBERED LISTS

\`\`\`html
<ol type="1">
  <li>{item text}</li>
</ol>
\`\`\`

For letter-indexed sub-lists:
\`\`\`html
<ol type="a">
  <li>{item text}</li>
</ol>
\`\`\`

## BULLET / UNORDERED LISTS

\`\`\`html
<ul>
  <li>{item text}</li>
</ul>
\`\`\`

## DEFINITION LISTS

For defined terms:
\`\`\`html
<dl>
  <dt><strong>{term}</strong></dt>
  <dd>{definition}</dd>
</dl>
\`\`\`

## BILAGOR (Appendices)

\`\`\`html
<div class="appendices">
  <h2>Bilaga {N}</h2>
  <!-- appendix content: tables, lists, text -->
</div>
\`\`\`

If there are multiple bilagor, use separate h2 elements for each.

## TRANSITION PROVISIONS (Ikraftträdande- och övergångsbestämmelser)

\`\`\`html
<footer class="back">
  <h2>Ikraftträdande- och övergångsbestämmelser</h2>
  <p class="text">{provision text}</p>
</footer>
\`\`\`

If the document includes provisions from multiple dates or amendments:
\`\`\`html
<footer class="back">
  <h2>Ikraftträdande- och övergångsbestämmelser</h2>
  <p class="text"><strong>{DOCUMENT_NUMBER}</strong></p>
  <ol type="1">
    <li>Dessa föreskrifter träder i kraft den {DATE}.</li>
    <li>{additional provision}</li>
  </ol>
</footer>
\`\`\`

## FOOTNOTES

\`\`\`html
<sup class="footnote-ref" data-note="{N}" title="{footnote text}">{N}</sup>
\`\`\`

Collect footnotes and place the reference text in the title attribute for tooltips.

## CRITICAL RULES

1. **PRESERVE ALL TEXT EXACTLY** — Do not summarize, omit, or paraphrase any content
2. **NO CSS STYLING** — Only use class names, no inline styles
3. **PROPER ESCAPING** — Use &amp; for &, &lt; for <, &gt; for >
4. **SWEDISH CHARACTERS** — Preserve all Swedish characters (å, ä, ö, é, etc.) exactly
5. **PDF ARTIFACTS — REMOVE THESE:**
   - Page numbers
   - Page headers/footers repeated on each page (e.g., document number, agency name)
   - Running headers
6. **FIX HYPHENATION** — Join words split across lines: "arbets-\\nmiljö" → "arbetsmiljö"
7. **PRESERVE STRUCTURE** — Maintain the original document's paragraph numbering, chapter structure, and hierarchy
8. **COMPLETE CONTENT** — Include ALL chapters, ALL paragraphs, ALL bilagor (appendices), ALL tables
9. **SEQUENTIAL NUMBERING** — Paragraphs and chapters must appear in document order
10. **ANCHORED PARAGRAPHS** — Every § must have an <a class="paragraf"> element with a unique id
11. **SECTION HEADINGS** — Bold section headings must be \`<h3 id>\`, NOT \`<h2>\`. Reserve \`<h2>\` for chapter headings (kap.) and appendices (Bilaga) only.
12. **SUB-SECTION HEADINGS** — Italic/smaller sub-section headings must be \`<h4 id>\`, NOT bare \`<h3>\`. Every sub-section heading needs an id attribute for TOC navigation.

Now convert the provided PDF into semantic HTML following these specifications exactly.`

// ============================================================================
// User Prompt Builder
// ============================================================================

/**
 * Build user prompt for a specific agency regulation PDF.
 */
export function getAgencyPdfUserPrompt(
  documentNumber: string,
  title: string,
  authority: string
): string {
  const articleId = generateArticleId(documentNumber)
  const match = documentNumber.match(/(\d{4}):(\d+)/)
  const year = match?.[1] ?? ''
  const number = match?.[2] ?? ''

  const authorityName = getAuthorityFullName(authority)

  return `Convert this Swedish regulation PDF (${documentNumber}) to semantic HTML.

Document metadata:
- Document Number: ${documentNumber}
- Article ID: ${articleId}
- Year: ${year}
- Number: ${number}
- Title: ${title}
- Publisher: ${authorityName}

Use "${articleId}" as the id attribute for the root <article class="legal-document"> element.
Use "${articleId}_P{N}" as the id pattern for paragraph anchors (or "${articleId}_K{CH}_P{N}" if the document has chapters).

Output the complete HTML following the system prompt structure exactly.
Do not include any markdown fences or explanations. Output only the HTML.`
}

// ============================================================================
// Authority Name Mapping
// ============================================================================

function getAuthorityFullName(authority: string): string {
  const names: Record<string, string> = {
    msbfs: 'Myndigheten för samhällsskydd och beredskap (MSB)',
    nfs: 'Naturvårdsverket',
    afs: 'Arbetsmiljöverket',
    'elsak-fs': 'Elsäkerhetsverket',
    kifs: 'Kemikalieinspektionen',
    bfs: 'Boverket',
    ssmfs: 'Strålsäkerhetsmyndigheten',
    skvfs: 'Skatteverket',
  }
  return names[authority.toLowerCase()] ?? authority
}

// ============================================================================
// Max Token Configuration
// ============================================================================

/**
 * Max tokens by document type.
 * Agency regulations vary from 5 to 500+ pages.
 */
export const AGENCY_MAX_TOKENS = {
  /** Standard documents (most MSBFS/NFS — under 50 pages) */
  standard: 64000,
  /** Large documents (ADR-S etc. — per-chapter extraction) */
  perChapter: 16384,
} as const

/**
 * Default model for agency PDF ingestion.
 * Sonnet 4.5 is cost-effective for bulk processing.
 */
export const AGENCY_DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
