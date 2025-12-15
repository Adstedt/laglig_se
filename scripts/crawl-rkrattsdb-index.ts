/**
 * Crawl SFS document index from rkrattsbaser.gov.se/sfsr (SFSR search)
 *
 * Story 2.13: Amendment Documents & Historical Versions
 * Phase 2 Part 2, Task 2.9: Pre-2018 ingestion from rkrattsdb.gov.se
 *
 * Strategy:
 * 1. Scrape SFSR search results to get SFS numbers + titles
 * 2. Classify documents by title (amendment/repeal/new_law)
 * 3. Extract base law SFS from amendment titles
 * 4. Construct PDF URLs using rkrattsdb.gov.se pattern
 *
 * Usage:
 *   pnpm tsx scripts/crawl-rkrattsdb-index.ts --year 1998
 *   pnpm tsx scripts/crawl-rkrattsdb-index.ts --year 1999 --delay 500
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
  htmlUrl: string // URL to SFSR entry
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
// SFSR Search Scraper
// =============================================================================

interface SearchResult {
  sfsNumber: string
  title: string
}

/**
 * Parse SFSR search results HTML to extract SFS numbers and titles
 * Format: "SFS 1998:306, Lag om ändring i stiftelselagen (1994:1220)"
 */
function parseSfsrResults(html: string): SearchResult[] {
  const results: SearchResult[] = []

  // Pattern: Links containing SFS numbers followed by titles
  // The HTML structure shows: <a href="...">SFS YYYY:NNN, Title...</a>
  // Or numbered list items: "1. SFS 1998:306, Lag om ändring..."

  // Try multiple patterns to capture the data
  const patterns = [
    // Pattern 1: "SFS YYYY:NNN, Title" in links or list items
    /SFS\s*(\d{4}:\d+)[,\s]+([^<\n]+?)(?=<|$|\n)/gi,
    // Pattern 2: Just "YYYY:NNN, Title"
    /(\d{4}:\d+)[,\s]+([^<\n]+?)(?=<|$|\n)/gi,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(html)) !== null) {
      const sfsNumber = match[1].trim()
      let title = match[2].trim()

      // Clean up title - remove trailing HTML artifacts
      title = title.replace(/<[^>]+>/g, '').trim()
      title = title.replace(/\s+/g, ' ').trim()

      // Skip if too short or doesn't look like a title
      if (title.length < 5) continue

      // Avoid duplicates
      if (!results.some((r) => r.sfsNumber === sfsNumber)) {
        results.push({ sfsNumber, title })
      }
    }
  }

  return results
}

/**
 * Extract total hit count from SFSR search results
 * Pattern: "Totalt X träffar" or "X dokument hittade"
 */
function extractTotalCount(html: string): number | null {
  const match = html.match(
    /(?:Totalt|Sökresultat[^0-9]*)\s*(\d+)\s*(?:träffar|dokument)/i
  )
  if (match) {
    return parseInt(match[1], 10)
  }
  return null
}

/**
 * Fetch SFSR search results for a given query
 */
async function fetchSfsrSearch(
  query: string,
  delayMs: number
): Promise<string> {
  const url = `https://rkrattsbaser.gov.se/sfsr?sok=${encodeURIComponent(query)}&LimitAntal=1500`

  console.log(`  Fetching: ${url}`)

  // Rate limiting
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
      Accept: 'text/html',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return response.text()
}

// =============================================================================
// Crawler
// =============================================================================

interface CrawlOptions {
  year: number
  delayMs: number
}

async function crawlYear(options: CrawlOptions): Promise<CrawlResult> {
  const { year, delayMs } = options

  console.log(`\nCrawling SFSR for year ${year}...`)

  const allResults: SearchResult[] = []

  // For years starting at 1 (1999+), search each digit prefix
  // For 1998 (starts at 306), search 3*, 4*, 5*, ... 18*
  const prefixes: string[] = []

  if (year === 1998) {
    // 1998 starts at 306, goes to 1836
    for (let i = 3; i <= 18; i++) {
      prefixes.push(`${year}:${i}*`)
    }
  } else {
    // Other years: search 1* through 9*, then 10*, 11*, etc. up to 20*
    for (let i = 1; i <= 20; i++) {
      prefixes.push(`${year}:${i}*`)
    }
  }

  console.log(`  Searching with ${prefixes.length} prefix queries...`)

  for (const prefix of prefixes) {
    try {
      const html = await fetchSfsrSearch(prefix, delayMs)

      const totalCount = extractTotalCount(html)
      const results = parseSfsrResults(html)

      // Filter to only include documents from the target year
      const yearResults = results.filter((r) =>
        r.sfsNumber.startsWith(`${year}:`)
      )

      console.log(
        `    ${prefix}: ${yearResults.length} results` +
          (totalCount ? ` (total: ${totalCount})` : '')
      )

      // Add results, avoiding duplicates
      for (const result of yearResults) {
        if (!allResults.some((r) => r.sfsNumber === result.sfsNumber)) {
          allResults.push(result)
        }
      }

      // If we got 0 results for this prefix, skip higher prefixes
      if (yearResults.length === 0 && parseInt(prefix.split(':')[1]) > 15) {
        console.log(`    No results for ${prefix}, stopping prefix search`)
        break
      }
    } catch (error) {
      console.error(`    Error fetching ${prefix}: ${error}`)
    }
  }

  console.log(`\nTotal unique results: ${allResults.length}`)

  // Convert to CrawledDocument format
  const documents: CrawledDocument[] = allResults.map((result) => {
    const documentType = classifyDocument(result.title)
    const baseLawSfs =
      documentType === 'amendment' ? extractBaseLawSfs(result.title) : null

    return {
      sfsNumber: result.sfsNumber,
      title: result.title,
      publishedDate: `${year}-01-01`,
      documentType,
      baseLawSfs,
      pdfUrl: buildPdfUrl(result.sfsNumber),
      htmlUrl: `https://rkrattsbaser.gov.se/sfsr?sok=${result.sfsNumber}`,
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
    year,
    source: 'rkrattsbaser.gov.se/sfsr',
    crawledAt: new Date().toISOString(),
    totalDocuments: documents.length,
    byType,
    documents,
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let year = 1998
  let delayMs = 1000 // 1 second between requests (conservative)
  let outputPath = ''

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
    }
  }

  console.log('='.repeat(70))
  console.log('SFSR Index Crawler (rkrattsbaser.gov.se)')
  console.log('='.repeat(70))
  console.log(`Year: ${year}`)
  console.log(`Delay: ${delayMs}ms between requests`)

  const result = await crawlYear({ year, delayMs })

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
    : path.join(process.cwd(), 'data', `sfs-index-${year}-rkrattsdb.json`)

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
