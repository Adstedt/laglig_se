/**
 * Swedish Law Section Parser
 *
 * Extracts section-level amendment information from Swedish law text.
 * Swedish laws include amendment markers at the end of each section:
 *   "7 § En arbetsgivare ska vidta alla åtgärder... Lag (2025:732)."
 *
 * Story 2.11 - Task 5: Implement Section Extraction
 */

// ============================================================================
// Types
// ============================================================================

export interface SectionAmendment {
  sectionNumber: string // "7" or "7 a" or "3:7"
  sectionText: string // Full section text
  amendedBy: string // "SFS 2025:732"
  chapterNumber: string | undefined // "3" if section is in a chapter
}

export interface ParsedAmendments {
  amendments: SectionAmendment[]
  uniqueSfsNumbers: string[] // Deduplicated list of all SFS numbers found
}

// ============================================================================
// Undertitel Parsing
// ============================================================================

/**
 * Parse the latest amendment from undertitel field
 * @example "t.o.m. SFS 2025:732" -> "SFS 2025:732"
 * @example "Förordning (1998:123)" -> null (not a t.o.m. reference)
 */
export function parseUndertitel(undertitel: string): string | null {
  if (!undertitel) return null

  // Pattern: "t.o.m. SFS YYYY:NNNN" or "t.o.m. SFS YYYY:NNN"
  const match = undertitel.match(/t\.o\.m\.\s*(SFS\s*\d{4}:\d+)/i)
  return match?.[1] || null
}

// ============================================================================
// Section Amendment Extraction
// ============================================================================

/**
 * Extract all section amendments from law full text
 *
 * Swedish law sections end with a reference to the law that last amended them:
 *   "7 § Text of the section. Lag (2025:732)."
 *   "8 § Another section. Lag (1994:579)."
 *
 * This extracts which sections were amended by which SFS numbers.
 */
export function extractSectionAmendments(fullText: string): ParsedAmendments {
  if (!fullText) {
    return { amendments: [], uniqueSfsNumbers: [] }
  }

  const amendments: SectionAmendment[] = []
  const sfsSet = new Set<string>()

  // Pattern to match section numbers followed by text ending with Lag (YYYY:NNNN).
  // Handles:
  // - Simple sections: "7 §"
  // - Sections with letters: "7 a §"
  // - Chapter:section format: "3 kap. 7 §"
  // - Multiple paragraph sections

  // First, try to match sections with chapter numbers
  const chapterSectionPattern = /(\d+)\s*kap\.\s*(\d+\s*[a-z]?)\s*§([^§]*?)Lag\s*\((\d{4}:\d+)\)\./gi

  for (const match of fullText.matchAll(chapterSectionPattern)) {
    const chapterNum = match[1]
    const sectionNum = match[2]?.trim() || ''
    const text = match[3]?.trim() || ''
    const sfsYear = match[4]
    const sfsNumber = `SFS ${sfsYear}`

    amendments.push({
      sectionNumber: `${chapterNum}:${sectionNum}`,
      sectionText: text.substring(0, 200), // First 200 chars for context
      amendedBy: sfsNumber,
      chapterNumber: chapterNum || undefined,
    })
    sfsSet.add(sfsNumber)
  }

  // Then match standalone sections (not in chapters)
  const simpleSectionPattern = /(?<!\d\s*kap\.\s*)(\d+\s*[a-z]?)\s*§([^§]*?)Lag\s*\((\d{4}:\d+)\)\./gi

  for (const match of fullText.matchAll(simpleSectionPattern)) {
    const sectionNum = match[1]?.trim() || ''
    const text = match[2]?.trim() || ''
    const sfsYear = match[3]
    const sfsNumber = `SFS ${sfsYear}`

    // Check if this section was already captured as part of a chapter
    const existingChapterSection = amendments.find(
      a => a.sectionNumber.endsWith(`:${sectionNum}`) || a.sectionNumber === sectionNum
    )
    if (existingChapterSection) continue

    amendments.push({
      sectionNumber: sectionNum,
      sectionText: text.substring(0, 200),
      amendedBy: sfsNumber,
      chapterNumber: undefined,
    })
    sfsSet.add(sfsNumber)
  }

  return {
    amendments,
    uniqueSfsNumbers: Array.from(sfsSet).sort(),
  }
}

/**
 * Find sections that were changed by a specific amendment
 * @param fullText The law's full text
 * @param amendmentSfs The SFS number to search for, e.g., "SFS 2025:732"
 * @returns Array of section identifiers that were modified
 */
export function findChangedSections(fullText: string, amendmentSfs: string): string[] {
  const { amendments } = extractSectionAmendments(fullText)

  return amendments
    .filter(a => a.amendedBy === amendmentSfs)
    .map(a => `${a.sectionNumber} §`)
}

/**
 * Extract all unique SFS numbers from law text
 * Useful for building amendment history
 */
export function extractAllSfsReferences(fullText: string): string[] {
  if (!fullText) return []

  const pattern = /Lag\s*\((\d{4}:\d+)\)/g
  const sfsSet = new Set<string>()

  for (const match of fullText.matchAll(pattern)) {
    sfsSet.add(`SFS ${match[1]}`)
  }

  return Array.from(sfsSet).sort()
}

/**
 * Parse Övergångsbestämmelser (transitional provisions) for effective dates
 * Swedish laws often have a section at the end specifying when amendments take effect
 *
 * @example
 * "Övergångsbestämmelser
 *  2025:732
 *  1. Denna lag träder i kraft den 1 januari 2026."
 */
export function parseTransitionalProvisions(fullText: string): Map<string, Date | null> {
  const effectiveDates = new Map<string, Date | null>()

  if (!fullText) return effectiveDates

  // Find the Övergångsbestämmelser section
  const transitionMatch = fullText.match(/Övergångsbestämmelser\s*([\s\S]*?)(?=\n\n|$)/i)
  if (!transitionMatch?.[1]) return effectiveDates

  const transitionText = transitionMatch[1]

  // Pattern to match: "YYYY:NNNN\n1. Denna lag träder i kraft den D MONTH YYYY"
  const entryPattern = /(\d{4}:\d+)\s*\n[^]*?(?:träder i kraft|tillämpas)[^]*?(?:den\s+)?(\d{1,2})\s*(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s*(\d{4})/gi

  const monthMap: Record<string, number> = {
    januari: 0,
    februari: 1,
    mars: 2,
    april: 3,
    maj: 4,
    juni: 5,
    juli: 6,
    augusti: 7,
    september: 8,
    oktober: 9,
    november: 10,
    december: 11,
  }

  for (const match of transitionText.matchAll(entryPattern)) {
    const sfsNumber = `SFS ${match[1] ?? ''}`
    const dayStr = match[2] ?? ''
    const monthStr = match[3] ?? ''
    const yearStr = match[4] ?? ''

    const day = parseInt(dayStr, 10)
    const month = monthMap[monthStr.toLowerCase()]
    const year = parseInt(yearStr, 10)

    if (month !== undefined && !isNaN(day) && !isNaN(year)) {
      effectiveDates.set(sfsNumber, new Date(year, month, day))
    }
  }

  return effectiveDates
}

/**
 * Group amendments by SFS number
 * Returns a map of SFS number -> list of affected sections
 */
export function groupAmendmentsBySfs(fullText: string): Map<string, string[]> {
  const { amendments } = extractSectionAmendments(fullText)
  const grouped = new Map<string, string[]>()

  for (const amendment of amendments) {
    const existing = grouped.get(amendment.amendedBy) || []
    existing.push(`${amendment.sectionNumber} §`)
    grouped.set(amendment.amendedBy, existing)
  }

  return grouped
}
