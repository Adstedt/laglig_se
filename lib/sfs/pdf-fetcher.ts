/**
 * SFS PDF Fetch and Storage Utility
 *
 * Story 2.28: Unified SFS PDF Sync & Document Classification
 *
 * Fetches PDFs from svenskforfattningssamling.se and stores them
 * in Supabase Storage with proper rate limiting.
 */

import { constructPdfUrls, constructStoragePath } from './pdf-urls'
import { uploadPdf } from '@/lib/supabase/storage'

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
  /** Original source URL */
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
        'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
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
 * Fetch and store a PDF for an SFS document
 *
 * This function:
 * 1. Constructs the PDF URL from SFS number and publication date
 * 2. Respects rate limiting (1 request/second)
 * 3. Downloads the PDF from svenskforfattningssamling.se
 * 4. Uploads to Supabase Storage bucket
 * 5. Returns metadata for storage in LegalDocument
 *
 * @param sfsNumber - SFS number (e.g., "2025:1581" or "SFS 2025:1581")
 * @param publicationDate - Publication date (YYYY-MM-DD format or Date object)
 * @returns Fetch result with success status and metadata
 *
 * @example
 * const result = await fetchAndStorePdf("2025:1581", "2025-12-23")
 * if (result.success) {
 *   // Store result.metadata in LegalDocument.metadata.pdf
 * }
 */
export async function fetchAndStorePdf(
  sfsNumber: string,
  publicationDate?: string | Date | null
): Promise<FetchPdfResult> {
  const cleanSfsNumber = sfsNumber.replace(/^SFS\s*/i, '').trim()

  try {
    // Construct URLs
    const urls = constructPdfUrls(sfsNumber, publicationDate)
    const storagePath = constructStoragePath(sfsNumber)

    console.log(`[PDF-FETCHER] Fetching PDF for ${cleanSfsNumber}`)
    console.log(`[PDF-FETCHER]   URL: ${urls.pdf}`)
    console.log(`[PDF-FETCHER]   Storage path: ${storagePath}`)

    // Wait for rate limiting
    await waitForRateLimit()

    // Fetch PDF
    const fetchResult = await fetchPdfFromUrl(urls.pdf)

    if (!fetchResult) {
      const errorMetadata: PdfMetadata = {
        storagePath,
        storageBucket: 'sfs-pdfs',
        originalUrl: urls.pdf,
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
        originalUrl: urls.pdf,
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
      originalUrl: urls.pdf,
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
