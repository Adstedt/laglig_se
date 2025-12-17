/**
 * Historical Version Reconstruction for Swedish Laws
 *
 * Story 2.13 Phase 3: Reconstructs law text at any historical date by:
 * 1. Starting with current text from LawSection table
 * 2. Finding relevant SectionChanges from amendments
 * 3. Determining what text existed at the target date
 *
 * Data flow:
 *   LawSection (current) + SectionChange (history) → Historical version
 */

import { PrismaClient, SectionChangeType } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================================================
// Types
// ============================================================================

export interface SectionVersion {
  chapter: string | null
  section: string
  textContent: string
  htmlContent: string
  heading: string | null
  /** Source of this version's text */
  source:
    | { type: 'current' } // From LawSection (unchanged)
    | { type: 'amendment'; sfsNumber: string; effectiveDate: Date } // From SectionChange
    | { type: 'not_exists' } // Section didn't exist at this date
  /** All amendments that affected this section up to this date (even if we don't have text) */
  amendmentsApplied?: Array<{
    sfsNumber: string
    effectiveDate: Date
    changeType: SectionChangeType
    hasText: boolean
  }>
}

export interface LawVersionResult {
  /** The base law SFS number */
  baseLawSfs: string
  /** The date this version represents */
  asOfDate: Date
  /** Title of the law */
  title: string
  /** All sections as they existed at the target date */
  sections: SectionVersion[]
  /** Metadata about the reconstruction */
  meta: {
    /** Total sections in current law */
    currentSectionCount: number
    /** Sections that existed at target date */
    historicalSectionCount: number
    /** Sections added after target date (excluded) */
    sectionsAddedLater: number
    /** Whether any sections have incomplete history */
    hasGaps: boolean
    /** List of amendments between target date and now */
    amendmentsBetween: Array<{ sfsNumber: string; effectiveDate: Date }>
  }
}

export interface SectionHistoryEntry {
  /** When this version became effective */
  effectiveDate: Date | null
  /** The amendment that made this change (null for original) */
  amendmentSfs: string | null
  /** Type of change */
  changeType: SectionChangeType | 'ORIGINAL'
  /** The text after this change */
  textContent: string | null
  /** Whether this is the current version */
  isCurrent: boolean
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get the text of a specific section at a historical date
 *
 * Algorithm:
 * 1. Find all SectionChanges for this section, ordered by effective_date DESC
 * 2. Find the most recent change ON or BEFORE target date
 * 3. Return that change's new_text (the text AFTER that amendment)
 * 4. If no changes found before date, return current LawSection text (unchanged since original)
 * 5. If section was created (NEW) after target date, return not_exists
 */
export async function getSectionTextAtDate(
  baseLawSfs: string,
  chapter: string | null,
  section: string,
  targetDate: Date
): Promise<SectionVersion | null> {
  // Normalize the SFS number - ensure it HAS the "SFS " prefix for AmendmentDocument queries
  const normalizedSfs = baseLawSfs.startsWith('SFS ')
    ? baseLawSfs
    : `SFS ${baseLawSfs}`

  // Find all amendments to this section, ordered by effective date DESC
  const sectionChanges = await prisma.sectionChange.findMany({
    where: {
      chapter: chapter,
      section: section,
      amendment: {
        base_law_sfs: normalizedSfs,
      },
    },
    include: {
      amendment: {
        select: {
          sfs_number: true,
          effective_date: true,
        },
      },
    },
    orderBy: {
      amendment: {
        effective_date: 'desc',
      },
    },
  })

  // Find the most recent change ON or BEFORE the target date
  const relevantChange = sectionChanges.find(
    (change) =>
      change.amendment.effective_date &&
      change.amendment.effective_date <= targetDate
  )

  // Check if this section was created AFTER the target date
  const creationChange = sectionChanges.find(
    (change) => change.change_type === 'NEW'
  )
  if (
    creationChange &&
    creationChange.amendment.effective_date &&
    creationChange.amendment.effective_date > targetDate
  ) {
    // Section didn't exist at target date
    return {
      chapter,
      section,
      textContent: '',
      htmlContent: '',
      heading: null,
      source: { type: 'not_exists' },
    }
  }

  if (relevantChange && relevantChange.new_text) {
    // Found a change - return the text AFTER that amendment
    return {
      chapter,
      section,
      textContent: relevantChange.new_text,
      htmlContent: '', // SectionChange doesn't store HTML
      heading: null,
      source: {
        type: 'amendment',
        sfsNumber: relevantChange.amendment.sfs_number,
        effectiveDate: relevantChange.amendment.effective_date!,
      },
    }
  }

  // No changes found before date - get current text from LawSection
  // This means the section hasn't changed since the law was originally enacted
  const legalDocument = await prisma.legalDocument.findFirst({
    where: {
      document_number: { contains: normalizedSfs },
      content_type: 'SFS_LAW',
    },
    select: { id: true },
  })

  if (!legalDocument) {
    return null // Law not found
  }

  const currentSection = await prisma.lawSection.findFirst({
    where: {
      legal_document_id: legalDocument.id,
      chapter: chapter,
      section: section,
    },
  })

  if (!currentSection) {
    return null // Section not found
  }

  return {
    chapter: currentSection.chapter,
    section: currentSection.section,
    textContent: currentSection.text_content,
    htmlContent: currentSection.html_content,
    heading: currentSection.heading,
    source: { type: 'current' },
  }
}

/**
 * Reconstruct an entire law as it existed at a historical date
 *
 * Algorithm:
 * 1. Get all current LawSections for this law
 * 2. Get all SectionChanges for this law, grouped by section
 * 3. For each section, determine what text existed at target date
 * 4. Exclude sections that were created after target date
 * 5. Return complete law structure
 */
export async function getLawVersionAtDate(
  baseLawSfs: string,
  targetDate: Date
): Promise<LawVersionResult | null> {
  // Normalize the SFS number - ensure it HAS the "SFS " prefix for AmendmentDocument queries
  const normalizedSfs = baseLawSfs.startsWith('SFS ')
    ? baseLawSfs
    : `SFS ${baseLawSfs}`

  // Find the base law document
  const legalDocument = await prisma.legalDocument.findFirst({
    where: {
      document_number: { contains: normalizedSfs },
      content_type: 'SFS_LAW',
    },
    select: {
      id: true,
      title: true,
      document_number: true,
    },
  })

  if (!legalDocument) {
    return null
  }

  // Get all current sections
  const currentSections = await prisma.lawSection.findMany({
    where: { legal_document_id: legalDocument.id },
    orderBy: [{ chapter: 'asc' }, { section: 'asc' }],
  })

  // Get all amendments to this law with their section changes
  const amendments = await prisma.amendmentDocument.findMany({
    where: {
      base_law_sfs: normalizedSfs,
      effective_date: { not: null },
    },
    include: {
      section_changes: true,
    },
    orderBy: { effective_date: 'desc' },
  })

  // Build a map of section changes by section key
  const changesBySection = new Map<
    string,
    Array<{
      change: (typeof amendments)[0]['section_changes'][0]
      amendment: (typeof amendments)[0]
    }>
  >()

  for (const amendment of amendments) {
    for (const change of amendment.section_changes) {
      const key = `${change.chapter || ''}:${change.section}`
      if (!changesBySection.has(key)) {
        changesBySection.set(key, [])
      }
      changesBySection.get(key)!.push({ change, amendment })
    }
  }

  // Reconstruct each section
  const sections: SectionVersion[] = []
  let sectionsAddedLater = 0
  const hasGaps = false // TODO: Implement gap detection logic if needed

  for (const currentSection of currentSections) {
    const key = `${currentSection.chapter || ''}:${currentSection.section}`
    const changes = changesBySection.get(key) || []

    // Sort changes by effective date DESC
    changes.sort((a, b) => {
      const dateA = a.amendment.effective_date?.getTime() || 0
      const dateB = b.amendment.effective_date?.getTime() || 0
      return dateB - dateA
    })

    // Check if section was created after target date
    const creationChange = changes.find((c) => c.change.change_type === 'NEW')
    if (
      creationChange &&
      creationChange.amendment.effective_date &&
      creationChange.amendment.effective_date > targetDate
    ) {
      sectionsAddedLater++
      continue // Skip - section didn't exist yet
    }

    // Find all changes ON or BEFORE target date
    const changesBeforeDate = changes.filter(
      (c) =>
        c.amendment.effective_date && c.amendment.effective_date <= targetDate
    )

    // Check if section was REPEALED on or before target date
    // The most recent change determines the state - if it's REPEALED, section doesn't exist
    const mostRecentChange = changesBeforeDate[0] // Already sorted DESC
    if (
      mostRecentChange &&
      mostRecentChange.change.change_type === 'REPEALED'
    ) {
      // Section was repealed before target date - it doesn't exist in this version
      // But we still want to track that it was repealed for diff purposes
      sections.push({
        chapter: currentSection.chapter,
        section: currentSection.section,
        textContent: '',
        htmlContent: '',
        heading: currentSection.heading,
        source: { type: 'not_exists' },
        amendmentsApplied: changesBeforeDate.map((c) => ({
          sfsNumber: c.amendment.sfs_number,
          effectiveDate: c.amendment.effective_date!,
          changeType: c.change.change_type,
          hasText: c.change.new_text !== null && c.change.new_text.length > 0,
        })),
      })
      continue
    }

    // Build amendmentsApplied list (all amendments that affected this section up to target date)
    const amendmentsApplied = changesBeforeDate.map((c) => ({
      sfsNumber: c.amendment.sfs_number,
      effectiveDate: c.amendment.effective_date!,
      changeType: c.change.change_type,
      hasText: c.change.new_text !== null && c.change.new_text.length > 0,
    }))

    // Find the most recent change with text
    const relevantChangeWithText = changesBeforeDate.find(
      (c) => c.change.new_text
    )

    if (relevantChangeWithText) {
      sections.push({
        chapter: currentSection.chapter,
        section: currentSection.section,
        textContent: relevantChangeWithText.change.new_text!,
        htmlContent: '', // Historical versions don't have HTML
        heading: currentSection.heading,
        source: {
          type: 'amendment',
          sfsNumber: relevantChangeWithText.amendment.sfs_number,
          effectiveDate: relevantChangeWithText.amendment.effective_date!,
        },
        amendmentsApplied,
      })
    } else {
      // No changes with text before date - use current text
      // But track that amendments exist even if we don't have the text
      sections.push({
        chapter: currentSection.chapter,
        section: currentSection.section,
        textContent: currentSection.text_content,
        htmlContent: currentSection.html_content,
        heading: currentSection.heading,
        source: { type: 'current' },
        amendmentsApplied,
      })
    }
  }

  // Sort sections by chapter and section number
  sections.sort((a, b) => {
    const chapterA = a.chapter ? parseInt(a.chapter, 10) : 0
    const chapterB = b.chapter ? parseInt(b.chapter, 10) : 0
    if (chapterA !== chapterB) return chapterA - chapterB

    const sectionA = parseInt(a.section, 10)
    const sectionB = parseInt(b.section, 10)
    return sectionA - sectionB
  })

  // Find amendments between target date and now
  const amendmentsBetween = amendments
    .filter((a) => a.effective_date && a.effective_date > targetDate)
    .map((a) => ({
      sfsNumber: a.sfs_number,
      effectiveDate: a.effective_date!,
    }))

  return {
    baseLawSfs: legalDocument.document_number,
    asOfDate: targetDate,
    title: legalDocument.title,
    sections,
    meta: {
      currentSectionCount: currentSections.length,
      historicalSectionCount: sections.length,
      sectionsAddedLater,
      hasGaps,
      amendmentsBetween,
    },
  }
}

/**
 * Get the complete history of a specific section
 *
 * Returns all versions of this section from newest to oldest:
 * - Current version (from LawSection)
 * - All amendments that affected this section
 * - Original version (if available)
 */
export async function getSectionHistory(
  baseLawSfs: string,
  chapter: string | null,
  section: string
): Promise<SectionHistoryEntry[]> {
  const normalizedSfs = baseLawSfs.startsWith('SFS ')
    ? baseLawSfs
    : `SFS ${baseLawSfs}`
  const history: SectionHistoryEntry[] = []

  // Get current version from LawSection
  const legalDocument = await prisma.legalDocument.findFirst({
    where: {
      document_number: { contains: normalizedSfs },
      content_type: 'SFS_LAW',
    },
    select: { id: true },
  })

  if (legalDocument) {
    const currentSection = await prisma.lawSection.findFirst({
      where: {
        legal_document_id: legalDocument.id,
        chapter,
        section,
      },
    })

    if (currentSection) {
      history.push({
        effectiveDate: null, // Current - no specific date
        amendmentSfs: null,
        changeType: 'ORIGINAL', // Will be updated if we find amendments
        textContent: currentSection.text_content,
        isCurrent: true,
      })
    }
  }

  // Get all amendments affecting this section
  const sectionChanges = await prisma.sectionChange.findMany({
    where: {
      chapter,
      section,
      amendment: {
        base_law_sfs: normalizedSfs,
      },
    },
    include: {
      amendment: {
        select: {
          sfs_number: true,
          effective_date: true,
        },
      },
    },
    orderBy: {
      amendment: {
        effective_date: 'desc',
      },
    },
  })

  // Update the "current" entry to reference the most recent amendment
  const firstHistoryEntry = history[0]
  const firstChange = sectionChanges[0]
  if (firstHistoryEntry && firstHistoryEntry.isCurrent && firstChange) {
    firstHistoryEntry.amendmentSfs = firstChange.amendment.sfs_number
    firstHistoryEntry.effectiveDate = firstChange.amendment.effective_date
    firstHistoryEntry.changeType = firstChange.change_type
  }

  // Add each amendment to history
  for (const change of sectionChanges) {
    history.push({
      effectiveDate: change.amendment.effective_date,
      amendmentSfs: change.amendment.sfs_number,
      changeType: change.change_type,
      textContent: change.new_text,
      isCurrent: false,
    })
  }

  return history
}

/**
 * Get a timeline of all amendments to a law
 */
export async function getLawAmendmentTimeline(baseLawSfs: string): Promise<
  Array<{
    sfsNumber: string
    effectiveDate: Date | null
    title: string | null
    sectionCount: number
    changeTypes: {
      amended: number
      new: number
      repealed: number
      renumbered: number
    }
    storagePath: string | null
  }>
> {
  const normalizedSfs = baseLawSfs.startsWith('SFS ')
    ? baseLawSfs
    : `SFS ${baseLawSfs}`

  const amendments = await prisma.amendmentDocument.findMany({
    where: { base_law_sfs: normalizedSfs },
    include: {
      section_changes: true,
    },
  })

  // Sort with effective_date DESC, nulls at the end
  const sorted = amendments.sort((a, b) => {
    // Both have dates - sort descending
    if (a.effective_date && b.effective_date) {
      return b.effective_date.getTime() - a.effective_date.getTime()
    }
    // a has date, b doesn't - a comes first
    if (a.effective_date && !b.effective_date) return -1
    // b has date, a doesn't - b comes first
    if (!a.effective_date && b.effective_date) return 1
    // Neither has date - sort by SFS number descending (newer SFS numbers first)
    return b.sfs_number.localeCompare(a.sfs_number)
  })

  return sorted.map((a) => ({
    sfsNumber: a.sfs_number,
    effectiveDate: a.effective_date,
    title: a.title,
    sectionCount: a.section_changes.length,
    changeTypes: {
      amended: a.section_changes.filter((c) => c.change_type === 'AMENDED')
        .length,
      new: a.section_changes.filter((c) => c.change_type === 'NEW').length,
      repealed: a.section_changes.filter((c) => c.change_type === 'REPEALED')
        .length,
      renumbered: a.section_changes.filter(
        (c) => c.change_type === 'RENUMBERED'
      ).length,
    },
    storagePath: a.storage_path,
  }))
}

/**
 * Get available version dates for a law
 * Returns all dates where the law changed (amendment effective dates)
 */
export async function getAvailableVersionDates(
  baseLawSfs: string
): Promise<Date[]> {
  const normalizedSfs = baseLawSfs.startsWith('SFS ')
    ? baseLawSfs
    : `SFS ${baseLawSfs}`

  const amendments = await prisma.amendmentDocument.findMany({
    where: {
      base_law_sfs: normalizedSfs,
      effective_date: { not: null },
    },
    select: { effective_date: true },
    orderBy: { effective_date: 'desc' },
  })

  return amendments.map((a) => a.effective_date!).filter((d) => d !== null)
}
