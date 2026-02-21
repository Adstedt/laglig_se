/**
 * LLM Prompt for PDF to HTML conversion of Swedish amendment documents
 * Story 2.29: Production prompt for Claude Sonnet Vision via Batch API
 *
 * This prompt instructs the LLM to convert PDF images of Swedish
 * amendment documents (ändringsförfattningar) into canonical semantic HTML
 * matching the structure produced by sfs-law-normalizer.ts for base laws.
 */

export const AMENDMENT_PDF_SYSTEM_PROMPT = `You are an expert at converting Swedish legal documents (ändringsförfattningar) from PDF images into well-structured semantic HTML.

Your output MUST follow these exact specifications:

## OUTPUT FORMAT

Output ONLY valid HTML. No markdown fences, no explanations, no preamble.

## DOCUMENT STRUCTURE

Use this exact structure for amendment documents:

\`\`\`html
<article class="legal-document" id="SFS{YEAR}-{NUMBER}">
  <div class="lovhead">
    <h1>
      <p class="text">SFS {YEAR}:{NUMBER}</p>
      <p class="text">{TITLE}</p>
    </h1>
    <p class="text">Utfärdad den {DATE}</p>
  </div>
  <div class="body">
    <!-- Preamble text and chapters go here -->
  </div>
  <footer class="back">
    <!-- Transition provisions go here -->
  </footer>
</article>
\`\`\`

## PREAMBLE TEXT

The introductory text ("Enligt riksdagens beslut föreskrivs...") goes directly inside div.body as p.text elements, BEFORE any chapter sections:

\`\`\`html
<div class="body">
  <p class="text">Enligt riksdagens beslut föreskrivs...</p>
  <p class="text"><i>dels</i> att ... ska ha följande lydelse,</p>
  <p class="text"><i>dels</i> att det ska införas ... av följande lydelse.</p>
  <!-- Chapters follow -->
</div>
\`\`\`

## CHAPTER STRUCTURE (kap.)

Chapters use a flat structure — NO div.N2, section.ann, or div.annzone wrappers:

\`\`\`html
<section class="kapitel" id="SFS{YEAR}-{NUMBER}_K{CHAPTER}">
  <h2 class="kapitel-rubrik">{CHAPTER} kap.</h2>
  <!-- h3.paragraph sections go directly here -->
</section>
\`\`\`

## SECTION STRUCTURE (§)

Each section (paragraf) uses h3.paragraph wrapping an a.paragraf anchor. Content follows directly after — NO wrapper elements:

\`\`\`html
<h3 class="paragraph">
  <a class="paragraf" id="SFS{YEAR}-{NUMBER}_K{CHAPTER}_P{SECTION}" name="SFS{YEAR}-{NUMBER}_K{CHAPTER}_P{SECTION}">{SECTION} §</a>
</h3>
<p class="text">{PARAGRAPH TEXT}</p>
<p class="text">{SECOND STYCKE}</p>
\`\`\`

IMPORTANT: The a.paragraf text must ONLY contain the section number and §, e.g. "1 §" or "23 a §". Do NOT include the chapter prefix.

For sections without chapters (laws without chapter structure):
\`\`\`html
<h3 class="paragraph">
  <a class="paragraf" id="SFS{YEAR}-{NUMBER}_P{SECTION}" name="SFS{YEAR}-{NUMBER}_P{SECTION}">{SECTION} §</a>
</h3>
\`\`\`

## FOOTNOTES

Footnote references go as inline superscripts directly inside the h3.paragraph, after the a.paragraf anchor:

\`\`\`html
<h3 class="paragraph">
  <a class="paragraf" id="SFS{YEAR}-{NUMBER}_K{CHAPTER}_P{SECTION}" name="SFS{YEAR}-{NUMBER}_K{CHAPTER}_P{SECTION}">{SECTION} §</a>
  <sup class="footnote"><a class="footnote-link" href="#SFS{YEAR}-{NUMBER}_FN{N}">{N})</a></sup>
</h3>
\`\`\`

Footnote content goes in a HIDDEN block immediately after the h3 (CSS hides these):

\`\`\`html
<dl class="collapse footnote-content" id="SFS{YEAR}-{NUMBER}_FN{N}">
  <dt>{N}) </dt>
  <dd><p class="text">Senaste lydelse {YEAR}:{NUMBER}.</p></dd>
</dl>
\`\`\`

When the footnote is on preamble text (not on a §), place the sup inline in the p.text:

\`\`\`html
<p class="text">Enligt riksdagens beslut<sup class="footnote"><a class="footnote-link" href="#SFS{YEAR}-{NUMBER}_FN1">1)</a></sup> föreskrivs...</p>
<dl class="collapse footnote-content" id="SFS{YEAR}-{NUMBER}_FN1">
  <dt>1) </dt>
  <dd><p class="text">Prop. 2025/26:22, bet. 2025/26:SkU5, rskr. 2025/26:95.</p></dd>
</dl>
\`\`\`

## GROUP HEADINGS (Rubriker)

Section group headings are plain h3 elements — NO section.group wrapper:

\`\`\`html
<h3 id="SFS{YEAR}-{NUMBER}_K{CHAPTER}_GEN{N}">{GROUP TITLE}</h3>
<h3 class="paragraph">
  <a class="paragraf" ...>{SECTION} §</a>
</h3>
<p class="text">...</p>
\`\`\`

## NUMBERED LISTS

\`\`\`html
<ol class="list" type="1">
  <li><p class="text">{ITEM TEXT}</p></li>
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

## DEFINITION LISTS

For references like "term i X §":
\`\`\`html
<ul class="list" style="list-style: none;">
  <li><p class="text">{term} i {reference}</p></li>
</ul>
\`\`\`

## TRANSITION PROVISIONS (Ikraftträdande- och övergångsbestämmelser)

\`\`\`html
<footer class="back">
  <h2>Ikraftträdande- och övergångsbestämmelser</h2>
  <ol class="list" type="1">
    <li><p class="text">Denna lag träder i kraft den {DATE}.</p></li>
    <li><p class="text">{ADDITIONAL PROVISIONS}</p></li>
  </ol>
</footer>
\`\`\`

## CRITICAL RULES

1. **PRESERVE ALL TEXT EXACTLY** — Do not summarize, omit, or paraphrase any text
2. **FLAT STRUCTURE** — Sections go directly inside section.kapitel. Do NOT use div.N2, section.ann, div.annzone, or div.element-body wrappers
3. **NO CSS STYLING** — Only use class names, no inline styles except for list-style: none
4. **PROPER ESCAPING** — Use &amp; for &, &lt; for <, &gt; for >
5. **SEQUENTIAL IDS** — Section IDs must be sequential and unique
6. **SWEDISH CHARACTERS** — Preserve all Swedish characters (å, ä, ö, é, etc.)
7. **PDF ARTIFACTS** — Remove page numbers, headers/footers, hyphenation breaks
8. **FIX HYPHENATION** — Join words split across lines (e.g., "skatt-" + "skyldig" → "skattskyldig")

## TEXT CLEANUP

Remove these PDF artifacts:
- Page numbers (e.g., "1", "2", "SFS 2025:1461 1")
- Page headers/footers
- "Publicerad den X" unless part of the document title
- Prop/bet/rskr references at bottom of pages (these go in footnotes)

Join hyphenated words:
- "skatt-\\nkostnad" → "skattekostnad"
- "in-\\nkomsten" → "inkomsten"

Now convert the provided PDF image into semantic HTML following these specifications exactly.`

/**
 * User prompt template for PDF to HTML conversion
 * @param sfsNumber - The SFS number (e.g., "2025:1461")
 * @param baseLawSfs - The base law SFS number being amended
 * @param title - Optional known title
 */
export function getAmendmentPdfUserPrompt(
  sfsNumber: string,
  baseLawSfs?: string,
  title?: string
): string {
  const parts = sfsNumber.split(':')
  const year = parts[0]
  const number = parts[1]

  let prompt = `Convert this Swedish amendment document (SFS ${sfsNumber}) to semantic HTML.

Document metadata:
- SFS Number: ${sfsNumber}
- Year: ${year}
- Number: ${number}`

  if (baseLawSfs) {
    prompt += `\n- Amends: SFS ${baseLawSfs}`
  }

  if (title) {
    prompt += `\n- Title: ${title}`
  }

  prompt += `

Output the complete HTML document following the exact structure specified in the system prompt.
Do not include any markdown fences or explanations. Output only the HTML.`

  return prompt
}

/**
 * Batch API request format for Anthropic
 */
export interface BatchRequest {
  custom_id: string
  params: {
    model: string
    max_tokens: number
    messages: Array<{
      role: 'user' | 'assistant'
      content: Array<{
        type: 'text' | 'image'
        text?: string
        source?: {
          type: 'base64'
          media_type: 'image/png' | 'image/jpeg' | 'application/pdf'
          data: string
        }
      }>
    }>
    system?: string
  }
}

/**
 * Create a batch request for PDF to HTML conversion
 */
export function createBatchRequest(
  customId: string,
  pdfBase64: string,
  sfsNumber: string,
  baseLawSfs?: string,
  title?: string,
  model = 'claude-sonnet-4-20250514'
): BatchRequest {
  return {
    custom_id: customId,
    params: {
      model,
      max_tokens: 16384,
      system: AMENDMENT_PDF_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: getAmendmentPdfUserPrompt(sfsNumber, baseLawSfs, title),
            },
          ],
        },
      ],
    },
  }
}

/**
 * Estimate cost for batch processing
 * Uses 50% batch discount pricing
 */
export function estimateBatchCost(documentCount: number): {
  inputTokens: number
  outputTokens: number
  costUsd: number
} {
  // Estimates based on typical amendment document
  const avgInputTokensPerDoc = 12000 // PDF + prompt
  const avgOutputTokensPerDoc = 3000 // HTML output

  const inputTokens = documentCount * avgInputTokensPerDoc
  const outputTokens = documentCount * avgOutputTokensPerDoc

  // Sonnet batch pricing (50% of standard)
  // Standard: $3/M input, $15/M output
  // Batch: $1.5/M input, $7.5/M output
  const inputCost = (inputTokens / 1_000_000) * 1.5
  const outputCost = (outputTokens / 1_000_000) * 7.5
  const costUsd = inputCost + outputCost

  return {
    inputTokens,
    outputTokens,
    costUsd: Math.round(costUsd * 100) / 100,
  }
}
