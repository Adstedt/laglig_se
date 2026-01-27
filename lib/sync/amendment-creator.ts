/**
 * Amendment Record Creator
 *
 * Creates Amendment records when changes are detected in SFS laws.
 * Links amendments to DocumentVersions and extracts affected sections.
 *
 * Story 2.11 - Task 6: Create Amendment Records from Detected Changes
 */

import type { Prisma, Amendment } from '@prisma/client'
import { AmendmentDetectedMethod } from '@prisma/client'
import {
  findChangedSections,
  parseTransitionalProvisions,
} from './section-parser'

// ============================================================================
// Types
// ============================================================================

export interface CreateAmendmentParams {
  baseDocumentId: string
  amendmentSfs: string // "SFS 2025:732"
  fullText: string // New law text to extract sections from
  detectedFromVersionId?: string // Link to the DocumentVersion
}

// Transaction client type for Prisma interactive transactions
type TransactionClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ============================================================================
// Amendment Creation
// ============================================================================

/**
 * Create an Amendment record for a detected change
 *
 * This is called when we detect that a law has been updated with a new amendment.
 * The amendment law itself (e.g., "Lag (2025:732) om ändring...") doesn't exist
 * as a separate document in Riksdagen API, so amending_document_id is NULL.
 *
 * @param tx Prisma transaction client
 * @param params Amendment creation parameters
 * @returns The created Amendment record or null if already exists
 */
export async function createAmendmentFromChange(
  tx: TransactionClient,
  params: CreateAmendmentParams
): Promise<Amendment | null> {
  const { baseDocumentId, amendmentSfs, fullText, detectedFromVersionId } =
    params

  // Check if this amendment already exists for this base document
  const existing = await tx.amendment.findFirst({
    where: {
      base_document_id: baseDocumentId,
      amending_law_title: { contains: amendmentSfs.replace('SFS ', '') },
    },
  })

  if (existing) {
    return null // Already recorded
  }

  // Extract which sections were modified by this amendment
  const changedSections = findChangedSections(fullText, amendmentSfs)

  // Try to parse effective date from transitional provisions
  const effectiveDates = parseTransitionalProvisions(fullText)
  const effectiveDate = effectiveDates.get(amendmentSfs) || null

  // Build create data conditionally to handle exactOptionalPropertyTypes
  const createData: {
    base_document_id: string
    amending_document_id: null
    amending_law_title: string
    publication_date: null
    effective_date: Date | null
    affected_sections_raw?: string
    affected_sections?: {
      amended: string[]
      repealed: string[]
      new: string[]
      renumbered: string[]
    }
    detected_method: typeof AmendmentDetectedMethod.RIKSDAGEN_TEXT_PARSING
    detected_from_version_id?: string
    summary: null
  } = {
    base_document_id: baseDocumentId,
    amending_document_id: null,
    amending_law_title: `Lag (${amendmentSfs.replace('SFS ', '')})`,
    publication_date: null,
    effective_date: effectiveDate,
    detected_method: AmendmentDetectedMethod.RIKSDAGEN_TEXT_PARSING,
    summary: null,
  }

  if (changedSections.length > 0) {
    createData.affected_sections_raw = changedSections.join(', ')
    createData.affected_sections = {
      amended: changedSections,
      repealed: [],
      new: [],
      renumbered: [],
    }
  }

  if (detectedFromVersionId) {
    createData.detected_from_version_id = detectedFromVersionId
  }

  // Create the Amendment record
  const amendment = await tx.amendment.create({
    data: createData,
  })

  return amendment
}

/**
 * Extract all amendments from a law's full text
 *
 * Used during backfill to create Amendment records for all historical
 * amendments found in the law text.
 *
 * @param tx Prisma transaction client
 * @param baseDocumentId The law's document ID
 * @param fullText The law's full text
 * @param detectedFromVersionId Optional link to the version
 * @returns Array of created Amendment records
 */
export async function extractAllAmendments(
  tx: TransactionClient,
  baseDocumentId: string,
  fullText: string,
  detectedFromVersionId?: string
): Promise<Amendment[]> {
  const amendments: Amendment[] = []

  // Extract all SFS references and group sections by them
  const pattern = /Lag\s*\((\d{4}:\d+)\)/g
  const sfsSet = new Set<string>()

  for (const match of fullText.matchAll(pattern)) {
    sfsSet.add(`SFS ${match[1]}`)
  }

  // Parse effective dates once
  const effectiveDates = parseTransitionalProvisions(fullText)

  // Create Amendment for each unique SFS number
  for (const sfsNumber of sfsSet) {
    // Check if already exists
    const existing = await tx.amendment.findFirst({
      where: {
        base_document_id: baseDocumentId,
        amending_law_title: { contains: sfsNumber.replace('SFS ', '') },
      },
    })

    if (existing) continue

    // Find sections modified by this amendment
    const changedSections = findChangedSections(fullText, sfsNumber)
    const effectiveDate = effectiveDates.get(sfsNumber) || null

    // Build create data conditionally
    const createData: {
      base_document_id: string
      amending_document_id: null
      amending_law_title: string
      publication_date: null
      effective_date: Date | null
      affected_sections_raw?: string
      affected_sections?: {
        amended: string[]
        repealed: string[]
        new: string[]
        renumbered: string[]
      }
      detected_method: typeof AmendmentDetectedMethod.RIKSDAGEN_TEXT_PARSING
      detected_from_version_id?: string
      summary: null
    } = {
      base_document_id: baseDocumentId,
      amending_document_id: null,
      amending_law_title: `Lag (${sfsNumber.replace('SFS ', '')})`,
      publication_date: null,
      effective_date: effectiveDate,
      detected_method: AmendmentDetectedMethod.RIKSDAGEN_TEXT_PARSING,
      summary: null,
    }

    if (changedSections.length > 0) {
      createData.affected_sections_raw = changedSections.join(', ')
      createData.affected_sections = {
        amended: changedSections,
        repealed: [],
        new: [],
        renumbered: [],
      }
    }

    if (detectedFromVersionId) {
      createData.detected_from_version_id = detectedFromVersionId
    }

    const amendment = await tx.amendment.create({
      data: createData,
    })

    amendments.push(amendment)
  }

  return amendments
}

/**
 * Count amendments for a document
 *
 * @param tx Prisma transaction client
 * @param baseDocumentId The law's document ID
 * @returns Number of amendments
 */
export async function countAmendments(
  tx: TransactionClient,
  baseDocumentId: string
): Promise<number> {
  return tx.amendment.count({
    where: { base_document_id: baseDocumentId },
  })
}

/**
 * Get all amendments for a document
 *
 * @param tx Prisma transaction client
 * @param baseDocumentId The law's document ID
 * @returns Array of amendments ordered by effective_date
 */
export async function getAmendments(
  tx: TransactionClient,
  baseDocumentId: string
): Promise<Amendment[]> {
  return tx.amendment.findMany({
    where: { base_document_id: baseDocumentId },
    orderBy: { effective_date: 'desc' },
  })
}

/**
 * Link a detected amendment to a DocumentVersion
 *
 * @param tx Prisma transaction client
 * @param amendmentId The amendment ID to update
 * @param versionId The DocumentVersion ID to link
 */
export async function linkAmendmentToVersion(
  tx: TransactionClient,
  amendmentId: string,
  versionId: string
): Promise<void> {
  await tx.amendment.update({
    where: { id: amendmentId },
    data: { detected_from_version_id: versionId },
  })
}
