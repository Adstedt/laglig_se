/**
 * Clean PDF extraction artifacts from SFS document content
 *
 * Common artifacts from Swedish legal PDF extraction:
 * - Publisher names (Wolters Kluwer, Elanders Sverige AB)
 * - Print year markers
 * - Page numbers and headers
 * - SFS number repeated as header
 * - OCR ruler/scale bar artifacts
 * - Empty lines and formatting noise
 * - PDF page footers with concatenated page numbers
 * - Split words across lines
 */

// Known publisher/printer strings to remove
const PUBLISHER_PATTERNS = [
  /Wolters Kluwer\s*/gi,
  /Elanders Sverige AB,?\s*\d{4}\s*/gi,
  /Norstedts Juridik\s*/gi,
  /Thomson Reuters\s*/gi,
  /Karnov Group\s*/gi,
]

// Header/footer patterns (SFS number as header, page numbers)
const HEADER_FOOTER_PATTERNS = [
  /^SFS\s+\d{4}:\d+\s*$/gm, // SFS number alone on a line
  /^\d+\s*$/gm, // Page numbers alone on a line
  /^–\s*\d+\s*–\s*$/gm, // Page numbers with dashes
  /^\s*Sida\s+\d+\s*/gim, // "Sida X" page markers
]

// PDF footnote patterns that appear embedded in text
// These are legislative reference footnotes from the bottom of PDF pages
const PDF_FOOTNOTE_PATTERNS = [
  // "1 Prop. 2025/26:22, bet. 2025/26:SkU5, rskr. 2025/26:95."
  // Matches: number + "Prop." + session reference + optional bet/rskr refs up to final period
  // The bet/rskr references can be like "SkU5" or just "95"
  /\s*\d+\s+Prop\.\s+\d{4}\/\d{2}:\d+(?:,\s*(?:bet|rskr)\.\s+\d{4}\/\d{2}:[A-Za-z]*\d+)*\.\s*/gi,
  // "3 Senaste lydelse 2024:1248." - simple form with just year:number
  /\s*\d+\s+Senaste lydelse\s+\d{4}:\d+\.\s*/gi,
  // "2 Senaste lydelse av 7 kap. 25 § 2024:1248." - single section reference
  /\s*\d+\s+Senaste lydelse(?:\s+av)?\s+(?:\d+\s*kap\.\s*)?\d+\s*[a-z]?\s*§\s+\d{4}:\d+\.\s*/gi,
  // "2 Senaste lydelse av 7 kap. 25 § 2024:1248 7 kap. 63 d § 2024:1248." - multiple section refs
  // Section refs like "7 kap. 63 d §" have optional letter suffix with spaces
  /\s*\d+\s+Senaste lydelse(?:\s+av)?(?:\s+\d+\s*kap\.\s+\d+\s*[a-z]?\s*§\s+\d{4}:\d+[\s,]*)+\.\s*/gi,
  // Standalone page header: "SFS 2025:1461 Publicerad den 10 december 2025"
  /SFS\s+\d{4}:\d+\s+Publicerad\s+den\s+\d+\s+\w+\s+\d{4}\s*/gi,
  // Concatenated SFS+page number followed by space and lowercase letter: "SFS 2025:14612 fast"
  // This indicates the digit is a page number concatenated to the SFS number
  /SFS\s+(\d{4}:\d+)(\d)\s+(?=[a-zåäö])/g,
]

// OCR artifacts from PDF rulers, scale bars, and noise
const OCR_ARTIFACT_PATTERNS = [
  // Ruler/scale bar patterns (e.g., "11 2 3 4 5 6 7 8 9 0 : ;")
  /^[\d\s:;.,]+$/gm,
  /\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s*[:;.,\s]*/g,
  // Repeated single digits with spaces (OCR noise)
  /(?:^|\s)(\d\s){5,}/gm,
  // Horizontal ruler patterns (various dash characters)
  /[─━═—–-]{3,}/g,
]

// Swedish legal document cleanup patterns
const LEGAL_CLEANUP_PATTERNS = [
  // Fix common OCR errors in Swedish
  /(\d)\s*§/g, // Space before § → no space (e.g., "1 §" is correct, but "1  §" isn't)
]

/**
 * Fix words split across lines by hyphenation
 * Common in PDF extraction where "kon-\ncern" should become "koncern"
 * Also handles cases where newline was converted to space: "in- komsten" -> "inkomsten"
 */
function fixSplitWords(content: string): string {
  let fixed = content

  // Fix hyphenated word splits at line breaks
  // Pattern: word ending with hyphen, newline, then lowercase continuation
  fixed = fixed.replace(/(\w+)-\n(\s*)([a-zåäö])/g, '$1$3')

  // Fix hyphenated word splits where newline became space
  // Pattern: word ending with hyphen, space(s), then lowercase continuation
  // Only match if the continuation is a valid Swedish word part (lowercase letter)
  fixed = fixed.replace(/([a-zåäöA-ZÅÄÖ]+)-\s+([a-zåäö])/g, '$1$2')

  return fixed
}

/**
 * Remove PDF page footer artifacts
 * Common pattern: "SFS 2025:1461 2" (SFS number followed by page number)
 */
function removePageFooters(content: string): string {
  // Pattern: SFS number followed by just a page number at end of line or standalone
  return content
    .replace(/^SFS\s+\d{4}:\d+\s+\d+\s*$/gm, '') // "SFS 2025:1461 2" on its own line
    .replace(/\nSFS\s+\d{4}:\d+\s+\d+\s*\n/g, '\n') // Same but embedded
}

/**
 * Clean PDF artifacts from extracted text content
 */
export function cleanPdfArtifacts(content: string | null): string | null {
  if (content === null || content === undefined) return null
  if (content.trim() === '') return ''

  let cleaned = content

  // Fix Windows line endings first
  cleaned = cleaned.replace(/\r\n/g, '\n')

  // Remove OCR artifacts (rulers, scale bars) FIRST - before other processing
  for (const pattern of OCR_ARTIFACT_PATTERNS) {
    cleaned = cleaned.replace(pattern, '')
  }

  // Remove publisher names
  for (const pattern of PUBLISHER_PATTERNS) {
    cleaned = cleaned.replace(pattern, '')
  }

  // Remove header/footer patterns
  for (const pattern of HEADER_FOOTER_PATTERNS) {
    cleaned = cleaned.replace(pattern, '')
  }

  // Remove PDF page footers (SFS number + page number)
  cleaned = removePageFooters(cleaned)

  // Remove PDF footnotes embedded in text
  for (const pattern of PDF_FOOTNOTE_PATTERNS) {
    // Special handling for concatenated SFS+page pattern - preserve the SFS number
    if (pattern.source.includes('(\\d{4}:\\d+)(\\d)')) {
      cleaned = cleaned.replace(pattern, 'SFS $1 ')
    } else {
      cleaned = cleaned.replace(pattern, ' ')
    }
  }

  // Fix split words from PDF extraction
  cleaned = fixSplitWords(cleaned)

  // Clean up noise
  cleaned = cleaned
    .replace(/\n{4,}/g, '\n\n') // Excessive newlines
    .replace(/^\s+$/gm, '') // Whitespace-only lines
    .replace(/\u00a0/g, ' ') // Non-breaking spaces
    .replace(/[ \t]{2,}/g, ' ') // Multiple spaces to single

  // Apply legal document cleanup
  for (const pattern of LEGAL_CLEANUP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '$1 §')
  }

  // Trim leading/trailing whitespace
  cleaned = cleaned.trim()

  return cleaned
}

/**
 * Format legal text with proper structure
 * Attempts to add line breaks and formatting to make wall-of-text readable
 */
export function formatLegalText(content: string | null): string | null {
  const cleaned = cleanPdfArtifacts(content)
  if (!cleaned) return null

  let formatted = cleaned

  // Add line breaks before section references (e.g., "2 kap. 1 §")
  formatted = formatted.replace(/(\s)(\d+\s*kap\.\s*\d+\s*§)/g, '\n\n$2')

  // Add line breaks before standalone section references (e.g., "1 §")
  formatted = formatted.replace(/(\s)(\d+\s*§)(?=[A-ZÅÄÖ])/g, '\n\n$2 ')

  // Add line breaks before "dels att" (common in amendment intro)
  formatted = formatted.replace(/,?\s*(dels att)/gi, '\n\n• $1')

  // Add line break after "följande lydelse." (end of intro)
  formatted = formatted.replace(/(följande lydelse\.)/gi, '$1\n\n')

  // Add line break before definition list items (word "i X §")
  formatted = formatted.replace(/(\s)([a-zåäö]+(?:\s+[a-zåäö]+)*\s+i\s+\d+)/g, '\n$2')

  // Add paragraph breaks before "Prop.", "SFS", "Publicerad"
  formatted = formatted.replace(/(\s)(Prop\.\s+\d{4})/g, '\n\n$2')
  formatted = formatted.replace(/(\s)(SFS\s+\d{4}:\d+)/g, '\n\n$2')
  formatted = formatted.replace(/(\s)(Publicerad den)/gi, '\n\n$2')

  // Clean up multiple newlines
  formatted = formatted.replace(/\n{3,}/g, '\n\n')

  return formatted.trim()
}

/**
 * Clean markdown content specifically
 * Preserves markdown formatting while removing artifacts
 */
export function cleanMarkdownContent(content: string | null): string | null {
  if (!content) return null

  let cleaned = cleanPdfArtifacts(content)
  if (!cleaned) return null

  // Additional markdown-specific cleanup
  cleaned = cleaned
    // Fix broken markdown links
    .replace(/\]\s+\(/g, '](')
    // Fix broken bold/italic
    .replace(/\*\s+\*/g, '**')
    // Remove orphaned markdown characters
    .replace(/^\*\s*$/gm, '')
    .replace(/^#\s*$/gm, '')

  return cleaned
}

/**
 * Extract a clean summary from content (first meaningful paragraph)
 */
export function extractCleanSummary(
  content: string | null,
  maxLength = 200
): string | null {
  const cleaned = cleanPdfArtifacts(content)
  if (!cleaned) return null

  // Find first paragraph with actual content
  const paragraphs = cleaned.split(/\n\n+/)
  const firstMeaningful = paragraphs.find((p) => {
    const trimmed = p.trim()
    // Skip very short paragraphs or those that look like headers
    return trimmed.length > 50 && !trimmed.startsWith('#')
  })

  if (!firstMeaningful) return null

  // Truncate if needed
  if (firstMeaningful.length <= maxLength) {
    return firstMeaningful.trim()
  }

  // Find a good break point (end of sentence)
  const truncated = firstMeaningful.substring(0, maxLength)
  const lastPeriod = truncated.lastIndexOf('.')
  const lastComma = truncated.lastIndexOf(',')
  const breakPoint = Math.max(lastPeriod, lastComma)

  if (breakPoint > maxLength * 0.5) {
    return truncated.substring(0, breakPoint + 1).trim()
  }

  return truncated.trim() + '...'
}
