/**
 * Story 8.1: Change event utility types and functions
 * Extracted from server actions to avoid 'use server' constraints on sync exports.
 */

import type { ChangeType, ContentType } from '@prisma/client'

export type ChangePriority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface UnacknowledgedChange {
  id: string
  documentId: string
  documentTitle: string
  documentNumber: string
  contentType: ContentType
  changeType: ChangeType
  amendmentSfs: string | null
  aiSummary: string | null
  detectedAt: Date
  priority: ChangePriority
  /** The specific law list this change appears in (one row per change × list) */
  listId: string
  listName: string
  /** LawListItem ID — the entity that gets acknowledged in Story 8.3 */
  lawListItemId: string
}

/**
 * Derive priority from change_type per Epic 8 spec:
 * REPEAL=HIGH, AMENDMENT=MEDIUM, NEW_LAW=MEDIUM, METADATA_UPDATE=LOW
 */
export function derivePriority(changeType: ChangeType): ChangePriority {
  switch (changeType) {
    case 'REPEAL':
      return 'HIGH'
    case 'AMENDMENT':
    case 'NEW_LAW':
    case 'NEW_RULING':
      return 'MEDIUM'
    case 'METADATA_UPDATE':
      return 'LOW'
    default:
      return 'MEDIUM'
  }
}

/** Numeric priority for sorting (higher = more urgent) */
export function priorityWeight(priority: ChangePriority): number {
  switch (priority) {
    case 'HIGH':
      return 3
    case 'MEDIUM':
      return 2
    case 'LOW':
      return 1
  }
}
