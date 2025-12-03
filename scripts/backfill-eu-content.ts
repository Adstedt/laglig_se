/* eslint-disable no-console */
/**
 * Backfill EU Document Content via CELLAR REST API
 *
 * This script fetches full text content for existing EU regulations and directives
 * using the Publications Office CELLAR REST API (bypasses EUR-Lex WAF).
 *
 * Features:
 * - Fetches Swedish HTML content via CELLAR REST API
 * - Updates html_content and full_text fields
 * - Progress logging with ETA calculation
 * - Rate limiting (2 req/sec) to be respectful
 * - Resume capability (skips documents that already have content)
 *
 * Usage: pnpm tsx scripts/backfill-eu-content.ts [--limit N] [--force]
 *
 * Options:
 *   --limit N   Process only first N documents (for testing)
 *   --force     Re-fetch content even if already present
 */

import { PrismaClient, ContentType, Prisma } from '@prisma/client'
import {
  fetchDocumentContentViaCellar,
  extractEUMetadata,
} from '../lib/external/eurlex'

// ============================================================================
// Configuration
// ============================================================================

const prisma = new PrismaClient()

const CONFIG = {
  // Progress logging
  logEveryN: 50, // Log progress every N documents

  // Delay between documents (ms) - on top of rate limiting in eurlex.ts
  delayBetweenDocs: 100,
}

// Parse command line args
const args = process.argv.slice(2)
const limitArg = args.find((a) => a.startsWith('--limit'))
const LIMIT = limitArg ? parseInt(args[args.indexOf(limitArg) + 1] || '0', 10) : 0
const FORCE = args.includes('--force')

// ============================================================================
// Types
// ============================================================================

interface BackfillStats {
  total: number
  processed: number
  updated: number
  skipped: number
  failed: number
  noContent: number
  startTime: number
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

function calculateETA(processed: number, total: number, startTime: number): string {
  if (processed === 0) return 'calculating...'

  const elapsed = Date.now() - startTime
  const rate = processed / elapsed
  const remaining = total - processed
  const etaMs = remaining / rate

  return formatDuration(etaMs)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// Main Backfill Function
// ============================================================================

async function backfillEUContent(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🇪🇺 EU Document Content Backfill (CELLAR REST API)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Started at: ${new Date().toISOString()}`)
  if (LIMIT > 0) console.log(`Limit: ${LIMIT} documents`)
  if (FORCE) console.log(`Force mode: Re-fetching all content`)
  console.log('')

  const stats: BackfillStats = {
    total: 0,
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    noContent: 0,
    startTime: Date.now(),
  }

  try {
    // Get EU documents that need content
    const whereClause = FORCE
      ? {
          content_type: { in: [ContentType.EU_REGULATION, ContentType.EU_DIRECTIVE] },
        }
      : {
          content_type: { in: [ContentType.EU_REGULATION, ContentType.EU_DIRECTIVE] },
          OR: [{ full_text: null }, { html_content: null }],
        }

    const euDocuments = await prisma.legalDocument.findMany({
      where: whereClause,
      select: {
        id: true,
        document_number: true,
        title: true,
        content_type: true,
        metadata: true,
        eu_document: {
          select: {
            celex_number: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
      take: LIMIT > 0 ? LIMIT : undefined,
    })

    stats.total = euDocuments.length
    console.log(`Documents to process: ${stats.total.toLocaleString()}`)
    console.log('')

    if (stats.total === 0) {
      console.log('✅ No documents need content backfill!')
      return
    }

    // Process each document
    for (const doc of euDocuments) {
      const celex = doc.eu_document?.celex_number

      if (!celex) {
        console.log(`   ⚠️ No CELEX for ${doc.document_number} - skipping`)
        stats.skipped++
        stats.processed++
        continue
      }

      try {
        // Fetch content via CELLAR REST API
        const content = await fetchDocumentContentViaCellar(celex)

        if (content && content.plainText.length > 100) {
          // Extract metadata from full text
          const extractedMetadata = extractEUMetadata(
            content.plainText,
            doc.title
          )

          // Merge with existing metadata
          const existingMetadata =
            (doc as { metadata?: Record<string, unknown> }).metadata || {}
          const updatedMetadata: Prisma.JsonObject = {
            ...(existingMetadata as Prisma.JsonObject),
            // Structure info
            articleCount: extractedMetadata.articleCount,
            chapterCount: extractedMetadata.chapterCount,
            sectionCount: extractedMetadata.sectionCount,
            recitalCount: extractedMetadata.recitalCount,
            // Issuing body
            issuingBody: extractedMetadata.issuingBody,
            issuingBodySwedish: extractedMetadata.issuingBodySwedish,
            // Complexity
            documentComplexity: extractedMetadata.documentComplexity,
            // OJ Reference
            ojSeries: extractedMetadata.ojSeries,
            ojNumber: extractedMetadata.ojNumber,
            ojDate: extractedMetadata.ojDate,
            // References (limit to avoid huge JSON)
            eliReferences: extractedMetadata.eliReferences.slice(0, 10),
            referencedCelex: extractedMetadata.referencedCelex.slice(0, 20),
            // Stats
            wordCount: extractedMetadata.wordCount,
          }

          // Update the document
          await prisma.legalDocument.update({
            where: { id: doc.id },
            data: {
              html_content: content.html,
              full_text: content.plainText,
              metadata: updatedMetadata,
            },
          })
          stats.updated++
        } else {
          stats.noContent++
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`   ❌ Error for ${celex}: ${errorMsg}`)
        stats.failed++
      }

      stats.processed++

      // Log progress
      if (stats.processed % CONFIG.logEveryN === 0 || stats.processed === stats.total) {
        const percentage = ((stats.processed / stats.total) * 100).toFixed(1)
        const eta = calculateETA(stats.processed, stats.total, stats.startTime)
        const docType = doc.content_type === ContentType.EU_REGULATION ? 'REG' : 'DIR'

        console.log(
          `   [${stats.processed.toLocaleString()}/${stats.total.toLocaleString()}] (${percentage}%) - ` +
            `Updated: ${stats.updated.toLocaleString()}, ` +
            `No content: ${stats.noContent}, ` +
            `Failed: ${stats.failed} - ` +
            `Last: ${celex} (${docType}) - ` +
            `ETA: ${eta}`
        )
      }

      // Small delay between documents
      await sleep(CONFIG.delayBetweenDocs)
    }
  } finally {
    await prisma.$disconnect()
  }

  // Final Summary
  const totalDuration = formatDuration(Date.now() - stats.startTime)

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 BACKFILL SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Total processed: ${stats.processed.toLocaleString()}`)
  console.log(`  - Updated with content: ${stats.updated.toLocaleString()}`)
  console.log(`  - No content available: ${stats.noContent.toLocaleString()}`)
  console.log(`  - Failed: ${stats.failed}`)
  console.log(`  - Skipped (no CELEX): ${stats.skipped}`)
  console.log('')
  console.log(`Execution time: ${totalDuration}`)
  console.log(`Finished at: ${new Date().toISOString()}`)
  console.log('')

  if (stats.updated > 0) {
    console.log(`✅ Backfill complete! ${stats.updated.toLocaleString()} documents now have full text content.`)
  } else {
    console.log('⚠️ No documents were updated.')
  }
}

// Run the script
backfillEUContent().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
