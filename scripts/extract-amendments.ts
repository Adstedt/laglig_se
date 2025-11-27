#!/usr/bin/env tsx
/**
 * Extract Amendments from SFS Laws (Post-Ingestion)
 *
 * Runs after SFS laws are ingested to extract amendment relationships
 * from law full text. This is more reliable than extracting during ingestion
 * because all laws are already in the database.
 *
 * Usage:
 *   pnpm tsx scripts/extract-amendments.ts
 *
 * Estimated time: ~30-60 minutes
 */

import { prisma } from '../lib/prisma'
import { ContentType, Prisma } from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

interface ExtractionStats {
  totalLaws: number
  lawsProcessed: number
  lawsWithAmendments: number
  amendmentsExtracted: number
  amendmentsSkipped: number
  errors: number
  startTime: Date
}

interface AmendmentReference {
  year: string
  number: string
  sfsNumber: string // "SFS YYYY:NNNN"
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  BATCH_SIZE: 100, // Process laws in batches
  PROGRESS_LOG_INTERVAL: 500,
}

// ============================================================================
// Main Function
// ============================================================================

async function extractAmendments() {
  const stats: ExtractionStats = {
    totalLaws: 0,
    lawsProcessed: 0,
    lawsWithAmendments: 0,
    amendmentsExtracted: 0,
    amendmentsSkipped: 0,
    errors: 0,
    startTime: new Date(),
  }

  try {
    console.log('='.repeat(80))
    console.log('Amendment Extraction Script - Starting')
    console.log('='.repeat(80))
    console.log(`Started at: ${stats.startTime.toISOString()}`)
    console.log('')

    // Count total SFS laws
    stats.totalLaws = await prisma.legalDocument.count({
      where: { content_type: ContentType.SFS_LAW },
    })

    console.log(`📊 Total SFS laws: ${stats.totalLaws}`)
    console.log(`📊 Batch size: ${CONFIG.BATCH_SIZE}`)
    console.log('')

    // Process in batches
    let skip = 0
    while (skip < stats.totalLaws) {
      const laws = await prisma.legalDocument.findMany({
        where: {
          content_type: ContentType.SFS_LAW,
        },
        select: {
          id: true,
          document_number: true,
          full_text: true,
        },
        skip,
        take: CONFIG.BATCH_SIZE,
      })

      for (const law of laws) {
        try {
          if (law.full_text) {
            const amendmentsCreated = await extractAndCreateAmendments(
              law.id,
              law.full_text
            )

            if (amendmentsCreated > 0) {
              stats.lawsWithAmendments++
              stats.amendmentsExtracted += amendmentsCreated
            }
          }

          stats.lawsProcessed++

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
                `Amendments: ${stats.amendmentsExtracted} | ` +
                `ETA: ${estimatedCompletion.toLocaleTimeString()}`
            )
          }
        } catch (error) {
          stats.errors++
          console.error(
            `❌ Error processing ${law.document_number}:`,
            error instanceof Error ? error.message : error
          )
        }
      }

      skip += CONFIG.BATCH_SIZE
    }

    // Print final summary
    printFinalSummary(stats)
  } catch (error) {
    console.error('\n❌ Fatal error during extraction:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
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
        // Amending law not in database (might be older than our dataset or invalid reference)
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
          effective_date: null, // TODO: Parse from transition provisions
          affected_sections_raw: null, // TODO: Parse affected sections
          affected_sections: Prisma.JsonNull,
          summary: null, // Generated in separate script
          summary_generated_by: null,
          detected_method: 'RIKSDAGEN_TEXT_PARSING',
          metadata: {
            extractedFrom: 'full_text',
            pattern: 'inline_reference',
            extractedAt: new Date().toISOString(),
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

function printFinalSummary(stats: ExtractionStats) {
  const endTime = new Date()
  const duration = endTime.getTime() - stats.startTime.getTime()
  const hours = Math.floor(duration / (1000 * 60 * 60))
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((duration % (1000 * 60)) / 1000)

  console.log('\n' + '='.repeat(80))
  console.log('✅ AMENDMENT EXTRACTION COMPLETE')
  console.log('='.repeat(80))
  console.log('')
  console.log(`📊 Total laws processed:        ${stats.lawsProcessed}`)
  console.log(`📊 Laws with amendments:        ${stats.lawsWithAmendments}`)
  console.log(`🔗 Amendments extracted:        ${stats.amendmentsExtracted}`)
  console.log(`⏭️  Amendments skipped (exist):  ${stats.amendmentsSkipped}`)
  console.log(`❌ Errors:                      ${stats.errors}`)
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

  console.log('Next steps:')
  console.log(
    '1. Backfill missing amendments: pnpm tsx scripts/backfill-amendments-lagen-nu.ts'
  )
  console.log(
    '2. Test GPT-4 summaries: pnpm tsx scripts/test-amendment-summaries.ts'
  )
  console.log('3. Verify data: pnpm tsx scripts/verify-ingestion.ts')
  console.log('')
}

// ============================================================================
// Execute
// ============================================================================

extractAmendments()
