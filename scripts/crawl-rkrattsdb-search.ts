/**
 * Crawl SFS document index from rkrattsdb.gov.se/sfspdf search
 *
 * Story 2.13: Amendment Documents & Historical Versions
 * Phase 2 Part 2, Task 2.9: Pre-2018 ingestion from rkrattsdb.gov.se
 *
 * Strategy:
 * 1. Scrape rkrattsdb.gov.se/sfspdf search results to get SFS numbers + titles
 * 2. Classify documents by title (amendment/repeal/new_law)
 * 3. Extract base law SFS from amendment titles
 * 4. Construct PDF URLs using rkrattsdb.gov.se pattern
 *
 * Search format: "1998:*" shows all 1998 docs (max 1500 results)
 * For years >1500 docs, use prefix searches: "1998:1*", "1998:2*", etc.
 *
 * Usage:
 *   pnpm tsx scripts/crawl-rkrattsdb-search.ts --year 1998
 *   pnpm tsx scripts/crawl-rkrattsdb-search.ts --year 1999 --delay 500
 */

import * as fs from 'fs'
import * as path from 'path'

// =============================================================================
// Types (matching crawl-sfs-index.ts format)
// =============================================================================

export type DocumentType = 'amendment' | 'repeal' | 'new_law'

export interface CrawledDocument {
  sfsNumber: string // "1998:306"
  title: string // "Lag om ändring i stiftelselagen (1994:1220)"
  publishedDate: string // "1998-01-01" (approximate)
  documentType: DocumentType
  baseLawSfs: string | null // "1994:1220" for amendments
  pdfUrl: string // Full URL to PDF on rkrattsdb.gov.se
  htmlUrl: string // Search URL
  isRattelseblad: boolean // True if this is a correction sheet
}

export interface CrawlResult {
  year: number
  source: string
  crawledAt: string
  totalDocuments: number
  byType: {
    amendment: number
    repeal: number
    new_law: number
  }
  documents: CrawledDocument[]
}

// =============================================================================
// Document Classification
// =============================================================================

export function classifyDocument(title: string): DocumentType {
  const lowerTitle = title.toLowerCase()

  if (
    lowerTitle.includes('om ändring i') ||
    lowerTitle.includes('om ändring av')
  ) {
    return 'amendment'
  }

  if (
    lowerTitle.includes('om upphävande av') ||
    lowerTitle.includes('upphävande av')
  ) {
    return 'repeal'
  }

  return 'new_law'
}

export function extractBaseLawSfs(title: string): string | null {
  // For amendments, extract the base law SFS number from the title
  // Pattern: "om ändring i ... (YYYY:NNN)" or just "(YYYY:NNN)"
  const match = title.match(/om ändring i[^(]*\((\d{4}:\d+)\)/i)
  if (match) {
    return match[1]
  }

  // Try alternate pattern: just find the first SFS number in parentheses
  const altMatch = title.match(/\((\d{4}:\d+)\)/)
  if (altMatch) {
    return altMatch[1]
  }

  return null
}

// =============================================================================
// URL Construction
// =============================================================================

/**
 * Build PDF URL for rkrattsdb.gov.se
 * Pattern: /SFSdoc/{YY}/{YY}{NNNN}.PDF
 * Example: /SFSdoc/98/980306.PDF for SFS 1998:306
 */
function buildPdfUrl(sfsNumber: string): string {
  const [yearStr, numStr] = sfsNumber.split(':')
  const yy = yearStr.slice(-2) // Last 2 digits: 1998 -> "98"
  const paddedNum = numStr.padStart(4, '0') // 306 -> "0306"
  return `https://rkrattsdb.gov.se/SFSdoc/${yy}/${yy}${paddedNum}.PDF`
}

// =============================================================================
// rkrattsdb.gov.se Search Scraper
// =============================================================================

interface SearchResult {
  sfsNumber: string
  title: string
  pdfPath: string // e.g., "/SFSdoc/99/990982.PDF" or "/SFSdoc/99/990982r.PDF"
  isRattelseblad: boolean
}

/**
 * Parse rkrattsdb.gov.se/sfspdf search results HTML to extract SFS numbers and titles
 * HTML format: <A HREF="/SFSdoc/98/980306.PDF"><font size=2>SFS 1998:306, Title</font></A>
 * Rättelseblad have "r" suffix in PDF path and "Rättelseblad" in title
 */
function parseSearchResults(html: string): SearchResult[] {
  const results: SearchResult[] = []

  // Pattern: Links with PDF path, SFS number and title
  // Captures: [1]=PDF path, [2]=SFS number, [3]=title
  const pattern =
    /<A\s+HREF="([^"]*\.PDF)"[^>]*><font[^>]*>SFS\s*(\d{4}:\d+),\s*([^<]+)<\/font><\/A>/gi

  let match
  while ((match = pattern.exec(html)) !== null) {
    const pdfPath = match[1].trim()
    const sfsNumber = match[2].trim()
    let title = match[3].trim()

    // Clean up title
    title = title.replace(/\s+/g, ' ').trim()

    // Skip if too short
    if (title.length < 5) continue

    // Check if this is a Rättelseblad (correction sheet)
    const isRattelseblad =
      pdfPath.toLowerCase().endsWith('r.pdf') ||
      title.toLowerCase().includes('rättelseblad')

    // Create unique key combining SFS number and whether it's a correction
    const key = `${sfsNumber}${isRattelseblad ? '-r' : ''}`

    // Avoid duplicates
    if (
      !results.some(
        (r) => `${r.sfsNumber}${r.isRattelseblad ? '-r' : ''}` === key
      )
    ) {
      results.push({ sfsNumber, title, pdfPath, isRattelseblad })
    }
  }

  return results
}

/**
 * Extract total hit count from search results
 * Pattern: "Sökresultat - 1539 dokument hittade"
 */
function extractTotalCount(html: string): number | null {
  const patterns = [
    /Sökresultat[^0-9]*(\d+)\s*dokument/i,
    /(\d+)\s*träffar/i,
    /Totalt\s*(\d+)/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) {
      return parseInt(match[1], 10)
    }
  }
  return null
}

/**
 * Fetch search results from rkrattsdb.gov.se/sfspdf via POST
 */
async function fetchSearch(query: string, delayMs: number): Promise<string> {
  const url = 'https://rkrattsdb.gov.se/sfspdf/sql_search_rsp.asp'

  console.log(`  Searching: SFS_nr=${query}`)

  // Rate limiting
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `SFS_nr=${encodeURIComponent(query)}`,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  // The server returns ISO-8859-1 encoded text, need to decode properly
  const buffer = await response.arrayBuffer()
  const decoder = new TextDecoder('iso-8859-1')
  return decoder.decode(buffer)
}

// =============================================================================
// Crawler
// =============================================================================

interface CrawlOptions {
  year: number
  delayMs: number
}

interface CrawlYearResult {
  result: CrawlResult
  expectedTotal: number | null
}

async function crawlYear(options: CrawlOptions): Promise<CrawlYearResult> {
  const { year, delayMs } = options

  console.log(`\nCrawling rkrattsdb.gov.se/sfspdf for year ${year}...`)

  const allResults: SearchResult[] = []

  // First try a full year search to see total count
  console.log(`  Trying full year search: ${year}:*`)
  const fullYearHtml = await fetchSearch(`${year}:*`, delayMs)
  const totalCount = extractTotalCount(fullYearHtml)
  const fullYearResults = parseSearchResults(fullYearHtml)

  console.log(
    `    Found ${fullYearResults.length} results` +
      (totalCount ? ` (total in DB: ${totalCount})` : '')
  )

  if (totalCount && totalCount <= 1500) {
    // All results fit in one query
    for (const result of fullYearResults) {
      if (result.sfsNumber.startsWith(`${year}:`)) {
        allResults.push(result)
      }
    }
  } else {
    // Need to search by prefix to get all results
    console.log(`  Total exceeds 1500, searching by prefix...`)

    // Determine prefix ranges based on year
    const prefixes: string[] = []
    if (year === 1998) {
      // 1998 starts at 306, goes to 1836
      // Search: 3*, 4*, 5*, ..., 9*, 10*, 11*, ..., 18*
      for (let i = 3; i <= 9; i++) {
        prefixes.push(`${year}:${i}*`)
      }
      for (let i = 10; i <= 18; i++) {
        prefixes.push(`${year}:${i}*`)
      }
    } else {
      // Other years start at 1
      // Search: 1*, 2*, ..., 9*, 10*, 11*, ..., 20*
      for (let i = 1; i <= 9; i++) {
        prefixes.push(`${year}:${i}*`)
      }
      for (let i = 10; i <= 20; i++) {
        prefixes.push(`${year}:${i}*`)
      }
    }

    for (const prefix of prefixes) {
      try {
        const html = await fetchSearch(prefix, delayMs)
        const results = parseSearchResults(html)

        // Filter to only include documents from the target year
        const yearResults = results.filter((r) =>
          r.sfsNumber.startsWith(`${year}:`)
        )

        console.log(`    ${prefix}: ${yearResults.length} results`)

        // Add results, avoiding duplicates (allow both original and Rättelseblad)
        for (const result of yearResults) {
          const key = `${result.sfsNumber}${result.isRattelseblad ? '-r' : ''}`
          if (
            !allResults.some(
              (r) => `${r.sfsNumber}${r.isRattelseblad ? '-r' : ''}` === key
            )
          ) {
            allResults.push(result)
          }
        }

        // If we got 0 results for high prefixes, we can stop
        if (yearResults.length === 0) {
          const prefixNum = parseInt(prefix.split(':')[1])
          if (prefixNum >= 15) {
            console.log(`    No results for ${prefix}, stopping prefix search`)
            break
          }
        }
      } catch (error) {
        console.error(`    Error fetching ${prefix}: ${error}`)
      }
    }
  }

  console.log(`\nTotal unique results: ${allResults.length}`)

  // Convert to CrawledDocument format
  const documents: CrawledDocument[] = allResults.map((result) => {
    const documentType = classifyDocument(result.title)
    const baseLawSfs =
      documentType === 'amendment' ? extractBaseLawSfs(result.title) : null

    // Use PDF path from search results if available, otherwise construct it
    const pdfUrl = result.pdfPath
      ? `https://rkrattsdb.gov.se${result.pdfPath}`
      : buildPdfUrl(result.sfsNumber)

    return {
      sfsNumber: result.sfsNumber,
      title: result.title,
      publishedDate: `${year}-01-01`,
      documentType,
      baseLawSfs,
      pdfUrl,
      htmlUrl: `https://rkrattsdb.gov.se/sfspdf/?LimitSFSNUM=${result.sfsNumber}`,
      isRattelseblad: result.isRattelseblad,
    }
  })

  // Sort by SFS number
  documents.sort((a, b) => {
    const [, numA] = a.sfsNumber.split(':')
    const [, numB] = b.sfsNumber.split(':')
    return parseInt(numA) - parseInt(numB)
  })

  // Count by type
  const byType = {
    amendment: documents.filter((d) => d.documentType === 'amendment').length,
    repeal: documents.filter((d) => d.documentType === 'repeal').length,
    new_law: documents.filter((d) => d.documentType === 'new_law').length,
  }

  return {
    result: {
      year,
      source: 'rkrattsdb.gov.se/sfspdf',
      crawledAt: new Date().toISOString(),
      totalDocuments: documents.length,
      byType,
      documents,
    },
    expectedTotal: totalCount,
  }
}

// =============================================================================
// Main
// =============================================================================

/**
 * Check if a PDF exists for a given SFS number
 */
async function checkPdfExists(sfsNumber: string): Promise<boolean> {
  const pdfUrl = buildPdfUrl(sfsNumber)
  try {
    const response = await fetch(pdfUrl, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Fill gaps by checking PDF URLs directly
 */
async function fillGaps(
  year: number,
  documents: CrawledDocument[],
  expectedTotal: number | null,
  delayMs: number
): Promise<CrawledDocument[]> {
  const found = new Set(
    documents.map((d) => parseInt(d.sfsNumber.split(':')[1]))
  )

  // Determine range to check
  const nums = [...found].sort((a, b) => a - b)
  const minNum = year === 1998 ? 306 : 1
  // Check beyond max found - use expected total or add 50 buffer
  const maxFound = nums[nums.length - 1] || (year === 1998 ? 1836 : 1500)
  const maxNum = expectedTotal
    ? Math.max(maxFound, expectedTotal + 20)
    : maxFound + 50

  console.log(`\nChecking for gaps in range ${minNum}-${maxNum}...`)
  console.log(
    `  (Found max: ${maxFound}, Expected total: ${expectedTotal || 'unknown'})`
  )

  const gaps: number[] = []
  for (let i = minNum; i <= maxNum; i++) {
    if (!found.has(i)) {
      gaps.push(i)
    }
  }

  if (gaps.length === 0) {
    console.log('  No gaps found!')
    return documents
  }

  console.log(
    `  Found ${gaps.length} potential gaps: ${gaps.slice(0, 20).join(', ')}${gaps.length > 20 ? '...' : ''}`
  )

  // Check each gap to see if PDF exists
  const newDocs: CrawledDocument[] = []
  for (const num of gaps) {
    const sfsNumber = `${year}:${num}`

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    const exists = await checkPdfExists(sfsNumber)
    if (exists) {
      console.log(`  Found missing PDF: ${sfsNumber}`)

      // Try to get title from search
      let title = `SFS ${sfsNumber}`
      try {
        const html = await fetchSearch(sfsNumber, 100)
        const results = parseSearchResults(html)
        const match = results.find((r) => r.sfsNumber === sfsNumber)
        if (match) {
          title = match.title
        }
      } catch {
        // Keep default title
      }

      const documentType = classifyDocument(title)
      newDocs.push({
        sfsNumber,
        title,
        publishedDate: `${year}-01-01`,
        documentType,
        baseLawSfs:
          documentType === 'amendment' ? extractBaseLawSfs(title) : null,
        pdfUrl: buildPdfUrl(sfsNumber),
        htmlUrl: `https://rkrattsdb.gov.se/sfspdf/?LimitSFSNUM=${sfsNumber}`,
        isRattelseblad: false,
      })
    }
  }

  if (newDocs.length > 0) {
    console.log(`  Filled ${newDocs.length} gaps`)
  }

  return [...documents, ...newDocs]
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let year = 1998
  let delayMs = 1000 // 1 second between requests (conservative)
  let outputPath = ''
  let fillGapsFlag = true

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--year' && args[i + 1]) {
      year = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--delay' && args[i + 1]) {
      delayMs = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[i + 1]
      i++
    } else if (args[i] === '--no-gap-fill') {
      fillGapsFlag = false
    }
  }

  console.log('='.repeat(70))
  console.log('rkrattsdb.gov.se/sfspdf Index Crawler')
  console.log('='.repeat(70))
  console.log(`Year: ${year}`)
  console.log(`Delay: ${delayMs}ms between requests`)
  console.log(`Gap filling: ${fillGapsFlag ? 'enabled' : 'disabled'}`)

  const { result: crawlResult, expectedTotal } = await crawlYear({
    year,
    delayMs,
  })
  let result = crawlResult

  // Fill gaps if enabled
  if (fillGapsFlag && result.documents.length > 0) {
    const filledDocs = await fillGaps(
      year,
      result.documents,
      expectedTotal,
      delayMs
    )

    if (filledDocs.length > result.documents.length) {
      // Re-sort and recalculate stats
      filledDocs.sort((a, b) => {
        const [, numA] = a.sfsNumber.split(':')
        const [, numB] = b.sfsNumber.split(':')
        return parseInt(numA) - parseInt(numB)
      })

      result = {
        ...result,
        totalDocuments: filledDocs.length,
        byType: {
          amendment: filledDocs.filter((d) => d.documentType === 'amendment')
            .length,
          repeal: filledDocs.filter((d) => d.documentType === 'repeal').length,
          new_law: filledDocs.filter((d) => d.documentType === 'new_law')
            .length,
        },
        documents: filledDocs,
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Total documents: ${result.totalDocuments}`)
  if (result.totalDocuments > 0) {
    console.log(
      `  - Amendments: ${result.byType.amendment} (${((result.byType.amendment / result.totalDocuments) * 100).toFixed(1)}%)`
    )
    console.log(
      `  - Repeals: ${result.byType.repeal} (${((result.byType.repeal / result.totalDocuments) * 100).toFixed(1)}%)`
    )
    console.log(
      `  - New laws: ${result.byType.new_law} (${((result.byType.new_law / result.totalDocuments) * 100).toFixed(1)}%)`
    )
  }

  // Output to file
  const finalPath = outputPath
    ? path.isAbsolute(outputPath)
      ? outputPath
      : path.join(process.cwd(), outputPath)
    : path.join(
        process.cwd(),
        'data',
        'sfs-indexes',
        'rkrattsdb',
        `sfs-index-${year}-rkrattsdb.json`
      )

  const dataDir = path.dirname(finalPath)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  fs.writeFileSync(finalPath, JSON.stringify(result, null, 2))
  console.log(`\nResults saved to: ${finalPath}`)

  // Show sample documents
  if (result.documents.length > 0) {
    console.log('\n' + '='.repeat(70))
    console.log('SAMPLE DOCUMENTS')
    console.log('='.repeat(70))

    const samples = result.documents.slice(0, 5)
    samples.forEach((doc, i) => {
      console.log(`\n${i + 1}. ${doc.sfsNumber} [${doc.documentType}]`)
      console.log(`   Title: ${doc.title}`)
      if (doc.baseLawSfs) {
        console.log(`   Base law: ${doc.baseLawSfs}`)
      }
      console.log(`   PDF: ${doc.pdfUrl}`)
    })

    // Show last few too
    if (result.documents.length > 5) {
      console.log('\n... and last 3:')
      const lastSamples = result.documents.slice(-3)
      lastSamples.forEach((doc, i) => {
        console.log(
          `\n${result.documents.length - 2 + i}. ${doc.sfsNumber} [${doc.documentType}]`
        )
        console.log(`   Title: ${doc.title}`)
        if (doc.baseLawSfs) {
          console.log(`   Base law: ${doc.baseLawSfs}`)
        }
      })
    }
  }
}

main().catch(console.error)
