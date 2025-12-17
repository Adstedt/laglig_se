/**
 * Sync SFS laws for a specific year from Riksdagen API
 *
 * This script fetches ALL laws for a given year, not using systemdatum sorting.
 * Useful for backfilling years that were missed by the incremental sync.
 *
 * Usage:
 *   pnpm tsx scripts/sync-sfs-year.ts --year 1999
 *   pnpm tsx scripts/sync-sfs-year.ts --year 2000 --dry-run
 *   pnpm tsx scripts/sync-sfs-year.ts --year 2024 --verbose
 */

import { prisma } from '../lib/prisma'
import {
  fetchLawFullText,
  fetchLawHTML,
  generateSlug,
} from '../lib/external/riksdagen'
import { ContentType, DocumentStatus, ChangeType } from '@prisma/client'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  PAGE_SIZE: 100,
  DELAY_BETWEEN_REQUESTS: 250, // ms
}

// Parse command line arguments
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const VERBOSE = args.includes('--verbose')
const YEAR = parseInt(
  args.find((a) => a.startsWith('--year='))?.split('=')[1] ||
    args[args.indexOf('--year') + 1] ||
    '0',
  10
)

if (!YEAR || YEAR < 1900 || YEAR > 2100) {
  console.error('Usage: pnpm tsx scripts/sync-sfs-year.ts --year <YYYY>')
  console.error('Example: pnpm tsx scripts/sync-sfs-year.ts --year 1999')
  process.exit(1)
}

// ============================================================================
// Types
// ============================================================================

interface RiksdagenDocument {
  dok_id: string
  beteckning: string
  titel: string
  datum: string
  systemdatum: string
  undertitel?: string
  dokument_url_html: string
}

interface SyncStats {
  apiCount: number
  fetched: number
  inserted: number
  skipped: number
  failed: number
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchSFSByYear(
  year: number,
  page: number = 1
): Promise<{
  documents: RiksdagenDocument[]
  totalCount: number
  hasMore: boolean
  totalPages: number
}> {
  const url = new URL('https://data.riksdagen.se/dokumentlista/')
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
  url.searchParams.set('sz', CONFIG.PAGE_SIZE.toString())
  url.searchParams.set('p', page.toString())
  url.searchParams.set('rm', year.toString()) // Filter by year (riksmöte)
  url.searchParams.set('sort', 'datum') // Sort by publication date
  url.searchParams.set('sortorder', 'asc') // Oldest first

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const totalCount = parseInt(data.dokumentlista['@traffar'], 10) || 0
  const totalPages = parseInt(data.dokumentlista['@sidor'], 10) || 1
  const documents: RiksdagenDocument[] = data.dokumentlista.dokument || []

  return {
    documents,
    totalCount,
    totalPages,
    hasMore: page < totalPages,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseUndertitel(undertitel: string): string | null {
  // Extract "SFS 2024:123" from "t.o.m. SFS 2024:123"
  const match = undertitel.match(/SFS\s*(\d{4}:\d+)/)
  return match ? match[1] : null
}

// ============================================================================
// Main Sync
// ============================================================================

async function syncYear() {
  const startTime = new Date()

  console.log('='.repeat(60))
  console.log(`SFS Year Sync: ${YEAR}`)
  console.log('='.repeat(60))
  console.log(`Started at: ${startTime.toISOString()}`)
  console.log(`Dry run: ${DRY_RUN}`)
  console.log('')

  const stats: SyncStats = {
    apiCount: 0,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    failed: 0,
  }

  try {
    // Fetch first page to get total count
    const firstPage = await fetchSFSByYear(YEAR, 1)
    stats.apiCount = firstPage.totalCount

    console.log(`Total SFS laws for ${YEAR} in API: ${stats.apiCount}`)
    console.log(`Total pages: ${firstPage.totalPages}`)
    console.log('')

    // Check current DB count for this year
    const dbCount = await prisma.legalDocument.count({
      where: {
        content_type: 'SFS_LAW',
        document_number: { startsWith: `SFS ${YEAR}:` },
      },
    })
    console.log(`Current DB count for ${YEAR}: ${dbCount}`)
    console.log('')

    // Process all pages
    let page = 0
    let hasMore = true
    let documents = firstPage.documents

    while (hasMore) {
      page++

      if (page > 1) {
        await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
        const pageData = await fetchSFSByYear(YEAR, page)
        documents = pageData.documents
        hasMore = pageData.hasMore
      } else {
        hasMore = firstPage.hasMore
      }

      console.log(`Processing page ${page}/${firstPage.totalPages}...`)

      // Process each document
      for (const doc of documents) {
        stats.fetched++
        const sfsNumber = `SFS ${doc.beteckning}`

        // Check if already exists
        const existing = await prisma.legalDocument.findUnique({
          where: { document_number: sfsNumber },
          select: { id: true },
        })

        if (existing) {
          stats.skipped++
          if (VERBOSE) {
            console.log(`  Skipped: ${sfsNumber} (exists)`)
          }
          continue
        }

        // New law - insert
        if (DRY_RUN) {
          console.log(
            `  Would insert: ${sfsNumber} - ${doc.titel.substring(0, 50)}...`
          )
          stats.inserted++
          continue
        }

        try {
          // Fetch content
          await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
          const [htmlContent, fullText] = await Promise.all([
            fetchLawHTML(doc.dok_id),
            fetchLawFullText(doc.dok_id),
          ])

          if (!fullText && !htmlContent) {
            console.log(`  No content for ${sfsNumber}`)
            stats.failed++
            continue
          }

          // Generate slug
          const slug = generateSlug(doc.titel, sfsNumber)
          const latestAmendment = parseUndertitel(doc.undertitel || '')

          // Insert with transaction
          await prisma.$transaction(async (tx) => {
            const newDoc = await tx.legalDocument.create({
              data: {
                document_number: sfsNumber,
                title: doc.titel,
                slug,
                content_type: ContentType.SFS_LAW,
                full_text: fullText,
                html_content: htmlContent,
                publication_date: doc.datum ? new Date(doc.datum) : null,
                status: DocumentStatus.ACTIVE,
                source_url: `https://data.riksdagen.se/dokument/${doc.dok_id}`,
                metadata: {
                  dokId: doc.dok_id,
                  source: 'data.riksdagen.se',
                  systemdatum: doc.systemdatum,
                  latestAmendment,
                  versionCount: 1,
                  fetchedAt: new Date().toISOString(),
                  method: 'sync-sfs-year',
                },
              },
            })

            // Create initial version record
            await tx.documentVersion.create({
              data: {
                document_id: newDoc.id,
                version_number: 1,
                full_text: fullText || '',
                html_content: htmlContent,
                amendment_sfs: latestAmendment,
                source_systemdatum: new Date(
                  doc.systemdatum.replace(' ', 'T') + 'Z'
                ),
              },
            })

            // Create ChangeEvent for new law
            await tx.changeEvent.create({
              data: {
                document_id: newDoc.id,
                content_type: ContentType.SFS_LAW,
                change_type: ChangeType.NEW_LAW,
                amendment_sfs: null,
              },
            })
          })

          console.log(`  Inserted: ${sfsNumber}`)
          stats.inserted++
        } catch (error) {
          console.error(
            `  Error inserting ${sfsNumber}:`,
            error instanceof Error ? error.message : error
          )
          stats.failed++
        }
      }
    }

    // Final summary
    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()
    const seconds = Math.floor(duration / 1000)

    console.log('')
    console.log('='.repeat(60))
    console.log('SYNC COMPLETE')
    console.log('='.repeat(60))
    console.log('')
    console.log(`Year:     ${YEAR}`)
    console.log(`API count:        ${stats.apiCount}`)
    console.log(`Fetched:          ${stats.fetched}`)
    console.log(`Inserted:         ${stats.inserted}`)
    console.log(`Skipped:          ${stats.skipped}`)
    console.log(`Failed:           ${stats.failed}`)
    console.log('')
    console.log(`Duration:         ${seconds}s`)

    // Log final DB count
    const finalCount = await prisma.legalDocument.count({
      where: {
        content_type: 'SFS_LAW',
        document_number: { startsWith: `SFS ${YEAR}:` },
      },
    })
    console.log(``)
    console.log(`Final DB count for ${YEAR}: ${finalCount}`)
  } catch (error) {
    console.error('Sync failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run
syncYear().catch(console.error)
