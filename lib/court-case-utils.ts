/**
 * Court Case Display Utilities
 *
 * Provides formatting functions for court case display in search results
 * and detail pages, mimicking domstol.se UX patterns.
 */

/**
 * Raw case type values from Domstolsverket API
 */
export type RawCaseType = 'DOM_ELLER_BESLUT' | 'PROVNINGSTILLSTAND' | 'REFERAT'

/**
 * Maps raw API case type to Swedish display label
 */
const CASE_TYPE_LABELS: Record<string, string> = {
  DOM_ELLER_BESLUT: 'Dom eller beslut',
  PROVNINGSTILLSTAND: 'Prövningstillstånd',
  REFERAT: 'Referat',
}

/**
 * Gets the display label for a court case type.
 * If the case is guiding (prejudikat), returns "Prejudikat" regardless of raw type.
 *
 * @param isGuiding - Whether the case is a guiding precedent (arVagledande)
 * @param rawType - Raw case type from API (DOM_ELLER_BESLUT, etc.)
 * @returns Formatted display label
 */
export function getCaseTypeLabel(
  isGuiding: boolean | undefined,
  rawType: string | undefined
): string {
  if (isGuiding) {
    return 'Prejudikat'
  }

  if (rawType && CASE_TYPE_LABELS[rawType]) {
    return CASE_TYPE_LABELS[rawType]
  }

  // Fallback for unknown types - try to format nicely
  if (rawType) {
    return rawType
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return 'Avgörande'
}

/**
 * Checks if a content type is a court case
 */
export function isCourtCase(contentType: string): boolean {
  return contentType.startsWith('COURT_CASE_')
}

/**
 * Gets short court name for display in metadata line
 * E.g., "Högsta domstolen" -> "HD", "Högsta förvaltningsdomstolen" -> "HFD"
 */
export function getShortCourtName(courtName: string): string {
  const SHORT_NAMES: Record<string, string> = {
    'Högsta domstolen': 'HD',
    'Högsta förvaltningsdomstolen': 'HFD',
    Arbetsdomstolen: 'AD',
    'Mark- och miljööverdomstolen': 'MÖD',
    Migrationsöverdomstolen: 'MIG',
  }

  // Check for exact match
  if (SHORT_NAMES[courtName]) {
    return SHORT_NAMES[courtName]
  }

  // Check for Hovrätt variants
  if (courtName.toLowerCase().includes('hovrätt')) {
    return 'HovR'
  }

  // Check for Kammarrätt variants
  if (courtName.toLowerCase().includes('kammarrätt')) {
    return 'KamR'
  }

  return courtName
}

/**
 * Extracts court case metadata for display
 */
export interface CourtCaseDisplayData {
  /** Primary case number for title (e.g., "B 4130-24") */
  caseNumber: string
  /** Case name if available (e.g., "Andnöden") */
  caseName: string | null
  /** Full court name (e.g., "Högsta domstolen") */
  courtName: string
  /** Short court name (e.g., "HD") */
  courtNameShort: string
  /** Formatted case type (e.g., "Prejudikat", "Dom eller beslut") */
  caseTypeLabel: string
  /** Whether this is a guiding/precedent case */
  isGuiding: boolean
  /** Decision date */
  decisionDate: string | null
}

/**
 * Extracts display data from court case metadata
 */
export function extractCourtCaseDisplayData(
  metadata: Record<string, unknown> | null,
  courtCase: {
    court_name: string
    case_number: string
    decision_date: Date | string | null
  } | null
): CourtCaseDisplayData {
  const isGuiding = (metadata?.is_guiding as boolean) ?? false
  const rawType = metadata?.case_type as string | undefined
  const caseName = (metadata?.case_name as string) || null

  const courtName = courtCase?.court_name || 'Domstol'
  const caseNumber = courtCase?.case_number || ''
  const decisionDate = courtCase?.decision_date
    ? (new Date(courtCase.decision_date).toISOString().split('T')[0] ?? null)
    : null

  return {
    caseNumber,
    caseName,
    courtName,
    courtNameShort: getShortCourtName(courtName),
    caseTypeLabel: getCaseTypeLabel(isGuiding, rawType),
    isGuiding,
    decisionDate,
  }
}
