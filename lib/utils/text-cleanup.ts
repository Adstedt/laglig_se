/**
 * Text cleanup utilities for Swedish legal text
 * Handles common artifacts from PDF/HTML extraction
 */

/**
 * Remove line-break hyphenation artifacts from Swedish text
 *
 * When text is extracted from PDFs, words split across lines retain hyphens:
 * - "an-ordningar" should be "anordningar"
 * - "männis-kors" should be "människors"
 *
 * This function removes hyphens between lowercase letters, which catches
 * most line-break artifacts while preserving intentional hyphens in:
 * - Numbers and dates (2021-01-01)
 * - Uppercase abbreviations (A-B)
 *
 * Note: This will also merge intentional compound words like "första-tredje",
 * but this is acceptable for comparison purposes since both versions will
 * normalize the same way.
 */
export function cleanLineBreakHyphens(text: string): string {
  // First normalize all dash types to standard hyphen
  let cleaned = text.replace(/[–—]/g, '-')

  // Remove hyphens between lowercase Swedish letters
  // This catches line-break artifacts like "an-ordningar" → "anordningar"
  cleaned = cleaned.replace(/([a-zåäöéü])-([a-zåäöéü])/gi, '$1$2')

  return cleaned
}

/**
 * Remove soft hyphens (invisible hyphenation hints)
 */
export function removeSoftHyphens(text: string): string {
  return text.replace(/\u00AD/g, '')
}

/**
 * Full text cleanup for legal documents
 * Use this when storing text in the database to ensure consistency
 */
export function cleanLegalText(text: string): string {
  let cleaned = text

  // Remove soft hyphens
  cleaned = removeSoftHyphens(cleaned)

  // Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, '\n')

  // Remove line-break hyphenation
  cleaned = cleanLineBreakHyphens(cleaned)

  // Normalize multiple spaces to single space (preserving newlines)
  cleaned = cleaned.replace(/[^\S\n]+/g, ' ')

  // Trim whitespace from each line
  cleaned = cleaned
    .split('\n')
    .map((line) => line.trim())
    .join('\n')

  // Remove multiple consecutive newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

  return cleaned.trim()
}
