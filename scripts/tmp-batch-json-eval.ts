#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Batch eval: Submit 10 SFS laws to Batch API for JSON parsing.
 *
 * Usage:
 *   npx tsx scripts/tmp-batch-json-eval.ts pick       # Pick 10 docs and show them
 *   npx tsx scripts/tmp-batch-json-eval.ts submit      # Submit batch
 *   npx tsx scripts/tmp-batch-json-eval.ts status      # Check batch status
 *   npx tsx scripts/tmp-batch-json-eval.ts download    # Download results
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../lib/prisma'
import * as fs from 'fs'

const BATCH_DIR = 'data/json-eval-batch'
const BATCH_ID_FILE = `${BATCH_DIR}/batch-id.txt`
const REQUESTS_FILE = `${BATCH_DIR}/requests.jsonl`

// 10 diverse SFS laws: mix of flat, chaptered, small, medium
const DOC_NUMBERS = [
  'SFS 1977:1160', // Arbetsmiljölagen — 9 chapters, 110K
  'SFS 2003:460', // Lag om etikprövning — chaptered, 38K
  'SFS 2018:218', // Dataskyddskompletteringslagen — 32K
  'SFS 1972:207', // Skadeståndslag — 6 chapters, 30K
  'SFS 2014:799', // Sprängämnesprekursorer — small, 13K
  'SFS 1998:204', // Personuppgiftslag — 51K
  'SFS 1915:218', // Avtalslagen — small classic, 27K
  'SFS 2008:486', // Marknadsföringslagen — 68K
  'SFS 2010:1011', // Lag om brandfarliga och explosiva varor — medium
  'SFS 1982:80', // Lag om anställningsskydd (LAS) — classic, medium
]

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
  "number": string,
  "title": string | null,
  "chapters": Chapter[]
}

Chapter:
{
  "number": string | null,
  "title": string | null,
  "sections": Section[]
}

Section (represents a single §):
{
  "number": string,
  "heading": string | null,
  "lastAmendment": string | null,
  "status": string | null,
  "paragraphs": Paragraph[]
}

Paragraph (represents a single stycke):
{
  "number": number | null,
  "text": string,
  "role": string
}

Appendix:
{
  "title": string | null,
  "htmlContent": string,
  "text": string
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

### Flat Documents
- If the document has no chapters (no "kap." headings), use a single chapter with number: null and title: null`

// ============================================================================

async function pick() {
  console.log('Picking 10 SFS laws for batch eval...\n')

  for (const docNum of DOC_NUMBERS) {
    const doc = await prisma.legalDocument.findFirst({
      where: { document_number: docNum },
      select: { document_number: true, title: true, html_content: true },
    })
    if (!doc) {
      console.log(`  ✗ ${docNum} — NOT FOUND`)
      continue
    }
    const htmlLen = doc.html_content?.length ?? 0
    const estTokens = Math.ceil(htmlLen / 4)
    console.log(
      `  ✓ ${docNum} — ${doc.title} (${htmlLen.toLocaleString()} chars, ~${estTokens.toLocaleString()} tokens)`
    )
  }

  await prisma.$disconnect()
}

async function submit() {
  if (!fs.existsSync(BATCH_DIR)) fs.mkdirSync(BATCH_DIR, { recursive: true })

  console.log('Building batch requests...\n')
  const requests: string[] = []

  for (const docNum of DOC_NUMBERS) {
    const doc = await prisma.legalDocument.findFirst({
      where: { document_number: docNum },
      select: {
        id: true,
        document_number: true,
        title: true,
        html_content: true,
      },
    })
    if (!doc?.html_content) {
      console.log(`  ✗ ${docNum} — skipped (not found or no HTML)`)
      continue
    }

    const slug = docNum.replace(/\s+/g, '-').replace(/:/g, '-').toLowerCase()
    console.log(
      `  ✓ ${docNum} — ${doc.html_content.length.toLocaleString()} chars`
    )

    const request = {
      custom_id: slug,
      params: {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 64000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Parse this Swedish law HTML into the JSON schema described in your instructions.\n\nDocument: ${doc.document_number} — ${doc.title}\n\n${doc.html_content}`,
          },
        ],
      },
    }
    requests.push(JSON.stringify(request))
  }

  // Write JSONL
  fs.writeFileSync(REQUESTS_FILE, requests.join('\n'))
  console.log(`\nWrote ${requests.length} requests to ${REQUESTS_FILE}`)

  // Submit batch
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  console.log('\nSubmitting batch...')

  const batch = await client.messages.batches.create({
    requests: requests.map((r) => JSON.parse(r)),
  })

  fs.writeFileSync(BATCH_ID_FILE, batch.id)
  console.log(`Batch ID: ${batch.id}`)
  console.log(`Status: ${batch.processing_status}`)
  console.log(`Saved batch ID to ${BATCH_ID_FILE}`)

  await prisma.$disconnect()
}

async function status() {
  if (!fs.existsSync(BATCH_ID_FILE)) {
    console.error('No batch ID found. Run "submit" first.')
    process.exit(1)
  }

  const batchId = fs.readFileSync(BATCH_ID_FILE, 'utf8').trim()
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const batch = await client.messages.batches.retrieve(batchId)
  console.log(`Batch: ${batch.id}`)
  console.log(`Status: ${batch.processing_status}`)
  console.log(`Counts:`, JSON.stringify(batch.request_counts, null, 2))
  console.log(`Created: ${batch.created_at}`)
  if (batch.ended_at) console.log(`Ended: ${batch.ended_at}`)
}

async function download() {
  if (!fs.existsSync(BATCH_ID_FILE)) {
    console.error('No batch ID found. Run "submit" first.')
    process.exit(1)
  }

  const batchId = fs.readFileSync(BATCH_ID_FILE, 'utf8').trim()
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Check status first
  const batch = await client.messages.batches.retrieve(batchId)
  if (batch.processing_status !== 'ended') {
    console.log(`Batch not done yet. Status: ${batch.processing_status}`)
    console.log(`Counts:`, JSON.stringify(batch.request_counts, null, 2))
    return
  }

  console.log(`Downloading results for batch ${batchId}...\n`)

  let totalInput = 0
  let totalOutput = 0
  let success = 0
  let failed = 0

  const resultsStream = await client.messages.batches.results(batchId)
  for await (const result of resultsStream) {
    const customId = result.custom_id
    const outFile = `${BATCH_DIR}/${customId}.json`

    if (result.result.type === 'succeeded') {
      const message = result.result.message
      totalInput += message.usage.input_tokens
      totalOutput += message.usage.output_tokens

      // Extract JSON text
      const textBlock = message.content.find((b: any) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        console.log(`  ✗ ${customId} — no text content`)
        failed++
        continue
      }

      let jsonText = textBlock.text.trim()
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
      }

      try {
        const json = JSON.parse(jsonText)
        fs.writeFileSync(outFile, JSON.stringify(json, null, 2))

        // Quick stats
        const chapters = json.divisions
          ? json.divisions.flatMap((d: any) => d.chapters)
          : json.chapters || []
        const sections = chapters.reduce(
          (s: number, ch: any) => s + (ch.sections?.length || 0),
          0
        )
        const paragraphs = chapters.reduce(
          (s: number, ch: any) =>
            s +
            (ch.sections || []).reduce(
              (ss: number, sec: any) => ss + (sec.paragraphs?.length || 0),
              0
            ),
          0
        )

        console.log(
          `  ✓ ${customId} — ${chapters.length} ch, ${sections} §, ${paragraphs} p (${message.usage.output_tokens} out tokens)`
        )
        success++
      } catch {
        console.log(`  ✗ ${customId} — JSON parse error`)
        fs.writeFileSync(`${BATCH_DIR}/${customId}-raw.txt`, jsonText)
        failed++
      }
    } else {
      console.log(
        `  ✗ ${customId} — ${result.result.type}: ${JSON.stringify(result.result)}`
      )
      failed++
    }
  }

  // Cost (Batch API = 50% of standard)
  const inputCost = (totalInput / 1_000_000) * 0.5 // Haiku batch input
  const outputCost = (totalOutput / 1_000_000) * 2.5 // Haiku batch output
  console.log(`\n=== SUMMARY ===`)
  console.log(`Success: ${success}, Failed: ${failed}`)
  console.log(`Total input tokens: ${totalInput.toLocaleString()}`)
  console.log(`Total output tokens: ${totalOutput.toLocaleString()}`)
  console.log(
    `Batch cost: $${(inputCost + outputCost).toFixed(4)} (input: $${inputCost.toFixed(4)}, output: $${outputCost.toFixed(4)})`
  )
  console.log(`\nFiles saved to ${BATCH_DIR}/`)
}

// CLI
const cmd = process.argv[2] || 'pick'
if (cmd === 'pick') pick().catch(console.error)
else if (cmd === 'submit') submit().catch(console.error)
else if (cmd === 'status') status().catch(console.error)
else if (cmd === 'download') download().catch(console.error)
else
  console.error(`Unknown command: ${cmd}. Use: pick, submit, status, download`)
