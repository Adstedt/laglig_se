/**
 * AFS HTML Scraper — Fetch regulation content from av.se
 * Story 9.1, Task 3
 *
 * Fetches the full consolidated regulation text from each AFS document's
 * page on av.se. The HTML is server-rendered by Episerver/Optimizely CMS
 * and contains the complete regulation including Allmänna råd, bilagor,
 * footnotes, tables, and övergångsbestämmelser.
 */

import * as cheerio from 'cheerio'

// ============================================================================
// Types
// ============================================================================

export interface ScrapedAfsDocument {
  /** The full inner HTML of div.provision */
  provisionHtml: string
  /** The page title from <title> or <h1> */
  pageTitle: string
  /** Content sections found */
  sections: {
    hasPreamble: boolean
    hasRules: boolean
    hasTransitionalRegulations: boolean
    hasAppendices: boolean
  }
  /** Raw stats for verification */
  stats: {
    paragraphCount: number
    sectionSignCount: number
    generalRecommendationCount: number
    tableCount: number
    footnoteCount: number
    listCount: number
    appendixCount: number
  }
}

export interface ScrapeResult {
  success: true
  data: ScrapedAfsDocument
}

export interface ScrapeError {
  success: false
  error: string
  statusCode?: number
}

export type ScrapeOutcome = ScrapeResult | ScrapeError

// ============================================================================
// Configuration
// ============================================================================

const USER_AGENT =
  'Laglig.se/1.0 (legal compliance platform; contact@laglig.se)'
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1000

// ============================================================================
// Core Scraper
// ============================================================================

/**
 * Fetch and parse a single AFS document page from av.se.
 * Extracts the div.provision content which contains the full regulation text.
 */
export async function scrapeAfsPage(pageUrl: string): Promise<ScrapeOutcome> {
  let lastError: string = ''

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        },
      })

      if (!response.ok) {
        lastError = `HTTP ${response.status} ${response.statusText}`
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1))
          continue
        }
        return { success: false, error: lastError, statusCode: response.status }
      }

      const html = await response.text()
      return parseProvisionHtml(html, pageUrl)
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1))
        continue
      }
    }
  }

  return {
    success: false,
    error: `Failed after ${MAX_RETRIES} retries: ${lastError}`,
  }
}

/**
 * Parse the full page HTML and extract the provision content.
 * av.se renders the entire regulation on a single HTML line inside
 * div.provision — a DOM parser (cheerio) is required.
 */
export function parseProvisionHtml(
  html: string,
  sourceUrl: string
): ScrapeOutcome {
  const $ = cheerio.load(html)

  // Extract page title
  const pageTitle =
    $('h1').first().text().trim() || $('title').first().text().trim() || ''

  // Find the provision container
  const provision = $('div.provision')
  if (provision.length === 0) {
    return {
      success: false,
      error: `No div.provision found on page: ${sourceUrl}`,
    }
  }

  // Get the inner HTML of the provision
  const provisionHtml = provision.html()
  if (!provisionHtml || provisionHtml.trim().length === 0) {
    return {
      success: false,
      error: `Empty div.provision on page: ${sourceUrl}`,
    }
  }

  // Detect content sections
  const sections = {
    hasPreamble: provision.find('div.preamble').length > 0,
    hasRules: provision.find('div.rules').length > 0,
    hasTransitionalRegulations:
      provision.find('div.transitionalregulations').length > 0,
    hasAppendices: provision.find('div.appendices').length > 0,
  }

  // Collect stats for verification
  const stats = {
    paragraphCount: provision.find('div.paragraph').length,
    sectionSignCount: provision.find('span.section-sign').length,
    generalRecommendationCount: provision.find('div.general-recommendation')
      .length,
    tableCount: provision.find('table.provision__table').length,
    footnoteCount: provision.find('button.footnote').length,
    listCount: provision.find('ol.provisionlist').length,
    appendixCount: provision.find('div.appendices > h2').length,
  }

  // Basic validation — a regulation page should have at least some section signs
  if (stats.sectionSignCount === 0 && sections.hasRules) {
    return {
      success: false,
      error: `No section signs (§) found despite having rules section: ${sourceUrl}`,
    }
  }

  return {
    success: true,
    data: {
      provisionHtml,
      pageTitle,
      sections,
      stats,
    },
  }
}

// ============================================================================
// Batch Scraping
// ============================================================================

export interface BatchScrapeOptions {
  /** Delay between requests in ms (default: 1000) */
  delayMs?: number
  /** Called after each document is scraped */
  onProgress?: (
    _docNumber: string,
    _result: ScrapeOutcome,
    _index: number,
    _total: number
  ) => void
}

/**
 * Scrape multiple AFS pages with rate limiting.
 * Returns a map of document number → scrape outcome.
 */
export async function scrapeAfsPages(
  documents: Array<{ documentNumber: string; pageUrl: string }>,
  options: BatchScrapeOptions = {}
): Promise<Map<string, ScrapeOutcome>> {
  const { delayMs = 1000, onProgress } = options
  const results = new Map<string, ScrapeOutcome>()

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]!
    const result = await scrapeAfsPage(doc.pageUrl)
    results.set(doc.documentNumber, result)

    if (onProgress) {
      onProgress(doc.documentNumber, result, i, documents.length)
    }

    // Rate limit between requests (skip delay after last request)
    if (i < documents.length - 1) {
      await delay(delayMs)
    }
  }

  return results
}

// ============================================================================
// Helpers
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
