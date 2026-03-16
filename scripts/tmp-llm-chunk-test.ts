/**
 * Compare deterministic parser vs LLM for GDPR chunking.
 * Sends Chapter I (Articles 1-4) to Claude for structured JSON output,
 * then compares with deterministic parser result.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import { writeFileSync } from 'fs'

const prisma = new PrismaClient()
const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are a legal document parser. Given HTML of a legal document chapter, produce a JSON array of article chunks optimized for RAG retrieval and embedding.

Each chunk should represent one article with:
- Clean, readable text preserving the logical structure of numbered points and sub-points
- Proper nesting indicated by indentation or formatting
- Metadata for citation

Output JSON format:
{
  "chunks": [
    {
      "articleNumber": "1",
      "articleHeading": "Syfte",
      "chapter": { "number": "I", "title": "Allmänna bestämmelser" },
      "text": "The full article text, with numbered points and sub-points merged into readable paragraphs. Use line breaks between major points. Sub-points (a, b, c) should be inline with their parent point.",
      "points": [
        {
          "pointNumber": "1",
          "text": "Full text of point 1...",
          "subPoints": [
            { "label": "a", "text": "sub-point a text" }
          ]
        }
      ],
      "summary": "One sentence summary of what this article covers"
    }
  ]
}

Rules:
- Preserve ALL text content — do not omit or summarize in the text field
- The "text" field should be the complete article as clean readable text
- The "points" field should decompose the article into its numbered structure
- Keep the original language (Swedish)
- Remove excessive whitespace (like "1.   " → "1. ")
- Merge sub-point labels (a, b, c) with their content
- The "summary" should be in Swedish, one sentence`

async function main() {
  // 1. Get GDPR HTML
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: { contains: '32016R0679' } },
    select: { html_content: true },
  })

  if (!doc?.html_content) {
    console.log('GDPR not found')
    return
  }

  // 2. Extract Chapter I HTML only
  const $ = cheerio.load(doc.html_content)
  const chapter1 = $('section.kapitel').first()
  const chapter1Html = $.html(chapter1)
  console.log(`Chapter I HTML: ${chapter1Html.length} chars`)

  // 3. Deterministic parser result for comparison
  const fullJson = parseCanonicalHtml(doc.html_content)
  const ch1Deterministic = fullJson.chapters[0]!
  writeFileSync(
    resolve(process.cwd(), 'data/eu-gdpr-ch1-deterministic.json'),
    JSON.stringify(ch1Deterministic, null, 2),
    'utf-8'
  )
  console.log(
    `Deterministic: ${ch1Deterministic.sections.length} sections, ${ch1Deterministic.sections.reduce((a, s) => a + s.paragraphs.length, 0)} paragraphs`
  )

  // 4. Send to Claude
  console.log('\nSending Chapter I to Claude Haiku...')
  const startTime = Date.now()

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16384,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Parse this EU regulation chapter into structured article chunks:\n\n${chapter1Html}`,
      },
    ],
  })

  const elapsed = Date.now() - startTime
  const usage = response.usage

  // Extract JSON from response
  const responseText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  // Try to parse JSON from response
  let llmJson: any
  try {
    // Strip markdown code fences if present
    let cleaned = responseText
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*$/m, '')
      .trim()
    // Find the outermost JSON object
    const startIdx = cleaned.indexOf('{')
    const endIdx = cleaned.lastIndexOf('}')
    if (startIdx >= 0 && endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1)
    }
    llmJson = JSON.parse(cleaned)
  } catch (e) {
    console.log('Failed to parse JSON:', e)
    // Save raw response for debugging
    writeFileSync(
      resolve(process.cwd(), 'data/eu-gdpr-ch1-llm-raw.txt'),
      responseText,
      'utf-8'
    )
    console.log(
      `Saved raw response (${responseText.length} chars) to data/eu-gdpr-ch1-llm-raw.txt`
    )
    console.log(`Stop reason: ${response.stop_reason}`)
    console.log(
      `Tokens: ${usage.input_tokens} input, ${usage.output_tokens} output`
    )
    return
  }

  writeFileSync(
    resolve(process.cwd(), 'data/eu-gdpr-ch1-llm.json'),
    JSON.stringify(llmJson, null, 2),
    'utf-8'
  )

  // 5. Cost calculation
  const inputTokens = usage.input_tokens
  const outputTokens = usage.output_tokens

  // Haiku pricing: $0.80/MTok input, $4/MTok output
  const haikuCostInput = (inputTokens / 1_000_000) * 0.8
  const haikuCostOutput = (outputTokens / 1_000_000) * 4.0
  const haikuCost = haikuCostInput + haikuCostOutput

  // Extrapolate: GDPR has 11 chapters, this was 1
  // Full GDPR HTML is 482k chars, Chapter I is ${chapter1Html.length}
  const ratio = doc.html_content.length / chapter1Html.length
  const estimatedFullDocCost = haikuCost * ratio

  // All EU docs (~18 template + ~6k total)
  const estimated18Templates = estimatedFullDocCost * 18
  const estimated6kDocs = estimatedFullDocCost * 6000

  // SFS laws (~10.8k docs, avg smaller than GDPR)
  const estimatedSfsPerDoc = estimatedFullDocCost * 0.25 // SFS avg ~25% of GDPR size
  const estimated10kSfs = estimatedSfsPerDoc * 10800

  console.log(`\n--- RESULTS ---`)
  console.log(`LLM: ${llmJson.chunks?.length || 0} chunks`)
  console.log(`Time: ${elapsed}ms`)
  console.log(`Tokens: ${inputTokens} input, ${outputTokens} output`)
  console.log(`Cost (this call): $${haikuCost.toFixed(4)}`)

  console.log(`\n--- COST EXTRAPOLATION (Haiku) ---`)
  console.log(`Chapter I HTML: ${chapter1Html.length} chars`)
  console.log(
    `Full GDPR HTML: ${doc.html_content.length} chars (${ratio.toFixed(1)}x)`
  )
  console.log(`Est. full GDPR: $${estimatedFullDocCost.toFixed(4)}`)
  console.log(`Est. 18 EU templates: $${estimated18Templates.toFixed(2)}`)
  console.log(`Est. all ~6k EU docs: $${estimated6kDocs.toFixed(2)}`)
  console.log(`Est. ~10.8k SFS laws: $${estimated10kSfs.toFixed(2)}`)
  console.log(
    `Est. total (~17k docs): $${(estimated6kDocs + estimated10kSfs).toFixed(2)}`
  )

  console.log(`\nFiles saved to data/`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
