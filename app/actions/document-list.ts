'use server'

/**
 * Story 4.11: Document List Server Actions
 * CRUD operations for document lists and list items with permission checks
 */

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import {
  CreateDocumentListSchema,
  UpdateDocumentListSchema,
  DeleteDocumentListSchema,
  AddDocumentToListSchema,
  RemoveDocumentFromListSchema,
  UpdateListItemSchema,
  ReorderListItemsSchema,
  SearchDocumentsSchema,
  GetDocumentListItemsSchema,
  BulkUpdateListItemsSchema,
  // Story 4.13: Group schemas
  CreateListGroupSchema,
  UpdateListGroupSchema,
  DeleteListGroupSchema,
  GetListGroupsSchema,
  MoveItemToGroupSchema,
  BulkMoveToGroupSchema,
  ReorderGroupsSchema,
  type CreateDocumentListInput,
  type UpdateDocumentListInput,
  type AddDocumentToListInput,
  type UpdateListItemInput,
  type ReorderListItemsInput,
  type SearchDocumentsInput,
  type GetDocumentListItemsInput,
  type BulkUpdateListItemsInput,
  // Story 4.13: Group types
  type CreateListGroupInput,
  type UpdateListGroupInput,
  type MoveItemToGroupInput,
  type BulkMoveToGroupInput,
  type ReorderGroupsInput,
} from '@/lib/validation/document-list'
import type {
  ContentType,
  LawListItemStatus,
  LawListItemPriority,
  ComplianceStatus,
} from '@prisma/client'
import { getContentTypeLabel } from '@/lib/utils/content-type'

// ============================================================================
// Types
// ============================================================================

export interface DocumentListSummary {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  itemCount: number
  createdAt: Date
  updatedAt: Date
}

export interface DocumentListItem {
  id: string
  position: number
  commentary: string | null
  status: LawListItemStatus
  priority: LawListItemPriority
  notes: string | null
  addedAt: Date
  dueDate: Date | null // Story 4.12
  assignee: {
    // Story 4.12
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  } | null
  // Story 4.13: Group information
  groupId: string | null
  groupName: string | null
  // Story 6.2: Compliance tracking fields
  complianceStatus: ComplianceStatus
  responsibleUser: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  } | null
  category: string | null
  document: {
    id: string
    title: string
    documentNumber: string
    contentType: ContentType
    slug: string
    summary: string | null
    effectiveDate: Date | null
    // Story 6.3 Performance: For instant modal display
    sourceUrl: string | null
    status: string
  }
}

export interface SearchResult {
  id: string
  title: string
  documentNumber: string
  contentType: ContentType
  slug: string
  summary: string | null
  alreadyInList: boolean
}

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// Internal update types for Prisma operations
interface LawListUpdateData {
  name?: string
  description?: string | null
  is_default?: boolean
}

interface LawListItemUpdateData {
  status?: LawListItemStatus
  priority?: LawListItemPriority
  notes?: string | null
  commentary?: string | null
  due_date?: Date | null // Story 4.12
  assigned_to?: string | null // Story 4.12
  group_id?: string | null // Story 4.13
  // Story 6.2: Compliance tracking
  compliance_status?: ComplianceStatus
  responsible_user_id?: string | null
}

// ============================================================================
// List CRUD Operations
// ============================================================================

/**
 * Get all document lists for the current workspace
 */
export async function getDocumentLists(): Promise<
  ActionResult<DocumentListSummary[]>
> {
  try {
    return await withWorkspace(async (ctx) => {
      const lists = await prisma.lawList.findMany({
        where: { workspace_id: ctx.workspaceId },
        include: {
          _count: { select: { items: true } },
        },
        orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
      })

      return {
        success: true,
        data: lists.map((list) => ({
          id: list.id,
          name: list.name,
          description: list.description,
          isDefault: list.is_default,
          itemCount: list._count.items,
          createdAt: list.created_at,
          updatedAt: list.updated_at,
        })),
      }
    }, 'read')
  } catch (error) {
    console.error('Error fetching document lists:', error)
    return { success: false, error: 'Kunde inte hämta dokumentlistor' }
  }
}

/**
 * Create a new document list
 */
export async function createDocumentList(
  input: CreateDocumentListInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = CreateDocumentListSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Use context workspaceId (input workspaceId is optional/ignored)
      const workspaceId = ctx.workspaceId

      // If setting as default, unset other defaults first
      if (parsed.data.isDefault) {
        await prisma.lawList.updateMany({
          where: { workspace_id: workspaceId, is_default: true },
          data: { is_default: false },
        })
      }

      const list = await prisma.lawList.create({
        data: {
          workspace_id: workspaceId,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          is_default: parsed.data.isDefault ?? false,
          created_by: ctx.userId,
        },
      })

      revalidatePath('/laglistor')
      return { success: true, data: { id: list.id } }
    }, 'lists:create')
  } catch (error) {
    console.error('Error creating document list:', error)
    return { success: false, error: 'Kunde inte skapa dokumentlista' }
  }
}

/**
 * Update a document list
 */
export async function updateDocumentList(
  input: UpdateDocumentListInput
): Promise<ActionResult> {
  try {
    const parsed = UpdateDocumentListSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify list belongs to workspace
      const list = await prisma.lawList.findFirst({
        where: {
          id: parsed.data.listId,
          workspace_id: ctx.workspaceId,
        },
      })

      if (!list) {
        return { success: false, error: 'Listan hittades inte' }
      }

      // If setting as default, unset other defaults first
      if (parsed.data.isDefault) {
        await prisma.lawList.updateMany({
          where: {
            workspace_id: ctx.workspaceId,
            is_default: true,
            id: { not: parsed.data.listId },
          },
          data: { is_default: false },
        })
      }

      // Build update data object, only including defined fields
      const updateData: LawListUpdateData = {}
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name
      if (parsed.data.description !== undefined)
        updateData.description = parsed.data.description
      if (parsed.data.isDefault !== undefined)
        updateData.is_default = parsed.data.isDefault

      await prisma.lawList.update({
        where: { id: parsed.data.listId },
        data: updateData,
      })

      revalidatePath('/laglistor')
      return { success: true }
    }, 'lists:create') // Using lists:create as there's no lists:update
  } catch (error) {
    console.error('Error updating document list:', error)
    return { success: false, error: 'Kunde inte uppdatera dokumentlista' }
  }
}

/**
 * Delete a document list
 */
export async function deleteDocumentList(
  listId: string
): Promise<ActionResult> {
  try {
    const parsed = DeleteDocumentListSchema.safeParse({ listId })
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      const list = await prisma.lawList.findFirst({
        where: {
          id: listId,
          workspace_id: ctx.workspaceId,
        },
      })

      if (!list) {
        return { success: false, error: 'Listan hittades inte' }
      }

      // Prevent deleting the default list
      if (list.is_default) {
        return { success: false, error: 'Standardlistan kan inte tas bort' }
      }

      await prisma.lawList.delete({
        where: { id: listId },
      })

      revalidatePath('/laglistor')
      return { success: true }
    }, 'lists:delete')
  } catch (error) {
    console.error('Error deleting document list:', error)
    return { success: false, error: 'Kunde inte ta bort dokumentlista' }
  }
}

// ============================================================================
// List Item Operations
// ============================================================================

/**
 * Get items in a document list with pagination and filtering
 */
export async function getDocumentListItems(
  input: GetDocumentListItemsInput
): Promise<
  ActionResult<{ items: DocumentListItem[]; total: number; hasMore: boolean }>
> {
  try {
    const parsed = GetDocumentListItemsSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    const { listId, page, limit, contentTypeFilter } = parsed.data
    const offset = (page - 1) * limit

    return await withWorkspace(async (ctx) => {
      // Verify list belongs to workspace
      const list = await prisma.lawList.findFirst({
        where: {
          id: listId,
          workspace_id: ctx.workspaceId,
        },
      })

      if (!list) {
        return { success: false, error: 'Listan hittades inte' }
      }

      // Build where clause
      const whereClause: {
        law_list_id: string
        document?: { content_type: { in: ContentType[] } }
      } = { law_list_id: listId }

      if (contentTypeFilter && contentTypeFilter.length > 0) {
        whereClause.document = { content_type: { in: contentTypeFilter } }
      }

      const [items, total] = await Promise.all([
        prisma.lawListItem.findMany({
          where: whereClause,
          include: {
            document: {
              select: {
                id: true,
                title: true,
                document_number: true,
                content_type: true,
                slug: true,
                summary: true,
                effective_date: true,
                // Story 6.3 Performance: Include for instant modal display
                source_url: true,
                status: true,
              },
            },
            // Story 4.12: Include assignee for table view
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar_url: true,
              },
            },
            // Story 4.13: Include group information
            group: {
              select: {
                id: true,
                name: true,
              },
            },
            // Story 6.2: Include responsible user for compliance view
            responsible_user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar_url: true,
              },
            },
          },
          orderBy: { position: 'asc' },
          skip: offset,
          take: limit + 1, // Fetch one extra to check hasMore
        }),
        prisma.lawListItem.count({ where: whereClause }),
      ])

      const hasMore = items.length > limit
      const itemsToReturn = hasMore ? items.slice(0, limit) : items

      return {
        success: true,
        data: {
          items: itemsToReturn.map((item) => ({
            id: item.id,
            position: item.position,
            commentary: item.commentary,
            status: item.status,
            priority: item.priority,
            notes: item.notes,
            addedAt: item.added_at,
            dueDate: item.due_date, // Story 4.12
            assignee: item.assignee
              ? {
                  // Story 4.12
                  id: item.assignee.id,
                  name: item.assignee.name,
                  email: item.assignee.email,
                  avatarUrl: item.assignee.avatar_url,
                }
              : null,
            // Story 4.13: Group information
            groupId: item.group?.id ?? null,
            groupName: item.group?.name ?? null,
            // Story 6.2: Compliance tracking fields
            complianceStatus: item.compliance_status,
            responsibleUser: item.responsible_user
              ? {
                  id: item.responsible_user.id,
                  name: item.responsible_user.name,
                  email: item.responsible_user.email,
                  avatarUrl: item.responsible_user.avatar_url,
                }
              : null,
            category: item.category,
            document: {
              id: item.document.id,
              title: item.document.title,
              documentNumber: item.document.document_number,
              contentType: item.document.content_type,
              slug: item.document.slug,
              summary: item.document.summary,
              effectiveDate: item.document.effective_date,
              sourceUrl: item.document.source_url,
              status: item.document.status,
            },
          })),
          total,
          hasMore,
        },
      }
    }, 'read')
  } catch (error) {
    console.error('Error fetching document list items:', error)
    return { success: false, error: 'Kunde inte hämta dokument' }
  }
}

/**
 * Add a document to a list
 */
export async function addDocumentToList(
  input: AddDocumentToListInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = AddDocumentToListSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify list belongs to workspace
      const list = await prisma.lawList.findFirst({
        where: {
          id: parsed.data.listId,
          workspace_id: ctx.workspaceId,
        },
      })

      if (!list) {
        return { success: false, error: 'Listan hittades inte' }
      }

      // Check if document exists
      const document = await prisma.legalDocument.findUnique({
        where: { id: parsed.data.documentId },
      })

      if (!document) {
        return { success: false, error: 'Dokumentet hittades inte' }
      }

      // Check if already in list
      const existing = await prisma.lawListItem.findUnique({
        where: {
          law_list_id_document_id: {
            law_list_id: parsed.data.listId,
            document_id: parsed.data.documentId,
          },
        },
      })

      if (existing) {
        return { success: false, error: 'Dokumentet finns redan i listan' }
      }

      // Get max position for new item
      const maxPositionItem = await prisma.lawListItem.findFirst({
        where: { law_list_id: parsed.data.listId },
        orderBy: { position: 'desc' },
        select: { position: true },
      })

      const newPosition = (maxPositionItem?.position ?? 0) + 1

      const item = await prisma.lawListItem.create({
        data: {
          law_list_id: parsed.data.listId,
          document_id: parsed.data.documentId,
          commentary: parsed.data.commentary ?? null,
          source: parsed.data.source ?? 'MANUAL',
          position: newPosition,
          added_by: ctx.userId,
        },
      })

      revalidatePath('/laglistor')
      return { success: true, data: { id: item.id } }
    }, 'documents:add')
  } catch (error) {
    console.error('Error adding document to list:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: `Kunde inte lägga till dokument: ${errorMessage}`,
    }
  }
}

/**
 * Remove a document from a list
 */
export async function removeDocumentFromList(
  listItemId: string
): Promise<ActionResult> {
  try {
    const parsed = RemoveDocumentFromListSchema.safeParse({ listItemId })
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify item belongs to workspace via list
      const item = await prisma.lawListItem.findFirst({
        where: { id: listItemId },
        include: { law_list: true },
      })

      if (!item || item.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Dokumentet hittades inte' }
      }

      await prisma.lawListItem.delete({
        where: { id: listItemId },
      })

      revalidatePath('/laglistor')
      return { success: true }
    }, 'documents:remove')
  } catch (error) {
    console.error('Error removing document from list:', error)
    return { success: false, error: 'Kunde inte ta bort dokument' }
  }
}

/**
 * Update a list item (status, priority, notes)
 */
export async function updateListItem(
  input: UpdateListItemInput
): Promise<ActionResult> {
  try {
    const parsed = UpdateListItemSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify item belongs to workspace
      const item = await prisma.lawListItem.findFirst({
        where: { id: parsed.data.listItemId },
        include: { law_list: true },
      })

      if (!item || item.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Dokumentet hittades inte' }
      }

      // Build update data object, only including defined fields
      const itemUpdateData: LawListItemUpdateData = {}
      if (parsed.data.status !== undefined)
        itemUpdateData.status = parsed.data.status
      if (parsed.data.priority !== undefined)
        itemUpdateData.priority = parsed.data.priority
      if (parsed.data.notes !== undefined)
        itemUpdateData.notes = parsed.data.notes
      if (parsed.data.commentary !== undefined)
        itemUpdateData.commentary = parsed.data.commentary
      // Story 4.12: Handle new fields
      if (parsed.data.dueDate !== undefined)
        itemUpdateData.due_date = parsed.data.dueDate
      if (parsed.data.assignedTo !== undefined)
        itemUpdateData.assigned_to = parsed.data.assignedTo
      // Story 4.13: Handle group assignment
      if (parsed.data.groupId !== undefined) {
        // If moving to a group, verify it belongs to the same list
        if (parsed.data.groupId) {
          const group = await prisma.lawListGroup.findFirst({
            where: {
              id: parsed.data.groupId,
              law_list_id: item.law_list_id,
            },
          })
          if (!group) {
            return {
              success: false,
              error: 'Gruppen hittades inte i denna lista',
            }
          }
        }
        itemUpdateData.group_id = parsed.data.groupId
      }
      // Story 6.2: Handle compliance fields
      if (parsed.data.complianceStatus !== undefined)
        itemUpdateData.compliance_status = parsed.data.complianceStatus
      if (parsed.data.responsibleUserId !== undefined)
        itemUpdateData.responsible_user_id = parsed.data.responsibleUserId

      await prisma.lawListItem.update({
        where: { id: parsed.data.listItemId },
        data: itemUpdateData,
      })

      revalidatePath('/laglistor')
      return { success: true }
    }, 'tasks:edit')
  } catch (error) {
    console.error('Error updating list item:', error)
    return { success: false, error: 'Kunde inte uppdatera dokument' }
  }
}

/**
 * Reorder items in a list (drag-and-drop)
 */
export async function reorderListItems(
  input: ReorderListItemsInput
): Promise<ActionResult> {
  try {
    const parsed = ReorderListItemsSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify list belongs to workspace
      const list = await prisma.lawList.findFirst({
        where: {
          id: parsed.data.listId,
          workspace_id: ctx.workspaceId,
        },
      })

      if (!list) {
        return { success: false, error: 'Listan hittades inte' }
      }

      // Bulk update positions
      await prisma.$transaction(
        parsed.data.items.map((item) =>
          prisma.lawListItem.update({
            where: { id: item.id },
            data: { position: item.position },
          })
        )
      )

      revalidatePath('/laglistor')
      return { success: true }
    }, 'tasks:edit')
  } catch (error) {
    console.error('Error reordering list items:', error)
    return { success: false, error: 'Kunde inte ändra ordning' }
  }
}

/**
 * Story 4.12: Bulk update multiple list items (for table view)
 */
export async function bulkUpdateListItems(
  input: BulkUpdateListItemsInput
): Promise<ActionResult<{ updated: number }>> {
  try {
    const parsed = BulkUpdateListItemsSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify list belongs to workspace
      const list = await prisma.lawList.findFirst({
        where: {
          id: parsed.data.listId,
          workspace_id: ctx.workspaceId,
        },
      })

      if (!list) {
        return { success: false, error: 'Listan hittades inte' }
      }

      // Verify all items belong to this list
      const items = await prisma.lawListItem.findMany({
        where: {
          id: { in: parsed.data.itemIds },
          law_list_id: parsed.data.listId,
        },
        select: { id: true },
      })

      if (items.length !== parsed.data.itemIds.length) {
        return { success: false, error: 'Några objekt hittades inte i listan' }
      }

      // Build update data
      const updateData: LawListItemUpdateData = {}
      if (parsed.data.updates.status !== undefined)
        updateData.status = parsed.data.updates.status
      if (parsed.data.updates.priority !== undefined)
        updateData.priority = parsed.data.updates.priority
      if (parsed.data.updates.dueDate !== undefined)
        updateData.due_date = parsed.data.updates.dueDate
      if (parsed.data.updates.assignedTo !== undefined)
        updateData.assigned_to = parsed.data.updates.assignedTo
      // Story 6.2: Compliance status and responsible person bulk update
      if (parsed.data.updates.complianceStatus !== undefined)
        updateData.compliance_status = parsed.data.updates.complianceStatus
      if (parsed.data.updates.responsibleUserId !== undefined)
        updateData.responsible_user_id = parsed.data.updates.responsibleUserId

      // Bulk update
      const result = await prisma.lawListItem.updateMany({
        where: {
          id: { in: parsed.data.itemIds },
          law_list_id: parsed.data.listId,
        },
        data: updateData,
      })

      revalidatePath('/laglistor')
      return { success: true, data: { updated: result.count } }
    }, 'tasks:edit')
  } catch (error) {
    console.error('Error bulk updating list items:', error)
    return { success: false, error: 'Kunde inte uppdatera objekt' }
  }
}

// ============================================================================
// Search
// ============================================================================

/**
 * Search legal documents for the add modal
 * Uses PostgreSQL full-text search for better performance at scale
 */
export async function searchLegalDocuments(
  input: SearchDocumentsInput
): Promise<ActionResult<{ results: SearchResult[]; total: number }>> {
  try {
    const parsed = SearchDocumentsSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    const { query, contentTypes, excludeListId, limit, offset } = parsed.data

    return await withWorkspace(async (ctx) => {
      // Build dynamic WHERE conditions for filters
      const conditions: string[] = ["status = 'ACTIVE'"]
      const params: unknown[] = [query]
      let paramIndex = 2

      if (contentTypes && contentTypes.length > 0) {
        conditions.push(`content_type::text = ANY($${paramIndex}::text[])`)
        params.push(contentTypes)
        paramIndex++
      }

      const whereClause = conditions.join(' AND ')

      // Use PostgreSQL full-text search with fallback to document_number ILIKE
      // This scales better for 10K+ documents than simple LIKE queries
      interface RawSearchResult {
        id: string
        title: string
        document_number: string
        content_type: ContentType
        slug: string
        summary: string | null
        rank: number
        total_count: bigint | number
      }

      const searchQuery = `
        WITH search_results AS (
          SELECT
            id,
            title,
            document_number,
            content_type,
            slug,
            summary,
            CASE
              WHEN search_vector @@ plainto_tsquery('pg_catalog.swedish', $1)
              THEN ts_rank_cd(search_vector, plainto_tsquery('pg_catalog.swedish', $1))
              ELSE 0.0
            END AS rank
          FROM legal_documents
          WHERE ${whereClause}
            AND (
              search_vector @@ plainto_tsquery('pg_catalog.swedish', $1)
              OR document_number ILIKE '%' || $1 || '%'
            )
        )
        SELECT *, COUNT(*) OVER() AS total_count
        FROM search_results
        ORDER BY rank DESC, title ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `

      const documents = await prisma.$queryRawUnsafe<RawSearchResult[]>(
        searchQuery,
        ...params
      )

      const total = documents[0] ? Number(documents[0].total_count) : 0

      // Check which documents are already in the list
      let existingDocIds: Set<string> = new Set()
      if (excludeListId) {
        // Verify list belongs to workspace first
        const list = await prisma.lawList.findFirst({
          where: { id: excludeListId, workspace_id: ctx.workspaceId },
        })

        if (list) {
          const existingItems = await prisma.lawListItem.findMany({
            where: {
              law_list_id: excludeListId,
              document_id: { in: documents.map((d) => d.id) },
            },
            select: { document_id: true },
          })
          existingDocIds = new Set(existingItems.map((i) => i.document_id))
        }
      }

      return {
        success: true,
        data: {
          results: documents.map((doc) => ({
            id: doc.id,
            title: doc.title,
            documentNumber: doc.document_number,
            contentType: doc.content_type,
            slug: doc.slug,
            summary: doc.summary ? doc.summary.substring(0, 100) + '...' : null,
            alreadyInList: existingDocIds.has(doc.id),
          })),
          total,
        },
      }
    }, 'read')
  } catch (error) {
    console.error('Error searching documents:', error)
    return { success: false, error: 'Sökningen misslyckades' }
  }
}

// ============================================================================
// Export
// ============================================================================

/**
 * Get export data for a document list (used by client-side CSV generation)
 */
export async function getExportData(listId: string): Promise<
  ActionResult<{
    listName: string
    items: Array<{
      title: string
      documentNumber: string
      contentType: string
      status: string
      priority: string
      commentary: string | null
    }>
  }>
> {
  try {
    return await withWorkspace(async (ctx) => {
      const list = await prisma.lawList.findFirst({
        where: {
          id: listId,
          workspace_id: ctx.workspaceId,
        },
        include: {
          items: {
            include: {
              document: {
                select: {
                  title: true,
                  document_number: true,
                  content_type: true,
                },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
      })

      if (!list) {
        return { success: false, error: 'Listan hittades inte' }
      }

      return {
        success: true,
        data: {
          listName: list.name,
          items: list.items.map((item) => ({
            title: item.document.title,
            documentNumber: item.document.document_number,
            contentType: getContentTypeLabel(item.document.content_type),
            status: item.status,
            priority: item.priority,
            commentary: item.commentary,
          })),
        },
      }
    }, 'read')
  } catch (error) {
    console.error('Error getting export data:', error)
    return { success: false, error: 'Kunde inte exportera listan' }
  }
}

// ============================================================================
// Workspace Members (for assignee selector)
// ============================================================================

/**
 * Story 4.12: Get workspace members for assignee dropdown
 */
export interface WorkspaceMemberOption {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

export async function getWorkspaceMembers(): Promise<
  ActionResult<WorkspaceMemberOption[]>
> {
  try {
    return await withWorkspace(async (ctx) => {
      const members = await prisma.workspaceMember.findMany({
        where: { workspace_id: ctx.workspaceId },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar_url: true,
            },
          },
        },
        orderBy: { joined_at: 'asc' },
      })

      return {
        success: true,
        data: members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatar_url,
        })),
      }
    }, 'read')
  } catch (error) {
    console.error('Error fetching workspace members:', error)
    return { success: false, error: 'Kunde inte hämta medlemmar' }
  }
}

// ============================================================================
// Default List Helper
// ============================================================================

/**
 * Get or create the default document list for the current workspace
 */
export async function getOrCreateDefaultList(): Promise<
  ActionResult<{ id: string; name: string }>
> {
  try {
    return await withWorkspace(async (ctx) => {
      // Try to find existing default list
      let list = await prisma.lawList.findFirst({
        where: {
          workspace_id: ctx.workspaceId,
          is_default: true,
        },
      })

      // If no default list, find any list
      if (!list) {
        list = await prisma.lawList.findFirst({
          where: { workspace_id: ctx.workspaceId },
          orderBy: { created_at: 'asc' },
        })
      }

      // If still no list, create one
      if (!list) {
        list = await prisma.lawList.create({
          data: {
            workspace_id: ctx.workspaceId,
            name: 'Huvudlista',
            is_default: true,
            created_by: ctx.userId,
          },
        })
      }

      return {
        success: true,
        data: { id: list.id, name: list.name },
      }
    }, 'read')
  } catch (error) {
    console.error('Error getting default list:', error)
    return { success: false, error: 'Kunde inte hämta standardlista' }
  }
}

// ============================================================================
// Story 4.13: Group Management
// ============================================================================

/**
 * Group summary type for UI
 */
export interface ListGroupSummary {
  id: string
  name: string
  position: number
  itemCount: number
  createdAt: Date
}

/**
 * Create a new group within a law list
 */
export async function createListGroup(
  input: CreateListGroupInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = CreateListGroupSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify list belongs to workspace
      const list = await prisma.lawList.findFirst({
        where: {
          id: parsed.data.listId,
          workspace_id: ctx.workspaceId,
        },
      })

      if (!list) {
        return { success: false, error: 'Listan hittades inte' }
      }

      // Check for duplicate group name in this list
      const existingGroup = await prisma.lawListGroup.findFirst({
        where: {
          law_list_id: parsed.data.listId,
          name: parsed.data.name,
        },
      })

      if (existingGroup) {
        return { success: false, error: 'En grupp med det namnet finns redan' }
      }

      // Get max position for new group
      const maxPositionGroup = await prisma.lawListGroup.findFirst({
        where: { law_list_id: parsed.data.listId },
        orderBy: { position: 'desc' },
        select: { position: true },
      })

      const newPosition = (maxPositionGroup?.position ?? 0) + 1

      const group = await prisma.lawListGroup.create({
        data: {
          law_list_id: parsed.data.listId,
          name: parsed.data.name,
          position: newPosition,
        },
      })

      revalidatePath('/laglistor')
      return { success: true, data: { id: group.id } }
    }, 'lists:create')
  } catch (error) {
    console.error('Error creating list group:', error)
    return { success: false, error: 'Kunde inte skapa grupp' }
  }
}

/**
 * Update an existing group (name or position)
 */
export async function updateListGroup(
  input: UpdateListGroupInput
): Promise<ActionResult> {
  try {
    const parsed = UpdateListGroupSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify group belongs to workspace via list
      const group = await prisma.lawListGroup.findFirst({
        where: { id: parsed.data.groupId },
        include: { law_list: true },
      })

      if (!group || group.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Gruppen hittades inte' }
      }

      // Check for duplicate name if changing name
      if (parsed.data.name && parsed.data.name !== group.name) {
        const existingGroup = await prisma.lawListGroup.findFirst({
          where: {
            law_list_id: group.law_list_id,
            name: parsed.data.name,
            id: { not: parsed.data.groupId },
          },
        })

        if (existingGroup) {
          return {
            success: false,
            error: 'En grupp med det namnet finns redan',
          }
        }
      }

      // Build update data
      const updateData: { name?: string; position?: number } = {}
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name
      if (parsed.data.position !== undefined)
        updateData.position = parsed.data.position

      await prisma.lawListGroup.update({
        where: { id: parsed.data.groupId },
        data: updateData,
      })

      revalidatePath('/laglistor')
      return { success: true }
    }, 'lists:create')
  } catch (error) {
    console.error('Error updating list group:', error)
    return { success: false, error: 'Kunde inte uppdatera grupp' }
  }
}

/**
 * Delete a group - items move to ungrouped (group_id = null)
 */
export async function deleteListGroup(groupId: string): Promise<ActionResult> {
  try {
    const parsed = DeleteListGroupSchema.safeParse({ groupId })
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify group belongs to workspace
      const group = await prisma.lawListGroup.findFirst({
        where: { id: groupId },
        include: { law_list: true },
      })

      if (!group || group.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Gruppen hittades inte' }
      }

      // Delete group (items will have group_id set to null due to onDelete: SetNull)
      await prisma.lawListGroup.delete({
        where: { id: groupId },
      })

      revalidatePath('/laglistor')
      return { success: true }
    }, 'lists:delete')
  } catch (error) {
    console.error('Error deleting list group:', error)
    return { success: false, error: 'Kunde inte ta bort grupp' }
  }
}

/**
 * Get all groups for a list with item counts
 */
export async function getListGroups(
  listId: string
): Promise<ActionResult<ListGroupSummary[]>> {
  try {
    const parsed = GetListGroupsSchema.safeParse({ listId })
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify list belongs to workspace
      const list = await prisma.lawList.findFirst({
        where: {
          id: listId,
          workspace_id: ctx.workspaceId,
        },
      })

      if (!list) {
        return { success: false, error: 'Listan hittades inte' }
      }

      const groups = await prisma.lawListGroup.findMany({
        where: { law_list_id: listId },
        include: {
          _count: { select: { items: true } },
        },
        orderBy: { position: 'asc' },
      })

      return {
        success: true,
        data: groups.map((group) => ({
          id: group.id,
          name: group.name,
          position: group.position,
          itemCount: group._count.items,
          createdAt: group.created_at,
        })),
      }
    }, 'read')
  } catch (error) {
    console.error('Error fetching list groups:', error)
    return { success: false, error: 'Kunde inte hämta grupper' }
  }
}

/**
 * Move an item to a group (or null for ungrouped)
 */
export async function moveItemToGroup(
  input: MoveItemToGroupInput
): Promise<ActionResult> {
  try {
    const parsed = MoveItemToGroupSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify item belongs to workspace
      const item = await prisma.lawListItem.findFirst({
        where: { id: parsed.data.listItemId },
        include: { law_list: true },
      })

      if (!item || item.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Dokumentet hittades inte' }
      }

      // If moving to a group, verify it belongs to the same list
      if (parsed.data.groupId) {
        const group = await prisma.lawListGroup.findFirst({
          where: {
            id: parsed.data.groupId,
            law_list_id: item.law_list_id,
          },
        })

        if (!group) {
          return {
            success: false,
            error: 'Gruppen hittades inte i denna lista',
          }
        }
      }

      await prisma.lawListItem.update({
        where: { id: parsed.data.listItemId },
        data: { group_id: parsed.data.groupId },
      })

      revalidatePath('/laglistor')
      return { success: true }
    }, 'tasks:edit')
  } catch (error) {
    console.error('Error moving item to group:', error)
    return { success: false, error: 'Kunde inte flytta dokument' }
  }
}

/**
 * Bulk move items to a group (for drag-and-drop or multi-select)
 */
export async function bulkMoveToGroup(
  input: BulkMoveToGroupInput
): Promise<ActionResult<{ moved: number }>> {
  try {
    const parsed = BulkMoveToGroupSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify list belongs to workspace
      const list = await prisma.lawList.findFirst({
        where: {
          id: parsed.data.listId,
          workspace_id: ctx.workspaceId,
        },
      })

      if (!list) {
        return { success: false, error: 'Listan hittades inte' }
      }

      // If moving to a group, verify it belongs to the same list
      if (parsed.data.groupId) {
        const group = await prisma.lawListGroup.findFirst({
          where: {
            id: parsed.data.groupId,
            law_list_id: parsed.data.listId,
          },
        })

        if (!group) {
          return {
            success: false,
            error: 'Gruppen hittades inte i denna lista',
          }
        }
      }

      // Verify all items belong to this list
      const items = await prisma.lawListItem.findMany({
        where: {
          id: { in: parsed.data.itemIds },
          law_list_id: parsed.data.listId,
        },
        select: { id: true },
      })

      if (items.length !== parsed.data.itemIds.length) {
        return { success: false, error: 'Några objekt hittades inte i listan' }
      }

      // Bulk update
      const result = await prisma.lawListItem.updateMany({
        where: {
          id: { in: parsed.data.itemIds },
          law_list_id: parsed.data.listId,
        },
        data: { group_id: parsed.data.groupId },
      })

      revalidatePath('/laglistor')
      return { success: true, data: { moved: result.count } }
    }, 'tasks:edit')
  } catch (error) {
    console.error('Error bulk moving items to group:', error)
    return { success: false, error: 'Kunde inte flytta dokument' }
  }
}

/**
 * Reorder groups within a list (drag-and-drop)
 */
export async function reorderGroups(
  input: ReorderGroupsInput
): Promise<ActionResult> {
  try {
    const parsed = ReorderGroupsSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify list belongs to workspace
      const list = await prisma.lawList.findFirst({
        where: {
          id: parsed.data.listId,
          workspace_id: ctx.workspaceId,
        },
      })

      if (!list) {
        return { success: false, error: 'Listan hittades inte' }
      }

      // Bulk update positions
      await prisma.$transaction(
        parsed.data.groups.map((group) =>
          prisma.lawListGroup.update({
            where: { id: group.id },
            data: { position: group.position },
          })
        )
      )

      revalidatePath('/laglistor')
      return { success: true }
    }, 'lists:create')
  } catch (error) {
    console.error('Error reordering groups:', error)
    return { success: false, error: 'Kunde inte ändra ordning på grupper' }
  }
}
