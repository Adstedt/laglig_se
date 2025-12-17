/**
 * Diff Generation for Swedish Law Versions
 *
 * Story 2.13 Phase 3: Generates diffs between law versions
 * Uses the 'diff' npm package for line-level comparison
 */

import * as Diff from 'diff'
import { getLawVersionAtDate, SectionVersion } from './version-reconstruction'
import { cleanLineBreakHyphens, removeSoftHyphens } from '../utils/text-cleanup'

// ============================================================================
// Types
// ============================================================================

export interface LineDiff {
  /** The line content */
  value: string
  /** Whether this line was added */
  added?: boolean
  /** Whether this line was removed */
  removed?: boolean
}

export interface SectionDiff {
  chapter: string | null
  section: string
  /** Type of change to this section */
  changeType: 'added' | 'removed' | 'modified' | 'unchanged'
  /** Line-level diff (only for modified sections) */
  lineDiff?: LineDiff[]
  /** Text in version A (older) */
  textA?: string
  /** Text in version B (newer) */
  textB?: string
  /** Number of lines added */
  linesAdded: number
  /** Number of lines removed */
  linesRemoved: number
  /** Amendments that affected this section between dates (even without text) */
  amendmentsBetween?: Array<{
    sfsNumber: string
    effectiveDate: Date
    changeType: string
    hasText: boolean
  }>
  /** True if we know the section changed but don't have the text to show */
  textUnavailable?: boolean
}

export interface LawVersionDiff {
  /** The base law SFS number */
  baseLawSfs: string
  /** Date of version A (older) */
  dateA: Date
  /** Date of version B (newer) */
  dateB: Date
  /** Summary statistics */
  summary: {
    sectionsAdded: number
    sectionsRemoved: number
    sectionsModified: number
    sectionsUnchanged: number
    totalLinesAdded: number
    totalLinesRemoved: number
  }
  /** Per-section diffs */
  sections: SectionDiff[]
  /** Amendments between the two dates */
  amendmentsBetween: Array<{ sfsNumber: string; effectiveDate: Date }>
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Normalize text for comparison by removing formatting artifacts
 * - Section number prefixes (e.g., "1 §", "2 a §")
 * - Chapter/section markers
 * - Law reference citations (e.g., "Lag (2021:1099)")
 * - Section subtitles/headers
 * - Hyphenated line breaks (e.g., "an-nan" → "annan")
 * - Extra whitespace
 * - Line endings
 */
function normalizeTextForComparison(text: string): string {
  // Use shared cleanup utilities for consistent handling
  let normalized = removeSoftHyphens(text)
  normalized = cleanLineBreakHyphens(normalized)

  return (
    normalized
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      // Remove section number prefixes anywhere (e.g., "1 §", "2 a §", "10 b §")
      .replace(/\d+\s*[a-z]?\s*§\s*/gi, '')
      // Remove chapter markers (e.g., "1 kap.", "2 kap.")
      .replace(/\d+\s*kap\.\s*/gi, '')
      // Remove standalone § symbols
      .replace(/§/g, '')
      // Remove law reference citations (e.g., "Lag (2021:1099)", ". Lag (2020:123)")
      .replace(/\.?\s*Lag\s*\(\d{4}:\d+\)/gi, '')
      // Remove SFS references (e.g., "SFS 2021:1099")
      .replace(/SFS\s*\d{4}:\d+/gi, '')
      // Remove trailing section subtitles (common Swedish law formatting)
      // These appear after the main text and are formatting, not content
      .replace(/\.\s*[A-ZÅÄÖ][a-zåäö]+(?:\s+[a-zåäö]+){0,4}\s*$/g, (match) => {
        // Only remove if it looks like a subtitle (short phrase at end)
        const words = match.trim().split(/\s+/)
        if (words.length <= 5 && words.length >= 1) {
          return ''
        }
        return match
      })
      // Normalize multiple spaces/newlines to single space
      .replace(/\s+/g, ' ')
      // Remove common formatting differences (dashes already handled by cleanLineBreakHyphens)
      .replace(/[""]/g, '"') // Normalize quotes
      .replace(/['']/g, "'") // Normalize apostrophes
      .trim()
      // Normalize trailing punctuation
      .replace(/\.\s*$/, '')
  )
}

/**
 * Light normalization for diff display - preserves chapter/section references
 * but cleans up formatting artifacts that would cause false diffs
 */
function normalizeTextForDiff(text: string): string {
  let normalized = removeSoftHyphens(text)
  normalized = cleanLineBreakHyphens(normalized)

  return (
    normalized
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      // Remove law reference citations (e.g., "Lag (2021:1099)")
      .replace(/\.?\s*Lag\s*\(\d{4}:\d+\)/gi, '')
      // Normalize multiple spaces/newlines to single space
      .replace(/\s+/g, ' ')
      // Normalize quotes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .trim()
  )
}

/**
 * Compare two text strings and return word-level diff
 * Uses word-level comparison for more precise change highlighting
 *
 * @param textA - The older version text
 * @param textB - The newer version text
 * @returns Array of diffs with added/removed flags
 */
export function compareSectionText(textA: string, textB: string): LineDiff[] {
  // Use light normalization that preserves chapter/section references for display
  const normalizedA = normalizeTextForDiff(textA)
  const normalizedB = normalizeTextForDiff(textB)

  // Use word-level diff for more precise comparison
  const diff = Diff.diffWords(normalizedA, normalizedB)

  // Group consecutive changes into logical chunks for better display
  const result: LineDiff[] = []
  let currentChunk: LineDiff | null = null

  for (const part of diff) {
    if (
      currentChunk &&
      ((currentChunk.added && part.added) ||
        (currentChunk.removed && part.removed) ||
        (!currentChunk.added &&
          !currentChunk.removed &&
          !part.added &&
          !part.removed))
    ) {
      // Same type, append to current chunk
      currentChunk.value += part.value
    } else {
      // Different type, start new chunk
      if (currentChunk) {
        result.push(currentChunk)
      }
      currentChunk = {
        value: part.value,
        added: part.added,
        removed: part.removed,
      }
    }
  }

  if (currentChunk) {
    result.push(currentChunk)
  }

  return result
}

/**
 * Check if two texts are semantically identical (ignoring formatting)
 */
export function areTextsSemanticallyEqual(
  textA: string,
  textB: string
): boolean {
  return normalizeTextForComparison(textA) === normalizeTextForComparison(textB)
}

/**
 * Compare two versions of a law and return detailed diff
 *
 * @param baseLawSfs - The SFS number of the base law
 * @param dateA - The older date
 * @param dateB - The newer date
 * @returns Detailed diff between the two versions
 */
export async function compareLawVersions(
  baseLawSfs: string,
  dateA: Date,
  dateB: Date
): Promise<LawVersionDiff | null> {
  // Ensure dateA is older than dateB
  const [olderDate, newerDate] = dateA < dateB ? [dateA, dateB] : [dateB, dateA]

  // Get both versions
  const versionA = await getLawVersionAtDate(baseLawSfs, olderDate)
  const versionB = await getLawVersionAtDate(baseLawSfs, newerDate)

  if (!versionA || !versionB) {
    return null
  }

  // Build maps of sections by key for easy lookup
  const sectionsA = new Map<string, SectionVersion>()
  const sectionsB = new Map<string, SectionVersion>()

  for (const s of versionA.sections) {
    const key = `${s.chapter || ''}:${s.section}`
    sectionsA.set(key, s)
  }

  for (const s of versionB.sections) {
    const key = `${s.chapter || ''}:${s.section}`
    sectionsB.set(key, s)
  }

  // Find all unique section keys
  const allKeys = new Set([...sectionsA.keys(), ...sectionsB.keys()])

  // Compare each section
  const sectionDiffs: SectionDiff[] = []
  let sectionsAdded = 0
  let sectionsRemoved = 0
  let sectionsModified = 0
  let sectionsUnchanged = 0
  let totalLinesAdded = 0
  let totalLinesRemoved = 0

  for (const key of allKeys) {
    const sectionA = sectionsA.get(key)
    const sectionB = sectionsB.get(key)

    const [chapter, sectionNum] = key.split(':')
    const section = sectionNum ?? ''

    // Helper to find amendments that occurred between the two dates for this section
    const getAmendmentsBetween = () => {
      const amendmentsA = sectionA?.amendmentsApplied || []
      const amendmentsB = sectionB?.amendmentsApplied || []

      // Amendments in B but not in A (i.e., occurred after date A)
      const aSfsSet = new Set(amendmentsA.map((a) => a.sfsNumber))
      return amendmentsB.filter((a) => !aSfsSet.has(a.sfsNumber))
    }

    // Check for not_exists (repealed or not yet created)
    const aExists = sectionA && sectionA.source.type !== 'not_exists'
    const bExists = sectionB && sectionB.source.type !== 'not_exists'

    if (!aExists && bExists) {
      // Section added in version B (or existed in A but we don't have it)
      sectionsAdded++
      const lines = sectionB!.textContent.split('\n').length
      totalLinesAdded += lines

      sectionDiffs.push({
        chapter: chapter || null,
        section,
        changeType: 'added',
        textB: sectionB!.textContent,
        linesAdded: lines,
        linesRemoved: 0,
        amendmentsBetween: getAmendmentsBetween(),
      })
    } else if (aExists && !bExists) {
      // Section removed (repealed) in version B
      sectionsRemoved++
      const lines = sectionA!.textContent.split('\n').length
      totalLinesRemoved += lines

      sectionDiffs.push({
        chapter: chapter || null,
        section,
        changeType: 'removed',
        textA: sectionA!.textContent,
        linesAdded: 0,
        linesRemoved: lines,
        amendmentsBetween: getAmendmentsBetween(),
      })
    } else if (aExists && bExists) {
      // Section exists in both - check if modified
      const amendmentsBetween = getAmendmentsBetween()

      // Use semantic comparison to ignore formatting-only changes
      const textsEqual = areTextsSemanticallyEqual(
        sectionA!.textContent,
        sectionB!.textContent
      )

      if (textsEqual && amendmentsBetween.length === 0) {
        // Texts are identical AND no amendments between dates
        sectionsUnchanged++

        sectionDiffs.push({
          chapter: chapter || null,
          section,
          changeType: 'unchanged',
          linesAdded: 0,
          linesRemoved: 0,
        })
      } else if (textsEqual && amendmentsBetween.length > 0) {
        // Texts appear equal BUT there were amendments between dates
        // This means we have amendments without text - mark as modified with textUnavailable
        sectionsModified++

        sectionDiffs.push({
          chapter: chapter || null,
          section,
          changeType: 'modified',
          textA: sectionA!.textContent,
          textB: sectionB!.textContent,
          linesAdded: 0,
          linesRemoved: 0,
          amendmentsBetween,
          textUnavailable: true,
        })
      } else {
        // Actual content change
        sectionsModified++

        const lineDiff = compareSectionText(
          sectionA!.textContent,
          sectionB!.textContent
        )

        // Count added/removed lines
        let linesAdded = 0
        let linesRemoved = 0
        for (const part of lineDiff) {
          const lineCount = part.value
            .split('\n')
            .filter((l) => l.length > 0).length
          if (part.added) linesAdded += lineCount
          if (part.removed) linesRemoved += lineCount
        }

        totalLinesAdded += linesAdded
        totalLinesRemoved += linesRemoved

        sectionDiffs.push({
          chapter: chapter || null,
          section,
          changeType: 'modified',
          lineDiff,
          textA: sectionA!.textContent,
          textB: sectionB!.textContent,
          linesAdded,
          linesRemoved,
          amendmentsBetween,
        })
      }
    } else if (!aExists && !bExists) {
      // Both don't exist (edge case) - skip
      continue
    }
  }

  // Sort sections by chapter and section number
  sectionDiffs.sort((a, b) => {
    const chapterA = a.chapter ? parseInt(a.chapter, 10) : 0
    const chapterB = b.chapter ? parseInt(b.chapter, 10) : 0
    if (chapterA !== chapterB) return chapterA - chapterB

    const sectionA = parseInt(a.section, 10)
    const sectionB = parseInt(b.section, 10)
    return sectionA - sectionB
  })

  // Get amendments between the two dates
  const amendmentsBetween = versionA.meta.amendmentsBetween.filter(
    (a) => a.effectiveDate <= newerDate
  )

  return {
    baseLawSfs: versionA.baseLawSfs,
    dateA: olderDate,
    dateB: newerDate,
    summary: {
      sectionsAdded,
      sectionsRemoved,
      sectionsModified,
      sectionsUnchanged,
      totalLinesAdded,
      totalLinesRemoved,
    },
    sections: sectionDiffs,
    amendmentsBetween,
  }
}

/**
 * Generate a unified diff string for display
 *
 * @param textA - The older version text
 * @param textB - The newer version text
 * @param labelA - Label for version A (e.g., "2020-01-01")
 * @param labelB - Label for version B (e.g., "2025-01-01")
 * @returns Unified diff string
 */
export function generateUnifiedDiff(
  textA: string,
  textB: string,
  labelA: string = 'version A',
  labelB: string = 'version B'
): string {
  const normalizedA = textA.replace(/\r\n/g, '\n').trim()
  const normalizedB = textB.replace(/\r\n/g, '\n').trim()

  return Diff.createPatch('section', normalizedA, normalizedB, labelA, labelB)
}

/**
 * Get only the changed sections (filter out unchanged)
 */
export function getChangedSections(diff: LawVersionDiff): SectionDiff[] {
  return diff.sections.filter((s) => s.changeType !== 'unchanged')
}

// Re-export formatSectionRef from section-parser for backward compatibility
export { formatSectionRef } from './section-parser'
