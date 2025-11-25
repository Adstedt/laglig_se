/* eslint-disable no-console */
/**
 * Riksdagen API Client
 *
 * Fetches Swedish law documents (SFS) from the Riksdagen Open Data API.
 *
 * API Documentation: https://data.riksdagen.se/dokumentation/
 *
 * Endpoints used:
 * - List: https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json
 * - Document: https://data.riksdagen.se/dokument/{dok_id}
 * - Full text: https://data.riksdagen.se/dokument/{dok_id}.html
 */

// ============================================================================
// Types
// ============================================================================

export interface RiksdagenDocument {
  dok_id: string
  beteckning: string // SFS number, e.g., "1977:1160"
  titel: string
  datum: string // Document date, e.g., "2024-01-15"
  publicerad: string // Publication timestamp, e.g., "2024-01-15 10:30:00"
  dokument_url_html: string
  dokument_url_text?: string
  summary?: string // Short summary/excerpt
  organ?: string // Issuing department
}

export interface RiksdagenListResponse {
  dokumentlista: {
    '@traffar': string // Total count as string
    '@sida': string // Current page
    '@sidor': string // Total pages
    dokument: RiksdagenDocument[]
  }
}

export interface ParsedLaw {
  dokId: string
  sfsNumber: string // "SFS 1977:1160"
  title: string
  publicationDate: Date | null
  sourceUrl: string
  fullTextUrl: string
}

export interface FetchLawsResult {
  laws: ParsedLaw[]
  totalCount: number
  hasMore: boolean
}

export class RiksdagenApiError extends Error {
  public statusCode: number | undefined
  public isRetryable: boolean

  constructor(
    message: string,
    statusCode?: number,
    isRetryable: boolean = false
  ) {
    super(message)
    this.name = 'RiksdagenApiError'
    this.statusCode = statusCode
    this.isRetryable = isRetryable
  }
}

// ============================================================================
// Configuration
// ============================================================================

const RIKSDAGEN_BASE_URL = 'https://data.riksdagen.se'

const RETRY_CONFIG = {
  maxAttempts: 3,
  backoffMultiplier: 2,
  initialDelay: 1000,
  maxDelay: 30000,
  retryableErrors: [429, 500, 502, 503, 504],
}

// Rate limiting: max 5 requests/second, 100 requests/minute
const RATE_LIMIT = {
  requestsPerSecond: 5,
  requestsPerMinute: 100,
  minDelayMs: 200, // 1000ms / 5 requests
}

// Simple in-memory rate limiter
let lastRequestTime = 0
let requestsInCurrentMinute = 0
let minuteStartTime = Date.now()

// ============================================================================
// Rate Limiting
// ============================================================================

async function waitForRateLimit(): Promise<void> {
  const now = Date.now()

  // Reset minute counter if a minute has passed
  if (now - minuteStartTime >= 60000) {
    requestsInCurrentMinute = 0
    minuteStartTime = now
  }

  // Check if we've hit the per-minute limit
  if (requestsInCurrentMinute >= RATE_LIMIT.requestsPerMinute) {
    const waitTime = 60000 - (now - minuteStartTime)
    console.log(`Rate limit: waiting ${waitTime}ms for minute reset`)
    await sleep(waitTime)
    requestsInCurrentMinute = 0
    minuteStartTime = Date.now()
  }

  // Ensure minimum delay between requests
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < RATE_LIMIT.minDelayMs) {
    await sleep(RATE_LIMIT.minDelayMs - timeSinceLastRequest)
  }

  lastRequestTime = Date.now()
  requestsInCurrentMinute++
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// Retry Logic
// ============================================================================

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
          Accept: 'application/json',
          'User-Agent': 'Laglig.se/1.0 (https://laglig.se)',
          ...options?.headers,
        },
      })

      // Check for rate limiting or server errors
      if (RETRY_CONFIG.retryableErrors.includes(response.status)) {
        throw new RiksdagenApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          true
        )
      }

      if (!response.ok) {
        throw new RiksdagenApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          false
        )
      }

      return response
    } catch (error) {
      lastError = error as Error

      const isRetryable =
        error instanceof RiksdagenApiError
          ? error.isRetryable
          : error instanceof TypeError // Network errors

      if (!isRetryable || attempt === RETRY_CONFIG.maxAttempts) {
        throw error
      }

      console.log(
        `Attempt ${attempt} failed, retrying in ${delay}ms:`,
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
 * Fetches a list of SFS laws from Riksdagen API
 *
 * @param limit - Maximum number of laws to fetch (default 100)
 * @param page - Page number for pagination (1-indexed)
 * @returns Parsed laws and pagination info
 */
export async function fetchSFSLaws(
  limit: number = 100,
  page: number = 1
): Promise<FetchLawsResult> {
  const url = new URL(`${RIKSDAGEN_BASE_URL}/dokumentlista/`)
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
  url.searchParams.set('sz', String(Math.min(limit, 100))) // Max 100 per page
  url.searchParams.set('p', String(page))
  url.searchParams.set('sort', 'datum')
  url.searchParams.set('sortorder', 'desc')

  console.log(`Fetching SFS laws: page ${page}, limit ${limit}`)

  const response = await fetchWithRetry(url.toString())
  const data: RiksdagenListResponse = await response.json()

  const totalCount = parseInt(data.dokumentlista['@traffar'], 10)
  const totalPages = parseInt(data.dokumentlista['@sidor'], 10)
  const currentPage = parseInt(data.dokumentlista['@sida'], 10)

  const documents = data.dokumentlista.dokument || []

  const laws: ParsedLaw[] = documents.map((doc) => {
    // API returns URLs without protocol (e.g., "//data.riksdagen.se/...")
    const htmlUrl = doc.dokument_url_html
      ? `https:${doc.dokument_url_html}`
      : `${RIKSDAGEN_BASE_URL}/dokument/${doc.dok_id}.html`

    return {
      dokId: doc.dok_id,
      sfsNumber: `SFS ${doc.beteckning}`,
      title: doc.titel,
      publicationDate: doc.datum ? parseSwedishDate(doc.datum) : null,
      sourceUrl: `${RIKSDAGEN_BASE_URL}/dokument/${doc.dok_id}`,
      fullTextUrl: htmlUrl,
    }
  })

  return {
    laws,
    totalCount,
    hasMore: currentPage < totalPages,
  }
}

/**
 * Fetches the full text of a law document
 *
 * @param dokId - The document ID from Riksdagen
 * @returns HTML content of the law, or null if not available
 */
export async function fetchLawFullText(dokId: string): Promise<string | null> {
  const url = `${RIKSDAGEN_BASE_URL}/dokument/${dokId}.html`

  try {
    const response = await fetchWithRetry(url, {
      headers: {
        Accept: 'text/html',
      },
    })

    const html = await response.text()

    // Extract just the body content, removing navigation etc.
    const cleanedText = extractLawContent(html)

    return cleanedText
  } catch (error) {
    console.error(`Failed to fetch full text for ${dokId}:`, error)
    return null
  }
}

/**
 * Fetches multiple laws with their full text
 *
 * @param limit - Maximum number of laws to fetch
 * @param progressCallback - Optional callback for progress updates
 */
export async function fetchLawsWithFullText(
  limit: number = 100,
  progressCallback?: (_current: number, _total: number) => void
): Promise<ParsedLaw[]> {
  // First, get the list of laws
  const { laws } = await fetchSFSLaws(limit)

  const lawsWithText: ParsedLaw[] = []

  for (let i = 0; i < laws.length; i++) {
    const law = laws[i]
    if (!law) continue

    if (progressCallback) {
      progressCallback(i + 1, laws.length)
    }

    // Note: Full text is fetched separately in the ingestion script
    lawsWithText.push(law)

    // Small delay to be nice to the API
    if (i < laws.length - 1) {
      await sleep(100)
    }
  }

  return lawsWithText
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Parses Swedish date strings from Riksdagen API
 * Format: "2024-01-15" or "2024-01-15 10:30:00"
 */
function parseSwedishDate(dateString: string): Date | null {
  if (!dateString) return null

  try {
    // Handle both "2024-01-15" and "2024-01-15 10:30:00" formats
    const cleanDate = dateString.split(' ')[0]
    if (!cleanDate) return null

    const date = new Date(cleanDate)

    if (isNaN(date.getTime())) {
      return null
    }

    return date
  } catch {
    return null
  }
}

/**
 * Extracts clean law content from HTML
 * Removes navigation, scripts, and other non-content elements
 */
function extractLawContent(html: string): string {
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

  // Extract body content if present
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch && bodyMatch[1]) {
    cleaned = bodyMatch[1]
  }

  // Remove remaining HTML tags but preserve whitespace structure
  cleaned = cleaned
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')

  // Decode HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ouml;/g, 'ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&aring;/g, 'å')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&Aring;/g, 'Å')

  // Normalize whitespace
  cleaned = cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()

  return cleaned
}

/**
 * Generates a URL-friendly slug from a law title and SFS number
 *
 * @example
 * generateSlug("Arbetsmiljölagen", "1977:1160") => "arbetsmiljolagen-1977-1160"
 */
export function generateSlug(title: string, sfsNumber: string): string {
  // Remove "SFS " prefix if present
  const cleanSfs = sfsNumber.replace(/^SFS\s*/i, '')

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

  // Convert SFS number: "1977:1160" => "1977-1160"
  const sfsSlug = cleanSfs.replace(/:/g, '-')

  return `${normalizedTitle}-${sfsSlug}`
}
