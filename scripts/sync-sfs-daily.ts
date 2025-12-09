/* eslint-disable no-console */
/**
 * Daily SFS Laws Sync
 *
 * Incremental sync script that fetches only new SFS laws from Riksdagen API.
 * Designed to run as a daily cron job to keep the database up to date.
 *
 * Usage:
 *   pnpm tsx scripts/sync-sfs-daily.ts
 *
 * Options:
 *   --days=N       Look back N days (default: 7)
 *   --dry-run      Don't insert, just show what would be added
 *   --verbose      Show detailed progress
 */

import { prisma } from '../lib/prisma'
import { fetchLawFullText, fetchLawHTML, generateSlug } from '../lib/external/riksdagen'
import { ContentType, DocumentStatus } from '@prisma/client'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  PAGE_SIZE: 100,
  MAX_PAGES: 10, // Safety limit (1000 laws max per sync)
  DELAY_BETWEEN_REQUESTS: 250, // ms
}

// Parse command line arguments
const args = process.argv.slice(2)
const DAYS_BACK = parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1] || '7', 10)
const DRY_RUN = args.includes('--dry-run')
const VERBOSE = args.includes('--verbose')

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

async function fetchRecentSFS(
  fromDate: string,
  page: number = 1
): Promise<{ documents: RiksdagenDocument[]; totalCount: number; hasMore: boolean }> {
  const url = new URL('https://data.riksdagen.se/dokumentlista/')
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
  url.searchParams.set('from', fromDate)
  url.searchParams.set('tom', new Date().toISOString().split('T')[0])
  url.searchParams.set('sz', CONFIG.PAGE_SIZE.toString())
  url.searchParams.set('p', page.toString())
  url.searchParams.set('sort', 'datum')
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
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ============================================================================
// Main Sync
// ============================================================================

async function syncDaily() {
  const startTime = new Date()
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - DAYS_BACK)
  const fromDate = formatDate(lookbackDate)

  console.log('='.repeat(60))
  console.log('Daily SFS Laws Sync')
  console.log('='.repeat(60))
  console.log(`Started at: ${startTime.toISOString()}`)
  console.log(`Looking back: ${DAYS_BACK} days (from ${fromDate})`)
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
    // Fetch first page to get count
    const firstPage = await fetchRecentSFS(fromDate, 1)
    stats.apiCount = firstPage.totalCount

    if (stats.apiCount === 0) {
      console.log('No new laws found in the specified date range.')
      await prisma.$disconnect()
      return
    }

    console.log(`Found ${stats.apiCount} laws in date range`)
    console.log('')

    // Collect all documents
    let allDocuments: RiksdagenDocument[] = [...firstPage.documents]
    let page = 1
    let hasMore = firstPage.hasMore

    while (hasMore) {
      page++
      await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
      const pageData = await fetchRecentSFS(fromDate, page)
      allDocuments = allDocuments.concat(pageData.documents)
      hasMore = pageData.hasMore
      if (VERBOSE) {
        console.log(`  Fetched page ${page}...`)
      }
    }

    stats.fetched = allDocuments.length
    console.log(`Fetched ${stats.fetched} documents`)
    console.log('')

    // Process each document
    for (const doc of allDocuments) {
      const sfsNumber = `SFS ${doc.beteckning}`

      // Check if already exists
      const existing = await prisma.legalDocument.findUnique({
        where: { document_number: sfsNumber },
      })

      if (existing) {
        stats.skipped++
        if (VERBOSE) {
          console.log(`  Skipped: ${sfsNumber} (exists)`)
        }
        continue
      }

      if (DRY_RUN) {
        console.log(`  Would insert: ${sfsNumber} - ${doc.titel.substring(0, 50)}...`)
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
              fetchedAt: new Date().toISOString(),
              method: 'daily-sync',
            },
          },
        })

        console.log(`  Inserted: ${sfsNumber}`)
        stats.inserted++
        await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
      } catch (error) {
        console.error(`  Error processing ${sfsNumber}:`, error instanceof Error ? error.message : error)
        stats.failed++
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
    console.log(`API count:    ${stats.apiCount}`)
    console.log(`Fetched:      ${stats.fetched}`)
    console.log(`Inserted:     ${stats.inserted}`)
    console.log(`Skipped:      ${stats.skipped}`)
    console.log(`Failed:       ${stats.failed}`)
    console.log('')
    console.log(`Duration:     ${seconds}s`)

    // Log final DB count
    const finalCount = await prisma.legalDocument.count({
      where: { content_type: 'SFS_LAW' },
    })
    console.log(``)
    console.log(`Total SFS_LAW in DB: ${finalCount}`)

  } catch (error) {
    console.error('Sync failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run
syncDaily().catch(console.error)
