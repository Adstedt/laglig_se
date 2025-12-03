/* eslint-disable no-console */
/**
 * EUR-Lex SPARQL API Client
 *
 * Fetches EU legislation (regulations and directives) in Swedish from EUR-Lex.
 *
 * API Documentation:
 * - SPARQL Endpoint: https://publications.europa.eu/webapi/rdf/sparql
 * - CDM Model: https://op.europa.eu/en/web/eu-vocabularies/cdm
 * - CELEX Format: https://eur-lex.europa.eu/content/help/eurlex-content/celex-number.html
 *
 * CELEX Structure: [Sector][Year][Type][Number]
 * - Sector 3 = Secondary legislation
 * - Type R = Regulation, L = Directive
 * - Example: 32016R0679 = GDPR (Regulation EU 2016/679)
 */

import pLimit from 'p-limit'
import { load as cheerioLoad } from 'cheerio'

// ============================================================================
// Types
// ============================================================================

export interface EurLexDocument {
  celex: string // "32016R0679"
  type: 'REG' | 'DIR' // Regulation or Directive
  title: string // Swedish title
  documentNumber: string | null // "Regulation (EU) 2016/679"
  publicationDate: Date | null
  entryIntoForce: Date | null
  eurlexUrl: string
  eutReference: string | null // Official Journal reference
}

export interface EurLexDocumentWithContent extends EurLexDocument {
  htmlContent: string | null
  fullText: string | null
}

export interface NIMData {
  sweden: {
    measures: Array<{
      sfsNumber: string // "SFS 2018:218"
      title: string
      notificationDate?: string
    }>
    implementationStatus: 'COMPLETE' | 'PARTIAL' | 'PENDING' | 'UNKNOWN'
  } | null
}

export interface SPARQLBinding {
  type: string
  value: string
  datatype?: string
}

export interface SPARQLResult {
  work?: SPARQLBinding
  celex?: SPARQLBinding
  title?: SPARQLBinding
  docNumber?: SPARQLBinding
  publicationDate?: SPARQLBinding
  entryIntoForce?: SPARQLBinding
  eutReference?: SPARQLBinding
  count?: SPARQLBinding // For COUNT queries
}

export interface SPARQLResponse {
  results: {
    bindings: SPARQLResult[]
  }
}

export class EurLexApiError extends Error {
  public statusCode: number | undefined
  public isRetryable: boolean

  constructor(
    message: string,
    statusCode?: number,
    isRetryable: boolean = false
  ) {
    super(message)
    this.name = 'EurLexApiError'
    this.statusCode = statusCode
    this.isRetryable = isRetryable
  }
}

// ============================================================================
// Configuration
// ============================================================================

const SPARQL_ENDPOINT = 'https://publications.europa.eu/webapi/rdf/sparql'
const EURLEX_HTML_BASE = 'https://eur-lex.europa.eu/legal-content/SV/TXT/HTML/'
const EURLEX_NIM_BASE = 'https://eur-lex.europa.eu/legal-content/EN/NIM/'
// CELLAR REST API - Official Publications Office endpoint (no WAF issues)
const CELLAR_REST_BASE = 'https://publications.europa.eu/resource/celex/'

// Rate limiting: 2 requests/second (conservative for government API)
const RATE_LIMIT_REQUESTS_PER_SECOND = 2
const rateLimiter = pLimit(RATE_LIMIT_REQUESTS_PER_SECOND)

const RETRY_CONFIG = {
  maxAttempts: 5, // Increased for API stability
  backoffMultiplier: 2,
  initialDelay: 2000, // 2 seconds
  maxDelay: 16000, // 16 seconds
  retryableErrors: [429, 500, 502, 503, 504],
}

// Simple in-memory rate limiter for request spacing
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 200 // 200ms = 5 req/sec (faster ingestion)

// ============================================================================
// SPARQL Query Builders
// ============================================================================

/**
 * Builds SPARQL query for fetching EU Regulations in Swedish
 */
export function buildRegulationsQuery(
  limit: number = 1000,
  offset: number = 0
): string {
  return `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT DISTINCT ?work ?celex ?title ?docNumber ?publicationDate ?entryIntoForce ?eutReference
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .

  # Filter for regulations (including implementing, delegated, financial)
  ?work cdm:work_has_resource-type ?type .
  FILTER(?type IN (
    <http://publications.europa.eu/resource/authority/resource-type/REG>,
    <http://publications.europa.eu/resource/authority/resource-type/REG_IMPL>,
    <http://publications.europa.eu/resource/authority/resource-type/REG_DEL>,
    <http://publications.europa.eu/resource/authority/resource-type/REG_FINANC>
  ))

  # Get Swedish expression and title (expression_belongs_to_work is the correct property)
  ?expr cdm:expression_belongs_to_work ?work .
  ?expr cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/SWE> .
  ?expr cdm:expression_title ?title .

  # Optional fields
  OPTIONAL { ?work cdm:resource_legal_id_sector ?docNumber }
  OPTIONAL { ?work cdm:work_date_document ?publicationDate }
  OPTIONAL { ?work cdm:resource_legal_date_entry-into-force ?entryIntoForce }
  OPTIONAL { ?work cdm:work_part_of_collection_document ?eutReference }

  # Exclude non-indexed documents
  FILTER NOT EXISTS { ?work cdm:do_not_index "true"^^xsd:boolean }
}
ORDER BY DESC(?publicationDate)
LIMIT ${limit}
OFFSET ${offset}
`
}

/**
 * Builds SPARQL query for fetching EU Directives in Swedish
 */
export function buildDirectivesQuery(
  limit: number = 1000,
  offset: number = 0
): string {
  return `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT DISTINCT ?work ?celex ?title ?docNumber ?publicationDate ?entryIntoForce ?eutReference
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .

  # Filter for directives (including implementing, delegated)
  ?work cdm:work_has_resource-type ?type .
  FILTER(?type IN (
    <http://publications.europa.eu/resource/authority/resource-type/DIR>,
    <http://publications.europa.eu/resource/authority/resource-type/DIR_IMPL>,
    <http://publications.europa.eu/resource/authority/resource-type/DIR_DEL>
  ))

  # Get Swedish expression and title (expression_belongs_to_work is the correct property)
  ?expr cdm:expression_belongs_to_work ?work .
  ?expr cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/SWE> .
  ?expr cdm:expression_title ?title .

  # Optional fields
  OPTIONAL { ?work cdm:resource_legal_id_sector ?docNumber }
  OPTIONAL { ?work cdm:work_date_document ?publicationDate }
  OPTIONAL { ?work cdm:resource_legal_date_entry-into-force ?entryIntoForce }
  OPTIONAL { ?work cdm:work_part_of_collection_document ?eutReference }

  # Exclude non-indexed documents
  FILTER NOT EXISTS { ?work cdm:do_not_index "true"^^xsd:boolean }
}
ORDER BY DESC(?publicationDate)
LIMIT ${limit}
OFFSET ${offset}
`
}

/**
 * Builds SPARQL query to count total regulations with Swedish content
 */
export function buildRegulationsCountQuery(): string {
  return `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT (COUNT(DISTINCT ?work) AS ?count)
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_has_resource-type ?type .
  FILTER(?type IN (
    <http://publications.europa.eu/resource/authority/resource-type/REG>,
    <http://publications.europa.eu/resource/authority/resource-type/REG_IMPL>,
    <http://publications.europa.eu/resource/authority/resource-type/REG_DEL>,
    <http://publications.europa.eu/resource/authority/resource-type/REG_FINANC>
  ))
  ?expr cdm:expression_belongs_to_work ?work .
  ?expr cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/SWE> .
  FILTER NOT EXISTS { ?work cdm:do_not_index "true"^^xsd:boolean }
}
`
}

/**
 * Builds SPARQL query to count total directives with Swedish content
 */
export function buildDirectivesCountQuery(): string {
  return `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT (COUNT(DISTINCT ?work) AS ?count)
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_has_resource-type ?type .
  FILTER(?type IN (
    <http://publications.europa.eu/resource/authority/resource-type/DIR>,
    <http://publications.europa.eu/resource/authority/resource-type/DIR_IMPL>,
    <http://publications.europa.eu/resource/authority/resource-type/DIR_DEL>
  ))
  ?expr cdm:expression_belongs_to_work ?work .
  ?expr cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/SWE> .
  FILTER NOT EXISTS { ?work cdm:do_not_index "true"^^xsd:boolean }
}
`
}

// ============================================================================
// Rate Limiting & Retry Logic
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForRateLimit(): Promise<void> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest)
  }

  lastRequestTime = Date.now()
}

async function fetchWithRetry(
  url: string,
  options?: RequestInit
): Promise<Response> {
  let lastError: Error | null = null
  let delay = RETRY_CONFIG.initialDelay

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      await waitForRateLimit()

      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Laglig.se/1.0 (https://laglig.se; contact@laglig.se)',
          ...options?.headers,
        },
      })

      // Check for rate limiting or server errors
      if (RETRY_CONFIG.retryableErrors.includes(response.status)) {
        throw new EurLexApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          true
        )
      }

      if (!response.ok) {
        throw new EurLexApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          false
        )
      }

      return response
    } catch (error) {
      lastError = error as Error

      const isRetryable =
        error instanceof EurLexApiError
          ? error.isRetryable
          : error instanceof TypeError // Network errors

      if (!isRetryable || attempt === RETRY_CONFIG.maxAttempts) {
        throw error
      }

      console.log(
        `EUR-Lex API attempt ${attempt} failed, retrying in ${delay}ms:`,
        (error as Error).message
      )
      await sleep(delay)
      delay = Math.min(
        delay * RETRY_CONFIG.backoffMultiplier,
        RETRY_CONFIG.maxDelay
      )
    }
  }

  throw lastError
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Executes a SPARQL query against EUR-Lex endpoint with retry on JSON parse errors
 */
export async function executeSparqlQuery(
  query: string
): Promise<SPARQLResponse> {
  const url = new URL(SPARQL_ENDPOINT)
  url.searchParams.set('query', query)

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      const response = await fetchWithRetry(url.toString(), {
        headers: {
          Accept: 'application/sparql-results+json',
        },
      })

      // Read response as text first to handle JSON parse errors
      const responseText = await response.text()

      try {
        return JSON.parse(responseText) as SPARQLResponse
      } catch (parseError) {
        // JSON parse error - likely truncated response
        throw new EurLexApiError(
          `JSON parse error: ${(parseError as Error).message} (response length: ${responseText.length} chars)`,
          undefined,
          true // Retryable
        )
      }
    } catch (error) {
      lastError = error as Error

      const isRetryable = error instanceof EurLexApiError && error.isRetryable

      if (!isRetryable || attempt === RETRY_CONFIG.maxAttempts) {
        throw error
      }

      const delay = Math.min(
        RETRY_CONFIG.initialDelay *
          Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
        RETRY_CONFIG.maxDelay
      )

      console.log(
        `SPARQL query attempt ${attempt} failed, retrying in ${delay}ms:`,
        (error as Error).message
      )
      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * Fetches EU regulations with Swedish titles
 */
export async function fetchRegulations(
  limit: number = 1000,
  offset: number = 0
): Promise<EurLexDocument[]> {
  const query = buildRegulationsQuery(limit, offset)
  const response = await executeSparqlQuery(query)

  return response.results.bindings.map((binding) =>
    parseSparqlBinding(binding, 'REG')
  )
}

/**
 * Fetches EU directives with Swedish titles
 */
export async function fetchDirectives(
  limit: number = 1000,
  offset: number = 0
): Promise<EurLexDocument[]> {
  const query = buildDirectivesQuery(limit, offset)
  const response = await executeSparqlQuery(query)

  return response.results.bindings.map((binding) =>
    parseSparqlBinding(binding, 'DIR')
  )
}

/**
 * Gets the total count of regulations with Swedish content
 */
export async function getRegulationsCount(): Promise<number> {
  const query = buildRegulationsCountQuery()
  const response = await executeSparqlQuery(query)

  const countBinding = response.results.bindings[0]
  if (!countBinding?.count?.value) {
    return 0
  }

  return parseInt(countBinding.count.value, 10)
}

/**
 * Gets the total count of directives with Swedish content
 */
export async function getDirectivesCount(): Promise<number> {
  const query = buildDirectivesCountQuery()
  const response = await executeSparqlQuery(query)

  const countBinding = response.results.bindings[0]
  if (!countBinding?.count?.value) {
    return 0
  }

  return parseInt(countBinding.count.value, 10)
}

/**
 * Fetches HTML content of an EU document in Swedish
 */
export async function fetchDocumentContent(
  celex: string
): Promise<{ html: string; plainText: string } | null> {
  const url = `${EURLEX_HTML_BASE}?uri=CELEX:${celex}`

  try {
    const response = await rateLimiter(() =>
      fetchWithRetry(url, {
        headers: {
          Accept: 'text/html',
        },
      })
    )

    const html = await response.text()

    // Check if we got actual content (not a "not available" page)
    if (
      html.includes('is not available in') ||
      html.includes('This document is not available')
    ) {
      console.log(`No Swedish content available for ${celex}`)
      return null
    }

    // Extract the main content area
    const $ = cheerioLoad(html)

    // Remove script, style, nav elements
    $('script, style, nav, header, footer, .navigation, .breadcrumb').remove()

    // Get the main content (usually in #document or .eli-main-title + .eli-main-body)
    let mainContent = $('#document').html() || $('.eli-main-body').html()
    if (!mainContent) {
      // Fallback: get body content
      mainContent = $('body').html() || html
    }

    // Clean HTML for storage
    const cleanedHtml = cleanHtmlContent(mainContent)

    // Extract plain text for RAG
    const plainText = extractPlainText($('body').text())

    return {
      html: cleanedHtml,
      plainText,
    }
  } catch (error) {
    console.error(`Failed to fetch content for ${celex}:`, error)
    return null
  }
}

/**
 * Fetches HTML content of an EU document in Swedish via CELLAR REST API
 *
 * This uses the official Publications Office REST API which:
 * - Has no WAF/CloudFront issues
 * - Supports content negotiation via Accept headers
 * - Returns Swedish content via Accept-Language header
 *
 * @param celex - CELEX number (e.g., "32016R0679")
 * @returns HTML content and plain text, or null if not available
 */
export async function fetchDocumentContentViaCellar(
  celex: string
): Promise<{ html: string; plainText: string } | null> {
  const url = `${CELLAR_REST_BASE}${celex}`

  try {
    const response = await rateLimiter(() =>
      fetchWithRetry(url, {
        headers: {
          Accept:
            'text/html, text/html;type=simplified, application/xhtml+xml, application/xml;q=0.9',
          'Accept-Language': 'sv, sv-SE;q=0.9, en;q=0.5',
        },
        redirect: 'follow',
      })
    )

    // Handle HTTP 300 Multiple Choices (content negotiation)
    if (response.status === 300) {
      // Parse the response to find Swedish HTML version
      const body = await response.text()
      const $ = cheerioLoad(body)

      // Look for Swedish HTML link
      let swedishHtmlUrl: string | null = null

      $('a').each((_, el) => {
        const href = $(el).attr('href')
        const text = $(el).text().toLowerCase()

        if (
          href &&
          (text.includes('swedish') ||
            text.includes('svenska') ||
            href.includes('/SWE/') ||
            href.includes('language=sv'))
        ) {
          if (href.includes('.html') || href.includes('text/html')) {
            swedishHtmlUrl = href
            return false // break
          }
        }
        return true // continue
      })

      if (swedishHtmlUrl) {
        // Fetch the Swedish HTML version
        const swedishResponse = await rateLimiter(() =>
          fetchWithRetry(swedishHtmlUrl!, {
            headers: {
              Accept: 'text/html',
            },
          })
        )
        const html = await swedishResponse.text()
        return parseHtmlContent(html, celex)
      }

      console.log(`No Swedish HTML version found in 300 response for ${celex}`)
      return null
    }

    const html = await response.text()
    return parseHtmlContent(html, celex)
  } catch (error) {
    console.error(`Failed to fetch content via CELLAR for ${celex}:`, error)
    return null
  }
}

/**
 * Parses HTML content and extracts clean HTML and plain text
 */
function parseHtmlContent(
  html: string,
  celex: string
): { html: string; plainText: string } | null {
  // Check if we got actual content (not an error page)
  if (
    html.includes('is not available in') ||
    html.includes('This document is not available') ||
    html.includes('Document not found') ||
    html.length < 500
  ) {
    console.log(`No valid content available for ${celex}`)
    return null
  }

  const $ = cheerioLoad(html)

  // Remove script, style, nav elements
  $(
    'script, style, nav, header, footer, .navigation, .breadcrumb, meta, link'
  ).remove()

  // Try to get main content area
  let mainContent =
    $('#document').html() ||
    $('.eli-main-body').html() ||
    $('article').html() ||
    $('main').html() ||
    $('body').html()

  if (!mainContent || mainContent.length < 100) {
    mainContent = html
  }

  // Clean HTML for storage
  const cleanedHtml = cleanHtmlContent(mainContent)

  // Extract plain text for RAG
  const bodyText = $('body').text() || $.root().text()
  const plainText = extractPlainText(bodyText)

  // Verify we got meaningful content
  if (plainText.length < 100) {
    console.log(`Content too short for ${celex}: ${plainText.length} chars`)
    return null
  }

  return {
    html: cleanedHtml,
    plainText,
  }
}

/**
 * Fetches National Implementation Measures for a directive
 */
export async function fetchNationalMeasures(
  celex: string
): Promise<NIMData | null> {
  const url = `${EURLEX_NIM_BASE}?uri=CELEX:${celex}`

  try {
    const response = await rateLimiter(() =>
      fetchWithRetry(url, {
        headers: {
          Accept: 'text/html',
        },
      })
    )

    const html = await response.text()
    const $ = cheerioLoad(html)

    // Look for Swedish implementation measures
    const measures: Array<{
      sfsNumber: string
      title: string
      notificationDate?: string
    }> = []
    let implementationStatus: 'COMPLETE' | 'PARTIAL' | 'PENDING' | 'UNKNOWN' =
      'UNKNOWN'

    // Find Sweden section (typically marked with "SE" or "Sweden")
    const swedenSection = $('tr:contains("SE"), tr:contains("Sweden")')

    if (swedenSection.length === 0) {
      return { sweden: null }
    }

    // Parse Swedish measures
    swedenSection.each((_, row) => {
      const cells = $(row).find('td')
      const countryCell = cells.first().text().trim()

      // Verify this is Sweden
      if (!countryCell.includes('SE') && !countryCell.includes('Sweden')) {
        return
      }

      // Look for SFS references in the row
      const rowText = $(row).text()
      const sfsMatches = rowText.match(/SFS\s*\d{4}:\d+/g)

      if (sfsMatches) {
        sfsMatches.forEach((sfs) => {
          measures.push({
            sfsNumber: sfs.replace(/\s+/g, ' ').trim(),
            title: '', // Title often not available in NIM table
          })
        })
      }

      // Check implementation status
      if (
        rowText.includes('Complete') ||
        rowText.includes('full transposition')
      ) {
        implementationStatus = 'COMPLETE'
      } else if (rowText.includes('Partial')) {
        implementationStatus = 'PARTIAL'
      } else if (rowText.includes('Pending') || rowText.includes('Notified')) {
        implementationStatus = 'PENDING'
      }
    })

    if (measures.length === 0) {
      return { sweden: null }
    }

    return {
      sweden: {
        measures,
        implementationStatus,
      },
    }
  } catch (error) {
    console.error(`Failed to fetch NIM for ${celex}:`, error)
    return { sweden: null }
  }
}

// ============================================================================
// Parsing Utilities
// ============================================================================

function parseSparqlBinding(
  binding: SPARQLResult,
  type: 'REG' | 'DIR'
): EurLexDocument {
  const celex = binding.celex?.value || ''

  return {
    celex,
    type,
    title: binding.title?.value || '',
    documentNumber: formatDocumentNumber(celex, type),
    publicationDate: parseDate(binding.publicationDate?.value),
    entryIntoForce: parseDate(binding.entryIntoForce?.value),
    eurlexUrl: `https://eur-lex.europa.eu/legal-content/SV/ALL/?uri=CELEX:${celex}`,
    eutReference: binding.eutReference?.value || null,
  }
}

/**
 * Formats CELEX number to human-readable EU document number
 * Example: "32016R0679" -> "Regulation (EU) 2016/679"
 */
function formatDocumentNumber(celex: string, type: 'REG' | 'DIR'): string {
  // CELEX format: [Sector][Year][Type][Number]
  // Example: 32016R0679
  const match = celex.match(/^(\d)(\d{4})([A-Z])(\d+)$/)

  if (!match) {
    return celex
  }

  const [, , year, , number] = match
  const typeName = type === 'REG' ? 'Regulation' : 'Directive'

  // Remove leading zeros from number
  const cleanNumber = parseInt(number!, 10)

  return `${typeName} (EU) ${year}/${cleanNumber}`
}

function parseDate(dateString: string | undefined): Date | null {
  if (!dateString) return null

  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return null
    }
    return date
  } catch {
    return null
  }
}

function cleanHtmlContent(html: string): string {
  // Remove script tags
  let cleaned = html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ''
  )

  // Remove style tags
  cleaned = cleaned.replace(
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    ''
  )

  // Remove comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '')

  // Remove empty tags
  cleaned = cleaned.replace(/<(\w+)[^>]*>\s*<\/\1>/g, '')

  return cleaned.trim()
}

function extractPlainText(text: string): string {
  return (
    text
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Trim
      .trim()
  )
}

// ============================================================================
// Metadata Extraction from Full Text
// ============================================================================

/**
 * Extracted metadata from EU document full text
 */
export interface ExtractedEUMetadata {
  // Document structure
  articleCount: number
  chapterCount: number
  sectionCount: number
  recitalCount: number

  // Issuing body
  issuingBody:
    | 'COMMISSION'
    | 'PARLIAMENT_COUNCIL'
    | 'COUNCIL'
    | 'ECB'
    | 'UNKNOWN'
  issuingBodySwedish: string | null

  // Document classification
  documentComplexity: 'SIMPLE' | 'MEDIUM' | 'COMPLEX'

  // OJ Reference parsed
  ojSeries: string | null // 'L' or 'C'
  ojNumber: string | null // e.g., '2025/1926'
  ojDate: string | null // e.g., '31.10.2025'

  // ELI references found
  eliReferences: string[]

  // Referenced EU acts (CELEX numbers found in text)
  referencedCelex: string[]

  // Word count for content length indicator
  wordCount: number
}

/**
 * Extracts structured metadata from EU document full text
 *
 * @param fullText - Plain text content of the document
 * @param title - Document title (used for issuing body detection)
 * @returns Extracted metadata object
 */
export function extractEUMetadata(
  fullText: string,
  title: string
): ExtractedEUMetadata {
  // Article count - matches "Artikel 1", "Artikel 2", etc.
  const articleMatches = fullText.match(/\bArtikel\s+\d+\b/gi) || []
  const uniqueArticles = new Set(articleMatches.map((m) => m.toLowerCase()))
  const articleCount = uniqueArticles.size

  // Chapter count - matches "KAPITEL I", "KAPITEL 1", etc.
  const chapterMatches = fullText.match(/\bKAPITEL\s+[IVX\d]+\b/gi) || []
  const uniqueChapters = new Set(chapterMatches.map((m) => m.toUpperCase()))
  const chapterCount = uniqueChapters.size

  // Section count - matches "AVSNITT 1", etc.
  const sectionMatches = fullText.match(/\bAVSNITT\s+\d+\b/gi) || []
  const uniqueSections = new Set(sectionMatches.map((m) => m.toUpperCase()))
  const sectionCount = uniqueSections.size

  // Recital count - matches "(1)", "(2)", etc. in preamble style
  // Only count those that appear before "HÄRIGENOM FÖRESKRIVS" or first Article
  const preambleEnd = fullText.search(/HÄRIGENOM FÖRESKRIVS|Artikel\s+1\b/i)
  const preambleText =
    preambleEnd > 0
      ? fullText.substring(0, preambleEnd)
      : fullText.substring(0, 5000)
  const recitalMatches = preambleText.match(/\(\d+\)/g) || []
  const recitalCount = recitalMatches.length

  // Issuing body detection from title
  const issuingBodyResult = detectIssuingBody(title)

  // Document complexity based on structure
  const documentComplexity = classifyComplexity(
    articleCount,
    chapterCount,
    fullText.length
  )

  // OJ Reference extraction from header
  // Pattern: "L-serien 2025/1926 31.10.2025" or "L 119/1"
  const ojResult = extractOJReference(fullText)

  // ELI references - URIs like http://data.europa.eu/eli/...
  const eliMatches =
    fullText.match(/http:\/\/data\.europa\.eu\/eli\/[^\s"<>]+/gi) || []
  const eliReferences = [...new Set(eliMatches)].slice(0, 20) // Limit to 20

  // Referenced CELEX numbers in text
  // Pattern: 3YYYYTNNNNN (e.g., 32016R0679, 32014L0065)
  const celexMatches = fullText.match(/\b3\d{4}[RLDB]\d{4,5}\b/g) || []
  const referencedCelex = [...new Set(celexMatches)].slice(0, 50) // Limit to 50

  // Word count
  const wordCount = fullText.split(/\s+/).filter((w) => w.length > 0).length

  return {
    articleCount,
    chapterCount,
    sectionCount,
    recitalCount,
    issuingBody: issuingBodyResult.code,
    issuingBodySwedish: issuingBodyResult.swedish,
    documentComplexity,
    ojSeries: ojResult.series,
    ojNumber: ojResult.number,
    ojDate: ojResult.date,
    eliReferences,
    referencedCelex,
    wordCount,
  }
}

/**
 * Detects the issuing body from document title
 */
function detectIssuingBody(title: string): {
  code: 'COMMISSION' | 'PARLIAMENT_COUNCIL' | 'COUNCIL' | 'ECB' | 'UNKNOWN'
  swedish: string | null
} {
  const titleLower = title.toLowerCase()

  // Parliament and Council together
  if (
    titleLower.includes('europaparlamentets och rådets') ||
    titleLower.includes('europaparlamentet och rådet')
  ) {
    return {
      code: 'PARLIAMENT_COUNCIL',
      swedish: 'Europaparlamentet och rådet',
    }
  }

  // Commission variants
  if (
    titleLower.includes('kommissionens') ||
    titleLower.includes('europeiska kommissionen')
  ) {
    return {
      code: 'COMMISSION',
      swedish: 'Europeiska kommissionen',
    }
  }

  // European Central Bank
  if (
    titleLower.includes('europeiska centralbanken') ||
    titleLower.includes('centralbanks')
  ) {
    return {
      code: 'ECB',
      swedish: 'Europeiska centralbanken',
    }
  }

  // Council alone
  if (
    titleLower.includes('rådets') &&
    !titleLower.includes('europaparlamentets')
  ) {
    return {
      code: 'COUNCIL',
      swedish: 'Rådet',
    }
  }

  return {
    code: 'UNKNOWN',
    swedish: null,
  }
}

/**
 * Classifies document complexity based on structure
 */
function classifyComplexity(
  articleCount: number,
  chapterCount: number,
  textLength: number
): 'SIMPLE' | 'MEDIUM' | 'COMPLEX' {
  // Complex: has chapters, many articles, or very long
  if (chapterCount > 0 || articleCount > 20 || textLength > 100000) {
    return 'COMPLEX'
  }

  // Medium: has several articles
  if (articleCount > 5 || textLength > 20000) {
    return 'MEDIUM'
  }

  // Simple: few articles, short document
  return 'SIMPLE'
}

/**
 * Extracts Official Journal reference from document text
 */
function extractOJReference(text: string): {
  series: string | null
  number: string | null
  date: string | null
} {
  // Try pattern: "L-serien 2025/1926 31.10.2025"
  const seriesMatch = text.match(
    /([LC])-serien\s+(\d{4}\/\d+)\s+(\d{1,2}\.\d{1,2}\.\d{4})/i
  )
  if (seriesMatch) {
    return {
      series: seriesMatch[1]!.toUpperCase(),
      number: seriesMatch[2]!,
      date: seriesMatch[3]!,
    }
  }

  // Try pattern: "OJ L 119/1" or "EUT L 119/1"
  const ojMatch = text.match(/(?:OJ|EUT)\s+([LC])\s+(\d+)/i)
  if (ojMatch) {
    return {
      series: ojMatch[1]!.toUpperCase(),
      number: ojMatch[2]!,
      date: null,
    }
  }

  // Try pattern in header: "Europeiska unionens officiella tidning ... L 119/1"
  const headerMatch = text
    .substring(0, 500)
    .match(/officiella tidning[^L]*([LC])\s*[\-]?\s*(\d+)/i)
  if (headerMatch) {
    return {
      series: headerMatch[1]!.toUpperCase(),
      number: headerMatch[2]!,
      date: null,
    }
  }

  return {
    series: null,
    number: null,
    date: null,
  }
}

// ============================================================================
// Batch Processing Helpers
// ============================================================================

/**
 * Fetches all regulations with pagination
 */
export async function fetchAllRegulations(
  batchSize: number = 1000,
  progressCallback?: (_fetched: number, _total: number) => void
): Promise<EurLexDocument[]> {
  const totalCount = await getRegulationsCount()
  console.log(`Total regulations with Swedish content: ${totalCount}`)

  const allDocuments: EurLexDocument[] = []
  let offset = 0

  while (offset < totalCount) {
    const batch = await fetchRegulations(batchSize, offset)
    allDocuments.push(...batch)
    offset += batchSize

    if (progressCallback) {
      progressCallback(Math.min(offset, totalCount), totalCount)
    }

    // Small delay between batches
    await sleep(100)
  }

  return allDocuments
}

/**
 * Fetches all directives with pagination
 */
export async function fetchAllDirectives(
  batchSize: number = 1000,
  progressCallback?: (_fetched: number, _total: number) => void
): Promise<EurLexDocument[]> {
  const totalCount = await getDirectivesCount()
  console.log(`Total directives with Swedish content: ${totalCount}`)

  const allDocuments: EurLexDocument[] = []
  let offset = 0

  while (offset < totalCount) {
    const batch = await fetchDirectives(batchSize, offset)
    allDocuments.push(...batch)
    offset += batchSize

    if (progressCallback) {
      progressCallback(Math.min(offset, totalCount), totalCount)
    }

    // Small delay between batches
    await sleep(100)
  }

  return allDocuments
}

// ============================================================================
// Slug Generation
// ============================================================================

/**
 * Generates a URL-friendly slug from EU document title and CELEX number
 *
 * @example
 * generateEuSlug("Europaparlamentets och rådets förordning (EU) 2016/679", "32016R0679")
 * => "gdpr-forordning-32016r0679"
 */
export function generateEuSlug(title: string, celex: string): string {
  // Normalize Swedish characters and create slug from title
  const normalizedTitle = title
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50) // Limit title part length

  const celexSlug = celex.toLowerCase()

  return `${normalizedTitle}-${celexSlug}`
}
