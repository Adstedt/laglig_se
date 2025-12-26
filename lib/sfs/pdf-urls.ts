/**
 * SFS PDF URL Construction
 *
 * Story 2.28: Unified SFS PDF Sync & Document Classification
 *
 * Constructs direct URLs to svenskforfattningssamling.se for SFS documents.
 * No crawling required - URLs are predictable based on SFS number and date.
 */

/**
 * Result of URL construction
 */
export interface SfsPdfUrls {
  /** HTML page URL (e.g., https://svenskforfattningssamling.se/doc/20251581.html) */
  html: string
  /** PDF download URL */
  pdf: string
  /** Year extracted from SFS number */
  year: string
  /** Number portion of SFS (may be padded) */
  number: string
  /** Year-month from publication date (YYYY-MM format) */
  yearMonth: string | null
}

/**
 * Parse an SFS number into year and number components
 *
 * @param sfsNumber - SFS number in format "2025:1581" or "SFS 2025:1581"
 * @returns { year, number } or null if invalid
 */
export function parseSfsNumber(
  sfsNumber: string
): { year: string; number: string } | null {
  if (!sfsNumber) return null

  // Remove "SFS " prefix if present
  const cleaned = sfsNumber.replace(/^SFS\s*/i, '').trim()

  // Match YYYY:NNNN pattern
  const match = cleaned.match(/^(\d{4}):(\d+)$/)
  if (!match || !match[1] || !match[2]) return null

  return {
    year: match[1],
    number: match[2],
  }
}

/**
 * Extract year-month from a publication date
 *
 * @param publicationDate - Date in format "YYYY-MM-DD" or Date object
 * @returns Year-month in "YYYY-MM" format, or null if invalid
 */
export function extractYearMonth(
  publicationDate: string | Date | null | undefined
): string | null {
  if (!publicationDate) return null

  try {
    if (publicationDate instanceof Date) {
      const year = publicationDate.getFullYear()
      const month = String(publicationDate.getMonth() + 1).padStart(2, '0')
      return `${year}-${month}`
    }

    // Handle string format "YYYY-MM-DD"
    const match = String(publicationDate).match(/^(\d{4})-(\d{2})/)
    if (match) {
      return `${match[1]}-${match[2]}`
    }

    return null
  } catch {
    return null
  }
}

/**
 * Pad an SFS number to 4 digits
 * e.g., "123" -> "0123", "1" -> "0001"
 *
 * @param number - The number portion of an SFS number
 * @returns Padded number string
 */
export function padSfsNumber(number: string): string {
  return number.padStart(4, '0')
}

/**
 * Construct URLs for an SFS document's HTML page and PDF
 *
 * URL patterns:
 * - HTML: https://svenskforfattningssamling.se/doc/{YYYYNNNN}.html
 * - PDF: https://svenskforfattningssamling.se/sites/default/files/sfs/{YYYY-MM}/SFS{YYYY}-{NNNN}.pdf
 *
 * Note: PDF URLs require the publication date month to construct the path.
 * If no publication date is provided, the PDF URL will use a fallback pattern.
 *
 * @param sfsNumber - SFS number (e.g., "2025:1581" or "SFS 2025:1581")
 * @param publicationDate - Publication date (optional, for PDF path construction)
 * @returns URLs object with html, pdf, and parsed components
 *
 * @example
 * constructPdfUrls("2025:1581", "2025-12-23")
 * // => {
 * //   html: "https://svenskforfattningssamling.se/doc/20251581.html",
 * //   pdf: "https://svenskforfattningssamling.se/sites/default/files/sfs/2025-12/SFS2025-1581.pdf",
 * //   year: "2025",
 * //   number: "1581",
 * //   yearMonth: "2025-12"
 * // }
 *
 * @example
 * // With short number (padding applied)
 * constructPdfUrls("2025:123", "2025-01-15")
 * // => {
 * //   html: "https://svenskforfattningssamling.se/doc/20250123.html",
 * //   pdf: "https://svenskforfattningssamling.se/sites/default/files/sfs/2025-01/SFS2025-123.pdf",
 * //   ...
 * // }
 */
export function constructPdfUrls(
  sfsNumber: string,
  publicationDate?: string | Date | null
): SfsPdfUrls {
  const parsed = parseSfsNumber(sfsNumber)

  if (!parsed) {
    throw new Error(`Invalid SFS number format: ${sfsNumber}`)
  }

  const { year, number } = parsed
  const paddedNumber = padSfsNumber(number)
  const yearMonth = extractYearMonth(publicationDate)

  // HTML URL uses the compact format: YYYYNNNN.html
  const html = `https://svenskforfattningssamling.se/doc/${year}${paddedNumber}.html`

  // PDF URL pattern: /sites/default/files/sfs/{YYYY-MM}/SFS{YYYY}-{NNNN}.pdf
  // Note: The PDF uses the original number (not padded) in the filename
  let pdf: string

  if (yearMonth) {
    pdf = `https://svenskforfattningssamling.se/sites/default/files/sfs/${yearMonth}/SFS${year}-${number}.pdf`
  } else {
    // Fallback: use year-01 if no date provided (documents typically published in January)
    // This may not always work, but provides a reasonable default
    pdf = `https://svenskforfattningssamling.se/sites/default/files/sfs/${year}-01/SFS${year}-${number}.pdf`
  }

  return {
    html,
    pdf,
    year,
    number,
    yearMonth,
  }
}

/**
 * Construct the storage path for Supabase bucket
 * Pattern: YYYY/SFSYYYY-NNNN.pdf
 *
 * @param sfsNumber - SFS number (e.g., "2025:1581")
 * @returns Storage path for the PDF
 */
export function constructStoragePath(sfsNumber: string): string {
  const parsed = parseSfsNumber(sfsNumber)

  if (!parsed) {
    throw new Error(`Invalid SFS number format: ${sfsNumber}`)
  }

  const { year, number } = parsed
  return `${year}/SFS${year}-${number}.pdf`
}

/**
 * Extract SFS number from a storage path
 * Reverse of constructStoragePath
 *
 * @param storagePath - Path like "2025/SFS2025-1581.pdf"
 * @returns SFS number like "2025:1581" or null
 */
export function extractSfsFromStoragePath(storagePath: string): string | null {
  // Match pattern: YYYY/SFSYYYY-NNNN.pdf
  const match = storagePath.match(/(\d{4})\/SFS\d{4}-(\d+)\.pdf$/)

  if (!match) return null

  return `${match[1]}:${match[2]}`
}
