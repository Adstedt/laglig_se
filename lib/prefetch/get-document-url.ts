/**
 * URL mapping utility for legal documents
 *
 * Maps content types to their corresponding detail page routes
 * Used by prefetch logic to build correct URLs for prefetching
 */

export type ContentTypeKey =
  | 'SFS_LAW'
  | 'SFS_AMENDMENT'
  | 'COURT_CASE_AD'
  | 'COURT_CASE_HD'
  | 'COURT_CASE_HFD'
  | 'COURT_CASE_HOVR'
  | 'COURT_CASE_MOD'
  | 'COURT_CASE_MIG'
  | 'EU_REGULATION'
  | 'EU_DIRECTIVE'
  | 'AGENCY_REGULATION'

// Court URL segment mapping
const COURT_URL_SEGMENT: Record<string, string> = {
  COURT_CASE_AD: 'ad',
  COURT_CASE_HD: 'hd',
  COURT_CASE_HFD: 'hfd',
  COURT_CASE_HOVR: 'hovr',
  COURT_CASE_MOD: 'mod',
  COURT_CASE_MIG: 'mig',
}

// EU type URL segment mapping
const EU_URL_SEGMENT: Record<string, string> = {
  EU_REGULATION: 'forordningar',
  EU_DIRECTIVE: 'direktiv',
}

export interface DocumentUrlParams {
  contentType: string
  slug: string
}

/**
 * Get the detail page URL for a document based on its content type and slug
 *
 * @param doc - Object containing contentType and slug
 * @returns The full path to the document's detail page
 *
 * @example
 * getDocumentUrl({ contentType: 'SFS_LAW', slug: 'arbetsmiljolag-1977-1160' })
 * // Returns: '/lagar/arbetsmiljolag-1977-1160'
 *
 * getDocumentUrl({ contentType: 'COURT_CASE_AD', slug: 'ad-2023-45' })
 * // Returns: '/rattsfall/ad/ad-2023-45'
 *
 * getDocumentUrl({ contentType: 'EU_DIRECTIVE', slug: '32016L0680' })
 * // Returns: '/eu/direktiv/32016L0680'
 */
export function getDocumentUrl(doc: DocumentUrlParams): string {
  const { contentType, slug } = doc

  // SFS Laws
  if (contentType === 'SFS_LAW') {
    return `/lagar/${slug}`
  }

  // SFS Amendments
  if (contentType === 'SFS_AMENDMENT') {
    return `/lagar/andringar/${slug}`
  }

  // Agency regulations (föreskrifter)
  if (contentType === 'AGENCY_REGULATION') {
    return `/foreskrifter/${slug}`
  }

  // Court cases
  const courtSegment = COURT_URL_SEGMENT[contentType]
  if (courtSegment) {
    return `/rattsfall/${courtSegment}/${slug}`
  }

  // EU legislation
  const euSegment = EU_URL_SEGMENT[contentType]
  if (euSegment) {
    return `/eu/${euSegment}/${slug}`
  }

  // Fallback for unknown types (should not normally happen)
  return `/dokument/${slug}`
}

/**
 * Check if a content type is a court case
 */
export function isCourtCase(contentType: string): boolean {
  return contentType in COURT_URL_SEGMENT
}

/**
 * Check if a content type is EU legislation
 */
export function isEuLegislation(contentType: string): boolean {
  return contentType in EU_URL_SEGMENT
}

/**
 * Get all court case content types
 */
export function getCourtCaseContentTypes(): string[] {
  return Object.keys(COURT_URL_SEGMENT)
}

/**
 * Get all EU legislation content types
 */
export function getEuContentTypes(): string[] {
  return Object.keys(EU_URL_SEGMENT)
}
