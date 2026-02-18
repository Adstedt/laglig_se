#!/usr/bin/env tsx
/**
 * Batch Process Amendments Script
 * Story 2.29: Process amendment PDFs through Anthropic Batch API
 *
 * Usage:
 *   pnpm tsx scripts/batch-process-amendments.ts prepare --limit 1000
 *   pnpm tsx scripts/batch-process-amendments.ts submit --batch-file batches/batch-001.jsonl
 *   pnpm tsx scripts/batch-process-amendments.ts status --batch-id batch_abc123
 *   pnpm tsx scripts/batch-process-amendments.ts download --batch-id batch_abc123
 *   pnpm tsx scripts/batch-process-amendments.ts process --results-file results/batch_abc123.jsonl
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  appendFileSync,
  unlinkSync,
} from 'fs'
import { join } from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../lib/prisma'
import { downloadPdfByPath } from '../lib/supabase/storage'
import {
  AMENDMENT_PDF_SYSTEM_PROMPT,
  getAmendmentPdfUserPrompt,
  estimateBatchCost,
} from '../lib/sfs/amendment-llm-prompt'
import {
  validateLlmOutput,
  needsManualReview,
} from '../lib/sfs/llm-output-validator'
import {
  htmlToMarkdown,
  htmlToPlainText,
} from '../lib/transforms/html-to-markdown'
import { htmlToJson } from '../lib/transforms/html-to-json'
import { buildSlugMap, type SlugMap } from '../lib/linkify'
import { linkifyHtmlContent } from '../lib/linkify/linkify-html'
import { createLegalDocumentFromAmendment } from '../lib/sfs/amendment-to-legal-document'
import { ParseStatus, SectionChangeType } from '@prisma/client'

// ============================================================================
// Configuration
// ============================================================================

const BATCH_DIR = 'batches'
const RESULTS_DIR = 'results'
const FAILURES_FILE = 'batch-failures.json'
const MODEL = 'claude-sonnet-4-5-20250929'
const MAX_TOKENS = 8192

interface FailedDocument {
  sfs_number: string
  error: string
  batch_id: string
  attempts: number
  last_attempt: string
}

// ============================================================================
// Commands
// ============================================================================

const commands = {
  prepare,
  submit,
  status,
  download,
  process: processResults,
  estimate,
  'list-pending': listPending,
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] as keyof typeof commands

  if (!command || !commands[command]) {
    console.log(`
Usage: pnpm tsx scripts/batch-process-amendments.ts <command> [options]

Commands:
  prepare         Prepare batch file from database (downloads PDFs)
  submit          Submit batch file to Anthropic API
  status          Check batch status
  download        Download batch results
  process         Process downloaded results into database
  estimate        Estimate cost for pending documents
  list-pending    List documents pending processing

Options:
  --limit N           Limit number of documents (prepare)
  --batch-file PATH   Path to batch JSONL file (submit)
  --batch-id ID       Batch ID (status, download)
  --results-file PATH Path to results JSONL file (process)
  --dry-run           Don't make changes, just show what would happen
    `)
    process.exit(1)
  }

  // Ensure directories exist
  ensureDir(BATCH_DIR)
  ensureDir(RESULTS_DIR)

  try {
    await commands[command](args.slice(1))
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// ============================================================================
// Prepare Command (Parallelized)
// ============================================================================

const CONCURRENCY = 20 // Number of parallel PDF downloads

interface AmendmentDoc {
  sfs_number: string
  storage_path: string
  base_law_sfs: string
  title: string | null
}

async function processAmendmentBatch(
  amendments: AmendmentDoc[]
): Promise<{ requests: string[]; failed: number }> {
  const results = await Promise.allSettled(
    amendments.map(async (amendment) => {
      // Download PDF using actual storage_path from database
      if (!amendment.storage_path) {
        throw new Error(`No storage_path for ${amendment.sfs_number}`)
      }

      const pdfBuffer = await downloadPdfByPath(amendment.storage_path)
      if (!pdfBuffer) {
        throw new Error(
          `Failed to download PDF for ${amendment.sfs_number} (path: ${amendment.storage_path})`
        )
      }

      // Convert to base64
      const pdfBase64 = pdfBuffer.toString('base64')

      // Create batch request
      const normalizedSfs = amendment.sfs_number
        .replace(/^SFS\s*/i, '')
        .replace(':', '-')

      const request = {
        custom_id: `SFS${normalizedSfs}`,
        params: {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: AMENDMENT_PDF_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: pdfBase64,
                  },
                },
                {
                  type: 'text',
                  text: getAmendmentPdfUserPrompt(
                    amendment.sfs_number,
                    amendment.base_law_sfs,
                    amendment.title || undefined
                  ),
                },
              ],
            },
          ],
        },
      }

      return JSON.stringify(request)
    })
  )

  const requests: string[] = []
  let failed = 0

  for (const result of results) {
    if (result.status === 'fulfilled') {
      requests.push(result.value)
    } else {
      failed++
    }
  }

  return { requests, failed }
}

async function prepare(args: string[]) {
  const limit = getArgValue(args, '--limit', 1000)
  const offset = getArgValue(args, '--offset', 0)
  const dryRun = args.includes('--dry-run')
  const concurrency = getArgValue(args, '--concurrency', CONCURRENCY)
  const chunkSize = getArgValue(args, '--chunk-size', 5000)
  const fromFile = getArgValue(args, '--from-file', '')

  console.log(
    `Preparing batch files (limit: ${limit}, offset: ${offset}, concurrency: ${concurrency}, chunk-size: ${chunkSize}, dryRun: ${dryRun})...`
  )

  let toProcess: AmendmentDoc[]

  if (fromFile) {
    // Read specific SFS numbers from file
    console.log(`Reading SFS numbers from ${fromFile}...`)
    const fileContent = readFileSync(fromFile, 'utf-8')
    const sfsNumbers = fileContent
      .trim()
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    console.log(`Found ${sfsNumbers.length} SFS numbers in file`)

    // Convert to full format: "2025:1" -> "SFS 2025:1"
    const fullSfsNumbers = sfsNumbers.map((s) =>
      s.startsWith('SFS') ? s : `SFS ${s}`
    )

    // Fetch amendments for these specific SFS numbers
    const amendments = await prisma.amendmentDocument.findMany({
      where: {
        parse_status: 'COMPLETED',
        sfs_number: { in: fullSfsNumbers },
      },
      select: {
        sfs_number: true,
        storage_path: true,
        base_law_sfs: true,
        title: true,
      },
      orderBy: { sfs_number: 'asc' },
    })

    console.log(`Found ${amendments.length} matching amendments in database`)
    toProcess = amendments
  } else {
    // Original logic: find all amendments without html_content
    const amendments = await prisma.amendmentDocument.findMany({
      where: {
        parse_status: 'COMPLETED',
      },
      select: {
        sfs_number: true,
        storage_path: true,
        base_law_sfs: true,
        title: true,
      },
      orderBy: { sfs_number: 'asc' },
      take: limit,
    })

    console.log(`Found ${amendments.length} amendment documents`)

    // Check which ones already have LegalDocuments with html_content
    const existing = await prisma.legalDocument.findMany({
      where: {
        content_type: 'SFS_AMENDMENT',
        html_content: { not: '' },
      },
      select: { document_number: true },
    })

    // Compare directly — both use "SFS YYYY:NNN" format
    const existingSet = new Set(existing.map((d) => d.document_number))

    const allToProcess = amendments.filter((a) => {
      // sfs_number may or may not have "SFS " prefix — check both
      const withPrefix = a.sfs_number.startsWith('SFS ')
        ? a.sfs_number
        : `SFS ${a.sfs_number}`
      return !existingSet.has(withPrefix)
    })
    console.log(`${allToProcess.length} documents need processing total`)

    // Apply offset to skip already processed documents
    toProcess = offset > 0 ? allToProcess.slice(offset) : allToProcess
    if (offset > 0) {
      console.log(
        `Skipping first ${offset} documents (offset), processing ${toProcess.length}`
      )
    }
  }

  const totalChunks = Math.ceil(toProcess.length / chunkSize)
  console.log(`Will create ${totalChunks} batch files (${chunkSize} docs each)`)

  if (dryRun) {
    console.log('Dry run - not creating batch files')
    const cost = estimateBatchCost(toProcess.length)
    console.log(`Estimated cost: $${cost.costUsd}`)
    return
  }

  const batchTimestamp = Date.now()
  const startTime = Date.now()
  let totalProcessed = 0
  let totalFailed = 0
  const createdFiles: string[] = []

  // Process documents in chunks - stream write to avoid memory issues
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const chunkStart = chunkIndex * chunkSize
    const chunkEnd = Math.min(chunkStart + chunkSize, toProcess.length)
    const chunkDocs = toProcess.slice(chunkStart, chunkEnd)

    const batchPath = join(
      BATCH_DIR,
      `batch-${batchTimestamp}-part${chunkIndex + 1 + Math.floor(offset / chunkSize)}.jsonl`
    )
    console.log(
      `\n=== Processing chunk ${chunkIndex + 1}/${totalChunks} (${chunkDocs.length} docs) ===`
    )

    // Delete file if exists (start fresh)
    if (existsSync(batchPath)) {
      unlinkSync(batchPath)
    }

    let chunkCount = 0

    // Process this chunk in parallel batches - stream write each batch
    for (let i = 0; i < chunkDocs.length; i += concurrency) {
      const batch = chunkDocs.slice(i, i + concurrency)
      const batchNum = Math.floor(i / concurrency) + 1
      const totalBatches = Math.ceil(chunkDocs.length / concurrency)

      process.stdout.write(
        `\rBatch ${batchNum}/${totalBatches} (${i + batch.length}/${chunkDocs.length} in chunk)...`
      )

      const { requests, failed } = await processAmendmentBatch(batch)

      // Stream write each batch immediately to disk
      if (requests.length > 0) {
        const content = (chunkCount > 0 ? '\n' : '') + requests.join('\n')
        appendFileSync(batchPath, content)
        chunkCount += requests.length
      }

      totalProcessed += requests.length
      totalFailed += failed

      // Force garbage collection hint by clearing batch data
      requests.length = 0
    }

    createdFiles.push(batchPath)

    const elapsed = (Date.now() - startTime) / 1000
    const rate = totalProcessed / elapsed
    const remaining = (toProcess.length - totalProcessed) / rate
    console.log(`\n  Written: ${batchPath} (${chunkCount} requests)`)
    console.log(
      `  Progress: ${totalProcessed}/${toProcess.length} total (${rate.toFixed(1)}/s, ~${Math.ceil(remaining / 60)} min remaining)`
    )
  }

  const elapsed = (Date.now() - startTime) / 1000
  console.log(`\n\n=== Summary ===`)
  console.log(`  Total prepared: ${totalProcessed}`)
  console.log(`  Total failed: ${totalFailed}`)
  console.log(`  Time: ${(elapsed / 60).toFixed(1)} minutes`)
  console.log(`  Created ${createdFiles.length} batch files:`)
  for (const file of createdFiles) {
    console.log(`    - ${file}`)
  }

  const cost = estimateBatchCost(totalProcessed)
  console.log(`\n  Estimated total cost: $${cost.costUsd}`)
  console.log(`\nTo submit all batches:`)
  for (const file of createdFiles) {
    console.log(
      `  pnpm tsx scripts/batch-process-amendments.ts submit --batch-file ${file}`
    )
  }
}

// ============================================================================
// Submit Command
// ============================================================================

async function submit(args: string[]) {
  const batchFile = getArgValue(args, '--batch-file', '')
  if (!batchFile) {
    console.error('--batch-file is required')
    process.exit(1)
  }

  if (!existsSync(batchFile)) {
    console.error(`Batch file not found: ${batchFile}`)
    process.exit(1)
  }

  // Max payload size per sub-batch (100MB to stay well under V8 string limit)
  const MAX_PAYLOAD_BYTES = 100 * 1024 * 1024

  console.log(`Submitting batch file: ${batchFile}`)

  const anthropic = new Anthropic()

  // Read JSONL line-by-line using streaming to avoid string size limits
  const { createReadStream } = await import('fs')
  const { createInterface } = await import('readline')

  let currentBatch: Array<{ custom_id: string; params: unknown }> = []
  let currentSize = 0
  let totalRequests = 0
  const batchIds: string[] = []

  async function flushBatch() {
    if (currentBatch.length === 0) return

    const batchNum = batchIds.length + 1
    console.log(
      `\nSubmitting sub-batch ${batchNum} (${currentBatch.length} requests, ~${(currentSize / 1024 / 1024).toFixed(0)}MB)...`
    )

    const batch = await anthropic.messages.batches.create({
      requests: currentBatch,
    })

    batchIds.push(batch.id)
    console.log(`  Batch ID: ${batch.id}`)
    console.log(`  Status: ${batch.processing_status}`)

    currentBatch = []
    currentSize = 0
  }

  const rl = createInterface({
    input: createReadStream(batchFile, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    if (!line.trim()) continue
    const parsed = JSON.parse(line)
    const request = {
      custom_id: parsed.custom_id,
      params: parsed.params,
    }
    const lineSize = Buffer.byteLength(line, 'utf-8')

    // If adding this request would exceed the limit, flush first
    if (currentBatch.length > 0 && currentSize + lineSize > MAX_PAYLOAD_BYTES) {
      await flushBatch()
    }

    currentBatch.push(request)
    currentSize += lineSize
    totalRequests++
  }

  // Flush remaining
  await flushBatch()

  console.log(`\n==============================`)
  console.log(`All batches submitted!`)
  console.log(`  Total requests: ${totalRequests}`)
  console.log(`  Sub-batches created: ${batchIds.length}`)
  console.log(`  Batch IDs:`)
  for (const id of batchIds) {
    console.log(`    ${id}`)
  }
  console.log(`\nTo check status:`)
  for (const id of batchIds) {
    console.log(
      `  pnpm tsx scripts/batch-process-amendments.ts status --batch-id ${id}`
    )
  }
}

// ============================================================================
// Status Command
// ============================================================================

async function status(args: string[]) {
  const batchId = getArgValue(args, '--batch-id', '')
  if (!batchId) {
    console.error('--batch-id is required')
    process.exit(1)
  }

  const anthropic = new Anthropic()
  const batch = await anthropic.messages.batches.retrieve(batchId)

  console.log(`Batch Status: ${batch.id}`)
  console.log(`  Processing Status: ${batch.processing_status}`)
  console.log(`  Requests:`)
  console.log(`    Processing: ${batch.request_counts.processing}`)
  console.log(`    Succeeded: ${batch.request_counts.succeeded}`)
  console.log(`    Errored: ${batch.request_counts.errored}`)
  console.log(`    Canceled: ${batch.request_counts.canceled}`)
  console.log(`    Expired: ${batch.request_counts.expired}`)

  if (batch.processing_status === 'ended') {
    console.log(`\nBatch complete! Download results:`)
    console.log(
      `  pnpm tsx scripts/batch-process-amendments.ts download --batch-id ${batchId}`
    )
  }
}

// ============================================================================
// Download Command
// ============================================================================

async function download(args: string[]) {
  const batchId = getArgValue(args, '--batch-id', '')
  if (!batchId) {
    console.error('--batch-id is required')
    process.exit(1)
  }

  const anthropic = new Anthropic()
  const batch = await anthropic.messages.batches.retrieve(batchId)

  if (batch.processing_status !== 'ended') {
    console.error(
      `Batch is not complete yet. Status: ${batch.processing_status}`
    )
    process.exit(1)
  }

  console.log(`Downloading results for batch: ${batchId}`)

  // Download results using the SDK's results iterator
  const resultsPath = join(RESULTS_DIR, `${batchId}.jsonl`)
  const resultsStream = await anthropic.messages.batches.results(batchId)
  const lines: string[] = []

  for await (const result of resultsStream) {
    lines.push(JSON.stringify(result))
  }

  writeFileSync(resultsPath, lines.join('\n'))

  console.log(`Downloaded ${lines.length} results to ${resultsPath}`)
  console.log(`\nProcess results:`)
  console.log(
    `  pnpm tsx scripts/batch-process-amendments.ts process --results-file ${resultsPath}`
  )
}

// ============================================================================
// Process Results Command
// ============================================================================

async function processResults(args: string[]) {
  const resultsFile = getArgValue(args, '--results-file', '')
  const dryRun = args.includes('--dry-run')

  if (!resultsFile) {
    console.error('--results-file is required')
    process.exit(1)
  }

  if (!existsSync(resultsFile)) {
    console.error(`Results file not found: ${resultsFile}`)
    process.exit(1)
  }

  console.log(`Processing results from: ${resultsFile}`)

  const content = readFileSync(resultsFile, 'utf-8')
  const lines = content.trim().split('\n')

  // Build slug map once for linkification
  console.log('Building slug map for linkification...')
  const slugMap: SlugMap = await buildSlugMap()
  console.log(`Slug map built: ${slugMap.size} entries`)

  let succeeded = 0
  let failed = 0
  let needsReview = 0
  let legalDocsCreated = 0
  let legalDocsUpdated = 0
  let sectionChangesCreated = 0
  const failures: FailedDocument[] = []

  for (const line of lines) {
    try {
      const result = JSON.parse(line)
      // custom_id format: SFS1998-1000 -> convert back to 1998:1000
      const customId = result.custom_id as string
      const sfsNumber = customId.replace(/^SFS/, '').replace('-', ':')

      if (result.result?.type === 'error') {
        console.warn(`Error for ${sfsNumber}: ${result.result.error?.message}`)
        failures.push({
          sfs_number: sfsNumber,
          error: result.result.error?.message || 'Unknown error',
          batch_id: resultsFile,
          attempts: 1,
          last_attempt: new Date().toISOString(),
        })
        failed++
        continue
      }

      // Extract HTML from response
      const responseContent = result.result?.message?.content || []
      const textContent = responseContent.find((c: any) => c.type === 'text')
      if (!textContent?.text) {
        console.warn(`No text content for ${sfsNumber}`)
        failed++
        continue
      }

      // Validate and clean output
      const validation = validateLlmOutput(textContent.text, sfsNumber)

      if (!validation.valid) {
        console.warn(`Invalid output for ${sfsNumber}:`, validation.errors)
        failures.push({
          sfs_number: sfsNumber,
          error: validation.errors.map((e) => e.message).join('; '),
          batch_id: resultsFile,
          attempts: 1,
          last_attempt: new Date().toISOString(),
        })
        failed++
        continue
      }

      if (needsManualReview(validation)) {
        console.log(`${sfsNumber} needs manual review:`, validation.warnings)
        needsReview++
      }

      // Derive all content formats from unlinkified HTML (same as sync cron)
      const htmlContent = validation.cleanedHtml!
      const markdownContent = htmlToMarkdown(htmlContent)
      const jsonContent = htmlToJson(htmlContent, {
        sfsNumber,
        documentType: 'amendment',
      })
      const plainText = htmlToPlainText(htmlContent)

      // Linkify AFTER deriving fields, BEFORE DB write (same as sync cron)
      const documentNumber = `SFS ${sfsNumber}`
      const linkifiedHtml = linkifyHtmlContent(
        htmlContent,
        slugMap,
        documentNumber
      ).html

      if (!dryRun) {
        // Find the AmendmentDocument (try both formats)
        const amendment = await prisma.amendmentDocument.findFirst({
          where: {
            OR: [{ sfs_number: sfsNumber }, { sfs_number: `SFS ${sfsNumber}` }],
          },
        })

        if (!amendment) {
          console.warn(`No AmendmentDocument found for ${sfsNumber}`)
          failed++
          continue
        }

        // Map JSON section changeType to database enum (same as sync cron)
        const mapChangeType = (
          type: 'amended' | 'repealed' | 'new' | null
        ): SectionChangeType => {
          switch (type) {
            case 'amended':
              return SectionChangeType.AMENDED
            case 'repealed':
              return SectionChangeType.REPEALED
            case 'new':
              return SectionChangeType.NEW
            default:
              return SectionChangeType.AMENDED
          }
        }

        // Transaction: SectionChanges + AmendmentDocument update + LegalDocument (same as sync cron)
        await prisma.$transaction(async (tx) => {
          // Delete existing SectionChange records (for re-processing)
          await tx.sectionChange.deleteMany({
            where: { amendment_id: amendment.id },
          })

          // Create SectionChange records from JSON sections
          let sortOrder = 0
          for (const section of jsonContent.sections) {
            if (section.type === 'chapter' && !section.number) continue

            await tx.sectionChange.create({
              data: {
                amendment_id: amendment.id,
                chapter: section.chapter,
                section: section.number || 'unknown',
                change_type: mapChangeType(section.changeType),
                description: section.heading ?? null,
                new_text: section.content || null,
                sort_order: sortOrder++,
              },
            })
            sectionChangesCreated++
          }

          // Extract effective_date from transition provisions (validate date)
          const effectiveDateStr = jsonContent.transitionProvisions.find(
            (tp) => tp.effectiveDate
          )?.effectiveDate
          const parsedDate = effectiveDateStr
            ? new Date(effectiveDateStr)
            : null
          const effectiveDate =
            parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null

          // Update AmendmentDocument with parsed data
          const updatedAmendment = await tx.amendmentDocument.update({
            where: { id: amendment.id },
            data: {
              title: (
                jsonContent.title ||
                amendment.title ||
                `Ändring SFS ${sfsNumber}`
              )
                .replace(/\s+/g, ' ')
                .trim(),
              effective_date: effectiveDate ?? amendment.effective_date,
              full_text: plainText,
              markdown_content: markdownContent,
              parse_status: ParseStatus.COMPLETED,
              parsed_at: new Date(),
              confidence: amendment.confidence,
            },
          })

          // Create/update LegalDocument via bridge function (same as sync cron)
          const legalDocResult = await createLegalDocumentFromAmendment(tx, {
            id: updatedAmendment.id,
            sfs_number: updatedAmendment.sfs_number,
            title: updatedAmendment.title,
            base_law_sfs: updatedAmendment.base_law_sfs,
            base_law_name: updatedAmendment.base_law_name,
            effective_date: updatedAmendment.effective_date,
            publication_date: updatedAmendment.publication_date,
            original_url: updatedAmendment.original_url,
            storage_path: updatedAmendment.storage_path,
            full_text: plainText,
            html_content: linkifiedHtml,
            markdown_content: markdownContent,
            json_content: jsonContent,
            confidence: updatedAmendment.confidence,
          })

          if (legalDocResult.isNew) {
            legalDocsCreated++
          } else {
            legalDocsUpdated++
          }
        })

        // Insert legislative references (outside transaction for performance)
        if (jsonContent.legislativeReferences?.length > 0) {
          const legalDoc = await prisma.legalDocument.findUnique({
            where: { document_number: documentNumber },
            select: { id: true },
          })

          if (legalDoc) {
            await prisma.legislativeRef.deleteMany({
              where: { legal_document_id: legalDoc.id },
            })

            const refTypeMap: Record<
              string,
              'PROP' | 'BET' | 'RSKR' | 'SOU' | 'DS'
            > = {
              prop: 'PROP',
              bet: 'BET',
              rskr: 'RSKR',
              sou: 'SOU',
              ds: 'DS',
            }

            await prisma.legislativeRef.createMany({
              data: jsonContent.legislativeReferences
                .filter((ref) => refTypeMap[ref.type])
                .map((ref) => ({
                  legal_document_id: legalDoc.id,
                  ref_type: refTypeMap[ref.type],
                  reference: ref.reference,
                  year: ref.year,
                  number: ref.number,
                })),
              skipDuplicates: true,
            })
          }
        }
      }

      succeeded++
      if (succeeded % 100 === 0) {
        console.log(
          `  Processed ${succeeded}/${lines.length} (${legalDocsCreated} new, ${legalDocsUpdated} updated, ${sectionChangesCreated} section changes)`
        )
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.warn(`Error processing line: ${msg}`)
      failed++
    }
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log(`PROCESSING COMPLETE`)
  console.log(`${'='.repeat(70)}`)
  console.log(`  Total results: ${lines.length}`)
  console.log(`  Succeeded: ${succeeded}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Needs Review: ${needsReview}`)
  console.log(`  LegalDocuments created: ${legalDocsCreated}`)
  console.log(`  LegalDocuments updated: ${legalDocsUpdated}`)
  console.log(`  SectionChanges created: ${sectionChangesCreated}`)

  if (failures.length > 0) {
    let allFailures: FailedDocument[] = []
    if (existsSync(FAILURES_FILE)) {
      allFailures = JSON.parse(readFileSync(FAILURES_FILE, 'utf-8'))
    }
    allFailures.push(...failures)
    writeFileSync(FAILURES_FILE, JSON.stringify(allFailures, null, 2))
    console.log(`\nFailures logged to ${FAILURES_FILE}`)
  }
}

// ============================================================================
// Estimate Command
// ============================================================================

async function estimate(_args: string[]) {
  // Count amendments needing processing
  const amendments = await prisma.amendmentDocument.count({
    where: {
      parse_status: 'COMPLETED',
    },
  })

  const existing = await prisma.legalDocument.count({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: '' },
    },
  })

  const toProcess = amendments - existing
  const cost = estimateBatchCost(toProcess)

  console.log(`Cost Estimate:`)
  console.log(`  Total amendments: ${amendments}`)
  console.log(`  Already processed: ${existing}`)
  console.log(`  To process: ${toProcess}`)
  console.log(``)
  console.log(`  Estimated tokens:`)
  console.log(`    Input: ${cost.inputTokens.toLocaleString()}`)
  console.log(`    Output: ${cost.outputTokens.toLocaleString()}`)
  console.log(``)
  console.log(`  Estimated cost (with 50% batch discount): $${cost.costUsd}`)
}

// ============================================================================
// List Pending Command
// ============================================================================

async function listPending(args: string[]) {
  const limit = getArgValue(args, '--limit', 20)

  const amendments = await prisma.amendmentDocument.findMany({
    where: {
      parse_status: 'COMPLETED',
      storage_path: { not: null },
    },
    orderBy: { sfs_number: 'desc' },
    take: limit,
  })

  // Check which have LegalDocuments with html_content
  const docNumbers = amendments.map((a) => `SFS ${a.sfs_number}`)
  const existing = await prisma.legalDocument.findMany({
    where: {
      document_number: { in: docNumbers },
      html_content: { not: null },
    },
    select: { document_number: true },
  })

  const existingSet = new Set(existing.map((d) => d.document_number))

  console.log(`Recent amendments (limit ${limit}):`)
  console.log('')

  for (const a of amendments) {
    const docNum = `SFS ${a.sfs_number}`
    const hasHtml = existingSet.has(docNum)
    const status = hasHtml ? '✓' : '○'
    console.log(`${status} ${a.sfs_number} - ${a.title || 'No title'}`)
  }

  console.log('')
  console.log('✓ = has html_content, ○ = needs processing')
}

// ============================================================================
// Utilities
// ============================================================================

function getArgValue(
  _args: string[],
  _flag: string,
  _defaultValue: number
): number
function getArgValue(
  _args: string[],
  _flag: string,
  _defaultValue: string
): string
function getArgValue(
  args: string[],
  flag: string,
  defaultValue: string | number
): string | number {
  const index = args.indexOf(flag)
  if (index === -1 || index + 1 >= args.length) {
    return defaultValue
  }
  const value = args[index + 1]
  return typeof defaultValue === 'number' ? parseInt(value, 10) : value
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

// Run main
main()
