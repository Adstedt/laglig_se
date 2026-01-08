/**
 * Story 4.11: Zod Validation Schemas for Document List Operations
 * Server Action input validation
 */

import { z } from 'zod'

// ============================================================================
// ENUMS - Match Prisma schema
// ============================================================================

export const ContentTypeEnum = z.enum([
  'SFS_LAW',
  'SFS_AMENDMENT',
  'COURT_CASE_AD',
  'COURT_CASE_HD',
  'COURT_CASE_HOVR',
  'COURT_CASE_HFD',
  'COURT_CASE_MOD',
  'COURT_CASE_MIG',
  'EU_REGULATION',
  'EU_DIRECTIVE',
])

export const LawListItemStatusEnum = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'REVIEW',
  'COMPLIANT',
])

export const LawListItemPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH'])

export const LawListItemSourceEnum = z.enum(['ONBOARDING', 'MANUAL', 'IMPORT'])

// Story 6.2: Compliance status enum (Swedish labels in UI)
export const ComplianceStatusEnum = z.enum([
  'EJ_PABORJAD',
  'PAGAENDE',
  'UPPFYLLD',
  'EJ_UPPFYLLD',
  'EJ_TILLAMPLIG',
])

export const ExportFormatEnum = z.enum(['csv', 'pdf'])

// ============================================================================
// DOCUMENT LIST SCHEMAS
// ============================================================================

/**
 * Create a new document list
 * Note: workspaceId is ignored - the server action will use the session context
 */
export const CreateDocumentListSchema = z.object({
  workspaceId: z.string().optional(), // Ignored - context is used
  name: z
    .string()
    .min(1, 'Namn krävs')
    .max(100, 'Namnet får vara max 100 tecken'),
  description: z
    .string()
    .max(500, 'Beskrivningen får vara max 500 tecken')
    .optional(),
  isDefault: z.boolean().optional(),
})

export type CreateDocumentListInput = z.infer<typeof CreateDocumentListSchema>

/**
 * Update an existing document list
 */
export const UpdateDocumentListSchema = z.object({
  listId: z.string().uuid('Ogiltigt list-ID'),
  name: z
    .string()
    .min(1, 'Namn krävs')
    .max(100, 'Namnet får vara max 100 tecken')
    .optional(),
  description: z
    .string()
    .max(500, 'Beskrivningen får vara max 500 tecken')
    .nullable()
    .optional(),
  isDefault: z.boolean().optional(),
})

export type UpdateDocumentListInput = z.infer<typeof UpdateDocumentListSchema>

/**
 * Delete a document list
 */
export const DeleteDocumentListSchema = z.object({
  listId: z.string().uuid('Ogiltigt list-ID'),
})

export type DeleteDocumentListInput = z.infer<typeof DeleteDocumentListSchema>

// ============================================================================
// LIST ITEM SCHEMAS
// ============================================================================

/**
 * Add a document to a list
 */
export const AddDocumentToListSchema = z.object({
  listId: z.string().uuid('Ogiltigt list-ID'),
  documentId: z.string().uuid('Ogiltigt dokument-ID'),
  commentary: z
    .string()
    .max(1000, 'Kommentaren får vara max 1000 tecken')
    .optional(),
  source: LawListItemSourceEnum.optional(),
})

export type AddDocumentToListInput = z.infer<typeof AddDocumentToListSchema>

/**
 * Remove a document from a list
 */
export const RemoveDocumentFromListSchema = z.object({
  listItemId: z.string().uuid('Ogiltigt list-item-ID'),
})

export type RemoveDocumentFromListInput = z.infer<
  typeof RemoveDocumentFromListSchema
>

/**
 * Update a list item (status, priority, notes, due_date, assigned_to, group_id)
 * Story 4.12: Added dueDate and assignedTo for table view
 * Story 4.13: Added groupId for group assignment
 * Story 6.2: Added complianceStatus and responsibleUserId for compliance view
 */
export const UpdateListItemSchema = z.object({
  listItemId: z.string().uuid('Ogiltigt list-item-ID'),
  status: LawListItemStatusEnum.optional(),
  priority: LawListItemPriorityEnum.optional(),
  notes: z
    .string()
    .max(10000, 'Anteckningarna får vara max 10000 tecken')
    .nullable()
    .optional(),
  commentary: z
    .string()
    .max(1000, 'Kommentaren får vara max 1000 tecken')
    .nullable()
    .optional(),
  dueDate: z.date().nullable().optional(), // Story 4.12: Review deadline
  assignedTo: z.string().uuid('Ogiltigt användar-ID').nullable().optional(), // Story 4.12: Assignee
  groupId: z.string().uuid('Ogiltigt grupp-ID').nullable().optional(), // Story 4.13: Group assignment
  // Story 6.2: Compliance tracking
  complianceStatus: ComplianceStatusEnum.optional(),
  responsibleUserId: z
    .string()
    .uuid('Ogiltigt användar-ID')
    .nullable()
    .optional(),
})

export type UpdateListItemInput = z.infer<typeof UpdateListItemSchema>

/**
 * Story 4.12: Bulk update multiple list items (status, priority, etc.)
 * Story 6.2: Added complianceStatus and responsibleUserId for bulk compliance updates
 */
export const BulkUpdateListItemsSchema = z.object({
  listId: z.string().uuid('Ogiltigt list-ID'),
  itemIds: z
    .array(z.string().uuid('Ogiltigt item-ID'))
    .min(1, 'Minst ett objekt krävs'),
  updates: z.object({
    status: LawListItemStatusEnum.optional(),
    priority: LawListItemPriorityEnum.optional(),
    dueDate: z.date().nullable().optional(),
    assignedTo: z.string().uuid('Ogiltigt användar-ID').nullable().optional(),
    complianceStatus: ComplianceStatusEnum.optional(), // Story 6.2
    responsibleUserId: z
      .string()
      .uuid('Ogiltigt användar-ID')
      .nullable()
      .optional(), // Story 6.2
  }),
})

export type BulkUpdateListItemsInput = z.infer<typeof BulkUpdateListItemsSchema>

/**
 * Reorder items in a list (drag-and-drop)
 */
export const ReorderListItemsSchema = z.object({
  listId: z.string().uuid('Ogiltigt list-ID'),
  items: z
    .array(
      z.object({
        id: z.string().uuid('Ogiltigt item-ID'),
        position: z.number().min(0, 'Position måste vara positiv'),
      })
    )
    .min(1, 'Minst ett objekt krävs'),
})

export type ReorderListItemsInput = z.infer<typeof ReorderListItemsSchema>

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Search legal documents for add modal
 */
export const SearchDocumentsSchema = z.object({
  query: z
    .string()
    .min(1, 'Sökterm krävs')
    .max(200, 'Söktermen får vara max 200 tecken'),
  contentTypes: z.array(ContentTypeEnum).optional(),
  excludeListId: z.string().uuid().optional(), // Exclude docs already in this list
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

export type SearchDocumentsInput = z.infer<typeof SearchDocumentsSchema>

// ============================================================================
// QUERY SCHEMAS
// ============================================================================

/**
 * Get document lists for a workspace
 */
export const GetDocumentListsSchema = z.object({
  workspaceId: z.string().uuid('Ogiltigt workspace-ID'),
})

export type GetDocumentListsInput = z.infer<typeof GetDocumentListsSchema>

/**
 * Get items in a document list
 */
export const GetDocumentListItemsSchema = z.object({
  listId: z.string().uuid('Ogiltigt list-ID'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
  contentTypeFilter: z.array(ContentTypeEnum).optional(),
})

export type GetDocumentListItemsInput = z.infer<
  typeof GetDocumentListItemsSchema
>

// ============================================================================
// EXPORT SCHEMAS
// ============================================================================

/**
 * Export a document list
 */
export const ExportDocumentListSchema = z.object({
  listId: z.string().uuid('Ogiltigt list-ID'),
  format: ExportFormatEnum,
})

export type ExportDocumentListInput = z.infer<typeof ExportDocumentListSchema>

// ============================================================================
// CONTENT TYPE GROUP FILTER
// ============================================================================

export const ContentTypeGroupEnum = z.enum([
  'all',
  'laws',
  'amendments',
  'courtCases',
  'euDocuments',
])

export type ContentTypeGroup = z.infer<typeof ContentTypeGroupEnum>

// ============================================================================
// STORY 4.13: GROUP SCHEMAS
// ============================================================================

/**
 * Create a new group within a law list
 */
export const CreateListGroupSchema = z.object({
  listId: z.string().uuid('Ogiltigt list-ID'),
  name: z
    .string()
    .min(1, 'Gruppnamn krävs')
    .max(50, 'Gruppnamnet får vara max 50 tecken'),
})

export type CreateListGroupInput = z.infer<typeof CreateListGroupSchema>

/**
 * Update an existing group
 */
export const UpdateListGroupSchema = z.object({
  groupId: z.string().uuid('Ogiltigt grupp-ID'),
  name: z
    .string()
    .min(1, 'Gruppnamn krävs')
    .max(50, 'Gruppnamnet får vara max 50 tecken')
    .optional(),
  position: z.number().min(0, 'Position måste vara positiv').optional(),
})

export type UpdateListGroupInput = z.infer<typeof UpdateListGroupSchema>

/**
 * Delete a group (items move to ungrouped)
 */
export const DeleteListGroupSchema = z.object({
  groupId: z.string().uuid('Ogiltigt grupp-ID'),
})

export type DeleteListGroupInput = z.infer<typeof DeleteListGroupSchema>

/**
 * Get groups for a list
 */
export const GetListGroupsSchema = z.object({
  listId: z.string().uuid('Ogiltigt list-ID'),
})

export type GetListGroupsInput = z.infer<typeof GetListGroupsSchema>

/**
 * Move item to a group (or null for ungrouped)
 */
export const MoveItemToGroupSchema = z.object({
  listItemId: z.string().uuid('Ogiltigt item-ID'),
  groupId: z.string().uuid('Ogiltigt grupp-ID').nullable(),
})

export type MoveItemToGroupInput = z.infer<typeof MoveItemToGroupSchema>

/**
 * Bulk move items to a group
 */
export const BulkMoveToGroupSchema = z.object({
  listId: z.string().uuid('Ogiltigt list-ID'),
  itemIds: z
    .array(z.string().uuid('Ogiltigt item-ID'))
    .min(1, 'Minst ett objekt krävs'),
  groupId: z.string().uuid('Ogiltigt grupp-ID').nullable(),
})

export type BulkMoveToGroupInput = z.infer<typeof BulkMoveToGroupSchema>

/**
 * Reorder groups within a list
 */
export const ReorderGroupsSchema = z.object({
  listId: z.string().uuid('Ogiltigt list-ID'),
  groups: z
    .array(
      z.object({
        id: z.string().uuid('Ogiltigt grupp-ID'),
        position: z.number().min(0, 'Position måste vara positiv'),
      })
    )
    .min(1, 'Minst en grupp krävs'),
})

export type ReorderGroupsInput = z.infer<typeof ReorderGroupsSchema>
