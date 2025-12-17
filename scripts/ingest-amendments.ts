/**
 * Ingest Amendment Documents Pipeline
 *
 * Story 2.13: Amendment Documents & Historical Versions
 * Phase 2: End-to-end ingestion from PDF to database
 *
 * Pipeline:
 * 1. Read crawl index
 * 2. Download PDFs (or read from Supabase Storage)
 * 3. Extract text from PDF
 * 4. Parse with LLM
 * 5. Store in database (AmendmentDocument + SectionChange)
 *
 * Usage:
 *   pnpm tsx scripts/ingest-amendments.ts --year 2025 --limit 10
 *   pnpm tsx scripts/ingest-amendments.ts --year 2025 --type amendment --resume
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient, ParseStatus, SectionChangeType } from '@prisma/client'
import { parsePdf } from '../lib/external/pdf-parser'
import {
  parseAmendmentWithLLM,
  type ParsedAmendmentLLM,
} from '../lib/external/llm-amendment-parser'
import {
  downloadPdf,
  getStoragePath,
  uploadPdf,
  pdfExists,
} from '../lib/supabase/storage'
import type {
  CrawlResult,
  CrawledDocument,
  DocumentType,
} from './crawl-sfs-index'

const prisma = new PrismaClient()

interface IngestStats {
  total: number
  processed: number
  skipped: number
  errors: number
  lowConfidence: number
  errorList: Array<{ sfsNumber: string; error: string }>
}

type IndexSource = 'svenskforfattningssamling' | 'rkrattsdb'

interface IngestOptions {
  year: number
  limit: number
  filterType: DocumentType | null
  resume: boolean
  skipLlm: boolean
  concurrency: number
  confidenceThreshold: number
  source: IndexSource
}

/**
 * Download PDF from source URL
 */
async function fetchPdf(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
      Accept: 'application/pdf',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

/**
 * Generate markdown content from amendment data
 */
function generateMarkdown(
  sfsNumber: string,
  title: string | null,
  fullText: string,
  baseLawSfs: string | null,
  baseLawName: string | null,
  effectiveDate: string | null,
  publicationDate: string | null,
  affectedSections: Array<{
    chapter?: string | null
    section: string
    changeType: string
    description?: string | null
  }> | null
): string {
  const lines: string[] = []

  // YAML frontmatter
  lines.push('---')
  lines.push(`sfs: "${sfsNumber}"`)
  if (baseLawSfs) lines.push(`baseLawSfs: "${baseLawSfs}"`)
  if (baseLawName) lines.push(`baseLawName: "${baseLawName}"`)
  if (effectiveDate) lines.push(`effectiveDate: "${effectiveDate}"`)
  if (publicationDate) lines.push(`publicationDate: "${publicationDate}"`)
  lines.push('---')
  lines.push('')

  // Title
  if (title) {
    lines.push(`# ${title}`)
    lines.push('')
  }

  // Affected sections summary
  if (affectedSections && affectedSections.length > 0) {
    lines.push('## Ändringar')
    lines.push('')

    for (const section of affectedSections) {
      const chapterPart = section.chapter ? `${section.chapter} kap. ` : ''
      const changeLabel =
        {
          amended: 'ändras',
          repealed: 'upphävs',
          new: 'ny',
          renumbered: 'omnumreras',
        }[section.changeType] || section.changeType

      let line = `- **${chapterPart}${section.section} §** (${changeLabel})`
      if (section.description) {
        line += `: ${section.description}`
      }
      lines.push(line)
    }
    lines.push('')
  }

  // Full text
  lines.push('## Fulltext')
  lines.push('')
  lines.push(fullText)

  return lines.join('\n')
}

/**
 * Map LLM change type to Prisma enum
 */
function mapChangeType(llmType: string): SectionChangeType {
  const map: Record<string, SectionChangeType> = {
    amended: 'AMENDED',
    repealed: 'REPEALED',
    new: 'NEW',
    renumbered: 'RENUMBERED',
  }
  return map[llmType] || 'AMENDED'
}

/**
 * Process a single document
 */
async function processDocument(
  doc: CrawledDocument,
  stats: IngestStats,
  options: IngestOptions
): Promise<void> {
  const {
    sfsNumber: rawSfsNumber,
    title,
    pdfUrl,
    baseLawSfs: rawBaseLawSfs,
    publishedDate,
  } = doc

  // Normalize to "SFS YYYY:NNN" format for consistency with LegalDocument.document_number
  const sfsNumber = rawSfsNumber.startsWith('SFS ')
    ? rawSfsNumber
    : `SFS ${rawSfsNumber}`
  const baseLawSfs = rawBaseLawSfs
    ? rawBaseLawSfs.startsWith('SFS ')
      ? rawBaseLawSfs
      : `SFS ${rawBaseLawSfs}`
    : null

  try {
    // Check if already processed (resume mode)
    if (options.resume) {
      const existing = await prisma.amendmentDocument.findUnique({
        where: { sfs_number: sfsNumber },
      })
      if (existing && existing.parse_status === 'COMPLETED') {
        stats.skipped++
        return
      }
    }

    // Get PDF content - try storage first, then download
    let pdfBuffer: Buffer | null = null

    if (await pdfExists(sfsNumber)) {
      pdfBuffer = await downloadPdf(sfsNumber)
    }

    if (!pdfBuffer) {
      // Download from source
      pdfBuffer = await fetchPdf(pdfUrl)

      // Upload to storage for future use
      await uploadPdf(sfsNumber, pdfBuffer)
    }

    // Extract text from PDF (parsePdf expects Uint8Array)
    const pdfData = new Uint8Array(pdfBuffer)
    const pdfResult = await parsePdf(
      pdfData,
      `SFS${sfsNumber.replace(':', '-')}.pdf`
    )
    const fullText = pdfResult.fullText

    // Parse with LLM (unless skipped)
    let llmResult: ParsedAmendmentLLM | null = null

    if (!options.skipLlm) {
      llmResult = await parseAmendmentWithLLM(fullText)
    }

    // Determine parse status based on confidence
    let parseStatus: ParseStatus = 'COMPLETED'
    if (llmResult && llmResult.confidence < options.confidenceThreshold) {
      parseStatus = 'NEEDS_REVIEW'
      stats.lowConfidence++
    }

    // Normalize LLM base law SFS to "SFS YYYY:NNN" format
    const llmBaseLawSfs = llmResult?.baseLaw.sfsNumber
      ? llmResult.baseLaw.sfsNumber.startsWith('SFS ')
        ? llmResult.baseLaw.sfsNumber
        : `SFS ${llmResult.baseLaw.sfsNumber}`
      : null

    // Generate markdown content
    const markdownContent = generateMarkdown(
      sfsNumber,
      llmResult?.title || title,
      fullText,
      llmBaseLawSfs || baseLawSfs,
      llmResult?.baseLaw.name || null,
      llmResult?.effectiveDate || null,
      llmResult?.publicationDate || publishedDate || null,
      llmResult?.affectedSections || null
    )

    // Upsert amendment document
    const amendmentDoc = await prisma.amendmentDocument.upsert({
      where: { sfs_number: sfsNumber },
      create: {
        sfs_number: sfsNumber,
        storage_path: getStoragePath(sfsNumber),
        original_url: pdfUrl,
        file_size: pdfBuffer.length,
        base_law_sfs: llmBaseLawSfs || baseLawSfs || 'unknown',
        base_law_name: llmResult?.baseLaw.name || null,
        title: llmResult?.title || title,
        effective_date: llmResult?.effectiveDate
          ? new Date(llmResult.effectiveDate)
          : null,
        publication_date: llmResult?.publicationDate
          ? new Date(llmResult.publicationDate)
          : publishedDate
            ? new Date(publishedDate)
            : null,
        full_text: fullText,
        markdown_content: markdownContent,
        parse_status: parseStatus,
        parsed_at: new Date(),
        confidence: llmResult?.confidence || null,
      },
      update: {
        storage_path: getStoragePath(sfsNumber),
        file_size: pdfBuffer.length,
        base_law_sfs: llmBaseLawSfs || baseLawSfs || 'unknown',
        base_law_name: llmResult?.baseLaw.name || null,
        title: llmResult?.title || title,
        effective_date: llmResult?.effectiveDate
          ? new Date(llmResult.effectiveDate)
          : null,
        publication_date: llmResult?.publicationDate
          ? new Date(llmResult.publicationDate)
          : publishedDate
            ? new Date(publishedDate)
            : null,
        full_text: fullText,
        markdown_content: markdownContent,
        parse_status: parseStatus,
        parsed_at: new Date(),
        confidence: llmResult?.confidence || null,
      },
    })

    // Insert section changes if we have LLM results
    if (llmResult?.affectedSections?.length) {
      // Delete existing section changes for this document
      await prisma.sectionChange.deleteMany({
        where: { amendment_id: amendmentDoc.id },
      })

      // Insert new section changes
      await prisma.sectionChange.createMany({
        data: llmResult.affectedSections.map((section, index) => ({
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

    stats.processed++
  } catch (error) {
    stats.errors++
    stats.errorList.push({
      sfsNumber,
      error: error instanceof Error ? error.message : String(error),
    })

    // Update document status to FAILED
    try {
      await prisma.amendmentDocument.upsert({
        where: { sfs_number: sfsNumber },
        create: {
          sfs_number: sfsNumber,
          storage_path: getStoragePath(sfsNumber),
          original_url: pdfUrl,
          base_law_sfs: baseLawSfs || 'unknown',
          title: title,
          parse_status: 'FAILED',
          parse_error: error instanceof Error ? error.message : String(error),
        },
        update: {
          parse_status: 'FAILED',
          parse_error: error instanceof Error ? error.message : String(error),
        },
      })
    } catch {
      // Ignore secondary errors
    }
  }
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  const options: IngestOptions = {
    year: 2025,
    limit: 0,
    filterType: null,
    resume: false,
    skipLlm: false,
    concurrency: 3, // Lower for LLM rate limits
    confidenceThreshold: 0.7,
    source: 'svenskforfattningssamling',
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--year' && args[i + 1]) {
      options.year = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--type' && args[i + 1]) {
      options.filterType = args[i + 1] as DocumentType
      i++
    } else if (args[i] === '--resume') {
      options.resume = true
    } else if (args[i] === '--skip-llm') {
      options.skipLlm = true
    } else if (args[i] === '--concurrency' && args[i + 1]) {
      options.concurrency = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--source' && args[i + 1]) {
      options.source = args[i + 1] as IndexSource
      i++
    }
  }

  console.log('='.repeat(70))
  console.log('Amendment Ingestion Pipeline')
  console.log('='.repeat(70))
  console.log(`Source: ${options.source}`)
  console.log(`Year: ${options.year}`)
  console.log(`Filter: ${options.filterType || 'all'}`)
  console.log(`Limit: ${options.limit || 'none'}`)
  console.log(`Resume: ${options.resume}`)
  console.log(`Skip LLM: ${options.skipLlm}`)
  console.log(`Concurrency: ${options.concurrency}`)
  console.log()

  // Load crawl results - path depends on source
  let indexPath: string
  if (options.source === 'rkrattsdb') {
    indexPath = path.join(
      process.cwd(),
      'data',
      'sfs-indexes',
      'rkrattsdb',
      `sfs-index-${options.year}-rkrattsdb.json`
    )
  } else {
    // svenskforfattningssamling - check new path first, fall back to old path
    const newPath = path.join(
      process.cwd(),
      'data',
      'sfs-indexes',
      'svenskforfattningssamling',
      `sfs-index-${options.year}.json`
    )
    const oldPath = path.join(
      process.cwd(),
      'data',
      `sfs-index-${options.year}.json`
    )
    indexPath = fs.existsSync(newPath) ? newPath : oldPath
  }

  if (!fs.existsSync(indexPath)) {
    console.error(`Index file not found: ${indexPath}`)
    console.error(`Run the appropriate crawler for ${options.source}`)
    process.exit(1)
  }

  const crawlResult: CrawlResult = JSON.parse(
    fs.readFileSync(indexPath, 'utf-8')
  )
  console.log(`Loaded ${crawlResult.totalDocuments} documents from index`)

  // Filter documents
  let documents = crawlResult.documents

  if (options.filterType) {
    documents = documents.filter((d) => d.documentType === options.filterType)
    console.log(
      `Filtered to ${documents.length} ${options.filterType} documents`
    )
  }

  if (options.limit > 0) {
    documents = documents.slice(0, options.limit)
    console.log(`Limited to ${documents.length} documents`)
  }

  // Initialize stats
  const stats: IngestStats = {
    total: documents.length,
    processed: 0,
    skipped: 0,
    errors: 0,
    lowConfidence: 0,
    errorList: [],
  }

  console.log('\nStarting ingestion...\n')
  const startTime = Date.now()

  // Process documents sequentially (LLM has rate limits)
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]

    // Rate limiting between documents (for LLM)
    if (i > 0 && !options.skipLlm) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    await processDocument(doc, stats, options)

    // Progress update every 5 documents or at end
    if ((i + 1) % 5 === 0 || i === documents.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const percent = (((i + 1) / documents.length) * 100).toFixed(1)
      console.log(
        `Progress: ${i + 1}/${documents.length} (${percent}%) - ` +
          `${stats.processed} processed, ${stats.skipped} skipped, ${stats.errors} errors - ${elapsed}s`
      )
    }
  }

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Total documents: ${stats.total}`)
  console.log(`Processed: ${stats.processed}`)
  console.log(`Skipped: ${stats.skipped}`)
  console.log(`Errors: ${stats.errors}`)
  console.log(`Low confidence (needs review): ${stats.lowConfidence}`)
  console.log(`Time: ${totalTime}s`)

  if (stats.errorList.length > 0) {
    console.log('\nErrors:')
    stats.errorList.slice(0, 10).forEach((e) => {
      console.log(`  - ${e.sfsNumber}: ${e.error}`)
    })
    if (stats.errorList.length > 10) {
      console.log(`  ... and ${stats.errorList.length - 10} more`)
    }

    // Save error list
    const errorPath = path.join(
      process.cwd(),
      'data',
      `ingest-errors-${options.year}.json`
    )
    fs.writeFileSync(errorPath, JSON.stringify(stats.errorList, null, 2))
    console.log(`\nError list saved to: ${errorPath}`)
  }

  // Show database stats
  const dbCount = await prisma.amendmentDocument.count({
    where: { sfs_number: { startsWith: `SFS ${options.year}:` } },
  })
  const sectionCount = await prisma.sectionChange.count()
  console.log(`\nDatabase stats:`)
  console.log(`  - Amendment documents (${options.year}): ${dbCount}`)
  console.log(`  - Section changes (all): ${sectionCount}`)

  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
