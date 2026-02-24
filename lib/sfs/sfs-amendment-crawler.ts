/**
 * SFS Amendment Crawler
 *
 * Story 8.20: Continuous SFS Amendment Discovery
 *
 * Crawls svenskforfattningssamling.se to discover new SFS amendments and repeals.
 * Extracted from scripts/crawl-sfs-index.ts with incremental watermark support.
 */

// =============================================================================
// Types
// =============================================================================

export type DocumentType = 'amendment' | 'repeal' | 'new_law'

export interface CrawledDocument {
  sfsNumber: string // "2026:145"
  title: string // "Lag om ändring i lagen (2023:875) om tilläggsskatt"
  publishedDate: string // "2026-02-10"
  documentType: DocumentType
  baseLawSfs: string | null // "2023:875" for amendments/repeals, null for new laws
  pdfUrl: string // Full URL to PDF
  htmlUrl: string // Full URL to HTML page
}

export interface CrawlIndexResult {
  year: number
  highestSfsNum: number
  documents: CrawledDocument[]
}

export interface CrawlerOptions {
  /** Minimum delay between requests in ms (default: 200) */
  requestDelayMs?: number
  /** Only discover SFS numbers above this watermark (numeric part after colon) */
  startFromSfsNumber?: number
  /** Custom fetch function for testing */
  fetchFn?: typeof fetch
}

const BASE_URL = 'https://svenskforfattningssamling.se'
const USER_AGENT = 'Laglig.se/1.0 (Legal research; contact@laglig.se)'

// =============================================================================
// Document Classification
// =============================================================================

/**
 * Classify a document by its title
 */
export function classifyDocument(title: string): DocumentType {
  const lowerTitle = title.toLowerCase()

  if (
    lowerTitle.includes('om ändring i') ||
    lowerTitle.includes('om ändring av')
  ) {
    return 'amendment'
  }

  if (lowerTitle.includes('om upphävande av')) {
    return 'repeal'
  }

  return 'new_law'
}

/**
 * Extract the base law SFS number from an amendment/repeal title.
 * Example: "Lag om ändring i lagen (2023:875) om tilläggsskatt" → "2023:875"
 * Example: "Lag om upphävande av lagen (2020:123)" → "2020:123"
 */
export function extractBaseLawSfs(title: string): string | null {
  // Match after "ändring i" or "upphävande av"
  const match = title.match(
    /om (?:ändring i|ändring av|upphävande av)[^(]*\((\d{4}:\d+)\)/i
  )
  if (match?.[1]) {
    return match[1]
  }

  // Fallback: first SFS number in parentheses
  const altMatch = title.match(/\((\d{4}:\d+)\)/)
  if (altMatch?.[1]) {
    return altMatch[1]
  }

  return null
}

/**
 * Extract the numeric portion of an SFS number (the part after the colon).
 * Returns NaN for invalid input.
 */
export function extractSfsNumericPart(sfsNumber: string): number {
  const parts = sfsNumber.split(':')
  if (parts.length !== 2 || !parts[1]) return NaN
  return parseInt(parts[1], 10)
}

// =============================================================================
// Rate Limiting
// =============================================================================

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// =============================================================================
// HTML Parsing
// =============================================================================

/**
 * Parse the index page HTML to extract the highest SFS number for the year.
 * Returns all SFS numbers found on the page.
 */
export function parseIndexPageSfsNumbers(html: string, year: number): number[] {
  const matches = [
    ...html.matchAll(/data-lable="SFS-nummer"[^>]*>(\d{4}):(\d+)/g),
  ]
  return matches
    .filter((m) => m[1] === String(year))
    .map((m) => parseInt(m[2]!, 10))
}

/**
 * Check if the index page has a "next" pagination link.
 */
export function getNextPageNumber(html: string): number | null {
  const match = html.match(
    /<li\s+class="next"[^>]*>[\s\S]*?<a\s+href="[^"]*[?%].*?page[=%3D]*(\d+)/i
  )
  if (match) {
    return parseInt(match[1]!, 10)
  }
  return null
}

/**
 * Parse a document page HTML to extract metadata.
 */
export function parseDocumentPage(
  html: string,
  sfsNumber: string
): Omit<CrawledDocument, 'sfsNumber'> | null {
  // Extract title from <title> tag
  const titleMatch = html.match(/<title>([^|]+)\|/i)
  const title = titleMatch ? titleMatch[1]!.trim() : null

  if (!title) return null

  // Extract PDF URL from the download link
  const pdfMatch = html.match(/href="([^"]*\/sfs\/[^"]+\.pdf)"/i)
  const pdfPath = pdfMatch ? pdfMatch[1]!.replace(/^\.\./, '') : null
  const pdfUrl = pdfPath
    ? `${BASE_URL}${pdfPath.startsWith('/') ? '' : '/'}${pdfPath}`
    : ''

  // Extract publication date from PDF path
  let publishedDate = `${sfsNumber.split(':')[0]}-01-01`
  if (pdfPath) {
    const monthMatch = pdfPath.match(/\/sfs\/(\d{4}-\d{2})\//)
    if (monthMatch) {
      publishedDate = `${monthMatch[1]}-01`
    }
  }

  const documentType = classifyDocument(title)
  const baseLawSfs =
    documentType === 'amendment' || documentType === 'repeal'
      ? extractBaseLawSfs(title)
      : null

  const [sfsYear, sfsNum] = sfsNumber.split(':')

  return {
    title,
    publishedDate,
    documentType,
    baseLawSfs,
    pdfUrl,
    htmlUrl: `${BASE_URL}/doc/${sfsYear}${sfsNum}.html`,
  }
}

// =============================================================================
// Crawler Functions
// =============================================================================

async function fetchPage(
  url: string,
  fetchFn: typeof fetch
): Promise<string | null> {
  const response = await fetchFn(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html',
    },
  })

  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(
      `HTTP ${response.status}: ${response.statusText} for ${url}`
    )
  }

  return response.text()
}

/**
 * Crawl the current year's index page to find the highest SFS number.
 * If no watermark is provided, traverses all pagination pages to build a full index.
 * With a watermark, only page 1 is needed (it shows the most recent documents).
 */
export async function crawlCurrentYearIndex(
  year: number,
  options: CrawlerOptions = {}
): Promise<CrawlIndexResult> {
  const { requestDelayMs = 200, startFromSfsNumber, fetchFn = fetch } = options

  const indexUrl = `${BASE_URL}/regulations/${year}/index.html`
  const html = await fetchPage(indexUrl, fetchFn)

  if (!html) {
    return { year, highestSfsNum: 0, documents: [] }
  }

  const sfsNumbers = parseIndexPageSfsNumbers(html, year)

  if (sfsNumbers.length === 0) {
    return { year, highestSfsNum: 0, documents: [] }
  }

  const highestSfsNum = Math.max(...sfsNumbers)

  // Determine the range to crawl
  const startFrom = startFromSfsNumber ? startFromSfsNumber + 1 : 1

  if (startFrom > highestSfsNum) {
    // No new documents above watermark
    return { year, highestSfsNum, documents: [] }
  }

  // Crawl individual document pages for the range
  const documents: CrawledDocument[] = []

  for (let num = startFrom; num <= highestSfsNum; num++) {
    if (num > startFrom) {
      await delay(requestDelayMs)
    }

    const sfsNumber = `${year}:${num}`
    const docUrl = `${BASE_URL}/doc/${year}${num}.html`

    try {
      const docHtml = await fetchPage(docUrl, fetchFn)
      if (!docHtml) continue // Document doesn't exist (gap in numbering)

      const parsed = parseDocumentPage(docHtml, sfsNumber)
      if (!parsed) continue

      documents.push({
        sfsNumber,
        ...parsed,
      })
    } catch (error) {
      console.error(
        `[SFS-CRAWLER] Error fetching ${sfsNumber}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  return { year, highestSfsNum, documents }
}

/**
 * Crawl a single document page by SFS number.
 */
export async function crawlDocumentPage(
  sfsNumber: string,
  options: CrawlerOptions = {}
): Promise<CrawledDocument | null> {
  const { fetchFn = fetch } = options

  const [year, num] = sfsNumber.split(':')
  if (!year || !num) return null

  const docUrl = `${BASE_URL}/doc/${year}${num}.html`

  const html = await fetchPage(docUrl, fetchFn)
  if (!html) return null

  const parsed = parseDocumentPage(html, sfsNumber)
  if (!parsed) return null

  return { sfsNumber, ...parsed }
}
