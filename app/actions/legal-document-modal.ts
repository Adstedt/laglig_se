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
    fullText: string | null
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
  mimeType: string
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
 * Fetch detailed list item data for the modal
 */
export async function getListItemDetails(
  listItemId: string
): Promise<ActionResult<ListItemDetails>> {
  try {
    return await withWorkspace(async (ctx) => {
      const item = await prisma.lawListItem.findFirst({
        where: { id: listItemId },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              document_number: true,
              full_text: true,
              html_content: true,
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
        return { success: false, error: 'Laglistpost hittades inte' }
      }

      // Verify workspace access
      if (item.law_list.workspace_id !== ctx.workspaceId) {
        return { success: false, error: 'Åtkomst nekad' }
      }

      return {
        success: true,
        data: {
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
            fullText: item.document.full_text,
            htmlContent: item.document.html_content,
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
        },
      }
    }, 'read')
  } catch (error) {
    console.error('Error fetching list item details:', error)
    return { success: false, error: 'Kunde inte hämta information' }
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

      revalidatePath('/laglistor')
      return { success: true }
    }, 'tasks:edit')
  } catch (error) {
    console.error('Error updating responsible person:', error)
    return { success: false, error: 'Kunde inte uppdatera ansvarig' }
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
          take: 10,
        })

        const completed = tasks.filter((t) => t.column.is_done).length

        return {
          success: true,
          data: {
            completed,
            total: tasks.length,
            tasks: tasks.slice(0, 5).map((t) => ({
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

      // Try to fetch evidence - graceful fallback if Evidence model doesn't exist
      try {
        const evidence = await prisma.evidence.findMany({
          where: {
            task: {
              list_item_links: { some: { law_list_item_id: listItemId } },
            },
          },
          select: {
            id: true,
            filename: true,
            mime_type: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' },
          take: 10,
        })

        return {
          success: true,
          data: evidence.map((e) => ({
            id: e.id,
            filename: e.filename,
            mimeType: e.mime_type,
            createdAt: e.created_at,
          })),
        }
      } catch (evidenceError) {
        // Table doesn't exist - graceful fallback
        if (
          evidenceError instanceof Error &&
          evidenceError.message.includes('does not exist')
        ) {
          return { success: true, data: null }
        }
        throw evidenceError
      }
    }, 'read')
  } catch (error) {
    console.error('Error fetching evidence for list item:', error)
    return { success: true, data: null } // Graceful fallback
  }
}
