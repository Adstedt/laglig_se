/** Story 21.4 — cycle-creation-wizard shared types. */

import type { AuditType } from '@prisma/client'

/**
 * Step-1 metadata shape — maps 1:1 to `createCycle`'s input (minus scope).
 */
export interface CycleMetadata {
  name: string
  lawListId: string
  auditType: AuditType
  scheduledStart: string // YYYY-MM-DD (HTML date input native format)
  scheduledEnd: string
  lawChangeCutoffDate: string
  leadAuditorUserId: string
  description?: string
}

export type CycleMetadataErrors = Partial<Record<keyof CycleMetadata, string>>
