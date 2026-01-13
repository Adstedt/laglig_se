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
 * Internal function to fetch list item details from database
 */
async function fetchListItemDetailsInternal(
  listItemId: string,
  workspaceId: string
): Promise<ListItemDetails | null> {
  const funcStart = Date.now()
  console.log(`   📌 [Internal] Starting fetchListItemDetailsInternal`)
  
  // Try Redis cache first (shared across all workspaces for the same item)
  const cacheKey = `list-item-details:${listItemId}`
  console.log(`   📌 [Internal +${Date.now() - funcStart}ms] Checking cache for key: ${cacheKey}`)
  console.log(`      Session workspace ID: ${workspaceId}`)
  
  try {
    const cacheCheckStart = Date.now()
    const cached = await redis.get(cacheKey)
    console.log(`   📌 [Internal +${Date.now() - funcStart}ms] Cache check took ${Date.now() - cacheCheckStart}ms`)
    console.log(`   Cache result type: ${typeof cached}`)
    console.log(`   Cache result is null? ${cached === null}`)
    
    if (cached) {
      // Handle both JSON string and object (Upstash may auto-parse)
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
      console.log(`   Cached item workspace: ${parsed.law_list?.workspace_id}`)
      console.log(`   Workspace match? ${parsed.law_list?.workspace_id === workspaceId}`)
      
      // Verify workspace access on cached data
      if (parsed.law_list?.workspace_id === workspaceId) {
        console.log(`   📌 [Internal +${Date.now() - funcStart}ms] ⚡ Cache HIT! Workspace matches`)
        
        // Get HTML content from centralized document cache
        const docFetchStart = Date.now()
        console.log(`   📌 [Internal +${Date.now() - funcStart}ms] Getting document HTML from cache...`)
        const cachedDoc = await getCachedDocument(parsed.document.id)
        console.log(`   📌 [Internal +${Date.now() - funcStart}ms] Document fetch took ${Date.now() - docFetchStart}ms`)
        const htmlContent = cachedDoc?.htmlContent || null
        console.log(`   📌 [Internal +${Date.now() - funcStart}ms] Has HTML content? ${!!htmlContent}`)
        
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
            fullText: null,
            htmlContent: htmlContent, // From centralized cache
            summary: parsed.document.summary,
            slug: parsed.document.slug,
            status: parsed.document.status,
            sourceUrl: parsed.document.source_url,
            contentType: parsed.document.content_type,
            effectiveDate: parsed.document.effective_date ? new Date(parsed.document.effective_date) : null,
          },
          lawList: {
            id: parsed.law_list.id,
            name: parsed.law_list.name,
          },
          responsibleUser: parsed.responsible_user ? {
            id: parsed.responsible_user.id,
            name: parsed.responsible_user.name,
            email: parsed.responsible_user.email,
            avatarUrl: parsed.responsible_user.avatar_url,
          } : null,
        }
      } else {
        console.log('❌ Cache MISS - workspace mismatch')
      }
    } else {
      console.log('❌ Cache MISS - no cached item')
    }
  } catch (error) {
    console.warn('❌ Cache read error:', error)
  }
  
  console.log('📊 Fetching from database...')
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
    console.log('❌ Item not found in database at all')
    return null
  }

  console.log('📊 Found item with workspace:', {
    itemWorkspaceId: item.law_list.workspace_id,
    sessionWorkspaceId: workspaceId,
    matches: item.law_list.workspace_id === workspaceId
  })

  // Verify workspace access
  if (item.law_list.workspace_id !== workspaceId) {
    console.log('❌ Workspace mismatch - access denied')
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
        html_content: null // Don't duplicate HTML in item cache
      }
    })
    console.log('📝 Caching list item (without HTML):', cacheKey.substring(0, 30))
    await redis.set(cacheKey, cacheData, { ex: 3600 })
  } catch (error) {
    console.warn('Cache write error:', error)
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
      fullText: null,
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
  const startTime = Date.now()
  console.log('\n🚀 ===========================================')
  console.log(`🚀 MODAL OPEN START: ${listItemId}`)
  console.log(`🚀 Time: ${new Date().toISOString()}`)
  console.log('🚀 ===========================================\n')
  
  try {
    console.log(`⏱️ [${Date.now() - startTime}ms] Calling withWorkspace...`)
    
    return await withWorkspace(async (ctx) => {
      console.log(`⏱️ [${Date.now() - startTime}ms] Inside withWorkspace, got context`)
      console.log(`   Workspace: ${ctx.workspaceId}`)
      console.log(`   User: ${ctx.userId}`)
      
      console.log(`⏱️ [${Date.now() - startTime}ms] Calling fetchListItemDetailsInternal...`)
      const result = await fetchListItemDetailsInternal(
        listItemId,
        ctx.workspaceId
      )
      console.log(`⏱️ [${Date.now() - startTime}ms] fetchListItemDetailsInternal returned`)
      
      if (!result) {
        console.error('List item not found:', {
          listItemId,
          workspaceId: ctx.workspaceId,
          userId: ctx.userId
        })
        return {
          success: false,
          error: 'List item not found or access denied'
        }
      }
      
      console.log(`⏱️ [${Date.now() - startTime}ms] Preparing response...`)
      const response = {
        success: true,
        data: result
      }
      
      console.log('\n🏁 ===========================================')
      console.log(`🏁 MODAL DATA READY: Total time: ${Date.now() - startTime}ms`)
      console.log('🏁 ===========================================\n')
      
      return response
    }, 'read')
  } catch (error) {
    console.error(`⏱️ [${Date.now() - startTime}ms] ERROR:`, error)
    return {
      success: false,
      error: 'Failed to fetch list item details'
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
): Promise<ActionResult<{ fullText: string | null; htmlContent: string | null }>> {
  try {
    // Use the new caching strategy for document content
    const data = await getCachedDocumentContent(
      documentId,
      async () => {
        const document = await prisma.legalDocument.findUnique({
          where: { id: documentId },
          select: {
            full_text: true,
            html_content: true,
          },
        })

        if (!document) {
          throw new Error('Document not found')
        }

        return {
          fullText: document.full_text,
          htmlContent: document.html_content,
        }
      }
    )

    return {
      success: true,
      data,
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
  const startTime = Date.now()
  console.log(`\n📋 TASKS: Starting getTasksForListItem for ${listItemId}`)
  
  try {
    return await withWorkspace(async (ctx) => {
      console.log(`📋 TASKS: [${Date.now() - startTime}ms] Got workspace context`)
      
      // Verify item belongs to workspace
      const item = await prisma.lawListItem.findFirst({
        where: { id: listItemId },
        include: { law_list: { select: { workspace_id: true } } },
      })
      console.log(`📋 TASKS: [${Date.now() - startTime}ms] Verified workspace access`)

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
  const startTime = Date.now()
  console.log(`\n📎 EVIDENCE: Starting getEvidenceForListItem for ${listItemId}`)
  
  try {
    return await withWorkspace(async (ctx) => {
      console.log(`📎 EVIDENCE: [${Date.now() - startTime}ms] Got workspace context`)
      
      // Verify item belongs to workspace
      const item = await prisma.lawListItem.findFirst({
        where: { id: listItemId },
        include: { law_list: { select: { workspace_id: true } } },
      })
      console.log(`📎 EVIDENCE: [${Date.now() - startTime}ms] Verified workspace access`)

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
