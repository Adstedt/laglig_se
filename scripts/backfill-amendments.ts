/* eslint-disable no-console */
/**
 * Backfill Amendments Script
 *
 * Extracts ALL historical amendments from existing law texts and creates
 * Amendment records for each unique SFS number found.
 *
 * Also:
 * - Adds systemdatum to existing law metadata
 * - Creates initial version records for all laws (version 1)
 *
 * Expected output: ~90,000 Amendment records across 11K laws
 *
 * Story 2.11 - Task 8: Backfill Existing Data & Historical Amendments
 *
 * Usage:
 *   pnpm tsx scripts/backfill-amendments.ts
 *
 * Options:
 *   --dry-run       Don't modify DB, just show what would be done
 *   --limit=N       Only process N laws (for testing)
 *   --skip-versions Skip creating initial version records
 *   --skip-amendments Skip extracting amendments
 */

import { prisma } from '../lib/prisma'
import { ContentType } from '@prisma/client'
import { createInitialVersion } from '../lib/sync/version-archive'
import { extractAllAmendments } from '../lib/sync/amendment-creator'

// Parse command line arguments
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const LIMIT = parseInt(
  args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0',
  10
)
const SKIP_VERSIONS = args.includes('--skip-versions')
const SKIP_AMENDMENTS = args.includes('--skip-amendments')

interface BackfillStats {
  lawsProcessed: number
  versionsCreated: number
  versionsSkipped: number
  amendmentsCreated: number
  amendmentsSkipped: number
  errors: number
}

async function backfillAmendments() {
  const startTime = new Date()

  console.log('='.repeat(60))
  console.log('Backfill Amendments & Versions')
  console.log('='.repeat(60))
  console.log(`Started at: ${startTime.toISOString()}`)
  console.log(`Dry run: ${DRY_RUN}`)
  console.log(`Limit: ${LIMIT || 'No limit'}`)
  console.log(`Skip versions: ${SKIP_VERSIONS}`)
  console.log(`Skip amendments: ${SKIP_AMENDMENTS}`)
  console.log('')

  const stats: BackfillStats = {
    lawsProcessed: 0,
    versionsCreated: 0,
    versionsSkipped: 0,
    amendmentsCreated: 0,
    amendmentsSkipped: 0,
    errors: 0,
  }

  try {
    // Get all SFS laws
    const query = {
      where: { content_type: ContentType.SFS_LAW },
      select: {
        id: true,
        document_number: true,
        title: true,
        full_text: true,
        html_content: true,
        metadata: true,
      },
      orderBy: { document_number: 'asc' as const },
      ...(LIMIT > 0 ? { take: LIMIT } : {}),
    }

    const laws = await prisma.legalDocument.findMany(query)
    console.log(`Found ${laws.length} SFS laws to process`)
    console.log('')

    let batchCount = 0
    const BATCH_SIZE = 100

    for (const law of laws) {
      stats.lawsProcessed++
      batchCount++

      if (batchCount >= BATCH_SIZE) {
        console.log(`Processing ${stats.lawsProcessed}/${laws.length}...`)
        batchCount = 0
      }

      if (DRY_RUN) {
        // Just count what would be done
        if (!SKIP_VERSIONS) stats.versionsCreated++
        if (!SKIP_AMENDMENTS && law.full_text) {
          const pattern = /Lag\s*\((\d{4}:\d+)\)/g
          const matches = law.full_text.matchAll(pattern)
          for (const _ of matches) {
            stats.amendmentsCreated++
          }
        }
        continue
      }

      try {
        await prisma.$transaction(async (tx) => {
          // Create initial version if needed
          if (!SKIP_VERSIONS) {
            const version = await createInitialVersion(tx, {
              documentId: law.id,
              fullText: law.full_text || '',
              htmlContent: law.html_content || null,
              amendmentSfs: null,
              sourceSystemdatum: null,
            })

            if (version) {
              stats.versionsCreated++
            } else {
              stats.versionsSkipped++
            }
          }

          // Extract and create amendments
          if (!SKIP_AMENDMENTS && law.full_text) {
            const amendments = await extractAllAmendments(
              tx,
              law.id,
              law.full_text,
              undefined // No version ID link for backfill
            )
            stats.amendmentsCreated += amendments.length
          }
        })
      } catch (error) {
        console.error(
          `Error processing ${law.document_number}:`,
          error instanceof Error ? error.message : error
        )
        stats.errors++
      }
    }

    // Final summary
    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)

    console.log('')
    console.log('='.repeat(60))
    console.log('BACKFILL COMPLETE')
    console.log('='.repeat(60))
    console.log('')
    console.log(`Laws processed:     ${stats.lawsProcessed}`)
    console.log(`Versions created:   ${stats.versionsCreated}`)
    console.log(`Versions skipped:   ${stats.versionsSkipped}`)
    console.log(`Amendments created: ${stats.amendmentsCreated}`)
    console.log(`Amendments skipped: ${stats.amendmentsSkipped}`)
    console.log(`Errors:             ${stats.errors}`)
    console.log('')
    console.log(`Duration: ${minutes}m ${seconds}s`)

    if (!DRY_RUN) {
      // Log final counts
      const [versionCount, amendmentCount] = await Promise.all([
        prisma.documentVersion.count(),
        prisma.amendment.count(),
      ])
      console.log('')
      console.log(`Total document_versions in DB: ${versionCount}`)
      console.log(`Total amendments in DB: ${amendmentCount}`)
    }
  } catch (error) {
    console.error('Backfill failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run
backfillAmendments().catch(console.error)
