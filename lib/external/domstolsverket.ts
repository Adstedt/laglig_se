/* eslint-disable no-console */
/**
 * Domstolsverket PUH API Client
 *
 * Fetches Swedish court cases from the Domstolsverket Public Hearings API.
 *
 * API Base URL: https://puh.domstol.se/puh/api/v1
 *
 * Endpoints used:
 * - GET /publiceringar - List all publications with pagination
 * - POST /sok - Advanced search with filters
 * - GET /publiceringar/{id} - Get single case details
 * - GET /bilagor/{fillagringId} - Download PDF attachment (future use)
 */

// ============================================================================
// Types - Based on Domstolsverket OpenAPI spec
// ============================================================================

export interface DomstolDTO {
  domstolKod: string // "HD", "HovR-Stockholm", "AD"
  domstolNamn: string // "Högsta domstolen", "Arbetsdomstolen"
}

export interface LagrumDTO {
  sfsNummer: string // "SFS 1977:1160"
  referens?: string // "3 kap. 2 §"
}

export interface PubliceringBilagaDTO {
  fillagringId: string // Storage ID for /api/v1/bilagor/{id}
  filnamn: string // Filename: "AD_2023_nr_45.pdf"
}

export interface PubliceringsgruppHanvisningDTO {
  gruppKorrelationsnummer?: string
  publiceringId?: string
}

export interface PubliceringDTO {
  // Core identifiers
  id: string // Unique publication ID
  gruppKorrelationsnummer?: string // Group correlation number
  ecliNummer?: string // European Case Law Identifier

  // Court information
  domstol: DomstolDTO // Court that issued decision

  // Case metadata
  typ: string // "Dom", "Beslut"
  malNummerLista: string[] // Case numbers (e.g., ["Ö 1234-22"])
  avgorandedatum: string // Decision date (ISO string)
  publiceringstid: string // Publication timestamp

  // Content
  sammanfattning?: string // Summary (may be null)
  innehall?: string // Full text content (HTML - PRESERVE!)
  benamning?: string // Case name/title
  arVagledande: boolean // Is guiding precedent?

  // References and categorization
  referatNummerLista?: string[] // NJA, RH series references
  arbetsdomstolenDomsnummer?: string // AD-specific case number
  lagrumLista?: LagrumDTO[] // Cited SFS laws (CRITICAL!)
  nyckelordLista?: string[] // Keywords
  rattsomradeLista?: string[] // Legal areas

  // Related cases and attachments
  hanvisadePubliceringarLista?: PubliceringsgruppHanvisningDTO[]
  bilagaLista?: PubliceringBilagaDTO[] // PDF attachments (CRITICAL!)
}

export interface SokFilterDTO {
  domstolKodLista?: string[] // Filter by court codes
  avgorandedatumFran?: string // Date from (ISO)
  avgorandedatumTill?: string // Date to (ISO)
  sfsNummer?: string // Filter by SFS reference
  nyckelordLista?: string[] // Filter by keywords
  rattsomradeLista?: string[] // Filter by legal areas
  arVagledande?: boolean // Only guiding cases
}

export interface SokRequestDTO {
  sidIndex: number // Page index (0-based)
  antalPerSida: number // Items per page
  sortorder?: string // Sort field
  asc?: boolean // Sort direction
  filter?: SokFilterDTO // Search filters
}

export interface SokResponseDTO {
  total: number // Total matching results
  publiceringLista: PubliceringDTO[] // Results for current page
}

export interface FetchPubliceringarResult {
  cases: PubliceringDTO[]
  total: number
  hasMore: boolean
  page: number
}

// ============================================================================
// Error Classes
// ============================================================================

export class DomstolsverketApiError extends Error {
  public statusCode: number | undefined
  public isRetryable: boolean

  constructor(
    message: string,
    statusCode?: number,
    isRetryable: boolean = false
  ) {
    super(message)
    this.name = 'DomstolsverketApiError'
    this.statusCode = statusCode
    this.isRetryable = isRetryable
  }
}

// ============================================================================
// Configuration
// ============================================================================

const DOMSTOLSVERKET_BASE_URL = 'https://rattspraxis.etjanst.domstol.se/api/v1'

const RETRY_CONFIG = {
  maxAttempts: 3,
  backoffMultiplier: 2,
  initialDelay: 1000,
  maxDelay: 30000,
  retryableErrors: [429, 500, 502, 503, 504],
}

// Rate limiting: 5 requests/second (conservative, respectful to government API)
const RATE_LIMIT = {
  requestsPerSecond: 5,
  minDelayMs: 200, // 1000ms / 5 requests
}

// Simple in-memory rate limiter
let lastRequestTime = 0

// ============================================================================
// Court Type Mapping
// ============================================================================

export type CourtType = 'AD' | 'HFD' | 'HD' | 'HovR'

export interface CourtConfig {
  code: string | string[] // Court code(s) for API filter
  name: string
  contentType:
    | 'COURT_CASE_AD'
    | 'COURT_CASE_HFD'
    | 'COURT_CASE_HD'
    | 'COURT_CASE_HOVR'
  description: string
}

export const COURT_CONFIGS: Record<CourtType, CourtConfig> = {
  AD: {
    code: 'ADO',
    name: 'Arbetsdomstolen',
    contentType: 'COURT_CASE_AD',
    description: 'Labour Court - Employment law precedent',
  },
  HFD: {
    code: 'HFD',
    name: 'Högsta förvaltningsdomstolen',
    contentType: 'COURT_CASE_HFD',
    description: 'Supreme Administrative Court - Tax/admin law',
  },
  HD: {
    code: 'HDO',
    name: 'Högsta domstolen',
    contentType: 'COURT_CASE_HD',
    description: 'Supreme Court - Civil/criminal precedent',
  },
  HovR: {
    // HovR requires multiple codes for different regional courts
    code: ['HSV', 'HGO', 'HVS', 'HSB', 'HNN', 'HON'],
    name: 'Hovrätterna',
    contentType: 'COURT_CASE_HOVR',
    description: 'Courts of Appeal - Practical precedent',
  },
}

// Priority order for ingestion (per competitive analysis - AD is most valuable)
export const COURT_PRIORITY: CourtType[] = ['AD', 'HFD', 'HD', 'HovR']

// ============================================================================
// Rate Limiting
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForRateLimit(): Promise<void> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < RATE_LIMIT.minDelayMs) {
    await sleep(RATE_LIMIT.minDelayMs - timeSinceLastRequest)
  }

  lastRequestTime = Date.now()
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
          'Content-Type': 'application/json',
          'User-Agent': 'Laglig.se/1.0 (https://laglig.se)',
          ...options?.headers,
        },
      })

      // Check for rate limiting or server errors
      if (RETRY_CONFIG.retryableErrors.includes(response.status)) {
        throw new DomstolsverketApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          true
        )
      }

      if (!response.ok) {
        throw new DomstolsverketApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          false
        )
      }

      return response
    } catch (error) {
      lastError = error as Error

      const isRetryable =
        error instanceof DomstolsverketApiError
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
 * Fetches publications using GET /publiceringar endpoint with pagination
 *
 * @param page - Page number (1-indexed for external API, converted internally)
 * @param pageSize - Number of items per page (max 100)
 * @param courtCode - Optional court code filter
 * @returns Paginated results with court cases
 */
export async function fetchPubliceringar(
  page: number = 1,
  pageSize: number = 100,
  courtCode?: string
): Promise<FetchPubliceringarResult> {
  const url = new URL(`${DOMSTOLSVERKET_BASE_URL}/publiceringar`)
  url.searchParams.set('page', String(page - 1)) // API is 0-indexed
  url.searchParams.set('pagesize', String(Math.min(pageSize, 100)))
  url.searchParams.set('sortorder', 'avgorandedatum')
  url.searchParams.set('asc', 'false')

  if (courtCode) {
    url.searchParams.set('domstolkod', courtCode)
  }

  console.log(`Fetching publiceringar: page ${page}, pageSize ${pageSize}`)

  const response = await fetchWithRetry(url.toString())
  const data = await response.json()

  // The API returns an object with total count and array of cases
  // Structure may vary - handle both array and object responses
  let cases: PubliceringDTO[] = []
  let total = 0

  if (Array.isArray(data)) {
    cases = data
    total = data.length
  } else if (data.content) {
    // Spring-style paginated response
    cases = data.content
    total = data.totalElements || data.total || cases.length
  } else if (data.publiceringLista) {
    cases = data.publiceringLista
    total = data.total || cases.length
  }

  const hasMore = page * pageSize < total

  return {
    cases,
    total,
    hasMore,
    page,
  }
}

/**
 * Advanced search using POST /sok endpoint with filters
 *
 * @param request - Search request with filters, pagination
 * @returns Search results with total count
 */
export async function searchPubliceringar(
  request: SokRequestDTO
): Promise<SokResponseDTO> {
  const url = `${DOMSTOLSVERKET_BASE_URL}/sok`

  console.log(
    `Searching publiceringar: page ${request.sidIndex}, filter: ${JSON.stringify(request.filter || {})}`
  )

  const response = await fetchWithRetry(url, {
    method: 'POST',
    body: JSON.stringify(request),
  })

  const data: SokResponseDTO = await response.json()
  return data
}

/**
 * Fetch a single publication by ID
 *
 * @param id - Publication ID
 * @returns Full publication details
 */
export async function fetchPubliceringById(
  id: string
): Promise<PubliceringDTO> {
  const url = `${DOMSTOLSVERKET_BASE_URL}/publiceringar/${encodeURIComponent(id)}`

  console.log(`Fetching publicering by ID: ${id}`)

  const response = await fetchWithRetry(url)
  const data: PubliceringDTO = await response.json()
  return data
}

/**
 * Fetch court cases for a specific court type using advanced search
 *
 * @param courtType - Court type (AD, HFD, HD, HovR)
 * @param page - Page number (0-indexed)
 * @param pageSize - Items per page
 * @returns Search results with court cases
 */
export async function fetchCourtCases(
  courtType: CourtType,
  page: number = 0,
  pageSize: number = 100
): Promise<SokResponseDTO> {
  const config = COURT_CONFIGS[courtType]
  const courtCodes = Array.isArray(config.code) ? config.code : [config.code]

  const request: SokRequestDTO = {
    sidIndex: page,
    antalPerSida: Math.min(pageSize, 100),
    sortorder: 'avgorandedatum',
    asc: false,
    filter: {
      domstolKodLista: courtCodes,
    },
  }

  return searchPubliceringar(request)
}

/**
 * Fetch all court cases for a specific court type with pagination
 * Generator function for memory-efficient iteration
 *
 * @param courtType - Court type (AD, HFD, HD, HovR)
 * @param pageSize - Items per page (default 100)
 * @yields Batches of court cases
 */
export async function* fetchAllCourtCases(
  courtType: CourtType,
  pageSize: number = 100
): AsyncGenerator<PubliceringDTO[], void, unknown> {
  let page = 0
  let hasMore = true

  while (hasMore) {
    const result = await fetchCourtCases(courtType, page, pageSize)
    const cases = result.publiceringLista || []

    if (cases.length === 0) {
      hasMore = false
      break
    }

    yield cases

    hasMore = cases.length === pageSize
    page++
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Maps a court code from API to our ContentType enum
 */
export function mapCourtCodeToContentType(
  courtCode: string
):
  | 'COURT_CASE_AD'
  | 'COURT_CASE_HFD'
  | 'COURT_CASE_HD'
  | 'COURT_CASE_HOVR'
  | 'COURT_CASE_MOD'
  | 'COURT_CASE_MIG'
  | null {
  if (courtCode === 'ADO') return 'COURT_CASE_AD'
  if (courtCode === 'HFD' || courtCode === 'REGR') return 'COURT_CASE_HFD'
  if (courtCode === 'HDO') return 'COURT_CASE_HD'
  // Hovrätterna (Courts of Appeal)
  if (['HSV', 'HGO', 'HVS', 'HSB', 'HNN', 'HON', 'HYOD'].includes(courtCode))
    return 'COURT_CASE_HOVR'
  // Kammarrätterna (Administrative Courts of Appeal) - map to HFD for now
  if (['KST', 'KGG', 'KSU', 'KJO'].includes(courtCode)) return 'COURT_CASE_HFD'
  // Mark- och miljööverdomstolen and Miljööverdomstolen
  if (courtCode === 'MMOD' || courtCode === 'MOD') return 'COURT_CASE_MOD'
  // Migrationsöverdomstolen
  if (courtCode === 'MIOD') return 'COURT_CASE_MIG'
  return null
}

/**
 * Generates a document number from a PubliceringDTO
 * Combines court code with case number or referat number
 */
export function generateDocumentNumber(dto: PubliceringDTO): string {
  const courtCode = dto.domstol?.domstolKod || 'UNKNOWN'

  // For AD, use the special AD case number format
  if (dto.arbetsdomstolenDomsnummer) {
    return `AD ${dto.arbetsdomstolenDomsnummer}`
  }

  // Try referat number first (NJA, RH format)
  if (dto.referatNummerLista && dto.referatNummerLista.length > 0) {
    return dto.referatNummerLista[0] || `${courtCode}-${dto.id}`
  }

  // Fall back to case number
  if (dto.malNummerLista && dto.malNummerLista.length > 0) {
    return `${courtCode} ${dto.malNummerLista[0]}`
  }

  // Ultimate fallback
  return `${courtCode}-${dto.id}`
}

/**
 * Generates a URL-friendly slug from case title and number
 */
export function generateSlug(title: string, documentNumber: string): string {
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

  // Normalize document number for URL
  const normalizedNumber = documentNumber
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/:/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  return `${normalizedTitle}-${normalizedNumber}`
}

/**
 * Extracts the primary case number from a PubliceringDTO
 */
export function extractCaseNumber(dto: PubliceringDTO): string {
  if (dto.arbetsdomstolenDomsnummer) {
    return dto.arbetsdomstolenDomsnummer
  }
  if (dto.malNummerLista && dto.malNummerLista.length > 0) {
    return dto.malNummerLista[0] || ''
  }
  return ''
}

/**
 * Generates a title for a court case
 * Uses benamning if available, otherwise constructs from court + case number
 */
export function generateTitle(dto: PubliceringDTO): string {
  if (dto.benamning) {
    return dto.benamning
  }

  const courtName = dto.domstol?.domstolNamn || 'Domstol'
  const caseNumber = extractCaseNumber(dto)
  const type = dto.typ || 'Avgörande'
  const date = dto.avgorandedatum
    ? new Date(dto.avgorandedatum).toISOString().split('T')[0]
    : ''

  return `${courtName} ${type} ${caseNumber} ${date}`.trim()
}

/**
 * Parses a date string from the API to a Date object
 */
export function parseApiDate(dateString: string | undefined): Date | null {
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
