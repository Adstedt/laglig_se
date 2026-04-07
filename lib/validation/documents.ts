import { z } from 'zod'
import { WorkspaceDocumentType, WorkspaceDocumentStatus } from '@prisma/client'

export { WorkspaceDocumentStatus, WorkspaceDocumentType }

export const createDocumentSchema = z.object({
  title: z.string().min(1, 'Titel krävs').max(255, 'Max 255 tecken'),
  documentType: z
    .nativeEnum(WorkspaceDocumentType)
    .default(WorkspaceDocumentType.OTHER),
  contentJson: z.any().optional(),
  templateId: z.string().uuid().optional().nullable(),
  documentNumber: z.string().max(50).optional().nullable(),
})

export const updateDocumentStatusSchema = z.object({
  documentId: z.string().uuid(),
  newStatus: z.nativeEnum(WorkspaceDocumentStatus),
  comment: z.string().max(500).optional(),
})

export const getWorkspaceDocumentsSchema = z.object({
  type: z.nativeEnum(WorkspaceDocumentType).optional(),
  status: z.nativeEnum(WorkspaceDocumentStatus).optional(),
  search: z.string().max(255).optional(),
  cursor: z.string().uuid().optional(),
  take: z.number().int().min(1).max(100).default(25),
  sortBy: z
    .enum(['title', 'updated_at', 'created_at', 'review_date'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentStatusInput = z.infer<
  typeof updateDocumentStatusSchema
>
export type GetWorkspaceDocumentsInput = z.infer<
  typeof getWorkspaceDocumentsSchema
>

export const updateDocumentMetadataSchema = z.object({
  documentId: z.string().uuid(),
  documentNumber: z.string().max(50).optional().nullable(),
  reviewDate: z.string().datetime().optional().nullable(),
  retentionUntil: z.string().datetime().optional().nullable(),
  documentType: z.nativeEnum(WorkspaceDocumentType).optional(),
})

export type UpdateDocumentMetadataInput = z.infer<
  typeof updateDocumentMetadataSchema
>

/**
 * Valid status transitions for WorkspaceDocumentStatus.
 * ARCHIVED is terminal — no transitions out.
 */
export const VALID_STATUS_TRANSITIONS: Record<
  WorkspaceDocumentStatus,
  WorkspaceDocumentStatus[]
> = {
  DRAFT: [WorkspaceDocumentStatus.IN_REVIEW, WorkspaceDocumentStatus.ARCHIVED],
  IN_REVIEW: [WorkspaceDocumentStatus.APPROVED, WorkspaceDocumentStatus.DRAFT],
  APPROVED: [
    WorkspaceDocumentStatus.SUPERSEDED,
    WorkspaceDocumentStatus.ARCHIVED,
  ],
  SUPERSEDED: [WorkspaceDocumentStatus.ARCHIVED],
  ARCHIVED: [],
}

export const importDocxDocumentSchema = z.object({
  title: z.string().min(1, 'Titel krävs').max(255, 'Max 255 tecken'),
  documentType: z
    .nativeEnum(WorkspaceDocumentType)
    .default(WorkspaceDocumentType.OTHER),
  documentNumber: z.string().max(50).optional().nullable(),
})

export type ImportDocxDocumentInput = z.infer<typeof importDocxDocumentSchema>

export function getValidNextStatuses(
  current: WorkspaceDocumentStatus
): WorkspaceDocumentStatus[] {
  return VALID_STATUS_TRANSITIONS[current]
}
