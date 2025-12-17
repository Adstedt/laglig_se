/**
 * Crawl SFS document index from svenskforfattningssamling.se
 *
 * Story 2.13: Amendment Documents & Historical Versions
 * Phase 2, Task 2.1: Build index crawler
 *
 * Usage:
 *   pnpm tsx scripts/crawl-sfs-index.ts --year 2025
 *   pnpm tsx scripts/crawl-sfs-index.ts --year 2025 --output crawl-results.json
 */

import * as fs from 'fs'
import * as path from 'path'

// =============================================================================
// Types
// =============================================================================

export type DocumentType = 'amendment' | 'repeal' | 'new_law'

export interface CrawledDocument {
  sfsNumber: string // "2025:1461"
  title: string // "Lag om ändring i lagen (2023:875) om tilläggsskatt"
  publishedDate: string // "2025-12-10"
  documentType: DocumentType
  baseLawSfs: string | null // "2023:875" for amendments, null for new laws
  pdfUrl: string // Full URL to PDF
  htmlUrl: string // Full URL to HTML page
}

export interface CrawlResult {
  year: number
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

/**
 * Classify a document by its title
 */
export function classifyDocument(title: string): DocumentType {
  const lowerTitle = title.toLowerCase()

  // Check for amendment pattern: "om ändring i"
  if (
    lowerTitle.includes('om ändring i') ||
    lowerTitle.includes('om ändring av')
  ) {
    return 'amendment'
  }

  // Check for repeal pattern: "om upphävande av"
  if (
    lowerTitle.includes('om upphävande av') ||
    lowerTitle.includes('om upphävande av')
  ) {
    return 'repeal'
  }

  // Everything else is a new law/regulation
  return 'new_law'
}

/**
 * Extract the base law SFS number from an amendment title
 * Example: "Lag om ändring i lagen (2023:875) om tilläggsskatt" -> "2023:875"
 */
export function extractBaseLawSfs(title: string): string | null {
  // Look for pattern like (YYYY:NNN) in the title
  // For amendments, this appears after "ändring i" and refers to the base law
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
// HTML Parsing
// =============================================================================

/**
 * Parse the index page HTML to extract document listings
 *
 * HTML structure:
 * <tr>
 *   <td ...><span data-lable="SFS-nummer">2025:1461</span></td>
 *   <td ...><span data-lable="Rubrik"><a href="doc/20251461.html">Title...</a></span></td>
 *   <td ...><span data-lable="Publicerad">2025-12-10</span></td>
 * </tr>
 */
function _parseIndexPage(html: string, year: number): CrawledDocument[] {
  const documents: CrawledDocument[] = []

  // Match table rows with document data
  // Use a more specific pattern based on the actual HTML structure
  const rowRegex =
    /<tr>[\s\S]*?<span[^>]*data-lable="SFS-nummer"[^>]*>(\d{4}:\d+)<\/span>[\s\S]*?<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<span[^>]*data-lable="Publicerad"[^>]*>(\d{4}-\d{2}-\d{2})<\/span>[\s\S]*?<\/tr>/gi

  let match
  while ((match = rowRegex.exec(html)) !== null) {
    const [, sfsNumber, href, title, publishedDate] = match

    // Skip if SFS number doesn't match the year we're looking for
    if (!sfsNumber.startsWith(`${year}:`)) {
      continue
    }

    const documentType = classifyDocument(title)
    const baseLawSfs =
      documentType === 'amendment' ? extractBaseLawSfs(title) : null

    // Construct full URLs
    const baseUrl = 'https://svenskforfattningssamling.se'
    const htmlUrl = href.startsWith('http')
      ? href
      : `${baseUrl}/${href.replace(/^\.\.\//, '')}`

    // PDF URL pattern: /sites/default/files/sfs/YYYY-MM/SFSYYYY-NNNN.pdf
    const [sfsYear, sfsNum] = sfsNumber.split(':')
    const month = publishedDate.substring(0, 7) // YYYY-MM
    const pdfUrl = `${baseUrl}/sites/default/files/sfs/${month}/SFS${sfsYear}-${sfsNum}.pdf`

    documents.push({
      sfsNumber,
      title: title.trim(),
      publishedDate,
      documentType,
      baseLawSfs,
      pdfUrl,
      htmlUrl,
    })
  }

  return documents
}

/**
 * Check if there's a next page link and extract the page number
 * Pattern: <li class="next"><a href="regulations%3Fpage=1.html" ...>
 * %3F is URL-encoded '?', %3D is URL-encoded '='
 */
function _getNextPageNumber(html: string): number | null {
  // Look for next page link in pagination
  // Pattern: page=N or page%3D=N (URL encoded)
  const match = html.match(
    /<li\s+class="next"[^>]*>[\s\S]*?<a\s+href="[^"]*[?%].*?page[=%3D]*(\d+)/i
  )
  if (match) {
    return parseInt(match[1], 10)
  }
  return null
}

// =============================================================================
// Crawler
// =============================================================================

async function fetchPage(url: string): Promise<string> {
  console.log(`  Fetching: ${url}`)

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

async function crawlYear(year: number): Promise<CrawlResult> {
  console.log(`\nCrawling SFS documents for year ${year}...`)

  const baseUrl = 'https://svenskforfattningssamling.se'
  const allDocuments: CrawledDocument[] = []

  // Step 1: Get the latest SFS number from the index page
  console.log('\nStep 1: Finding latest SFS number...')
  const indexUrl = `${baseUrl}/regulations/${year}/index.html`
  const indexHtml = await fetchPage(indexUrl)

  // Find the highest SFS number on the index page
  const sfsNumbers = [
    ...indexHtml.matchAll(/data-lable="SFS-nummer">(\d{4}):(\d+)</g),
  ]
    .filter((m) => m[1] === String(year))
    .map((m) => parseInt(m[2], 10))

  if (sfsNumbers.length === 0) {
    console.log(`  No documents found for ${year}`)
    return {
      year,
      crawledAt: new Date().toISOString(),
      totalDocuments: 0,
      byType: { amendment: 0, repeal: 0, new_law: 0 },
      documents: [],
    }
  }

  const latestSfsNum = Math.max(...sfsNumbers)
  console.log(`  Latest SFS number: ${year}:${latestSfsNum}`)

  // Step 2: Enumerate all document pages from 1 to latest
  console.log(`\nStep 2: Fetching ${latestSfsNum} document pages...`)

  for (let sfsNum = 1; sfsNum <= latestSfsNum; sfsNum++) {
    const docUrl = `${baseUrl}/doc/${year}${sfsNum}.html`

    // Progress indicator
    if (sfsNum % 50 === 0 || sfsNum === latestSfsNum) {
      console.log(
        `  Progress: ${sfsNum}/${latestSfsNum} (${allDocuments.length} found)`
      )
    }

    // Rate limiting: 100ms between requests (10 req/sec)
    if (sfsNum > 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    try {
      const response = await fetch(docUrl, {
        headers: {
          'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
          Accept: 'text/html',
        },
      })

      if (!response.ok) {
        // Document doesn't exist (gap in numbering or not yet published)
        continue
      }

      const html = await response.text()

      // Extract title from <title> tag
      const titleMatch = html.match(/<title>([^|]+)\|/i)
      const title = titleMatch ? titleMatch[1].trim() : `SFS ${year}:${sfsNum}`

      // Extract PDF URL from the download link
      // Pattern: href="../sites/default/files/sfs/YYYY-MM/SFSYYYY-N.pdf"
      const pdfMatch = html.match(/href="([^"]*\/sfs\/[^"]+\.pdf)"/i)
      const pdfPath = pdfMatch ? pdfMatch[1].replace(/^\.\./, '') : null
      const pdfUrl = pdfPath
        ? `${baseUrl}${pdfPath.startsWith('/') ? '' : '/'}${pdfPath}`
        : ''

      // Extract publication date from PDF path or page content
      let publishedDate = `${year}-01-01`
      if (pdfPath) {
        const monthMatch = pdfPath.match(/\/sfs\/(\d{4}-\d{2})\//)
        if (monthMatch) {
          publishedDate = `${monthMatch[1]}-01`
        }
      }

      const sfsNumber = `${year}:${sfsNum}`
      const documentType = classifyDocument(title)
      const baseLawSfs =
        documentType === 'amendment' ? extractBaseLawSfs(title) : null

      allDocuments.push({
        sfsNumber,
        title,
        publishedDate,
        documentType,
        baseLawSfs,
        pdfUrl,
        htmlUrl: docUrl,
      })
    } catch (error) {
      // Network error - skip this document
      console.error(`  Error fetching ${year}:${sfsNum}: ${error}`)
    }
  }

  console.log(`\nCrawl complete.`)

  // Count by type
  const byType = {
    amendment: allDocuments.filter((d) => d.documentType === 'amendment')
      .length,
    repeal: allDocuments.filter((d) => d.documentType === 'repeal').length,
    new_law: allDocuments.filter((d) => d.documentType === 'new_law').length,
  }

  return {
    year,
    crawledAt: new Date().toISOString(),
    totalDocuments: allDocuments.length,
    byType,
    documents: allDocuments,
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let year = 2025
  let outputPath = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--year' && args[i + 1]) {
      year = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[i + 1]
      i++
    }
  }

  console.log('='.repeat(70))
  console.log('SFS Index Crawler')
  console.log('='.repeat(70))
  console.log(`Year: ${year}`)

  const result = await crawlYear(year)

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Total documents: ${result.totalDocuments}`)
  console.log(
    `  - Amendments: ${result.byType.amendment} (${((result.byType.amendment / result.totalDocuments) * 100).toFixed(1)}%)`
  )
  console.log(
    `  - Repeals: ${result.byType.repeal} (${((result.byType.repeal / result.totalDocuments) * 100).toFixed(1)}%)`
  )
  console.log(
    `  - New laws: ${result.byType.new_law} (${((result.byType.new_law / result.totalDocuments) * 100).toFixed(1)}%)`
  )

  // Output to file if specified
  if (outputPath) {
    const fullPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.join(process.cwd(), outputPath)
    fs.writeFileSync(fullPath, JSON.stringify(result, null, 2))
    console.log(`\nResults saved to: ${fullPath}`)
  } else {
    // Default output path
    const defaultPath = path.join(
      process.cwd(),
      'data',
      `sfs-index-${year}.json`
    )
    const dataDir = path.dirname(defaultPath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    fs.writeFileSync(defaultPath, JSON.stringify(result, null, 2))
    console.log(`\nResults saved to: ${defaultPath}`)
  }

  // Show sample documents
  console.log('\n' + '='.repeat(70))
  console.log('SAMPLE DOCUMENTS')
  console.log('='.repeat(70))

  const samples = result.documents.slice(0, 5)
  samples.forEach((doc, i) => {
    console.log(`\n${i + 1}. ${doc.sfsNumber} [${doc.documentType}]`)
    console.log(`   Title: ${doc.title}`)
    console.log(`   Date: ${doc.publishedDate}`)
    if (doc.baseLawSfs) {
      console.log(`   Base law: ${doc.baseLawSfs}`)
    }
    console.log(`   PDF: ${doc.pdfUrl}`)
  })
}

main().catch(console.error)
