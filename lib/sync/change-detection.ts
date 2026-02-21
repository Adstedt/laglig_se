/**
 * Change Detection
 *
 * Detects and records changes between versions of legal documents.
 * Uses the `diff` library to compute text differences.
 *
 * Story 2.11 - Task 4: Implement Change Detection
 */

import * as Diff from 'diff'
import type { Prisma, ChangeEvent, ContentType } from '@prisma/client'
import { ChangeType } from '@prisma/client'
import { findChangedSections } from './section-parser'

// ============================================================================
// Types
// ============================================================================

export interface DetectChangesParams {
  documentId: string
  contentType: ContentType
  oldFullText: string
  newFullText: string
  amendmentSfs: string | null // "SFS 2025:732"
  previousVersionId?: string | null
  newVersionId?: string | null
}

export interface DiffResult {
  added: number // Lines added
  removed: number // Lines removed
  unchanged: number // Lines unchanged
  changes: Diff.Change[]
  summary: string // Human-readable summary
}

// Transaction client type for Prisma interactive transactions
type TransactionClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ============================================================================
// Diff Generation
// ============================================================================

/**
 * Compute line-by-line diff between two texts
 *
 * @param oldText Original text
 * @param newText New text
 * @returns DiffResult with statistics and changes
 */
export function computeDiff(oldText: string, newText: string): DiffResult {
  const changes = Diff.diffLines(oldText, newText)

  let added = 0
  let removed = 0
  let unchanged = 0

  for (const change of changes) {
    const lineCount = (change.value.match(/\n/g) || []).length || 1
    if (change.added) {
      added += lineCount
    } else if (change.removed) {
      removed += lineCount
    } else {
      unchanged += lineCount
    }
  }

  // Generate summary
  const summary = generateDiffSummary(added, removed, unchanged)

  return { added, removed, unchanged, changes, summary }
}

/**
 * Generate a human-readable summary of changes
 */
function generateDiffSummary(
  added: number,
  removed: number,
  unchanged: number
): string {
  const parts: string[] = []

  if (added > 0) {
    parts.push(`+${added} lines`)
  }
  if (removed > 0) {
    parts.push(`-${removed} lines`)
  }

  if (parts.length === 0) {
    return 'No text changes detected'
  }

  const total = added + removed + unchanged
  const changePercent =
    total > 0 ? (((added + removed) / total) * 100).toFixed(1) : '0'

  return `${parts.join(', ')} (${changePercent}% changed)`
}

/**
 * Generate a unified diff string (like git diff)
 *
 * @param oldText Original text
 * @param newText New text
 * @param contextLines Number of context lines around changes (default 3)
 * @returns Unified diff string
 */
export function generateUnifiedDiff(
  oldText: string,
  newText: string,
  contextLines: number = 3
): string {
  return Diff.createPatch('document', oldText, newText, 'old', 'new', {
    context: contextLines,
  })
}

/**
 * Check if two texts are semantically different
 * Ignores whitespace differences
 */
export function hasSubstantiveChanges(
  oldText: string,
  newText: string
): boolean {
  // Normalize whitespace for comparison
  const normalizedOld = oldText.replace(/\s+/g, ' ').trim()
  const normalizedNew = newText.replace(/\s+/g, ' ').trim()

  return normalizedOld !== normalizedNew
}

// ============================================================================
// Change Event Creation
// ============================================================================

/**
 * Detect changes and create a ChangeEvent record
 *
 * @param tx Prisma transaction client
 * @param params Change detection parameters
 * @returns The created ChangeEvent or null if no changes
 */
export async function detectChanges(
  tx: TransactionClient,
  params: DetectChangesParams
): Promise<ChangeEvent | null> {
  const {
    documentId,
    contentType,
    oldFullText,
    newFullText,
    amendmentSfs,
    previousVersionId,
    newVersionId,
  } = params

  // Check if there are actual changes
  if (!hasSubstantiveChanges(oldFullText, newFullText)) {
    return null
  }

  // Compute diff for statistics (not stored but useful for logging)
  computeDiff(oldFullText, newFullText)

  // Find changed sections if this is an amendment
  const changedSections = amendmentSfs
    ? findChangedSections(newFullText, amendmentSfs)
    : []

  // Generate unified diff for storage (truncated to prevent huge records)
  const unifiedDiff = generateUnifiedDiff(oldFullText, newFullText)
  const truncatedDiff =
    unifiedDiff.length > 50000
      ? unifiedDiff.substring(0, 50000) + '\n... [truncated]'
      : unifiedDiff

  // Build create data object conditionally to handle exactOptionalPropertyTypes
  const createData: {
    document_id: string
    content_type: ContentType
    change_type: typeof ChangeType.AMENDMENT
    amendment_sfs: string | null
    previous_version_id?: string | null
    new_version_id?: string | null
    diff_summary: string
    changed_sections?: string[]
    ai_summary: null
    ai_summary_generated_at: null
  } = {
    document_id: documentId,
    content_type: contentType,
    change_type: ChangeType.AMENDMENT,
    amendment_sfs: amendmentSfs,
    diff_summary: truncatedDiff,
    ai_summary: null,
    ai_summary_generated_at: null,
  }

  if (previousVersionId !== undefined) {
    createData.previous_version_id = previousVersionId
  }
  if (newVersionId !== undefined) {
    createData.new_version_id = newVersionId
  }
  if (changedSections.length > 0) {
    createData.changed_sections = changedSections
  }

  // Create ChangeEvent
  const changeEvent = await tx.changeEvent.create({
    data: createData,
  })

  // Story 8.16: Set change tracking fields on the base document
  await tx.legalDocument.update({
    where: { id: documentId },
    data: {
      last_change_type: ChangeType.AMENDMENT,
      last_change_ref: amendmentSfs,
      last_change_at: new Date(),
    },
  })

  return changeEvent
}

/**
 * Create a ChangeEvent for a new law (no previous version)
 *
 * @param tx Prisma transaction client
 * @param documentId The new document's ID
 * @param contentType The content type
 * @returns The created ChangeEvent
 */
export async function createNewLawEvent(
  tx: TransactionClient,
  documentId: string,
  contentType: ContentType
): Promise<ChangeEvent> {
  const changeEvent = await tx.changeEvent.create({
    data: {
      document_id: documentId,
      content_type: contentType,
      change_type: ChangeType.NEW_LAW,
    },
  })

  // Story 8.16: Set change tracking fields on the base document
  await tx.legalDocument.update({
    where: { id: documentId },
    data: {
      last_change_type: ChangeType.NEW_LAW,
      last_change_ref: null,
      last_change_at: new Date(),
    },
  })

  return changeEvent
}

/**
 * Create a ChangeEvent for a repealed law
 *
 * @param tx Prisma transaction client
 * @param documentId The repealed document's ID
 * @param contentType The content type
 * @param repealedBySfs The SFS number that repealed this law
 * @returns The created ChangeEvent
 */
export async function createRepealEvent(
  tx: TransactionClient,
  documentId: string,
  contentType: ContentType,
  repealedBySfs: string | null
): Promise<ChangeEvent> {
  const changeEvent = await tx.changeEvent.create({
    data: {
      document_id: documentId,
      content_type: contentType,
      change_type: ChangeType.REPEAL,
      amendment_sfs: repealedBySfs,
    },
  })

  // Story 8.16: Set change tracking fields on the base document
  await tx.legalDocument.update({
    where: { id: documentId },
    data: {
      last_change_type: ChangeType.REPEAL,
      last_change_ref: repealedBySfs,
      last_change_at: new Date(),
    },
  })

  return changeEvent
}

/**
 * Create a ChangeEvent for a new court ruling
 *
 * @param tx Prisma transaction client
 * @param documentId The new ruling's document ID
 * @param contentType The court type (COURT_CASE_AD, COURT_CASE_HD, etc.)
 * @returns The created ChangeEvent
 */
export async function createNewRulingEvent(
  tx: TransactionClient,
  documentId: string,
  contentType: ContentType
): Promise<ChangeEvent> {
  const changeEvent = await tx.changeEvent.create({
    data: {
      document_id: documentId,
      content_type: contentType,
      change_type: ChangeType.NEW_RULING,
    },
  })

  // Story 8.16: Set change tracking fields on the base document
  await tx.legalDocument.update({
    where: { id: documentId },
    data: {
      last_change_type: ChangeType.NEW_RULING,
      last_change_ref: null,
      last_change_at: new Date(),
    },
  })

  return changeEvent
}

// ============================================================================
// Change Query Functions
// ============================================================================

/**
 * Get pending changes that need AI summarization
 *
 * @param tx Prisma transaction client
 * @param limit Maximum number of changes to return
 * @returns Array of ChangeEvents needing AI summary
 */
export async function getPendingAiSummaries(
  tx: TransactionClient,
  limit: number = 10
): Promise<ChangeEvent[]> {
  return tx.changeEvent.findMany({
    where: {
      ai_summary: null,
      change_type: {
        in: [ChangeType.AMENDMENT, ChangeType.REPEAL],
      },
    },
    orderBy: { detected_at: 'asc' },
    take: limit,
  })
}

/**
 * Get recent changes for a document
 *
 * @param tx Prisma transaction client
 * @param documentId The document UUID
 * @param limit Maximum number of changes to return
 * @returns Array of ChangeEvents
 */
export async function getDocumentChanges(
  tx: TransactionClient,
  documentId: string,
  limit: number = 10
): Promise<ChangeEvent[]> {
  return tx.changeEvent.findMany({
    where: { document_id: documentId },
    orderBy: { detected_at: 'desc' },
    take: limit,
  })
}

/**
 * Get changes by date range
 *
 * @param tx Prisma transaction client
 * @param from Start date
 * @param to End date
 * @returns Array of ChangeEvents in the date range
 */
export async function getChangesByDateRange(
  tx: TransactionClient,
  from: Date,
  to: Date
): Promise<ChangeEvent[]> {
  return tx.changeEvent.findMany({
    where: {
      detected_at: {
        gte: from,
        lte: to,
      },
    },
    orderBy: { detected_at: 'desc' },
  })
}
