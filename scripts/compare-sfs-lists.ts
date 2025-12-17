/* eslint-disable no-console */
/**
 * Compare SFS Numbers: Database vs Riksdagen API
 *
 * Generates two lists for manual comparison:
 * 1. All SFS numbers in our database
 * 2. All SFS numbers in the Riksdagen API
 *
 * Outputs:
 *   - data/sfs-comparison/db-sfs-list.txt       - SFS numbers in database
 *   - data/sfs-comparison/api-sfs-list.txt      - SFS numbers in API
 *   - data/sfs-comparison/missing-from-db.txt   - In API but not in DB
 *   - data/sfs-comparison/extra-in-db.txt       - In DB but not in API
 *   - data/sfs-comparison/summary.json          - Statistics
 *
 * Usage:
 *   pnpm tsx scripts/compare-sfs-lists.ts
 */

import { prisma } from '../lib/prisma'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  PAGE_SIZE: 500, // Larger pages for faster fetching
  DELAY_MS: 200, // Delay between API requests
  OUTPUT_DIR: 'data/sfs-comparison',
}

// ============================================================================
// Types
// ============================================================================

interface RiksdagenDocument {
  dok_id: string
  beteckning: string // "2025:123" format
  titel: string
  datum: string
  systemdatum: string
}

interface ComparisonStats {
  dbCount: number
  apiCount: number
  missingFromDb: number
  extraInDb: number
  matchingCount: number
  fetchedAt: string
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchSFSPage(page: number): Promise<{
  documents: RiksdagenDocument[]
  totalCount: number
  totalPages: number
}> {
  const url = new URL('https://data.riksdagen.se/dokumentlista/')
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
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

  return { documents, totalCount, totalPages }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const startTime = new Date()

  console.log('='.repeat(60))
  console.log('SFS Comparison: Database vs Riksdagen API')
  console.log('='.repeat(60))
  console.log(`Started at: ${startTime.toISOString()}`)
  console.log('')

  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), CONFIG.OUTPUT_DIR)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // ============================================================================
  // Step 1: Fetch all SFS numbers from database
  // ============================================================================

  console.log('Step 1: Fetching SFS numbers from database...')

  const dbDocuments = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_LAW' },
    select: { document_number: true },
    orderBy: { document_number: 'asc' },
  })

  // Convert "SFS 2025:123" to "2025:123" for comparison
  const dbSfsNumbers = new Set(
    dbDocuments.map((doc) => doc.document_number.replace('SFS ', ''))
  )

  console.log(`  Found ${dbSfsNumbers.size} SFS laws in database`)
  console.log('')

  // ============================================================================
  // Step 2: Fetch all SFS numbers from API
  // ============================================================================

  console.log('Step 2: Fetching SFS numbers from Riksdagen API...')

  const apiSfsNumbers = new Set<string>()
  const apiSfsList: { sfs: string; title: string; date: string }[] = []

  // Get first page to determine total
  const firstPage = await fetchSFSPage(1)
  const totalPages = firstPage.totalPages
  const totalCount = firstPage.totalCount

  console.log(`  Total SFS in API: ${totalCount}`)
  console.log(`  Total pages: ${totalPages}`)
  console.log('')

  // Process first page
  for (const doc of firstPage.documents) {
    apiSfsNumbers.add(doc.beteckning)
    apiSfsList.push({
      sfs: doc.beteckning,
      title: doc.titel,
      date: doc.datum,
    })
  }

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    if (page % 10 === 0) {
      console.log(`  Fetching page ${page}/${totalPages}...`)
    }

    await sleep(CONFIG.DELAY_MS)

    try {
      const pageData = await fetchSFSPage(page)
      for (const doc of pageData.documents) {
        apiSfsNumbers.add(doc.beteckning)
        apiSfsList.push({
          sfs: doc.beteckning,
          title: doc.titel,
          date: doc.datum,
        })
      }
    } catch (error) {
      console.error(
        `  Error fetching page ${page}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  console.log(`  Fetched ${apiSfsNumbers.size} unique SFS numbers from API`)
  console.log('')

  // ============================================================================
  // Step 3: Compare and generate outputs
  // ============================================================================

  console.log('Step 3: Comparing lists...')

  // Find missing from DB (in API but not in DB)
  const missingFromDb: string[] = []
  for (const sfs of apiSfsNumbers) {
    if (!dbSfsNumbers.has(sfs)) {
      missingFromDb.push(sfs)
    }
  }
  missingFromDb.sort()

  // Find extra in DB (in DB but not in API)
  const extraInDb: string[] = []
  for (const sfs of dbSfsNumbers) {
    if (!apiSfsNumbers.has(sfs)) {
      extraInDb.push(sfs)
    }
  }
  extraInDb.sort()

  // Calculate matching
  const matchingCount = dbSfsNumbers.size - extraInDb.length

  console.log(`  Missing from DB: ${missingFromDb.length}`)
  console.log(`  Extra in DB: ${extraInDb.length}`)
  console.log(`  Matching: ${matchingCount}`)
  console.log('')

  // ============================================================================
  // Step 4: Write output files
  // ============================================================================

  console.log('Step 4: Writing output files...')

  // DB list - sorted
  const dbList = Array.from(dbSfsNumbers).sort()
  fs.writeFileSync(
    path.join(outputDir, 'db-sfs-list.txt'),
    dbList.join('\n') + '\n'
  )
  console.log(`  Written: db-sfs-list.txt (${dbList.length} entries)`)

  // API list - sorted
  const apiList = Array.from(apiSfsNumbers).sort()
  fs.writeFileSync(
    path.join(outputDir, 'api-sfs-list.txt'),
    apiList.join('\n') + '\n'
  )
  console.log(`  Written: api-sfs-list.txt (${apiList.length} entries)`)

  // Missing from DB - with titles for research
  const missingWithTitles = missingFromDb.map((sfs) => {
    const entry = apiSfsList.find((e) => e.sfs === sfs)
    return `${sfs}\t${entry?.date || ''}\t${entry?.title || ''}`
  })
  fs.writeFileSync(
    path.join(outputDir, 'missing-from-db.txt'),
    '# SFS numbers in API but NOT in database\n' +
      '# Format: SFS_NUMBER\\tDATE\\tTITLE\n' +
      '#\n' +
      missingWithTitles.join('\n') +
      '\n'
  )
  console.log(
    `  Written: missing-from-db.txt (${missingFromDb.length} entries)`
  )

  // Extra in DB
  fs.writeFileSync(
    path.join(outputDir, 'extra-in-db.txt'),
    '# SFS numbers in database but NOT in API\n' +
      '#\n' +
      extraInDb.join('\n') +
      '\n'
  )
  console.log(`  Written: extra-in-db.txt (${extraInDb.length} entries)`)

  // Summary JSON
  const stats: ComparisonStats = {
    dbCount: dbSfsNumbers.size,
    apiCount: apiSfsNumbers.size,
    missingFromDb: missingFromDb.length,
    extraInDb: extraInDb.length,
    matchingCount,
    fetchedAt: new Date().toISOString(),
  }
  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify(stats, null, 2) + '\n'
  )
  console.log(`  Written: summary.json`)

  // ============================================================================
  // Summary
  // ============================================================================

  const endTime = new Date()
  const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)

  console.log('')
  console.log('='.repeat(60))
  console.log('COMPARISON COMPLETE')
  console.log('='.repeat(60))
  console.log('')
  console.log(`Database SFS count:    ${dbSfsNumbers.size}`)
  console.log(`API SFS count:         ${apiSfsNumbers.size}`)
  console.log(`Missing from DB:       ${missingFromDb.length}`)
  console.log(`Extra in DB:           ${extraInDb.length}`)
  console.log(`Matching:              ${matchingCount}`)
  console.log('')
  console.log(`Duration:              ${duration}s`)
  console.log(`Output directory:      ${outputDir}`)
  console.log('')

  // Show first few missing for quick reference
  if (missingFromDb.length > 0) {
    console.log('First 20 missing from DB:')
    missingFromDb.slice(0, 20).forEach((sfs) => {
      const entry = apiSfsList.find((e) => e.sfs === sfs)
      console.log(
        `  ${sfs} - ${entry?.title?.substring(0, 50) || 'Unknown'}...`
      )
    })
    if (missingFromDb.length > 20) {
      console.log(`  ... and ${missingFromDb.length - 20} more`)
    }
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
