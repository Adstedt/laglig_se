/**
 * Batch Parse Amendments using Anthropic Message Batches API
 *
 * Story 2.13: Amendment Documents & Historical Versions
 * Phase 2: LLM parsing using batch API for 50% cost savings
 *
 * Workflow:
 * 1. Create batch: pnpm tsx scripts/batch-parse-amendments.ts --create
 * 2. Check status: pnpm tsx scripts/batch-parse-amendments.ts --status <batch_id>
 * 3. Process results: pnpm tsx scripts/batch-parse-amendments.ts --process <batch_id>
 *
 * The batch API processes requests asynchronously (typically within 24h)
 * at 50% of the real-time API cost.
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import * as fs from 'fs'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient, ParseStatus, SectionChangeType } from '@prisma/client'
import type { ParsedAmendmentLLM } from '../lib/external/llm-amendment-parser'

const prisma = new PrismaClient()

// ============================================================================
// EXACT SAME PROMPT as llm-amendment-parser.ts - DO NOT MODIFY
// ============================================================================

const AMENDMENT_PARSE_PROMPT = `You are an expert Swedish legal document parser. Analyze this amendment document (ändringsförfattning) and extract ALL structured data.

<document>
{fullText}
</document>

Extract the following and return as JSON with these EXACT field names:

{
  "baseLaw": {
    "name": "law name in Swedish (e.g., arbetsmiljölagen)",
    "sfsNumber": "YYYY:NNN format (e.g., 1977:1160)"
  },
  "title": "Full document title or null",
  "effectiveDate": "YYYY-MM-DD or null",
  "publicationDate": "YYYY-MM-DD (from 'Utfärdad den X') or null",
  "affectedSections": [
    {
      "chapter": "chapter number as string or null if no chapter",
      "section": "section number as string (e.g., '15' or '2a')",
      "changeType": "amended|repealed|new|renumbered",
      "oldNumber": "for renumbering only: the old section number",
      "description": "kort beskrivning på svenska av ändringen (t.ex. 'ska ha följande lydelse' eller 'ny paragraf om...')",
      "newText": "the FULL new text of this section as it appears in the document (for amended/new sections)"
    }
  ],
  "transitionalProvisions": [
    {
      "description": "description of the transitional rule",
      "effectiveUntil": "YYYY-MM-DD or null",
      "affectedSections": ["list of section references"]
    }
  ],
  "confidence": 0.95
}

CRITICAL PARSING RULES:

1. SECTION RANGES: Expand "15–20 §§" into individual entries (15, 16, 17, 18, 19, 20)

2. MULTIPLE SECTIONS: Parse "2 och 5 §§" as TWO separate entries (section 2 AND section 5)

3. CHAPTER CONTEXT: "9 kap. 2 och 5 §§" means BOTH sections are in chapter 9

4. CHANGE TYPES:
   - "ska ha följande lydelse" → "amended"
   - "upphävs" or "ska upphävas" or "upphöra att gälla" → "repealed"
   - "nya paragrafer" or "införas" or "tillkommer" → "new"
   - "X § blir Y §" → "renumbered" (include oldNumber)

5. DATES:
   - effectiveDate: from "träder i kraft den X"
   - publicationDate: from "Utfärdad den X"
   - Convert Swedish dates: "1 juli 2022" → "2022-07-01"

6. TRANSITIONAL PROVISIONS (Övergångsbestämmelser):
   - Usually at the end of the document
   - May specify when old rules still apply
   - May have time limits

7. CONFIDENCE SCORE:
   - 0.95-1.0: Clear, unambiguous document
   - 0.8-0.95: Some complexity but confident
   - 0.6-0.8: Complex patterns, may need review
   - <0.6: Very complex or unclear, needs human review

8. SECTION TEXT EXTRACTION (CRITICAL):
   - For AMENDED and NEW sections, extract the COMPLETE text content from the document
   - The newText field must contain the full paragraph text as it appears after the section header
   - Include everything from the section number until the next section or chapter begins
   - For REPEALED sections, newText should be null
   - This is essential for version reconstruction - do not skip text extraction

Return ONLY valid JSON. No markdown code blocks, no explanations.`

// ============================================================================
// Types
// ============================================================================

interface BatchRequest {
  custom_id: string
  params: {
    model: string
    max_tokens: number
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  }
}

interface BatchResultItem {
  custom_id: string
  result?: {
    type: 'succeeded' | 'errored' | 'expired'
    message?: {
      content: Array<{ type: 'text'; text: string }>
    }
    error?: {
      type: string
      message: string
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapChangeType(llmType: string): SectionChangeType {
  const map: Record<string, SectionChangeType> = {
    amended: 'AMENDED',
    repealed: 'REPEALED',
    new: 'NEW',
    renumbered: 'RENUMBERED',
  }
  return map[llmType] || 'AMENDED'
}

function parseJsonResponse(text: string): ParsedAmendmentLLM {
  let jsonText = text.trim()

  // Remove markdown code blocks if present
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const parsed = JSON.parse(jsonText) as ParsedAmendmentLLM

  // Validate required fields
  if (!parsed.baseLaw?.sfsNumber) {
    throw new Error('Missing required field: baseLaw.sfsNumber')
  }
  if (!Array.isArray(parsed.affectedSections)) {
    throw new Error('Missing required field: affectedSections')
  }

  // Normalize section data
  parsed.affectedSections = parsed.affectedSections.map((section) => ({
    chapter: section.chapter || null,
    section: String(section.section),
    changeType: section.changeType,
    oldNumber: section.oldNumber || null,
    description: section.description || '',
    newText: section.newText || null,
  }))

  // Ensure confidence is set
  if (typeof parsed.confidence !== 'number') {
    parsed.confidence = 0.8
  }

  return parsed
}

// ============================================================================
// Enhanced prompt for retries (includes balkar lookup)
// ============================================================================

const RETRY_PARSE_PROMPT = `You are an expert Swedish legal document parser. Analyze this amendment document (ändringsförfattning) and extract ALL structured data.

<document>
{fullText}
</document>

<known_law_codes>
These are well-known Swedish law codes and their SFS numbers:
GRUNDLAGAR (Constitutional laws):
- riksdagsordningen: 2014:801
- regeringsformen: 1974:152
- tryckfrihetsförordningen: 1949:105
- yttrandefrihetsgrundlagen: 1991:1469
- successionsordningen: 1810:0926

BALKAR (Major codes):
- brottsbalken: 1962:700
- rättegångsbalken: 1942:740
- miljöbalken: 1998:808
- socialförsäkringsbalken: 2010:110
- föräldrabalken: 1949:381
- ärvdabalken: 1958:637
- äktenskapsbalken: 1987:230
- jordabalken: 1970:994
- utsökningsbalken: 1981:774
- handelsbalken: 1736:0123 2

OTHER MAJOR LAWS:
- plan- och bygglagen: 2010:900
- offentlighets- och sekretesslagen: 2009:400
- skatteförfarandelagen: 2011:1244
- inkomstskattelagen: 1999:1229
- aktiebolagslagen: 2005:551
- utlänningslagen: 2005:716
- luftfartslagen: 2010:500
- sjölagen: 1994:1009
- skollagen: 2010:800
- hälso- och sjukvårdslagen: 2017:30
- socialtjänstlagen: 2001:453
</known_law_codes>

Extract the following and return as JSON:

{
  "baseLaw": {
    "name": "law name in Swedish",
    "sfsNumber": "YYYY:NNN format - USE THE LOOKUP TABLE ABOVE FOR WELL-KNOWN LAWS"
  },
  "title": "Full document title or null",
  "effectiveDate": "YYYY-MM-DD or null",
  "publicationDate": "YYYY-MM-DD or null",
  "affectedSections": [
    {
      "chapter": "chapter number as string or null",
      "section": "section number as string",
      "changeType": "amended|repealed|new|renumbered",
      "oldNumber": "for renumbering only",
      "description": "brief description",
      "newText": "the new text content or null"
    }
  ],
  "transitionalProvisions": [],
  "confidence": 0.9
}

CRITICAL RULES:
1. For well-known Swedish law codes (grundlagar, balkar), use the SFS numbers from the lookup table above
2. Expand section ranges: "15-20 §§" → individual entries for 15, 16, 17, 18, 19, 20
3. "9 kap. 2 och 5 §§" means BOTH sections 2 AND 5 are in chapter 9
4. Change types: "ska ha följande lydelse" → amended, "upphävs" → repealed, "införas" → new
5. Convert dates: "1 juli 2022" → "2022-07-01"
6. SKIP the newText field entirely - set it to null for ALL sections (we already have the full text)

Return ONLY valid JSON. No markdown, no explanations, no code blocks.`

// ============================================================================
// Create Batch
// ============================================================================

async function createBatch(options: { limit?: number; year?: number }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set')
  }

  console.log('Fetching unparsed amendment documents...')

  // Get documents that have text but no section changes (need LLM parsing)
  // This handles both PENDING status AND docs ingested with --skip-llm
  const whereClause: Record<string, unknown> = {
    full_text: { not: null },
    section_changes: { none: {} }, // No section changes = not parsed by LLM
  }

  if (options.year) {
    whereClause.sfs_number = { startsWith: `SFS ${options.year}:` }
  }

  const documents = await prisma.amendmentDocument.findMany({
    where: whereClause,
    select: {
      id: true,
      sfs_number: true,
      full_text: true,
    },
    take: options.limit || undefined,
    orderBy: { sfs_number: 'asc' },
  })

  console.log(`Found ${documents.length} documents to parse`)

  if (documents.length === 0) {
    console.log('No documents to process. Exiting.')
    return
  }

  // Create batch requests
  // custom_id must match ^[a-zA-Z0-9_-]{1,64}$
  // Convert "SFS 2025:400" to "SFS_2025-400"
  const requests: BatchRequest[] = documents.map((doc) => ({
    custom_id: doc.sfs_number.replace(' ', '_').replace(':', '-'),
    params: {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user' as const,
          content: AMENDMENT_PARSE_PROMPT.replace(
            '{fullText}',
            doc.full_text || ''
          ),
        },
      ],
    },
  }))

  // Write requests to JSONL file
  const batchDir = path.join(process.cwd(), 'data', 'batches')
  if (!fs.existsSync(batchDir)) {
    fs.mkdirSync(batchDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const inputFile = path.join(batchDir, `batch-input-${timestamp}.jsonl`)

  const jsonlContent = requests.map((r) => JSON.stringify(r)).join('\n')
  fs.writeFileSync(inputFile, jsonlContent)

  console.log(`\nBatch input file created: ${inputFile}`)
  console.log(`Documents: ${requests.length}`)

  // Submit batch to Anthropic
  console.log('\nSubmitting batch to Anthropic API...')

  const client = new Anthropic({ apiKey })

  // Upload the file and create batch
  const _fileContent = fs.readFileSync(inputFile)

  const batch = await client.messages.batches.create({
    requests: requests,
  })

  console.log('\n' + '='.repeat(70))
  console.log('BATCH CREATED SUCCESSFULLY')
  console.log('='.repeat(70))
  console.log(`Batch ID: ${batch.id}`)
  console.log(`Status: ${batch.processing_status}`)
  console.log(
    `Requests: ${batch.request_counts.processing + batch.request_counts.succeeded + batch.request_counts.errored}`
  )
  console.log(
    `\nTo check status: pnpm tsx scripts/batch-parse-amendments.ts --status ${batch.id}`
  )
  console.log(
    `To process results: pnpm tsx scripts/batch-parse-amendments.ts --process ${batch.id}`
  )

  // Save batch info
  const batchInfoFile = path.join(batchDir, `batch-info-${batch.id}.json`)
  fs.writeFileSync(
    batchInfoFile,
    JSON.stringify(
      {
        batchId: batch.id,
        createdAt: new Date().toISOString(),
        documentCount: requests.length,
        inputFile,
        sfsNumbers: requests.map((r) => r.custom_id),
      },
      null,
      2
    )
  )

  return batch.id
}

// ============================================================================
// Check Status
// ============================================================================

async function checkStatus(batchId: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set')
  }

  const client = new Anthropic({ apiKey })

  const batch = await client.messages.batches.retrieve(batchId)

  console.log('='.repeat(70))
  console.log('BATCH STATUS')
  console.log('='.repeat(70))
  console.log(`Batch ID: ${batch.id}`)
  console.log(`Status: ${batch.processing_status}`)
  console.log(`Created: ${batch.created_at}`)
  if (batch.ended_at) {
    console.log(`Ended: ${batch.ended_at}`)
  }
  console.log('\nRequest counts:')
  console.log(`  Processing: ${batch.request_counts.processing}`)
  console.log(`  Succeeded: ${batch.request_counts.succeeded}`)
  console.log(`  Errored: ${batch.request_counts.errored}`)
  console.log(`  Canceled: ${batch.request_counts.canceled}`)
  console.log(`  Expired: ${batch.request_counts.expired}`)

  if (batch.processing_status === 'ended') {
    console.log(
      `\nBatch complete! Run: pnpm tsx scripts/batch-parse-amendments.ts --process ${batchId}`
    )
  }

  return batch
}

// ============================================================================
// Process Results
// ============================================================================

async function processResults(
  batchId: string,
  options: { confidenceThreshold?: number; resume?: boolean }
) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set')
  }

  const confidenceThreshold = options.confidenceThreshold || 0.7
  const shouldResume = options.resume !== false // Default to true
  const client = new Anthropic({ apiKey })

  const batchDir = path.join(process.cwd(), 'data', 'batches')
  const resultsFile = path.join(batchDir, `batch-results-${batchId}.jsonl`)

  let results: BatchResultItem[] = []

  // Try to load from existing file first (for resume)
  if (fs.existsSync(resultsFile)) {
    console.log(`Loading results from existing file: ${resultsFile}`)
    const lines = fs
      .readFileSync(resultsFile, 'utf-8')
      .split('\n')
      .filter(Boolean)
    results = lines.map((line) => JSON.parse(line) as BatchResultItem)
    console.log(`Loaded ${results.length} results from file`)
  } else {
    // Check batch status first
    const batch = await client.messages.batches.retrieve(batchId)

    if (batch.processing_status !== 'ended') {
      console.log(`Batch not yet complete. Status: ${batch.processing_status}`)
      console.log('Please wait for the batch to finish processing.')
      return
    }

    console.log('Fetching batch results from API...')

    // Get results using the streaming API
    const resultsStream = await client.messages.batches.results(batchId)

    for await (const result of resultsStream) {
      results.push(result as BatchResultItem)
    }

    // Save raw results
    fs.writeFileSync(
      resultsFile,
      results.map((r) => JSON.stringify(r)).join('\n')
    )
    console.log(`Raw results saved to: ${resultsFile}`)
  }

  // Get already-processed SFS numbers (those with section_changes)
  let alreadyProcessed = new Set<string>()
  if (shouldResume) {
    console.log('Checking for already-processed documents...')
    const processed = await prisma.amendmentDocument.findMany({
      where: {
        section_changes: { some: {} },
        parse_status: 'COMPLETED',
      },
      select: { sfs_number: true },
    })
    alreadyProcessed = new Set(processed.map((p) => p.sfs_number))
    console.log(
      `Found ${alreadyProcessed.size} already-processed documents to skip`
    )
  }

  // Process each result
  let processed = 0
  let skipped = 0
  let errors = 0
  let lowConfidence = 0
  const errorList: Array<{ sfsNumber: string; error: string }> = []

  const toProcess = results.filter((item) => {
    const sfsNumber = item.custom_id.replace('_', ' ').replace('-', ':')
    if (alreadyProcessed.has(sfsNumber)) {
      skipped++
      return false
    }
    return true
  })

  console.log(
    `\nProcessing ${toProcess.length} results (skipped ${skipped} already done)...`
  )

  for (const item of toProcess) {
    // Convert custom_id back to SFS format (SFS_2025-400 -> SFS 2025:400)
    const sfsNumber = item.custom_id.replace('_', ' ').replace('-', ':')

    try {
      if (item.result?.type !== 'succeeded') {
        throw new Error(
          item.result?.error?.message || `Request ${item.result?.type}`
        )
      }

      const textContent = item.result.message?.content.find(
        (c) => c.type === 'text'
      )
      if (!textContent) {
        throw new Error('No text content in response')
      }

      const parsed = parseJsonResponse(textContent.text)

      // Normalize base_law_sfs to "SFS YYYY:NNN" format
      const baseLawSfs = parsed.baseLaw.sfsNumber.startsWith('SFS ')
        ? parsed.baseLaw.sfsNumber
        : `SFS ${parsed.baseLaw.sfsNumber}`

      // Determine parse status
      let parseStatus: ParseStatus = 'COMPLETED'
      if (parsed.confidence < confidenceThreshold) {
        parseStatus = 'NEEDS_REVIEW'
        lowConfidence++
      }

      // Update amendment document
      const amendmentDoc = await prisma.amendmentDocument.update({
        where: { sfs_number: sfsNumber },
        data: {
          base_law_sfs: baseLawSfs,
          base_law_name: parsed.baseLaw.name || null,
          title: parsed.title || undefined,
          effective_date: parsed.effectiveDate
            ? new Date(parsed.effectiveDate)
            : null,
          publication_date: parsed.publicationDate
            ? new Date(parsed.publicationDate)
            : null,
          parse_status: parseStatus,
          parsed_at: new Date(),
          confidence: parsed.confidence,
        },
      })

      // Delete existing section changes
      await prisma.sectionChange.deleteMany({
        where: { amendment_id: amendmentDoc.id },
      })

      // Insert section changes (deduplicate to avoid unique constraint errors)
      if (parsed.affectedSections?.length) {
        // Deduplicate by (chapter, section, changeType)
        const seen = new Set<string>()
        const uniqueSections = parsed.affectedSections.filter((s) => {
          const key = `${s.chapter || ''}-${s.section}-${s.changeType}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        await prisma.sectionChange.createMany({
          data: uniqueSections.map((section, index) => ({
            amendment_id: amendmentDoc.id,
            chapter: section.chapter || null,
            section: section.section,
            change_type: mapChangeType(section.changeType),
            old_number: section.oldNumber || null,
            description: section.description || null,
            new_text: section.newText || null,
            sort_order: index,
          })),
        })
      }

      processed++

      if (processed % 50 === 0) {
        console.log(`  Processed ${processed}/${toProcess.length}`)
      }
    } catch (error) {
      errors++
      const errorMsg = error instanceof Error ? error.message : String(error)
      errorList.push({ sfsNumber, error: errorMsg })

      // Mark as failed in database
      try {
        await prisma.amendmentDocument.update({
          where: { sfs_number: sfsNumber },
          data: {
            parse_status: 'FAILED',
            parse_error: errorMsg,
          },
        })
      } catch {
        // Ignore secondary errors
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('PROCESSING COMPLETE')
  console.log('='.repeat(70))
  console.log(`Total results: ${results.length}`)
  console.log(`Skipped (already done): ${skipped}`)
  console.log(`Successfully processed: ${processed}`)
  console.log(`Errors: ${errors}`)
  console.log(`Low confidence (needs review): ${lowConfidence}`)

  if (errorList.length > 0) {
    console.log('\nErrors:')
    errorList.slice(0, 10).forEach((e) => {
      console.log(`  - ${e.sfsNumber}: ${e.error}`)
    })
    if (errorList.length > 10) {
      console.log(`  ... and ${errorList.length - 10} more`)
    }

    // Save error list
    const errorFile = path.join(batchDir, `batch-errors-${batchId}.json`)
    fs.writeFileSync(errorFile, JSON.stringify(errorList, null, 2))
    console.log(`\nError list saved to: ${errorFile}`)
  }

  // Database stats
  const dbStats = await prisma.amendmentDocument.groupBy({
    by: ['parse_status'],
    _count: true,
  })
  const sectionCount = await prisma.sectionChange.count()

  console.log('\nDatabase stats:')
  dbStats.forEach((s) => {
    console.log(`  - ${s.parse_status}: ${s._count}`)
  })
  console.log(`  - Section changes: ${sectionCount}`)
}

// ============================================================================
// List Batches
// ============================================================================

async function listBatches() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set')
  }

  const client = new Anthropic({ apiKey })

  console.log('Fetching batches...\n')

  const batches = await client.messages.batches.list({ limit: 20 })

  console.log('='.repeat(70))
  console.log('RECENT BATCHES')
  console.log('='.repeat(70))

  for (const batch of batches.data) {
    const total =
      batch.request_counts.processing +
      batch.request_counts.succeeded +
      batch.request_counts.errored +
      batch.request_counts.canceled +
      batch.request_counts.expired

    console.log(`\nBatch ID: ${batch.id}`)
    console.log(`  Status: ${batch.processing_status}`)
    console.log(`  Created: ${batch.created_at}`)
    console.log(
      `  Requests: ${total} (${batch.request_counts.succeeded} succeeded, ${batch.request_counts.errored} errored)`
    )
  }
}

// ============================================================================
// Retry Failed Batch
// ============================================================================

async function retryFailedBatch(options: { limit?: number }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set')
  }

  console.log('Fetching FAILED amendment documents...')

  const documents = await prisma.amendmentDocument.findMany({
    where: {
      parse_status: 'FAILED',
      full_text: { not: null },
    },
    select: {
      id: true,
      sfs_number: true,
      full_text: true,
    },
    take: options.limit || undefined,
    orderBy: { sfs_number: 'asc' },
  })

  console.log(`Found ${documents.length} failed documents to retry`)

  if (documents.length === 0) {
    console.log('No failed documents to process. Exiting.')
    return
  }

  // Create batch requests with RETRY prompt (includes grundlagar + balkar lookup)
  const requests: BatchRequest[] = documents.map((doc) => ({
    custom_id: doc.sfs_number.replace(' ', '_').replace(':', '-'),
    params: {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000, // Further increased for large documents
      messages: [
        {
          role: 'user' as const,
          content: RETRY_PARSE_PROMPT.replace(
            '{fullText}',
            doc.full_text || ''
          ),
        },
      ],
    },
  }))

  // Write requests to JSONL file
  const batchDir = path.join(process.cwd(), 'data', 'batches')
  if (!fs.existsSync(batchDir)) {
    fs.mkdirSync(batchDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const inputFile = path.join(batchDir, `batch-retry-${timestamp}.jsonl`)

  const jsonlContent = requests.map((r) => JSON.stringify(r)).join('\n')
  fs.writeFileSync(inputFile, jsonlContent)

  console.log(`\nBatch input file created: ${inputFile}`)
  console.log(`Documents: ${requests.length}`)

  // Submit batch to Anthropic
  console.log('\nSubmitting retry batch to Anthropic API...')

  const client = new Anthropic({ apiKey })

  const batch = await client.messages.batches.create({
    requests: requests,
  })

  console.log('\n' + '='.repeat(70))
  console.log('RETRY BATCH CREATED SUCCESSFULLY')
  console.log('='.repeat(70))
  console.log(`Batch ID: ${batch.id}`)
  console.log(`Status: ${batch.processing_status}`)
  console.log(
    `Requests: ${batch.request_counts.processing + batch.request_counts.succeeded + batch.request_counts.errored}`
  )
  console.log(
    `\nTo check status: pnpm tsx scripts/batch-parse-amendments.ts --status ${batch.id}`
  )
  console.log(
    `To process results: pnpm tsx scripts/batch-parse-amendments.ts --process ${batch.id}`
  )

  // Save batch info
  const batchInfoFile = path.join(batchDir, `batch-info-${batch.id}.json`)
  fs.writeFileSync(
    batchInfoFile,
    JSON.stringify(
      {
        batchId: batch.id,
        createdAt: new Date().toISOString(),
        type: 'retry-failed',
        documentCount: requests.length,
        inputFile,
        sfsNumbers: requests.map((r) => r.custom_id),
      },
      null,
      2
    )
  )

  return batch.id
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.length === 0) {
    console.log(`
Batch Parse Amendments - Anthropic Message Batches API

Usage:
  pnpm tsx scripts/batch-parse-amendments.ts --create [--limit N] [--year YYYY]
  pnpm tsx scripts/batch-parse-amendments.ts --retry-failed [--limit N]
  pnpm tsx scripts/batch-parse-amendments.ts --status <batch_id>
  pnpm tsx scripts/batch-parse-amendments.ts --process <batch_id>
  pnpm tsx scripts/batch-parse-amendments.ts --list

Commands:
  --create       Create a new batch from unparsed amendment documents
  --retry-failed Create a batch to retry FAILED amendments with improved prompt
  --status       Check the status of a batch
  --process      Process completed batch results into the database
  --list         List recent batches

Options:
  --limit N    Limit number of documents to process (default: all)
  --year YYYY  Only process documents from a specific year
  --confidence N  Confidence threshold for NEEDS_REVIEW (default: 0.7)
`)
    process.exit(0)
  }

  try {
    if (args.includes('--create')) {
      const limitIdx = args.indexOf('--limit')
      const yearIdx = args.indexOf('--year')

      await createBatch({
        limit: limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : undefined,
        year: yearIdx >= 0 ? parseInt(args[yearIdx + 1], 10) : undefined,
      })
    } else if (args.includes('--retry-failed')) {
      const limitIdx = args.indexOf('--limit')

      await retryFailedBatch({
        limit: limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : undefined,
      })
    } else if (args.includes('--status')) {
      const statusIdx = args.indexOf('--status')
      const batchId = args[statusIdx + 1]
      if (!batchId) {
        console.error('Error: Batch ID required for --status')
        process.exit(1)
      }
      await checkStatus(batchId)
    } else if (args.includes('--process')) {
      const processIdx = args.indexOf('--process')
      const batchId = args[processIdx + 1]
      if (!batchId) {
        console.error('Error: Batch ID required for --process')
        process.exit(1)
      }

      const confIdx = args.indexOf('--confidence')
      await processResults(batchId, {
        confidenceThreshold:
          confIdx >= 0 ? parseFloat(args[confIdx + 1]) : undefined,
      })
    } else if (args.includes('--list')) {
      await listBatches()
    } else {
      console.error('Unknown command. Use --help for usage.')
      process.exit(1)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
