/* eslint-disable no-console */
/**
 * Daily SFS Laws Sync
 *
 * Incremental sync script that fetches new SFS laws from Riksdagen API.
 * Uses "catchup" strategy: fetches newest documents (sorted by publicerad desc)
 * and continues until a full page of already-existing docs is found.
 *
 * Usage:
 *   pnpm tsx scripts/sync-sfs-daily.ts
 *
 * Options:
 *   --dry-run      Don't insert, just show what would be added
 *   --verbose      Show detailed progress
 */

import { prisma } from '../lib/prisma'
import {
  fetchLawFullText,
  fetchLawHTML,
  generateSlug,
} from '../lib/external/riksdagen'
import { ContentType, DocumentStatus } from '@prisma/client'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  PAGE_SIZE: 100,
  MAX_PAGES: 3, // Safety limit - stop after 3 pages (300 docs) regardless
  DELAY_BETWEEN_REQUESTS: 250, // ms
}

// Parse command line arguments
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const _VERBOSE = args.includes('--verbose') // Reserved for future use

// ============================================================================
// Types
// ============================================================================

interface RiksdagenDocument {
  dok_id: string
  beteckning: string
  titel: string
  datum: string
  publicerad: string
  dokument_url_html: string
}

interface InsertedDoc {
  sfsNumber: string
  title: string
  publicerad: string
  datum: string
}

interface SyncStats {
  pagesChecked: number
  fetched: number
  inserted: number
  skipped: number
  failed: number
  insertedDocs: InsertedDoc[]
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchLatestSFS(
  page: number = 1
): Promise<{
  documents: RiksdagenDocument[]
  totalCount: number
  hasMore: boolean
}> {
  const url = new URL('https://data.riksdagen.se/dokumentlista/')
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
  url.searchParams.set('sz', CONFIG.PAGE_SIZE.toString())
  url.searchParams.set('p', page.toString())
  url.searchParams.set('sort', 'publicerad')
  url.searchParams.set('sortorder', 'desc')

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
    hasMore: page < totalPages && page < CONFIG.MAX_PAGES,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// Main Sync
// ============================================================================

async function syncDaily() {
  const startTime = new Date()

  console.log('='.repeat(60))
  console.log('Daily SFS Laws Sync (Catchup Strategy)')
  console.log('='.repeat(60))
  console.log(`Started at: ${startTime.toISOString()}`)
  console.log(`Strategy: Fetch newest by publicerad, stop when caught up`)
  console.log(
    `Max pages: ${CONFIG.MAX_PAGES} (${CONFIG.MAX_PAGES * CONFIG.PAGE_SIZE} docs)`
  )
  console.log(`Dry run: ${DRY_RUN}`)
  console.log('')

  const stats: SyncStats = {
    pagesChecked: 0,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    failed: 0,
    insertedDocs: [],
  }

  try {
    let page = 0

    while (page < CONFIG.MAX_PAGES) {
      page++
      stats.pagesChecked = page

      console.log(`[Page ${page}/${CONFIG.MAX_PAGES}] Fetching...`)

      if (page > 1) {
        await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
      }

      const pageData = await fetchLatestSFS(page)
      const documents = pageData.documents

      if (documents.length === 0) {
        console.log(`  No documents returned, stopping`)
        break
      }

      stats.fetched += documents.length

      // Track the newest publicerad date from API for this page
      if (page === 1 && documents.length > 0) {
        const newestApiDoc = documents[0]
        console.log(
          `  Newest in API: ${newestApiDoc.beteckning} (publicerad: ${newestApiDoc.publicerad})`
        )
      }

      let pageNewCount = 0
      let pageSkipCount = 0

      // Process each document - show row by row
      console.log('')
      console.log(`  Checking ${documents.length} documents:`)
      for (const doc of documents) {
        // Skip documents with empty beteckning (historical docs without SFS number)
        if (!doc.beteckning) {
          console.log(
            `    [ ] ${doc.dok_id.padEnd(20)} - (no SFS number, skipped)`
          )
          stats.skipped++
          pageSkipCount++
          continue
        }

        const sfsNumber = `SFS ${doc.beteckning}`

        // Check if already exists
        const existing = await prisma.legalDocument.findUnique({
          where: { document_number: sfsNumber },
        })

        if (existing) {
          stats.skipped++
          pageSkipCount++
          console.log(`    [✓] ${sfsNumber.padEnd(20)} - exists in DB`)
          continue
        }

        // New document found
        pageNewCount++
        console.log(
          `    [+] ${sfsNumber.padEnd(20)} - NEW (publicerad: ${doc.publicerad})`
        )

        if (DRY_RUN) {
          stats.inserted++
          continue
        }

        try {
          // Fetch content
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

          // Insert
          await prisma.legalDocument.create({
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
                publicerad: doc.publicerad,
                fetchedAt: new Date().toISOString(),
                method: 'daily-sync-catchup',
              },
            },
          })

          stats.inserted++
          stats.insertedDocs.push({
            sfsNumber,
            title: doc.titel,
            publicerad: doc.publicerad,
            datum: doc.datum,
          })
          console.log(`  [INSERTED] ${sfsNumber}`)
          console.log(
            `    Title: ${doc.titel.substring(0, 70)}${doc.titel.length > 70 ? '...' : ''}`
          )
          console.log(`    Datum: ${doc.datum} | Publicerad: ${doc.publicerad}`)
          await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
        } catch (error) {
          console.error(
            `  [ERROR] ${sfsNumber}:`,
            error instanceof Error ? error.message : error
          )
          stats.failed++
        }
      }

      // Log page summary
      console.log(
        `  Page ${page} summary: ${pageNewCount} new, ${pageSkipCount} skipped`
      )

      // Always check all 3 pages to catch any gaps
      if (!pageData.hasMore) {
        console.log(`  → No more pages available`)
        break
      } else if (page >= CONFIG.MAX_PAGES) {
        console.log(`  → Reached max pages limit`)
      } else {
        console.log(`  → Checking next page...`)
      }

      console.log('')
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
    console.log(`Pages checked:  ${stats.pagesChecked}`)
    console.log(`Docs fetched:   ${stats.fetched}`)
    console.log(`Inserted:       ${stats.inserted}`)
    console.log(`Skipped:        ${stats.skipped}`)
    console.log(`Failed:         ${stats.failed}`)
    console.log('')
    console.log(`Duration:       ${seconds}s`)

    // Log final DB count
    const finalCount = await prisma.legalDocument.count({
      where: { content_type: 'SFS_LAW' },
    })
    console.log('')
    console.log(`Total SFS_LAW in DB: ${finalCount}`)

    // Verification: Check if newest API doc exists in our DB
    console.log('')
    console.log('─'.repeat(60))
    console.log('VERIFICATION')
    console.log('─'.repeat(60))

    const newestApiResult = await fetchLatestSFS(1)
    const newestApiDoc = newestApiResult.documents.find((d) => d.beteckning)

    if (newestApiDoc) {
      const newestSfs = `SFS ${newestApiDoc.beteckning}`
      const existsInDb = await prisma.legalDocument.findUnique({
        where: { document_number: newestSfs },
      })

      console.log(
        `Newest in API:  ${newestSfs} (publicerad: ${newestApiDoc.publicerad})`
      )
      console.log(`In our DB:      ${existsInDb ? '✓ Yes' : '✗ NO - MISSING!'}`)

      if (!existsInDb) {
        console.log('')
        console.log('⚠️  WARNING: Newest API document is not in our database!')
        console.log('   This may indicate a sync issue. Check logs above.')
      }
    }

    // Log inserted documents summary
    if (stats.insertedDocs.length > 0) {
      console.log('')
      console.log('─'.repeat(60))
      console.log('NEW LAWS ADDED')
      console.log('─'.repeat(60))
      for (const doc of stats.insertedDocs) {
        console.log('')
        console.log(`${doc.sfsNumber}`)
        console.log(
          `  "${doc.title.substring(0, 70)}${doc.title.length > 70 ? '...' : ''}"`
        )
        console.log(`  Datum: ${doc.datum} | Publicerad: ${doc.publicerad}`)
      }
      console.log('─'.repeat(60))
    }

    console.log('')
    console.log(`Inserted this run: ${stats.inserted}`)
    console.log(`Pages checked:     ${stats.pagesChecked}`)
  } catch (error) {
    console.error('Sync failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run
syncDaily().catch(console.error)
