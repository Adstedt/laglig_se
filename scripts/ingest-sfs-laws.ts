/* eslint-disable no-console */
/**
 * SFS Laws Ingestion Script
 *
 * Fetches all 11,351 SFS laws from Riksdagen API and stores them in database.
 * Also extracts amendments from full text and creates amendment records.
 *
 * Usage:
 *   pnpm tsx scripts/ingest-sfs-laws.ts
 *
 * Estimated time: ~2 hours (main ingestion + amendment extraction)
 */

import { prisma } from '../lib/prisma'
import {
  fetchSFSLaws,
  fetchLawFullText,
  fetchLawHTML,
  generateSlug,
  type ParsedLaw,
} from '../lib/external/riksdagen'
import { ContentType, DocumentStatus, Prisma } from '@prisma/client'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Pagination: Riksdagen API max 100 per page
  PAGE_SIZE: 100,

  // Progress logging interval
  PROGRESS_LOG_INTERVAL: 100,

  // Amendment extraction (disabled - run scripts/extract-amendments.ts after ingestion)
  EXTRACT_AMENDMENTS: false,
}

// ============================================================================
// Types
// ============================================================================

interface IngestionStats {
  totalLaws: number
  lawsProcessed: number
  lawsInserted: number
  lawsSkipped: number
  amendmentsExtracted: number
  errors: number
  startTime: Date
}

interface AmendmentReference {
  year: string
  number: string
  sfsNumber: string // "SFS YYYY:NNNN"
}

// ============================================================================
// Main Ingestion Function
// ============================================================================

async function ingestSFSLaws() {
  const stats: IngestionStats = {
    totalLaws: 0,
    lawsProcessed: 0,
    lawsInserted: 0,
    lawsSkipped: 0,
    amendmentsExtracted: 0,
    errors: 0,
    startTime: new Date(),
  }

  try {
    console.log('='.repeat(80))
    console.log('SFS Laws Ingestion Script - Starting')
    console.log('='.repeat(80))
    console.log(`Started at: ${stats.startTime.toISOString()}`)
    console.log('')

    // Fetch first page to get total count
    const firstPage = await fetchSFSLaws(CONFIG.PAGE_SIZE, 1)
    stats.totalLaws = firstPage.totalCount

    console.log(`📊 Total SFS laws in Riksdagen: ${stats.totalLaws}`)
    console.log(`📄 Page size: ${CONFIG.PAGE_SIZE}`)
    console.log(
      `📄 Total pages: ${Math.ceil(stats.totalLaws / CONFIG.PAGE_SIZE)}`
    )
    console.log('')

    // Process first page
    await processLaws(firstPage.laws, stats)

    // Process remaining pages
    let currentPage = 2
    let hasMore = firstPage.hasMore

    while (hasMore) {
      console.log(`\n📄 Fetching page ${currentPage}...`)

      const page = await fetchSFSLaws(CONFIG.PAGE_SIZE, currentPage)
      await processLaws(page.laws, stats)

      hasMore = page.hasMore
      currentPage++

      // Safety check to prevent infinite loops (Riksdagen has ~114 pages)
      if (currentPage > 250) {
        console.warn('⚠️  Safety limit reached (250 pages), stopping')
        break
      }
    }

    // Print final summary
    printFinalSummary(stats)
  } catch (error) {
    console.error('\n❌ Fatal error during ingestion:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// ============================================================================
// Process Laws
// ============================================================================

async function processLaws(laws: ParsedLaw[], stats: IngestionStats) {
  for (const law of laws) {
    try {
      await processLaw(law, stats)

      // Progress logging
      if (stats.lawsProcessed % CONFIG.PROGRESS_LOG_INTERVAL === 0) {
        const percent = Math.round(
          (stats.lawsProcessed / stats.totalLaws) * 100
        )
        const elapsed = Date.now() - stats.startTime.getTime()
        const avgTimePerLaw = elapsed / stats.lawsProcessed
        const remaining =
          (stats.totalLaws - stats.lawsProcessed) * avgTimePerLaw
        const estimatedCompletion = new Date(Date.now() + remaining)

        console.log(
          `📈 Progress: ${stats.lawsProcessed}/${stats.totalLaws} laws (${percent}%) | ` +
            `Inserted: ${stats.lawsInserted} | Skipped: ${stats.lawsSkipped} | ` +
            `ETA: ${estimatedCompletion.toLocaleTimeString()}`
        )
      }
    } catch (error) {
      stats.errors++
      console.error(
        `❌ Error processing law ${law.sfsNumber}:`,
        error instanceof Error ? error.message : error
      )
      // Continue with next law instead of failing entire ingestion
    }
  }
}

// ============================================================================
// Process Single Law
// ============================================================================

async function processLaw(law: ParsedLaw, stats: IngestionStats) {
  stats.lawsProcessed++

  // Check for duplicate
  const existing = await prisma.legalDocument.findUnique({
    where: { document_number: law.sfsNumber },
  })

  if (existing) {
    stats.lawsSkipped++
    console.log(`⏭️  Skipped ${law.sfsNumber} (already exists)`)
    return
  }

  // Fetch both HTML and plain text
  const [htmlContent, fullText] = await Promise.all([
    fetchLawHTML(law.dokId),
    fetchLawFullText(law.dokId),
  ])

  if (!fullText) {
    console.warn(`⚠️  No full text for ${law.sfsNumber}, skipping`)
    stats.lawsSkipped++
    return
  }

  // Generate slug
  const slug = generateSlug(law.title, law.sfsNumber)

  // Create legal document record
  const document = await prisma.legalDocument.create({
    data: {
      document_number: law.sfsNumber,
      title: law.title,
      slug,
      content_type: ContentType.SFS_LAW,
      full_text: fullText,
      html_content: htmlContent,
      publication_date: law.publicationDate,
      status: DocumentStatus.ACTIVE,
      source_url: law.sourceUrl,
      metadata: {
        fullTextUrl: law.fullTextUrl,
        dokId: law.dokId,
        filbilaga: null, // Will be populated if files exist (court cases have this)
      },
    },
  })

  stats.lawsInserted++

  // Extract amendments if enabled
  if (CONFIG.EXTRACT_AMENDMENTS && fullText) {
    try {
      const amendmentsCreated = await extractAndCreateAmendments(
        document.id,
        fullText
      )
      stats.amendmentsExtracted += amendmentsCreated
    } catch (error) {
      console.error(
        `⚠️  Failed to extract amendments for ${law.sfsNumber}:`,
        error instanceof Error ? error.message : error
      )
    }
  }
}

// ============================================================================
// Amendment Extraction
// ============================================================================

/**
 * Extracts amendment references from law full text and creates Amendment records
 *
 * Pattern: "Lag (YYYY:NNNN)." at end of sections
 * Example: "3 § Detta är en paragraf. Lag (2021:1112)."
 */
async function extractAndCreateAmendments(
  baseDocumentId: string,
  fullText: string
): Promise<number> {
  // Extract all "Lag (YYYY:NNNN)" references
  const amendmentPattern = /Lag \((\d{4}):(\d+)\)\.?/gi
  const matches = [...fullText.matchAll(amendmentPattern)]

  if (matches.length === 0) {
    return 0
  }

  // Get unique amending law references
  const uniqueAmendments = new Map<string, AmendmentReference>()

  for (const match of matches) {
    const year = match[1]
    const number = match[2]
    if (!year || !number) continue

    const sfsNumber = `SFS ${year}:${number}`

    if (!uniqueAmendments.has(sfsNumber)) {
      uniqueAmendments.set(sfsNumber, {
        year,
        number,
        sfsNumber,
      })
    }
  }

  let createdCount = 0

  // For each unique amending law, create Amendment record
  for (const amendment of uniqueAmendments.values()) {
    try {
      // Look up the amending law in database
      const amendingLaw = await prisma.legalDocument.findUnique({
        where: { document_number: amendment.sfsNumber },
        select: {
          id: true,
          title: true,
          publication_date: true,
        },
      })

      if (!amendingLaw) {
        // Amending law not yet in database (might be ingested later)
        continue
      }

      // Check if amendment record already exists
      const existingAmendment = await prisma.amendment.findFirst({
        where: {
          base_document_id: baseDocumentId,
          amending_document_id: amendingLaw.id,
        },
      })

      if (existingAmendment) {
        continue // Already created
      }

      // Create amendment record
      await prisma.amendment.create({
        data: {
          base_document_id: baseDocumentId,
          amending_document_id: amendingLaw.id,
          amending_law_title: amendingLaw.title,
          publication_date: amendingLaw.publication_date || new Date(),
          effective_date: null, // TODO: Parse from transition provisions (future enhancement)
          affected_sections_raw: null, // TODO: Parse affected sections (future enhancement)
          affected_sections: Prisma.JsonNull,
          summary: null, // Generated in separate script (Task 8)
          summary_generated_by: null,
          detected_method: 'RIKSDAGEN_TEXT_PARSING',
          metadata: {
            extractedFrom: 'full_text',
            pattern: 'inline_reference',
          },
        },
      })

      createdCount++
    } catch (error) {
      console.error(
        `⚠️  Failed to create amendment record for ${amendment.sfsNumber}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  return createdCount
}

// ============================================================================
// Progress Reporting
// ============================================================================

function printFinalSummary(stats: IngestionStats) {
  const endTime = new Date()
  const duration = endTime.getTime() - stats.startTime.getTime()
  const hours = Math.floor(duration / (1000 * 60 * 60))
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((duration % (1000 * 60)) / 1000)

  console.log('\n' + '='.repeat(80))
  console.log('✅ INGESTION COMPLETE')
  console.log('='.repeat(80))
  console.log('')
  console.log(`📊 Total laws processed:    ${stats.lawsProcessed}`)
  console.log(`✅ Laws inserted:          ${stats.lawsInserted}`)
  console.log(`⏭️  Laws skipped (duplicates): ${stats.lawsSkipped}`)
  console.log(`🔗 Amendments extracted:   ${stats.amendmentsExtracted}`)
  console.log(`❌ Errors:                 ${stats.errors}`)
  console.log('')
  console.log(`⏱️  Duration: ${hours}h ${minutes}m ${seconds}s`)
  console.log(`📅 Started:  ${stats.startTime.toISOString()}`)
  console.log(`📅 Finished: ${endTime.toISOString()}`)
  console.log('')

  if (stats.errors > 0) {
    console.warn(
      `⚠️  ${stats.errors} errors occurred. Check logs above for details.`
    )
  }

  if (CONFIG.EXTRACT_AMENDMENTS) {
    console.log('ℹ️  Amendment summaries NOT generated yet.')
    console.log('   Run scripts/test-amendment-summaries.ts next (Task 8)')
  }

  console.log('')
  console.log('Next steps:')
  console.log('1. Verify data: pnpm tsx scripts/test-db-connection.ts')
  console.log(
    '2. Backfill missing amendments: pnpm tsx scripts/backfill-amendments-lagen-nu.ts'
  )
  console.log(
    '3. Test GPT-4 summaries: pnpm tsx scripts/test-amendment-summaries.ts'
  )
  console.log('4. Run tests: pnpm test tests/integration/ingestion/')
  console.log('')
}

// ============================================================================
// Execute
// ============================================================================

ingestSFSLaws()
