/* eslint-disable no-console */
/**
 * Lagen.nu Amendment Backfill Script
 *
 * Scrapes lagen.nu to find additional amendments for laws that have
 * fewer than 5 amendments (suspected incomplete from inline parsing).
 *
 * This is a SECONDARY method to complement the inline text parsing.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-amendments-lagen-nu.ts
 *
 * Estimated time: ~1.7 hours (3,000 laws × 2 seconds per request)
 *
 * NOTE: This is a respectful scraping approach with 2-second delays.
 * Do NOT reduce the rate limit.
 */

import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Rate limiting: 1 request per 2 seconds (respectful scraping)
  RATE_LIMIT_MS: 2000,

  // Threshold: Laws with fewer than this many amendments will be checked
  MIN_AMENDMENTS_THRESHOLD: 5,

  // Safety limit: Maximum laws to process (prevent runaway script)
  MAX_LAWS_TO_PROCESS: 5000,
}

// ============================================================================
// Types
// ============================================================================

interface BackfillStats {
  totalLawsChecked: number
  lawsWithNewAmendments: number
  totalAmendmentsAdded: number
  errors: number
  startTime: Date
}

interface LagenNuAmendment {
  sfsNumber: string // "2021:1112"
  title: string
  publicationDate: Date | null
}

// ============================================================================
// Main Function
// ============================================================================

async function backfillAmendments() {
  const stats: BackfillStats = {
    totalLawsChecked: 0,
    lawsWithNewAmendments: 0,
    totalAmendmentsAdded: 0,
    errors: 0,
    startTime: new Date(),
  }

  try {
    console.log('='.repeat(80))
    console.log('Lagen.nu Amendment Backfill - Starting')
    console.log('='.repeat(80))
    console.log(`Started at: ${stats.startTime.toISOString()}`)
    console.log('')

    // Query laws with fewer than MIN_AMENDMENTS_THRESHOLD amendments
    const lawsNeedingBackfill = await prisma.legalDocument.findMany({
      where: {
        content_type: 'SFS_LAW',
      },
      include: {
        base_amendments: true,
      },
      take: CONFIG.MAX_LAWS_TO_PROCESS,
    })

    // Filter to only those with few amendments
    const lawsToCheck = lawsNeedingBackfill.filter(
      (law) => law.base_amendments.length < CONFIG.MIN_AMENDMENTS_THRESHOLD
    )

    console.log(`📊 Total SFS laws: ${lawsNeedingBackfill.length}`)
    console.log(
      `🔍 Laws needing backfill (<${CONFIG.MIN_AMENDMENTS_THRESHOLD} amendments): ${lawsToCheck.length}`
    )
    console.log('')

    if (lawsToCheck.length === 0) {
      console.log('✅ No laws need backfill, exiting')
      return
    }

    // Process each law
    for (const law of lawsToCheck) {
      try {
        await processLaw(law, stats)

        // Progress logging
        if (stats.totalLawsChecked % 100 === 0) {
          const percent = Math.round(
            (stats.totalLawsChecked / lawsToCheck.length) * 100
          )
          console.log(
            `📈 Progress: ${stats.totalLawsChecked}/${lawsToCheck.length} (${percent}%) | ` +
              `Added: ${stats.totalAmendmentsAdded} amendments`
          )
        }

        // Rate limiting: Wait 2 seconds between requests
        await sleep(CONFIG.RATE_LIMIT_MS)
      } catch (error) {
        stats.errors++
        console.error(
          `❌ Error processing ${law.document_number}:`,
          error instanceof Error ? error.message : error
        )
      }
    }

    printFinalSummary(stats)
  } catch (error) {
    console.error('\n❌ Fatal error during backfill:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// ============================================================================
// Process Single Law
// ============================================================================

async function processLaw(
  law: { id: string; document_number: string; base_amendments: unknown[] },
  stats: BackfillStats
) {
  stats.totalLawsChecked++

  // Extract SFS number without "SFS " prefix
  const sfsNumber = law.document_number.replace(/^SFS\s*/i, '')

  // Construct lagen.nu URL
  const url = `https://lagen.nu/${sfsNumber}`

  console.log(
    `🔍 Checking ${law.document_number} (${law.base_amendments.length} existing amendments)`
  )

  try {
    // Fetch lagen.nu page
    const amendments = await scrapeAmendmentsFromLagenNu(url)

    if (amendments.length === 0) {
      console.log(`  ℹ️  No amendments found on lagen.nu`)
      return
    }

    console.log(`  ✅ Found ${amendments.length} amendments on lagen.nu`)

    // Create amendment records for each
    let addedCount = 0

    for (const amendment of amendments) {
      const created = await createAmendmentRecord(
        law.id,
        `SFS ${amendment.sfsNumber}`,
        amendment
      )

      if (created) {
        addedCount++
      }
    }

    if (addedCount > 0) {
      stats.lawsWithNewAmendments++
      stats.totalAmendmentsAdded += addedCount
      console.log(`  ✅ Added ${addedCount} new amendments`)
    } else {
      console.log(`  ℹ️  All amendments already in database`)
    }
  } catch (error) {
    throw new Error(
      `Failed to scrape ${url}: ${error instanceof Error ? error.message : error}`
    )
  }
}

// ============================================================================
// Lagen.nu Scraping
// ============================================================================

/**
 * Scrapes amendment list from lagen.nu HTML
 *
 * IMPORTANT: This is a simplified placeholder implementation.
 * Lagen.nu HTML structure is complex and may change.
 *
 * For MVP, we'll rely primarily on inline text parsing (Task 6).
 * This backfill is a "best effort" secondary method.
 */
async function scrapeAmendmentsFromLagenNu(
  url: string
): Promise<LagenNuAmendment[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Laglig.se/1.0 (https://laglig.se)',
        Accept: 'text/html',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        // Law not found on lagen.nu (older laws, edge cases)
        return []
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()

    // Extract amendment references from HTML
    // Pattern: Look for "Lag (YYYY:NNNN)" in change history section
    const amendmentPattern = /Lag \((\d{4}):(\d+)\)/gi
    const matches = [...html.matchAll(amendmentPattern)]

    const amendments: LagenNuAmendment[] = []
    const seen = new Set<string>()

    for (const match of matches) {
      const year = match[1]
      const number = match[2]
      if (!year || !number) continue

      const sfsNumber = `${year}:${number}`

      if (!seen.has(sfsNumber)) {
        seen.add(sfsNumber)
        amendments.push({
          sfsNumber,
          title: `Lag (${sfsNumber})`, // Simplified title
          publicationDate: null, // Not easily extractable from lagen.nu
        })
      }
    }

    return amendments
  } catch (error) {
    throw new Error(
      `Scraping failed: ${error instanceof Error ? error.message : error}`
    )
  }
}

// ============================================================================
// Create Amendment Record
// ============================================================================

async function createAmendmentRecord(
  baseDocumentId: string,
  amendingSfsNumber: string,
  amendment: LagenNuAmendment
): Promise<boolean> {
  try {
    // Look up the amending law in database
    const amendingLaw = await prisma.legalDocument.findUnique({
      where: { document_number: amendingSfsNumber },
      select: {
        id: true,
        title: true,
        publication_date: true,
      },
    })

    if (!amendingLaw) {
      // Amending law not yet in database
      return false
    }

    // Check if amendment record already exists
    const existing = await prisma.amendment.findFirst({
      where: {
        base_document_id: baseDocumentId,
        amending_document_id: amendingLaw.id,
      },
    })

    if (existing) {
      return false // Already exists
    }

    // Create amendment record
    await prisma.amendment.create({
      data: {
        base_document_id: baseDocumentId,
        amending_document_id: amendingLaw.id,
        amending_law_title: amendingLaw.title,
        publication_date: amendingLaw.publication_date || new Date(),
        effective_date: null,
        affected_sections_raw: null,
        affected_sections: Prisma.JsonNull,
        summary: null, // Generated in separate script (Task 8)
        summary_generated_by: null,
        detected_method: 'LAGEN_NU_SCRAPING',
        metadata: {
          source: 'lagen.nu',
          url: `https://lagen.nu/${amendment.sfsNumber}`,
        },
      },
    })

    return true
  } catch (error) {
    console.error(
      `  ⚠️  Failed to create amendment for ${amendingSfsNumber}:`,
      error instanceof Error ? error.message : error
    )
    return false
  }
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function printFinalSummary(stats: BackfillStats) {
  const endTime = new Date()
  const duration = endTime.getTime() - stats.startTime.getTime()
  const hours = Math.floor(duration / (1000 * 60 * 60))
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))

  console.log('\n' + '='.repeat(80))
  console.log('✅ BACKFILL COMPLETE')
  console.log('='.repeat(80))
  console.log('')
  console.log(`📊 Laws checked:           ${stats.totalLawsChecked}`)
  console.log(`✅ Laws with new amendments: ${stats.lawsWithNewAmendments}`)
  console.log(`🔗 Total amendments added: ${stats.totalAmendmentsAdded}`)
  console.log(`❌ Errors:                 ${stats.errors}`)
  console.log('')
  console.log(`⏱️  Duration: ${hours}h ${minutes}m`)
  console.log('')

  if (stats.errors > 0) {
    console.warn(`⚠️  ${stats.errors} errors occurred. Check logs above.`)
  }

  console.log('Next step: Run scripts/test-amendment-summaries.ts (Task 8)')
  console.log('')
}

// ============================================================================
// Execute
// ============================================================================

backfillAmendments()
