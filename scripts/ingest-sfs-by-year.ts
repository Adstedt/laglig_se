/* eslint-disable no-console */
/**
 * SFS Laws Ingestion by Year
 *
 * Fetches ALL SFS laws from Riksdagen API using year-by-year queries.
 * This bypasses the 100-page pagination limit by filtering each year separately.
 *
 * Usage:
 *   pnpm tsx scripts/ingest-sfs-by-year.ts
 *
 * Options:
 *   --start-year=YYYY  Start from specific year (default: 1757)
 *   --end-year=YYYY    End at specific year (default: current year)
 *   --dry-run          Don't insert, just count what would be added
 */

import { prisma } from '../lib/prisma'
import {
  fetchLawFullText,
  fetchLawHTML,
  generateSlug,
} from '../lib/external/riksdagen'
import { ContentType, DocumentStatus } from '@prisma/client'
import { inferSfsInstrument } from '../lib/sfs/instrument'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  PAGE_SIZE: 100,
  MAX_PAGES_PER_YEAR: 200, // Safety limit (20,000 laws/year max)
  DELAY_BETWEEN_REQUESTS: 250, // ms
  DELAY_BETWEEN_YEARS: 1000, // ms
  PROGRESS_LOG_INTERVAL: 50,
}

// Parse command line arguments
const args = process.argv.slice(2)
const START_YEAR = parseInt(
  args.find((a) => a.startsWith('--start-year='))?.split('=')[1] || '1757',
  10
)
const END_YEAR = parseInt(
  args.find((a) => a.startsWith('--end-year='))?.split('=')[1] ||
    new Date().getFullYear().toString(),
  10
)
const DRY_RUN = args.includes('--dry-run')

// ============================================================================
// Types
// ============================================================================

interface RiksdagenDocument {
  dok_id: string
  beteckning: string
  titel: string
  datum: string
  dokument_url_html: string
}

interface YearStats {
  year: number
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
}> {
  const url = new URL('https://data.riksdagen.se/dokumentlista/')
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
  url.searchParams.set('from', `${year}-01-01`)
  url.searchParams.set('tom', `${year}-12-31`)
  url.searchParams.set('sz', CONFIG.PAGE_SIZE.toString())
  url.searchParams.set('p', page.toString())
  url.searchParams.set('sort', 'datum')
  url.searchParams.set('sortorder', 'asc')

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
    hasMore: page < totalPages,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// Main Ingestion
// ============================================================================

async function ingestByYear() {
  const startTime = new Date()

  console.log('='.repeat(80))
  console.log('SFS Laws Ingestion by Year')
  console.log('='.repeat(80))
  console.log(`Started at: ${startTime.toISOString()}`)
  console.log(`Year range: ${START_YEAR} - ${END_YEAR}`)
  console.log(`Dry run: ${DRY_RUN}`)
  console.log('')

  const globalStats = {
    totalApiCount: 0,
    totalFetched: 0,
    totalInserted: 0,
    totalSkipped: 0,
    totalFailed: 0,
    yearsProcessed: 0,
  }

  const yearStatsList: YearStats[] = []

  // Get initial DB count
  const initialDbCount = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })
  console.log(`📊 Initial SFS_LAW count in DB: ${initialDbCount}`)
  console.log('')

  // Process each year
  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const yearStats: YearStats = {
      year,
      apiCount: 0,
      fetched: 0,
      inserted: 0,
      skipped: 0,
      failed: 0,
    }

    try {
      // Fetch first page to get count
      const firstPage = await fetchSFSByYear(year, 1)
      yearStats.apiCount = firstPage.totalCount

      if (yearStats.apiCount === 0) {
        console.log(`📅 ${year}: No laws found, skipping`)
        continue
      }

      console.log(`📅 ${year}: ${yearStats.apiCount} laws in API`)

      // Process all pages for this year
      let page = 1
      let hasMore = true
      let allDocuments: RiksdagenDocument[] = [...firstPage.documents]

      while (hasMore && page < CONFIG.MAX_PAGES_PER_YEAR) {
        if (page > 1) {
          await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
          const pageData = await fetchSFSByYear(year, page)
          allDocuments = allDocuments.concat(pageData.documents)
          hasMore = pageData.hasMore
        } else {
          hasMore = firstPage.hasMore
        }
        page++
      }

      yearStats.fetched = allDocuments.length

      // Process each document
      for (let i = 0; i < allDocuments.length; i++) {
        const doc = allDocuments[i]!
        const sfsNumber = `SFS ${doc.beteckning}`

        // Progress logging
        if (
          (yearStats.inserted + yearStats.skipped + yearStats.failed) %
            CONFIG.PROGRESS_LOG_INTERVAL ===
            0 &&
          i > 0
        ) {
          console.log(
            `   Progress: ${i}/${allDocuments.length} (Inserted: ${yearStats.inserted}, Skipped: ${yearStats.skipped})`
          )
        }

        // Check if already exists
        const existing = await prisma.legalDocument.findUnique({
          where: { document_number: sfsNumber },
        })

        if (existing) {
          yearStats.skipped++
          continue
        }

        if (DRY_RUN) {
          yearStats.inserted++
          continue
        }

        try {
          // Fetch content
          const [htmlContent, fullText] = await Promise.all([
            fetchLawHTML(doc.dok_id),
            fetchLawFullText(doc.dok_id),
          ])

          if (!fullText && !htmlContent) {
            console.log(`   ⚠️  No content for ${sfsNumber}`)
            yearStats.failed++
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
              sfs_instrument: inferSfsInstrument(doc.titel), // Story 2.32
              full_text: fullText,
              html_content: htmlContent,
              publication_date: doc.datum ? new Date(doc.datum) : null,
              status: DocumentStatus.ACTIVE,
              source_url: `https://data.riksdagen.se/dokument/${doc.dok_id}`,
              metadata: {
                dokId: doc.dok_id,
                source: 'data.riksdagen.se',
                fetchedAt: new Date().toISOString(),
                method: 'year-by-year',
              },
            },
          })

          yearStats.inserted++
          await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
        } catch (error) {
          console.error(
            `   ❌ Error processing ${sfsNumber}:`,
            error instanceof Error ? error.message : error
          )
          yearStats.failed++
        }
      }

      // Year summary
      console.log(
        `   ✅ Year ${year} complete: Inserted ${yearStats.inserted}, Skipped ${yearStats.skipped}, Failed ${yearStats.failed}`
      )
    } catch (error) {
      console.error(
        `❌ Error processing year ${year}:`,
        error instanceof Error ? error.message : error
      )
    }

    // Update global stats
    globalStats.totalApiCount += yearStats.apiCount
    globalStats.totalFetched += yearStats.fetched
    globalStats.totalInserted += yearStats.inserted
    globalStats.totalSkipped += yearStats.skipped
    globalStats.totalFailed += yearStats.failed
    globalStats.yearsProcessed++
    yearStatsList.push(yearStats)

    // Delay between years
    await sleep(CONFIG.DELAY_BETWEEN_YEARS)
  }

  // Final summary
  const endTime = new Date()
  const duration = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(duration / (1000 * 60 * 60))
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((duration % (1000 * 60)) / 1000)

  console.log('')
  console.log('='.repeat(80))
  console.log('✅ INGESTION COMPLETE')
  console.log('='.repeat(80))
  console.log('')
  console.log(`📊 Years processed:    ${globalStats.yearsProcessed}`)
  console.log(`📊 API total count:    ${globalStats.totalApiCount}`)
  console.log(`📊 Documents fetched:  ${globalStats.totalFetched}`)
  console.log(`✅ Inserted:           ${globalStats.totalInserted}`)
  console.log(`⏭️  Skipped (existing): ${globalStats.totalSkipped}`)
  console.log(`❌ Failed:             ${globalStats.totalFailed}`)
  console.log('')
  console.log(`⏱️  Duration: ${hours}h ${minutes}m ${seconds}s`)
  console.log('')

  // Final DB count
  const finalDbCount = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })
  console.log(`📊 Final SFS_LAW count in DB: ${finalDbCount}`)
  console.log(`📊 Net change: +${finalDbCount - initialDbCount}`)

  // Verify against current API total
  const verifyResponse = await fetch(
    'https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=1'
  )
  const verifyData = await verifyResponse.json()
  const currentApiTotal = parseInt(verifyData.dokumentlista['@traffar'], 10)

  console.log('')
  console.log(`📊 Current API total: ${currentApiTotal}`)
  console.log(
    `📊 DB coverage: ${((finalDbCount / currentApiTotal) * 100).toFixed(2)}%`
  )

  if (finalDbCount < currentApiTotal) {
    console.log(`⚠️  Gap remaining: ${currentApiTotal - finalDbCount} laws`)
  } else {
    console.log(`✅ Full coverage achieved!`)
  }

  // List years with issues
  const yearsWithGaps = yearStatsList.filter(
    (y) => y.failed > 0 || y.fetched < y.apiCount
  )
  if (yearsWithGaps.length > 0) {
    console.log('')
    console.log('⚠️  Years with potential issues:')
    yearsWithGaps.forEach((y) => {
      console.log(
        `   ${y.year}: API=${y.apiCount}, Fetched=${y.fetched}, Failed=${y.failed}`
      )
    })
  }

  await prisma.$disconnect()
}

// Run
ingestByYear().catch(console.error)
