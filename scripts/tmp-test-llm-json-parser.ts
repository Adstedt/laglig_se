#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Prototype: LLM-based HTML → JSON parsing for SFS laws
 *
 * Sends normalized HTML to Claude and gets back CanonicalDocumentJson.
 * Tests on 1977:1160 (Arbetsmiljölagen).
 *
 * Usage:
 *   npx tsx scripts/tmp-test-llm-json-parser.ts
 *   npx tsx scripts/tmp-test-llm-json-parser.ts --doc "SFS 2012:210"
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../lib/prisma'
import { validateCanonicalJson } from '../lib/transforms/validate-document-json'
import * as fs from 'fs'

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a Swedish legal document parser. You receive HTML of a Swedish law (SFS) and return a structured JSON representation.

## Output Format

Return ONLY valid JSON matching this exact schema (no markdown fences, no explanation):

{
  "schemaVersion": "1.0",
  "documentType": "SFS_LAW",
  "title": string | null,
  "documentNumber": string | null,
  "divisions": Division[] | null,
  "chapters": Chapter[],
  "preamble": null,
  "transitionProvisions": Paragraph[] | null,
  "appendices": Appendix[] | null,
  "metadata": {
    "sfsNumber": string | null,
    "baseLawSfs": null,
    "effectiveDate": null
  }
}

### Types

Division (for documents with "Avdelning" groupings):
{
  "number": string,        // "1", "2"
  "title": string | null,
  "chapters": Chapter[]
}

Chapter:
{
  "number": string | null,  // "1", "2", null for flat docs without chapters
  "title": string | null,   // Chapter heading text
  "sections": Section[]
}

Section (represents a single §):
{
  "number": string,           // "1", "2a", "15b"
  "heading": string | null,   // Sub-heading if present (e.g., "Sanktionsavgift")
  "lastAmendment": string | null,  // Extracted from "Lag (YYYY:NNN)" → "YYYY:NNN"
  "status": string | null,    // "repealed" if section says "Har upphävts genom", "pending" if "/Träder i kraft/", null otherwise
  "paragraphs": Paragraph[]
}

Paragraph (represents a single stycke):
{
  "number": number | null,   // Sequential stycke number: 1, 2, 3... Only for real content paragraphs.
  "text": string,            // The text content
  "role": string             // One of: "PARAGRAPH", "HEADING", "TABLE", "ALLMANT_RAD", "TRANSITION_PROVISION"
}

Appendix:
{
  "title": string | null,
  "htmlContent": string,     // Preserve the raw HTML
  "text": string             // Plain text extraction
}

## Rules

### Stycke Numbering
- Number real content paragraphs sequentially within each §: 1, 2, 3...
- A "stycke" is a substantive paragraph of legal text
- Numbered lists (1., 2., 3. or "1. ...", "2. ...") within a stycke are NOT separate stycken — they are part of the stycke that introduces them
- Do NOT count these as stycken:
  - Amendment references like "Lag (2022:1109)" — extract to section.lastAmendment instead
  - Version markers like "/Upphör att gälla U:2028-07-01/" or "/Träder i kraft I:2028-07-01/"
  - "Har upphävts genom" markers

### Amendment References
- Lines matching "Lag (YYYY:NNN)" or "Förordning (YYYY:NNN)" at the end of a § are amendment references
- Extract the "YYYY:NNN" part to section.lastAmendment
- Do NOT include these as paragraphs

### Version Markers
- Lines starting with "/" like "/Upphör att gälla U:2028-07-01/" are version markers
- Do NOT include these as paragraphs
- If a § appears twice (one with "/Upphör att gälla/" and one with "/Träder i kraft/"), include ONLY the currently active version (the one WITHOUT "/Träder i kraft/")
- Set status: "pending" on sections that have "/Träder i kraft/" markers

### Repealed Sections
- Sections containing "Har upphävts genom" followed by a "lag (YYYY:NNN)" reference are repealed
- Set status: "repealed" on these sections
- Include one paragraph with the repeal text
- Set lastAmendment to the repealing law's SFS number

### Subheadings
- Non-§ headings within a chapter (like "Sanktionsavgift", "Skyddsombud") are subheadings
- Include them as paragraphs with role: "HEADING" in the section they precede
- If a subheading appears between sections, attach it to the NEXT section's heading field

### Transition Provisions (Övergångsbestämmelser)
- Found in <footer class="back"> or after an "Övergångsbestämmelser" heading
- Each amendment's transition provision block starts with the SFS number (bold or standalone)
- Group by amendment: each SFS number + its following text = one entry with role: "TRANSITION_PROVISION"
- Combine the SFS number and its provision text into a single text field

### Divisions (Avdelningar)
- If the document has "Avdelning" groupings, use the divisions array
- When divisions is populated, chapters must be []
- When there are no avdelningar, divisions must be null

### Tables
- Tables should be captured with role: "TABLE"
- Include the table's text content in text field
- Include the raw HTML in an htmlContent field

### Flat Documents
- If the document has no chapters (no "kap." headings), use a single chapter with number: null and title: null`

// ============================================================================
// Main
// ============================================================================

async function main() {
  const docNumber = process.argv.includes('--doc')
    ? process.argv[process.argv.indexOf('--doc') + 1]!
    : 'SFS 1977:1160'

  console.log(`\nFetching ${docNumber} from DB...`)

  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: docNumber },
    select: {
      id: true,
      title: true,
      document_number: true,
      html_content: true,
    },
  })

  if (!doc || !doc.html_content) {
    console.error(`Document ${docNumber} not found or has no html_content`)
    process.exit(1)
  }

  console.log(`Found: ${doc.title} (${doc.document_number})`)
  console.log(`HTML length: ${doc.html_content.length} chars`)

  // Estimate tokens
  const inputTokensEst = Math.ceil(doc.html_content.length / 4) + 2000 // html + system prompt
  console.log(`Estimated input tokens: ~${inputTokensEst.toLocaleString()}`)

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  console.log(`\nSending to Claude Haiku (streaming)...\n`)
  const startTime = Date.now()

  const stream = client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Parse this Swedish law HTML into the JSON schema described in your instructions.\n\nDocument: ${doc.document_number} — ${doc.title}\n\n${doc.html_content}`,
      },
    ],
  })

  // Collect streamed text
  let jsonText = ''
  let lastProgress = 0
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      jsonText += event.delta.text
      // Progress indicator every 10K chars
      const progress = Math.floor(jsonText.length / 10000)
      if (progress > lastProgress) {
        lastProgress = progress
        process.stdout.write(
          `  ${jsonText.length.toLocaleString()} chars received...\r`
        )
      }
    }
  }

  const response = await stream.finalMessage()
  const elapsed = Date.now() - startTime
  console.log(`\nResponse received in ${(elapsed / 1000).toFixed(1)}s`)
  console.log(`Input tokens: ${response.usage.input_tokens}`)
  console.log(`Output tokens: ${response.usage.output_tokens}`)
  console.log(`Stop reason: ${response.stop_reason}`)

  // Calculate cost (Haiku pricing)
  const inputCost = (response.usage.input_tokens / 1_000_000) * 1.0
  const outputCost = (response.usage.output_tokens / 1_000_000) * 5.0
  console.log(
    `Cost: $${(inputCost + outputCost).toFixed(4)} (input: $${inputCost.toFixed(4)}, output: $${outputCost.toFixed(4)})`
  )

  jsonText = jsonText.trim()
  // Strip markdown fences if present
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
  }

  // Parse JSON
  let json: any
  try {
    json = JSON.parse(jsonText)
  } catch (e) {
    console.error('Failed to parse JSON response')
    console.error('First 500 chars:', jsonText.slice(0, 500))
    fs.writeFileSync('data/tmp-llm-json-raw.txt', jsonText)
    console.error('Full response saved to data/tmp-llm-json-raw.txt')
    process.exit(1)
  }

  // Validate with Zod
  const validation = validateCanonicalJson(json)
  console.log(`\nZod validation: ${validation.success ? 'PASS' : 'FAIL'}`)
  if (!validation.success) {
    console.log('Errors:', validation.errors?.slice(0, 5))
  }

  // Stats
  const allChapters = json.divisions
    ? json.divisions.flatMap((d: any) => d.chapters)
    : json.chapters || []

  const totalSections = allChapters.reduce(
    (sum: number, ch: any) => sum + (ch.sections?.length || 0),
    0
  )
  const totalParagraphs = allChapters.reduce(
    (sum: number, ch: any) =>
      sum +
      (ch.sections || []).reduce(
        (s: number, sec: any) => s + (sec.paragraphs?.length || 0),
        0
      ),
    0
  )

  // Count new features
  let withAmendRef = 0
  let withStatus = 0
  let numberedParagraphs = 0
  let headingParagraphs = 0

  for (const ch of allChapters) {
    for (const sec of ch.sections || []) {
      if (sec.lastAmendment) withAmendRef++
      if (sec.status) withStatus++
      for (const p of sec.paragraphs || []) {
        if (p.number !== null) numberedParagraphs++
        if (p.role === 'HEADING') headingParagraphs++
      }
    }
  }

  console.log(`\n=== STATS ===`)
  console.log(`Chapters: ${allChapters.length}`)
  console.log(`Sections (§): ${totalSections}`)
  console.log(`Paragraphs: ${totalParagraphs}`)
  console.log(`  with stycke numbers: ${numberedParagraphs}`)
  console.log(`  HEADING role: ${headingParagraphs}`)
  console.log(`Sections with lastAmendment: ${withAmendRef}`)
  console.log(`Sections with status: ${withStatus}`)
  console.log(
    `Transition provisions: ${json.transitionProvisions?.length || 0}`
  )
  console.log(`Divisions: ${json.divisions?.length || 'null'}`)

  // Sample output
  console.log(`\n=== SAMPLE: Chapter 1 ===`)
  const ch1 = allChapters.find((c: any) => c.number === '1')
  if (ch1) {
    console.log(`Title: ${ch1.title}`)
    for (const sec of (ch1.sections || []).slice(0, 3)) {
      console.log(
        `\n  § ${sec.number}${sec.heading ? ' — ' + sec.heading : ''}`
      )
      console.log(`  lastAmendment: ${sec.lastAmendment || '(none)'}`)
      console.log(`  status: ${sec.status || '(active)'}`)
      for (const p of (sec.paragraphs || []).slice(0, 3)) {
        const preview =
          p.text.length > 100 ? p.text.slice(0, 100) + '...' : p.text
        console.log(`    st.${p.number ?? '?'} [${p.role}] ${preview}`)
      }
      if (sec.paragraphs?.length > 3) {
        console.log(`    ... (${sec.paragraphs.length - 3} more)`)
      }
    }
  }

  // Show a repealed section
  console.log(`\n=== REPEALED SECTIONS ===`)
  for (const ch of allChapters) {
    for (const sec of ch.sections || []) {
      if (sec.status === 'repealed') {
        console.log(
          `  Ch ${ch.number} § ${sec.number}: ${sec.status} (${sec.lastAmendment})`
        )
        sec.paragraphs?.forEach((p: any) =>
          console.log(`    "${p.text.slice(0, 80)}"`)
        )
      }
    }
  }

  // Show transition provisions sample
  console.log(`\n=== TRANSITION PROVISIONS (first 5) ===`)
  for (const tp of (json.transitionProvisions || []).slice(0, 5)) {
    console.log(`  [${tp.role}] ${tp.text.slice(0, 120)}`)
  }

  // Check for duplicate § numbers (version marker handling)
  console.log(`\n=== DUPLICATE § CHECK ===`)
  for (const ch of allChapters) {
    const nums = (ch.sections || []).map((s: any) => s.number)
    const dupes = nums.filter((n: string, i: number) => nums.indexOf(n) !== i)
    if (dupes.length > 0) {
      console.log(`  Ch ${ch.number}: duplicate §§: ${dupes.join(', ')}`)
    }
  }
  if (
    allChapters.every((ch: any) => {
      const nums = (ch.sections || []).map((s: any) => s.number)
      return new Set(nums).size === nums.length
    })
  ) {
    console.log('  No duplicates found')
  }

  // Save
  const slug = docNumber.replace(/\s+/g, '-').replace(/:/g, '-').toLowerCase()
  const outPath = `data/${slug}-llm-parsed.json`
  fs.writeFileSync(outPath, JSON.stringify(json, null, 2))
  console.log(`\nFull JSON written to: ${outPath}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
