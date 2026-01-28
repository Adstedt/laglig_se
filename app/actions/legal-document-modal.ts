'use server'

/**
 * Story 6.3: Legal Document Modal Server Actions
 * Data fetching and mutations for the legal document modal
 */

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { z } from 'zod'
import type { ComplianceStatus } from '@prisma/client'
import { redis } from '@/lib/cache/redis'
import { getCachedDocument } from '@/lib/services/document-cache'
// REMOVED: getCachedDocumentContent - using only Redis via getCachedDocument

// ============================================================================
// Types
// ============================================================================

export interface ListItemDetails {
  id: string
  position: number
  complianceStatus: ComplianceStatus
  businessContext: string | null
  aiCommentary: string | null
  category: string | null
  addedAt: Date
  updatedAt: Date
  dueDate: Date | null
  legalDocument: {
    id: string
    title: string
    documentNumber: string
    htmlContent: string | null
    summary: string | null
    slug: string
    status: string
    sourceUrl: string | null
    contentType: string
    effectiveDate: Date | null
  }
  lawList: {
    id: string
    name: string
  }
  responsibleUser: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  } | null
}

export interface TaskSummary {
  id: string
  title: string
  columnName: string
  columnColor: string | null
  isDone: boolean
  assignee: {
    name: string | null
    avatarUrl: string | null
  } | null
}

export interface TaskProgress {
  completed: number
  total: number
  tasks: TaskSummary[]
}

export interface EvidenceSummary {
  id: string
  filename: string
  mimeType: string | null // Nullable for folders (Story 6.7b)
  createdAt: Date
}

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// Schemas
// ============================================================================

const UpdateBusinessContextSchema = z.object({
  listItemId: z.string().uuid(),
  content: z.string().max(10000),
})

const UpdateComplianceStatusSchema = z.object({
  listItemId: z.string().uuid(),
  status: z.enum([
    'EJ_PABORJAD',
    'PAGAENDE',
    'UPPFYLLD',
    'EJ_UPPFYLLD',
    'EJ_TILLAMPLIG',
  ]),
})

const UpdateResponsibleSchema = z.object({
  listItemId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
})

// ============================================================================
// Get List Item Details
// ============================================================================

/**
 * Internal function to fetch list item details from database
 */
async function fetchListItemDetailsInternal(
  listItemId: string,
  workspaceId: string
): Promise<ListItemDetails | null> {
  // Try Redis cache first (shared across all workspaces for the same item)
  const cacheKey = `list-item-details:${listItemId}`
  // Cache check for key: ${cacheKey}

  try {
    const cached = await redis.get(cacheKey)

    if (cached) {
      // Handle both JSON string and object (Upstash may auto-parse)
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
      // Check workspace match

      // Verify workspace access on cached data
      if (parsed.law_list?.workspace_id === workspaceId) {
        // Cache HIT - workspace matches

        // Get HTML content from centralized document cache
        const cachedDoc = await getCachedDocument(parsed.document.id)
        const htmlContent = cachedDoc?.htmlContent || null

        // Transform to expected format
        return {
          id: parsed.id,
          position: parsed.position,
          complianceStatus: parsed.compliance_status,
          businessContext: parsed.business_context,
          aiCommentary: parsed.ai_commentary,
          category: parsed.category,
          addedAt: new Date(parsed.added_at),
          updatedAt: new Date(parsed.updated_at),
          dueDate: parsed.due_date ? new Date(parsed.due_date) : null,
          legalDocument: {
            id: parsed.document.id,
            title: parsed.document.title,
            documentNumber: parsed.document.document_number,
            htmlContent: htmlContent, // From centralized cache
            summary: parsed.document.summary,
            slug: parsed.document.slug,
            status: parsed.document.status,
            sourceUrl: parsed.document.source_url,
            contentType: parsed.document.content_type,
            effectiveDate: parsed.document.effective_date
              ? new Date(parsed.document.effective_date)
              : null,
          },
          lawList: {
            id: parsed.law_list.id,
            name: parsed.law_list.name,
          },
          responsibleUser: parsed.responsible_user
            ? {
                id: parsed.responsible_user.id,
                name: parsed.responsible_user.name,
                email: parsed.responsible_user.email,
                avatarUrl: parsed.responsible_user.avatar_url,
              }
            : null,
        }
      }
    }
  } catch {
    // Cache read error - will fetch from database
  }

  // Fetch from database
  // Cache miss - fetch from database
  const item = await prisma.lawListItem.findFirst({
    where: { id: listItemId },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          document_number: true,
          // Don't fetch content here - use centralized cache
          summary: true,
          slug: true,
          status: true,
          source_url: true,
          content_type: true,
          effective_date: true,
        },
      },

      law_list: {
        select: {
          id: true,
          name: true,
          workspace_id: true,
        },
      },
      responsible_user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar_url: true,
        },
      },
    },
  })

  if (!item) {
    return null
  }

  // Verify workspace access

  // Verify workspace access
  if (item.law_list.workspace_id !== workspaceId) {
    return null
  }

  // Get HTML content from centralized cache (shared across all users/views)
  const cachedDoc = await getCachedDocument(item.document.id)
  const htmlContent = cachedDoc?.htmlContent || null

  // Cache the item for future requests (1 hour TTL)
  // Note: We cache the item WITHOUT the HTML content to save space
  // The HTML is cached separately in the document cache
  try {
    const cacheData = JSON.stringify({
      ...item,
      document: {
        ...item.document,
        html_content: null, // Don't duplicate HTML in item cache
      },
    })
    await redis.set(cacheKey, cacheData, { ex: 3600 })
  } catch {
    // Cache write error - non-critical
  }

  return {
    id: item.id,
    position: item.position,
    complianceStatus: item.compliance_status,
    businessContext: item.business_context,
    aiCommentary: item.ai_commentary,
    category: item.category,
    addedAt: item.added_at,
    updatedAt: item.updated_at,
    dueDate: item.due_date,
    legalDocument: {
      id: item.document.id,
      title: item.document.title,
      documentNumber: item.document.document_number,
      htmlContent: htmlContent, // From centralized cache
      summary: item.document.summary,
      slug: item.document.slug,
      status: item.document.status,
      sourceUrl: item.document.source_url,
      contentType: item.document.content_type,
      effectiveDate: item.document.effective_date,
    },
    lawList: {
      id: item.law_list.id,
      name: item.law_list.name,
    },
    responsibleUser: item.responsible_user
      ? {
          id: item.responsible_user.id,
          name: item.responsible_user.name,
          email: item.responsible_user.email,
          avatarUrl: item.responsible_user.avatar_url,
        }
      : null,
  }
}

/**
 * Export function to get list item details with workspace validation
 * This is the missing function that was causing the application to crash
 */
export async function getListItemDetails(
  listItemId: string
): Promise<ActionResult<ListItemDetails>> {
  try {
    return await withWorkspace(async (ctx) => {
      const result = await fetchListItemDetailsInternal(
        listItemId,
        ctx.workspaceId
      )

      if (!result) {
        return {
          success: false,
          error: 'List item not found or access denied',
        }
      }

      return {
        success: true,
        data: result,
      }
    }, 'read')
  } catch {
    return {
      success: false,
      error: 'Failed to fetch list item details',
    }
  }
}

// ============================================================================
// Update Business Context
// ============================================================================

/**
 * Update the business context for a list item
 */
export async function updateListItemBusinessContext(
  listItemId: string,
  content: string
): Promise<ActionResult> {
  try {
    const parsed = UpdateBusinessContextSchema.safeParse({
      listItemId,
      content,
    })
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify item belongs to workspace
      const item = await prisma.lawListItem.findFirst({
        where: { id: listItemId },
        include: { law_list: { select: { workspace_id: true } } },
      })

      if (!item || item.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Laglistpost hittades inte' }
      }

      await prisma.lawListItem.update({
        where: { id: listItemId },
        data: { business_context: content || null },
      })

      // Invalidate Redis cache for this list item
      try {
        await redis.del(`list-item-details:${listItemId}`)
      } catch {
        // Cache invalidation error - non-critical
      }

      revalidatePath('/laglistor')
      return { success: true }
    }, 'tasks:edit')
  } catch (error) {
    console.error('Error updating business context:', error)
    return { success: false, error: 'Kunde inte spara' }
  }
}

// ============================================================================
// Update Compliance Status
// ============================================================================

/**
 * Update the compliance status for a list item
 */
export async function updateListItemComplianceStatus(
  listItemId: string,
  status: ComplianceStatus
): Promise<ActionResult> {
  try {
    const parsed = UpdateComplianceStatusSchema.safeParse({
      listItemId,
      status,
    })
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify item belongs to workspace
      const item = await prisma.lawListItem.findFirst({
        where: { id: listItemId },
        include: { law_list: { select: { workspace_id: true } } },
      })

      if (!item || item.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Laglistpost hittades inte' }
      }

      await prisma.lawListItem.update({
        where: { id: listItemId },
        data: { compliance_status: status },
      })

      // Invalidate Redis cache for this list item
      try {
        await redis.del(`list-item-details:${listItemId}`)
      } catch {
        // Cache invalidation error - non-critical
      }

      revalidatePath('/laglistor')
      return { success: true }
    }, 'tasks:edit')
  } catch (error) {
    console.error('Error updating compliance status:', error)
    return { success: false, error: 'Kunde inte uppdatera status' }
  }
}

// ============================================================================
// Update Responsible Person
// ============================================================================

/**
 * Update the responsible person for a list item
 */
export async function updateListItemResponsible(
  listItemId: string,
  userId: string | null
): Promise<ActionResult> {
  try {
    const parsed = UpdateResponsibleSchema.safeParse({ listItemId, userId })
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
      }
    }

    return await withWorkspace(async (ctx) => {
      // Verify item belongs to workspace
      const item = await prisma.lawListItem.findFirst({
        where: { id: listItemId },
        include: { law_list: { select: { workspace_id: true } } },
      })

      if (!item || item.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Laglistpost hittades inte' }
      }

      // If userId is provided, verify user is a workspace member
      if (userId) {
        const member = await prisma.workspaceMember.findFirst({
          where: {
            workspace_id: ctx.workspaceId,
            user_id: userId,
          },
        })

        if (!member) {
          return {
            success: false,
            error: 'Användaren är inte medlem i arbetsytan',
          }
        }
      }

      await prisma.lawListItem.update({
        where: { id: listItemId },
        data: { responsible_user_id: userId },
      })

      // Invalidate Redis cache for this list item
      try {
        await redis.del(`list-item-details:${listItemId}`)
      } catch {
        // Cache invalidation error - non-critical
      }

      revalidatePath('/laglistor')
      return { success: true }
    }, 'tasks:edit')
  } catch (error) {
    console.error('Error updating responsible person:', error)
    return { success: false, error: 'Kunde inte uppdatera ansvarig' }
  }
}

// ============================================================================
// Get Document Content (Separate for performance)
// ============================================================================

/**
 * Fetch the full HTML and text content of a document
 * This is separated from getListItemDetails for performance
 * as these fields can be megabytes for large laws
 *
 * Story P.1: Now uses Redis caching with 24-hour TTL to improve performance
 */
export async function getDocumentContent(
  documentId: string
): Promise<ActionResult<{ htmlContent: string | null }>> {
  try {
    // Use the new caching strategy for document content
    const cachedDoc = await getCachedDocument(documentId)

    if (!cachedDoc) {
      return {
        success: false,
        error: 'Document not found',
      }
    }

    return {
      success: true,
      data: { htmlContent: cachedDoc.htmlContent },
    }
  } catch (error) {
    console.error('Error fetching document content:', error)
    return {
      success: false,
      error: 'Kunde inte ladda dokumentinnehåll',
    }
  }
}

// ============================================================================
// Get Tasks for List Item (with graceful fallback)
// ============================================================================

/**
 * Get tasks linked to a list item
 * Returns null if Task model doesn't exist (graceful fallback)
 */
export async function getTasksForListItem(
  listItemId: string
): Promise<ActionResult<TaskProgress | null>> {
  try {
    return await withWorkspace(async (ctx) => {
      // Verify item belongs to workspace
      const item = await prisma.lawListItem.findFirst({
        where: { id: listItemId },
        include: { law_list: { select: { workspace_id: true } } },
      })

      if (!item || item.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Laglistpost hittades inte' }
      }

      // Try to fetch tasks - graceful fallback if Task model doesn't exist
      // Story 6.15: Removed limits to show all linked tasks in accordion
      try {
        const tasks = await prisma.task.findMany({
          where: {
            list_item_links: { some: { law_list_item_id: listItemId } },
          },
          include: {
            column: { select: { name: true, color: true, is_done: true } },
            assignee: { select: { name: true, avatar_url: true } },
          },
          orderBy: { position: 'asc' },
        })

        const completed = tasks.filter((t) => t.column.is_done).length

        return {
          success: true,
          data: {
            completed,
            total: tasks.length,
            tasks: tasks.map((t) => ({
              id: t.id,
              title: t.title,
              columnName: t.column.name,
              columnColor: t.column.color,
              isDone: t.column.is_done,
              assignee: t.assignee
                ? {
                    name: t.assignee.name,
                    avatarUrl: t.assignee.avatar_url,
                  }
                : null,
            })),
          },
        }
      } catch (taskError) {
        // Table doesn't exist - graceful fallback
        if (
          taskError instanceof Error &&
          taskError.message.includes('does not exist')
        ) {
          return { success: true, data: null }
        }
        throw taskError
      }
    }, 'read')
  } catch (error) {
    console.error('Error fetching tasks for list item:', error)
    return { success: true, data: null } // Graceful fallback
  }
}

// ============================================================================
// Get Evidence for List Item (with graceful fallback)
// ============================================================================

/**
 * Get evidence attached to tasks linked to a list item
 * Returns null if Evidence model doesn't exist (graceful fallback)
 */
export async function getEvidenceForListItem(
  listItemId: string
): Promise<ActionResult<EvidenceSummary[] | null>> {
  try {
    return await withWorkspace(async (ctx) => {
      // Verify item belongs to workspace
      const item = await prisma.lawListItem.findFirst({
        where: { id: listItemId },
        include: { law_list: { select: { workspace_id: true } } },
      })

      if (!item || item.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Laglistpost hittades inte' }
      }

      // Story 6.7a: Fetch files linked to this list item via file_list_item_links
      const fileLinks = await prisma.fileListItemLink.findMany({
        where: { list_item_id: listItemId },
        include: {
          file: {
            select: {
              id: true,
              filename: true,
              mime_type: true,
              created_at: true,
            },
          },
        },
        orderBy: { linked_at: 'desc' },
        take: 10,
      })

      return {
        success: true,
        data: fileLinks.map((link) => ({
          id: link.file.id,
          filename: link.file.filename,
          mimeType: link.file.mime_type,
          createdAt: link.file.created_at,
        })),
      }
    }, 'read')
  } catch (error) {
    console.error('Error fetching evidence for list item:', error)
    return { success: true, data: null } // Graceful fallback
  }
}
