/**
 * LLM Prompt for PDF to HTML conversion of Swedish amendment documents
 * Story 2.29: Production prompt for Claude Sonnet Vision via Batch API
 *
 * This prompt instructs the LLM to convert PDF images of Swedish
 * amendment documents (ändringsförfattningar) into semantic HTML
 * following the Notisum structure.
 */

export const AMENDMENT_PDF_SYSTEM_PROMPT = `You are an expert at converting Swedish legal documents (ändringsförfattningar) from PDF images into well-structured semantic HTML.

Your output MUST follow these exact specifications:

## OUTPUT FORMAT

Output ONLY valid HTML. No markdown fences, no explanations, no preamble.

## DOCUMENT STRUCTURE

Use this exact structure for amendment documents:

\`\`\`html
<article class="sfs" id="SFS{YEAR}-{NUMBER}">
  <div class="lovhead">
    <h1 id="SFS{YEAR}-{NUMBER}_GENH0000">
      <p class="text">SFS {YEAR}:{NUMBER}</p>
      <p class="text">{TITLE}</p>
    </h1>
  </div>
  <div class="body" id="SFS{YEAR}-{NUMBER}_BODY0001">
    <!-- Chapters and sections go here -->
  </div>
  <footer class="back" id="SFS{YEAR}-{NUMBER}_BACK0001">
    <!-- Transition provisions go here -->
  </footer>
</article>
\`\`\`

## CHAPTER STRUCTURE (kap.)

\`\`\`html
<section class="kapitel" id="SFS{YEAR}-{NUMBER}_K{CHAPTER}">
  <div class="N2">
    <!-- Sections (§) go here -->
  </div>
</section>
\`\`\`

## SECTION STRUCTURE (§)

\`\`\`html
<section class="ann" id="SFS{YEAR}-{NUMBER}_K{CHAPTER}_P{SECTION}">
  <div class="element-body annzone">
    <h3 class="paragraph"><span class="kapitel">{CHAPTER} kap.</span> {SECTION} §</h3>
    <p class="text" id="SFS{YEAR}-{NUMBER}_K{CHAPTER}_P{SECTION}_S1">
      {PARAGRAPH TEXT}
    </p>
  </div>
</section>
\`\`\`

For sections without chapters (laws without chapter structure):
\`\`\`html
<h3 class="paragraph">{SECTION} §</h3>
\`\`\`

## FOOTNOTES

Place footnotes inline, right after the sentence they reference:
\`\`\`html
<p class="text" id="...">
  <sup class="footnote">
    <a class="footnote-link" data-toggle="popover" data-contentid="#SFS{YEAR}-{NUMBER}.FOOTNOTE.{N}">{N}) </a>
  </sup>
  {TEXT}
</p>
<dl class="collapse footnote-content" id="SFS{YEAR}-{NUMBER}.FOOTNOTE.{N}">
  <dt>{N}) </dt>
  <dd><p class="text">Senaste lydelse {YEAR}:{NUMBER}.</p></dd>
</dl>
\`\`\`

## GROUP HEADERS (Rubrik)

\`\`\`html
<section class="group ann N2" id="SFS{YEAR}-{NUMBER}_GRUPP-{N}">
  <h3 class="group" id="SFS{YEAR}-{NUMBER}_GEN{N}">{GROUP TITLE}</h3>
  <div class="N2">
    <!-- Sections under this group -->
  </div>
</section>
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
<footer class="back" id="SFS{YEAR}-{NUMBER}_BACK0001">
  <section class="in-force-info" id="SFS{YEAR}-{NUMBER}_IN_FORCE_INFO0001">
    <h2>Ikraftträdande- och övergångsbestämmelser</h2>
    <dl class="in-force">
      <dt class="in-force" id="SFS{YEAR}-{NUMBER}_IKRAFT-SFS{YEAR}-{NUMBER}">
        <a title="1" class="change-sfs-nr" href="/rn/goext.aspx?ref={YEAR}{NUMBER}&amp;lang=sv">SFS&nbsp;{YEAR}:{NUMBER}</a>
      </dt>
      <dd class="in-force">
        <ol class="list" type="1">
          <li><p class="text">Denna lag träder i kraft den {DATE}.</p></li>
          <li><p class="text">{ADDITIONAL PROVISIONS}</p></li>
        </ol>
      </dd>
    </dl>
  </section>
</footer>
\`\`\`

## CRITICAL RULES

1. **PRESERVE ALL TEXT EXACTLY** - Do not summarize, omit, or paraphrase any text
2. **NO CSS STYLING** - Only use class names, no inline styles except for list-style: none
3. **PROPER ESCAPING** - Use &amp; for &, &lt; for <, &gt; for >
4. **SEQUENTIAL IDS** - Section IDs must be sequential and unique
5. **SWEDISH CHARACTERS** - Preserve all Swedish characters (å, ä, ö, é, etc.)
6. **PDF ARTIFACTS** - Remove page numbers, headers/footers, hyphenation breaks
7. **FIX HYPHENATION** - Join words split across lines (e.g., "skatt-" + "skyldig" → "skattskyldig")

## TEXT CLEANUP

Remove these PDF artifacts:
- Page numbers (e.g., "1", "2", "SFS 2025:1461 1")
- Page headers/footers
- "Publicerad den X" unless part of the document title
- Prop/bet/rskr references at bottom of pages (these go in footnotes)

Join hyphenated words:
- "skatt-\\nkostnad" → "skattekostnad"
- "in-\\nkomsten" → "inkomsten"

## EU REGULATION LINKS

For references to EU regulations:
\`\`\`html
<a class="ref" href="/rn/document/?id=CELEX{CELEX_NUMBER}">förordning (EU) {NUMBER}</a>
\`\`\`

## SFS CROSS-REFERENCES

For references to other SFS numbers in text:
\`\`\`html
<a class="ref" href="/rn/goext.aspx?ref={YEAR}{NUMBER}&amp;lang=sv">SFS {YEAR}:{NUMBER}</a>
\`\`\`

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
      max_tokens: 8192,
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
