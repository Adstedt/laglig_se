/**
 * SFS PDF Fetch and Storage Utility
 *
 * Story 2.28: Unified SFS PDF Sync & Document Classification
 *
 * Fetches PDFs from svenskforfattningssamling.se and stores them
 * in Supabase Storage with proper rate limiting.
 *
 * URL resolution: the canonical PDF URL is read from the document's HTML
 * page (`/doc/{year}{number}.html`) — the gov site files PDFs under the
 * issuance month, which doesn't always match the publication month, so
 * a date-based URL guess is unreliable. The doc page is the source of truth.
 */

import { parseSfsNumber, constructStoragePath } from './pdf-urls'
import { uploadPdf } from '@/lib/supabase/storage'

const BASE_URL = 'https://svenskforfattningssamling.se'
const USER_AGENT = 'Laglig.se/1.0 (Legal research; contact@laglig.se)'

/**
 * Rate limiting configuration
 */
const PDF_FETCH_DELAY_MS = 1000 // 1 second between requests
let lastFetchTime = 0

/**
 * PDF metadata for storage in LegalDocument.metadata.pdf
 */
export interface PdfMetadata {
  /** Storage path in Supabase (e.g., "2025/SFS2025-1581.pdf") */
  storagePath: string
  /** Storage bucket name */
  storageBucket: string
  /** Original source URL (the URL that was actually fetched) */
  originalUrl: string
  /** File size in bytes */
  fileSize: number
  /** When the PDF was fetched */
  fetchedAt: string
  /** Error message if fetch failed */
  error?: string
}

/**
 * Result of fetching and storing a PDF
 */
export interface FetchPdfResult {
  success: boolean
  metadata: PdfMetadata | null
  error?: string
}

/**
 * Wait for rate limiting
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now()
  const timeSinceLastFetch = now - lastFetchTime
  const waitTime = Math.max(0, PDF_FETCH_DELAY_MS - timeSinceLastFetch)

  if (waitTime > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitTime))
  }

  lastFetchTime = Date.now()
}

/**
 * Resolve the canonical PDF URL by scraping the SFS document HTML page.
 *
 * The gov site's doc page (`/doc/{year}{number}.html`) contains an `<a href>`
 * to the actual PDF. This is the source of truth — date-based URL guesses
 * are unreliable because PDFs are filed by issuance month, not publication month.
 *
 * @param sfsNumber - SFS number (with or without "SFS " prefix)
 * @returns Absolute PDF URL, or null if doc page is missing or has no PDF link
 */
export async function resolvePdfUrl(sfsNumber: string): Promise<string | null> {
  const parsed = parseSfsNumber(sfsNumber)
  if (!parsed) return null

  const { year, number } = parsed
  const docUrl = `${BASE_URL}/doc/${year}${number}.html`

  await waitForRateLimit()

  try {
    const response = await fetch(docUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
      },
    })

    if (!response.ok) {
      console.error(
        `[PDF-FETCHER] Doc page fetch failed: ${response.status} ${response.statusText} - ${docUrl}`
      )
      return null
    }

    const html = await response.text()

    const pdfMatch = html.match(/href="([^"]*\/sfs\/[^"]+\.pdf)"/i)
    if (!pdfMatch || !pdfMatch[1]) {
      console.error(`[PDF-FETCHER] No PDF link found on doc page: ${docUrl}`)
      return null
    }

    const pdfPath = pdfMatch[1].replace(/^\.\./, '')
    return `${BASE_URL}${pdfPath.startsWith('/') ? '' : '/'}${pdfPath}`
  } catch (error) {
    console.error(`[PDF-FETCHER] Doc page fetch error for ${docUrl}:`, error)
    return null
  }
}

/**
 * Fetch PDF from svenskforfattningssamling.se
 *
 * @param url - URL to fetch
 * @returns Buffer containing PDF data, or null if failed
 */
async function fetchPdfFromUrl(
  url: string
): Promise<{ buffer: Buffer; size: number } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/pdf',
      },
    })

    if (!response.ok) {
      console.error(
        `[PDF-FETCHER] Failed to fetch PDF: ${response.status} ${response.statusText} - ${url}`
      )
      return null
    }

    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/pdf')) {
      console.error(
        `[PDF-FETCHER] Unexpected content type: ${contentType} - ${url}`
      )
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return { buffer, size: buffer.length }
  } catch (error) {
    console.error(`[PDF-FETCHER] Fetch error for ${url}:`, error)
    return null
  }
}

/**
 * Fetch and store a PDF for an SFS document.
 *
 * Pipeline:
 * 1. Resolve canonical PDF URL by scraping `/doc/{year}{number}.html` (source of truth)
 * 2. Download the PDF (rate-limited to 1 req/sec)
 * 3. Upload to Supabase Storage bucket
 * 4. Return metadata for storage in LegalDocument
 *
 * @param sfsNumber - SFS number (e.g., "2025:1581" or "SFS 2025:1581")
 * @param _publicationDate - @deprecated No longer used; URL is resolved from the doc page.
 *                           Kept for backwards compatibility with existing call sites.
 * @returns Fetch result with success status and metadata
 *
 * @example
 * const result = await fetchAndStorePdf("SFS 2026:422")
 * if (result.success) {
 *   // Store result.metadata in LegalDocument.metadata.pdf
 * }
 */
export async function fetchAndStorePdf(
  sfsNumber: string,
  _publicationDate?: string | Date | null
): Promise<FetchPdfResult> {
  const cleanSfsNumber = sfsNumber.replace(/^SFS\s*/i, '').trim()

  try {
    const storagePath = constructStoragePath(sfsNumber)

    console.log(`[PDF-FETCHER] Fetching PDF for ${cleanSfsNumber}`)
    console.log(`[PDF-FETCHER]   Storage path: ${storagePath}`)

    // Resolve canonical PDF URL from the doc page
    const resolvedUrl = await resolvePdfUrl(sfsNumber)

    if (!resolvedUrl) {
      const errorMetadata: PdfMetadata = {
        storagePath,
        storageBucket: 'sfs-pdfs',
        originalUrl: '',
        fileSize: 0,
        fetchedAt: new Date().toISOString(),
        error: 'Failed to resolve PDF URL from doc page',
      }

      return {
        success: false,
        metadata: errorMetadata,
        error: 'Failed to resolve PDF URL from doc page',
      }
    }

    console.log(`[PDF-FETCHER]   Resolved URL: ${resolvedUrl}`)

    // Fetch PDF from the resolved URL
    await waitForRateLimit()
    const fetchResult = await fetchPdfFromUrl(resolvedUrl)

    if (!fetchResult) {
      const errorMetadata: PdfMetadata = {
        storagePath,
        storageBucket: 'sfs-pdfs',
        originalUrl: resolvedUrl,
        fileSize: 0,
        fetchedAt: new Date().toISOString(),
        error: 'Failed to fetch PDF from source',
      }

      return {
        success: false,
        metadata: errorMetadata,
        error: 'Failed to fetch PDF from source',
      }
    }

    console.log(
      `[PDF-FETCHER] Downloaded ${(fetchResult.size / 1024).toFixed(1)} KB`
    )

    // Upload to Supabase Storage
    const { path, error: uploadError } = await uploadPdf(
      cleanSfsNumber,
      fetchResult.buffer
    )

    if (uploadError) {
      console.error(`[PDF-FETCHER] Upload failed:`, uploadError)

      const errorMetadata: PdfMetadata = {
        storagePath: path,
        storageBucket: 'sfs-pdfs',
        originalUrl: resolvedUrl,
        fileSize: fetchResult.size,
        fetchedAt: new Date().toISOString(),
        error: `Upload failed: ${uploadError.message}`,
      }

      return {
        success: false,
        metadata: errorMetadata,
        error: `Upload failed: ${uploadError.message}`,
      }
    }

    console.log(`[PDF-FETCHER] ✓ Stored: ${path}`)

    const metadata: PdfMetadata = {
      storagePath: path,
      storageBucket: 'sfs-pdfs',
      originalUrl: resolvedUrl,
      fileSize: fetchResult.size,
      fetchedAt: new Date().toISOString(),
    }

    return {
      success: true,
      metadata,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error(`[PDF-FETCHER] Error processing ${cleanSfsNumber}:`, error)

    return {
      success: false,
      metadata: null,
      error: errorMessage,
    }
  }
}

/**
 * Create error metadata for a failed PDF fetch
 * Useful when we need to mark a document as having a PDF error
 * without actually attempting the fetch
 *
 * @param sfsNumber - SFS number
 * @param errorMessage - Error message to store
 */
export function createErrorMetadata(
  sfsNumber: string,
  errorMessage: string
): PdfMetadata {
  const storagePath = constructStoragePath(sfsNumber)

  return {
    storagePath,
    storageBucket: 'sfs-pdfs',
    originalUrl: '',
    fileSize: 0,
    fetchedAt: new Date().toISOString(),
    error: errorMessage,
  }
}

/**
 * Check if a PDF metadata indicates a failure that should be retried
 */
export function shouldRetryPdf(metadata: PdfMetadata | null): boolean {
  if (!metadata) return false
  return !!metadata.error
}

/**
 * Reset rate limiter (useful for testing)
 */
export function resetRateLimiter(): void {
  lastFetchTime = 0
}
