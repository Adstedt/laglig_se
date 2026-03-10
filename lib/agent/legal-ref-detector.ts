/**
 * Legal Reference Detection
 * Story 14.8, Task 2 (AC: 10-13)
 *
 * Extracts SFS numbers and chapter/section references from natural language queries.
 * Results are attached as metadata to retrieval results (enrichment, not filtering).
 * BM25 keyword search deferred to Story 14.13.
 */

export interface SectionRef {
  chapter?: number
  section: string
}

export interface LegalReferences {
  sfsNumbers: string[]
  sectionRefs: SectionRef[]
}

// SFS number: "SFS 1977:1160" or just "1977:1160"
const SFS_PATTERN = /(?:SFS\s+)?(\d{4}:\d+)/g

// Chapter + section: "3 kap. 5 §", "3 kap. 5a §"
const CHAPTER_SECTION_PATTERN = /(\d+)\s*kap\.\s*(\d+[a-z]?)\s*§/g

// All section-like matches: "5 §", "12a §"
const ALL_SECTION_PATTERN = /(\d+[a-z]?)\s*§/g

export function detectLegalReferences(query: string): LegalReferences {
  const sfsNumbers: string[] = []
  const sectionRefs: SectionRef[] = []

  // Extract SFS numbers
  let match: RegExpExecArray | null
  SFS_PATTERN.lastIndex = 0
  while ((match = SFS_PATTERN.exec(query)) !== null) {
    const sfsNum = match[1]!
    if (!sfsNumbers.includes(sfsNum)) {
      sfsNumbers.push(sfsNum)
    }
  }

  // Track character ranges consumed by chapter+section pattern
  const chapSecRanges: Array<[number, number]> = []

  CHAPTER_SECTION_PATTERN.lastIndex = 0
  while ((match = CHAPTER_SECTION_PATTERN.exec(query)) !== null) {
    sectionRefs.push({
      chapter: parseInt(match[1]!, 10),
      section: match[2]!,
    })
    chapSecRanges.push([match.index, match.index + match[0].length])
  }

  // Extract standalone section references not inside a chapter+section match
  ALL_SECTION_PATTERN.lastIndex = 0
  while ((match = ALL_SECTION_PATTERN.exec(query)) !== null) {
    const matchStart = match.index
    const matchEnd = matchStart + match[0].length

    // Skip if this match falls within a chapter+section range
    const insideChapSec = chapSecRanges.some(
      ([start, end]) => matchStart >= start && matchEnd <= end
    )
    if (insideChapSec) continue

    sectionRefs.push({ section: match[1]! })
  }

  return { sfsNumbers, sectionRefs }
}
