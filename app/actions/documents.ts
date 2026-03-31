'use server'

/**
 * Epic 17 Story 17.1: Workspace Document Server Actions
 * Basic CRUD operations for the Document Management System
 */

import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import {
  createDocumentSchema,
  updateDocumentStatusSchema,
  updateDocumentMetadataSchema,
  getWorkspaceDocumentsSchema,
  VALID_STATUS_TRANSITIONS,
  type CreateDocumentInput,
  type UpdateDocumentStatusInput,
  type UpdateDocumentMetadataInput,
  type GetWorkspaceDocumentsInput,
} from '@/lib/validation/documents'
import { WorkspaceDocumentStatus } from '@prisma/client'
import { getStorageClient } from '@/lib/supabase/storage'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// Default empty Tiptap document
const EMPTY_TIPTAP_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

// Helper to extract plaintext from HTML
function extractPlaintext(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const BUCKET_NAME = 'workspace-files'

// ============================================================================
// Server Actions
// ============================================================================

export async function createDocument(
  input: CreateDocumentInput
): Promise<ActionResult<{ id: string; title: string; versionNumber: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const validated = createDocumentSchema.parse(input)

      // If templateId provided, fetch template content
      let contentJson = validated.contentJson ?? EMPTY_TIPTAP_DOC
      let documentType = validated.documentType

      if (validated.templateId) {
        const template = await prisma.workspaceDocumentTemplate.findUnique({
          where: { id: validated.templateId },
        })
        if (!template) {
          return { success: false, error: 'Mall hittades inte' }
        }
        contentJson = template.content_json
        documentType = template.document_type
      }

      // Create document + version v1 in a transaction
      const document = await prisma.$transaction(async (tx) => {
        const doc = await tx.workspaceDocument.create({
          data: {
            workspace_id: workspaceId,
            title: validated.title,
            document_type: documentType,
            document_number: validated.documentNumber ?? null,
            template_id: validated.templateId ?? null,
            created_by: userId,
            current_version_number: 1,
          },
        })

        const version = await tx.workspaceDocumentVersion.create({
          data: {
            document_id: doc.id,
            version_number: 1,
            source: 'TIPTAP',
            content_json: contentJson,
            content_html: '',
            created_by: userId,
          },
        })

        // Set current_version_id
        const updated = await tx.workspaceDocument.update({
          where: { id: doc.id },
          data: { current_version_id: version.id },
        })

        // ActivityLog: document_created
        await tx.activityLog.create({
          data: {
            workspace_id: workspaceId,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: doc.id,
            action: 'document_created',
            new_value: { title: validated.title, document_type: documentType },
          },
        })

        return updated
      })

      return {
        success: true,
        data: {
          id: document.id,
          title: document.title,
          versionNumber: 1,
        },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function getDocument(
  documentId: string
): Promise<ActionResult<unknown>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: {
          id: documentId,
          workspace_id: workspaceId,
        },
        include: {
          current_version: true,
          creator: {
            select: { id: true, name: true, email: true, avatar_url: true },
          },
          approver: {
            select: { id: true, name: true, email: true, avatar_url: true },
          },
          template: {
            select: { id: true, name: true },
          },
          task_links: {
            include: {
              task: { select: { id: true, title: true } },
            },
          },
          list_item_links: {
            include: {
              list_item: {
                select: {
                  id: true,
                  document: {
                    select: { title: true, document_number: true },
                  },
                },
              },
            },
          },
        },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      return { success: true, data: document }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export interface VersionAuthor {
  id: string
  name: string
  avatar_url: string | null
}

export interface DocumentVersionEntry {
  id: string
  version_number: number
  source: string
  change_summary: string | null
  created_by: string
  created_at: Date
  author: VersionAuthor
}

export async function getDocumentVersions(
  documentId: string
): Promise<ActionResult<DocumentVersionEntry[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      // Verify document belongs to workspace
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const versions = await prisma.workspaceDocumentVersion.findMany({
        where: { document_id: documentId },
        orderBy: { version_number: 'desc' },
        select: {
          id: true,
          version_number: true,
          source: true,
          change_summary: true,
          created_by: true,
          created_at: true,
        },
      })

      // Resolve author names (created_by has no FK — separate lookup needed)
      const userIds = [
        ...new Set(
          versions.map((v) => v.created_by).filter((id) => id !== 'agent')
        ),
      ]

      const users =
        userIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, avatar_url: true },
            })
          : []

      const userMap = new Map(users.map((u) => [u.id, u]))

      const versionsWithAuthors: DocumentVersionEntry[] = versions.map((v) => {
        const user = userMap.get(v.created_by)
        return {
          ...v,
          author:
            v.created_by === 'agent'
              ? { id: 'agent', name: 'AI-assistent', avatar_url: null }
              : {
                  id: v.created_by,
                  name: user?.name ?? 'Okänd användare',
                  avatar_url: user?.avatar_url ?? null,
                },
        }
      })

      return { success: true, data: versionsWithAuthors }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function getWorkspaceDocuments(
  input?: GetWorkspaceDocumentsInput
): Promise<ActionResult<unknown>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const validated = getWorkspaceDocumentsSchema.parse(input ?? {})

      const where: Record<string, unknown> = {
        workspace_id: workspaceId,
      }

      if (validated.type) {
        where.document_type = validated.type
      }
      if (validated.status) {
        where.status = validated.status
      }
      if (validated.search) {
        where.title = { contains: validated.search, mode: 'insensitive' }
      }

      const sortField = validated.sortBy ?? 'updated_at'
      const sortDirection = validated.sortOrder ?? 'desc'

      const documents = await prisma.workspaceDocument.findMany({
        where,
        take: validated.take + 1, // Fetch one extra to check hasMore
        ...(validated.cursor
          ? { cursor: { id: validated.cursor }, skip: 1 }
          : {}),
        orderBy: { [sortField]: sortDirection },
        select: {
          id: true,
          title: true,
          document_type: true,
          status: true,
          document_number: true,
          current_version_number: true,
          review_date: true,
          created_by: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      const hasMore = documents.length > validated.take
      const items = hasMore ? documents.slice(0, validated.take) : documents
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

      return {
        success: true,
        data: { items, hasMore, nextCursor },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function updateDocumentStatus(
  input: UpdateDocumentStatusInput
): Promise<ActionResult<{ id: string; status: WorkspaceDocumentStatus }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const validated = updateDocumentStatusSchema.parse(input)

      const document = await prisma.workspaceDocument.findFirst({
        where: { id: validated.documentId, workspace_id: workspaceId },
        select: { id: true, status: true, workspace_id: true },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      // Validate status transition
      const allowedTransitions = VALID_STATUS_TRANSITIONS[document.status]
      if (!allowedTransitions.includes(validated.newStatus)) {
        return {
          success: false,
          error: `Ogiltig statusövergång: ${document.status} → ${validated.newStatus}`,
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        status: validated.newStatus,
      }

      if (validated.newStatus === WorkspaceDocumentStatus.APPROVED) {
        updateData.approved_by = userId
        updateData.approved_at = new Date()
      } else if (document.status === WorkspaceDocumentStatus.APPROVED) {
        // Transitioning away from APPROVED — clear approval fields
        updateData.approved_by = null
        updateData.approved_at = null
      }

      const oldStatus = document.status

      const updated = await prisma.$transaction(async (tx) => {
        const doc = await tx.workspaceDocument.update({
          where: { id: document.id },
          data: updateData,
        })

        // ActivityLog: document_status_changed
        await tx.activityLog.create({
          data: {
            workspace_id: document.workspace_id,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: document.id,
            action: 'document_status_changed',
            old_value: { status: oldStatus },
            new_value: {
              status: validated.newStatus,
              comment: validated.comment ?? null,
            },
          },
        })

        return doc
      })

      return {
        success: true,
        data: { id: updated.id, status: updated.status },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Get Latest Status Change Comment
// ============================================================================

export async function getLatestStatusComment(documentId: string): Promise<{
  comment: string
  userName: string
  fromStatus: string
  toStatus: string
  createdAt: string
} | null> {
  try {
    const entry = await prisma.activityLog.findFirst({
      where: {
        entity_type: 'workspace_document',
        entity_id: documentId,
        action: 'document_status_changed',
      },
      orderBy: { created_at: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
      },
    })

    if (!entry) return null

    const newValue = entry.new_value as Record<string, unknown> | null
    const oldValue = entry.old_value as Record<string, unknown> | null
    const comment = (newValue?.comment as string) ?? ''

    if (!comment) return null

    return {
      comment,
      userName:
        (entry.user?.name as string) ??
        (entry.user?.email as string) ??
        'Okänd',
      fromStatus: (oldValue?.status as string) ?? '',
      toStatus: (newValue?.status as string) ?? '',
      createdAt: entry.created_at.toISOString(),
    }
  } catch {
    return null
  }
}

// ============================================================================
// Story 17.2: Save Document Version
// ============================================================================

/**
 * Autosave: updates the current version in place (no new version number).
 */
export async function autosaveDocument(
  documentId: string,
  contentJson: object,
  title?: string,
  contentHtml?: string
): Promise<ActionResult<{ id: string; versionNumber: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: {
          id: true,
          current_version_id: true,
          current_version_number: true,
        },
      })

      if (!document || !document.current_version_id) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const html = contentHtml ?? ''
      const extractedText = extractPlaintext(html)

      await prisma.workspaceDocumentVersion.update({
        where: { id: document.current_version_id },
        data: {
          content_json: contentJson as never,
          content_html: html,
          extracted_text: extractedText,
        },
      })

      if (title !== undefined) {
        await prisma.workspaceDocument.update({
          where: { id: document.id },
          data: { title },
        })
      }

      return {
        success: true,
        data: {
          id: document.current_version_id,
          versionNumber: document.current_version_number,
        },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

/**
 * Explicit save: creates a new version with incremented version number.
 */
export async function saveDocumentVersion(
  documentId: string,
  contentJson: object,
  changeSummary?: string,
  title?: string,
  contentHtml?: string
): Promise<ActionResult<{ id: string; versionNumber: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true, current_version_number: true, workspace_id: true },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const html = contentHtml ?? ''
      const extractedText = extractPlaintext(html)

      const newVersionNumber = document.current_version_number + 1

      const version = await prisma.$transaction(async (tx) => {
        const ver = await tx.workspaceDocumentVersion.create({
          data: {
            document_id: document.id,
            version_number: newVersionNumber,
            source: 'TIPTAP',
            content_json: contentJson as never,
            content_html: html,
            extracted_text: extractedText,
            change_summary: changeSummary ?? null,
            created_by: userId,
          },
        })

        const docUpdate: Record<string, unknown> = {
          current_version_id: ver.id,
          current_version_number: newVersionNumber,
        }
        if (title !== undefined) {
          docUpdate.title = title
        }

        await tx.workspaceDocument.update({
          where: { id: document.id },
          data: docUpdate,
        })

        // ActivityLog: document_version_saved
        await tx.activityLog.create({
          data: {
            workspace_id: document.workspace_id,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: document.id,
            action: 'document_version_saved',
            new_value: {
              version_number: newVersionNumber,
              change_summary: changeSummary ?? null,
            },
          },
        })

        return ver
      })

      return {
        success: true,
        data: { id: version.id, versionNumber: newVersionNumber },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.3: Get Document Version Content (for diff view)
// ============================================================================

export async function getDocumentVersionContent(
  documentId: string,
  versionId: string
): Promise<ActionResult<{ extracted_text: string }>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      // Verify document belongs to workspace
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const version = await prisma.workspaceDocumentVersion.findFirst({
        where: { id: versionId, document_id: documentId },
        select: { extracted_text: true },
      })

      if (!version) {
        return { success: false, error: 'Version hittades inte' }
      }

      return {
        success: true,
        data: { extracted_text: version.extracted_text ?? '' },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.3: Restore Document Version
// ============================================================================

export async function restoreDocumentVersion(
  documentId: string,
  versionNumber: number
): Promise<ActionResult<{ id: string; versionNumber: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Verify document belongs to workspace
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true, current_version_number: true, workspace_id: true },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      // Fetch the old version's content and HTML
      const oldVersion = await prisma.workspaceDocumentVersion.findFirst({
        where: { document_id: documentId, version_number: versionNumber },
        select: { content_json: true, content_html: true },
      })

      if (!oldVersion) {
        return { success: false, error: 'Version hittades inte' }
      }

      // Reuse stored HTML from the old version
      const contentHtml = oldVersion.content_html ?? ''
      const extractedText = extractPlaintext(contentHtml)

      const newVersionNumber = document.current_version_number + 1
      const changeSummary = `Återställning från version ${versionNumber}`

      // Create new version from old content and update document — all in transaction
      const version = await prisma.$transaction(async (tx) => {
        const ver = await tx.workspaceDocumentVersion.create({
          data: {
            document_id: document.id,
            version_number: newVersionNumber,
            source: 'TIPTAP',
            content_json: oldVersion.content_json as never,
            content_html: contentHtml,
            extracted_text: extractedText,
            change_summary: changeSummary,
            created_by: userId,
          },
        })

        await tx.workspaceDocument.update({
          where: { id: document.id },
          data: {
            current_version_id: ver.id,
            current_version_number: newVersionNumber,
          },
        })

        // ActivityLog: document_version_restored
        await tx.activityLog.create({
          data: {
            workspace_id: document.workspace_id,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: document.id,
            action: 'document_version_restored',
            new_value: {
              restored_from_version: versionNumber,
              new_version_number: newVersionNumber,
            },
          },
        })

        return ver
      })

      return {
        success: true,
        data: { id: version.id, versionNumber: newVersionNumber },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.4: Create Draft from Approved Document
// ============================================================================

export async function createDraftFromApproved(
  documentId: string
): Promise<ActionResult<{ id: string; versionNumber: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: {
          id: true,
          status: true,
          current_version_number: true,
          workspace_id: true,
          current_version: {
            select: { content_json: true, content_html: true },
          },
        },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      if (document.status !== WorkspaceDocumentStatus.APPROVED) {
        return {
          success: false,
          error: 'Endast godkända dokument kan skapa en ny version',
        }
      }

      const contentJson =
        document.current_version?.content_json ?? EMPTY_TIPTAP_DOC

      // Reuse stored HTML from the current version
      const contentHtml = document.current_version?.content_html ?? ''
      const extractedText = extractPlaintext(contentHtml)

      const newVersionNumber = document.current_version_number + 1

      const version = await prisma.$transaction(async (tx) => {
        const ver = await tx.workspaceDocumentVersion.create({
          data: {
            document_id: document.id,
            version_number: newVersionNumber,
            source: 'TIPTAP',
            content_json: contentJson as never,
            content_html: contentHtml,
            extracted_text: extractedText,
            change_summary: 'Ny version från godkänt dokument',
            created_by: userId,
          },
        })

        await tx.workspaceDocument.update({
          where: { id: document.id },
          data: {
            current_version_id: ver.id,
            current_version_number: newVersionNumber,
            status: WorkspaceDocumentStatus.DRAFT,
            approved_by: null,
            approved_at: null,
          },
        })

        // ActivityLog: status changed from APPROVED to DRAFT
        await tx.activityLog.create({
          data: {
            workspace_id: document.workspace_id,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: document.id,
            action: 'document_status_changed',
            old_value: { status: WorkspaceDocumentStatus.APPROVED },
            new_value: {
              status: WorkspaceDocumentStatus.DRAFT,
              comment: 'Ny version från godkänt dokument',
            },
          },
        })

        return ver
      })

      return {
        success: true,
        data: { id: version.id, versionNumber: newVersionNumber },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.4: Update Document Metadata
// ============================================================================

export async function updateDocumentMetadata(
  input: UpdateDocumentMetadataInput
): Promise<ActionResult<{ id: string }>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const validated = updateDocumentMetadataSchema.parse(input)

      const document = await prisma.workspaceDocument.findFirst({
        where: { id: validated.documentId, workspace_id: workspaceId },
        select: { id: true },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const updateData: Record<string, unknown> = {}
      if (validated.documentNumber !== undefined) {
        updateData.document_number = validated.documentNumber
      }
      if (validated.reviewDate !== undefined) {
        updateData.review_date = validated.reviewDate
          ? new Date(validated.reviewDate)
          : null
      }
      if (validated.retentionUntil !== undefined) {
        updateData.retention_until = validated.retentionUntil
          ? new Date(validated.retentionUntil)
          : null
      }
      if (validated.documentType !== undefined) {
        updateData.document_type = validated.documentType
      }

      await prisma.workspaceDocument.update({
        where: { id: document.id },
        data: updateData,
      })

      return { success: true, data: { id: document.id } }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.7: Get Document Templates
// ============================================================================

export async function getDocumentTemplates(): Promise<ActionResult<unknown>> {
  try {
    return await withWorkspace(async () => {
      const templates = await prisma.workspaceDocumentTemplate.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          document_type: true,
          content_json: true,
          sort_order: true,
        },
      })

      return { success: true, data: templates }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.5: Import .docx Document
// ============================================================================

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MAX_IMPORT_SIZE = 25 * 1024 * 1024 // 25MB

export async function importDocxDocument(
  formData: FormData
): Promise<ActionResult<{ id: string; title: string; versionNumber: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const file = formData.get('file') as File | null
      const title = formData.get('title') as string | null
      const documentType = formData.get('documentType') as string | null
      const documentNumber = formData.get('documentNumber') as string | null

      if (!file || !title) {
        return { success: false, error: 'Fil och titel krävs' }
      }

      // Validate file type
      if (file.type !== DOCX_MIME) {
        return {
          success: false,
          error: 'Ogiltig filtyp — endast .docx stöds',
        }
      }

      // Validate file size
      if (file.size > MAX_IMPORT_SIZE) {
        return { success: false, error: 'Filen är för stor (max 25 MB)' }
      }

      const { importDocxDocumentSchema } = await import(
        '@/lib/validation/documents'
      )
      const validated = importDocxDocumentSchema.parse({
        title,
        documentType: documentType ?? undefined,
        documentNumber: documentNumber ?? undefined,
      })

      // Convert .docx to Tiptap JSON
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      let conversionResult
      try {
        const { convertDocxToTiptap } = await import(
          '@/lib/documents/docx-to-tiptap'
        )
        // Create document ID ahead of time for image upload paths
        const tempDocId = crypto.randomUUID()
        conversionResult = await convertDocxToTiptap(
          buffer,
          workspaceId,
          tempDocId
        )
      } catch {
        return { success: false, error: 'Filen kunde inte konverteras' }
      }

      const { json, html, extractedText } = conversionResult

      // Upload original .docx to Supabase Storage
      const docId = crypto.randomUUID()
      const storagePath = `${workspaceId}/document-imports/${docId}/${file.name}`

      const storageClient = getStorageClient()
      const { error: archiveError } = await storageClient.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: DOCX_MIME,
          upsert: false,
        })

      // Log archival failure but proceed — document creation is more important
      if (archiveError) {
        console.error('Failed to archive .docx:', archiveError.message)
      }

      // Create document + version v1 in a transaction
      const document = await prisma.$transaction(async (tx) => {
        const doc = await tx.workspaceDocument.create({
          data: {
            id: docId,
            workspace_id: workspaceId,
            title: validated.title,
            document_type: validated.documentType,
            document_number: validated.documentNumber ?? null,
            created_by: userId,
            current_version_number: 1,
          },
        })

        const version = await tx.workspaceDocumentVersion.create({
          data: {
            document_id: doc.id,
            version_number: 1,
            source: 'IMPORT',
            content_json: json as never,
            content_html: html,
            extracted_text: extractedText,
            storage_path: archiveError ? null : storagePath,
            change_summary: 'Importerad från .docx',
            created_by: userId,
          },
        })

        await tx.workspaceDocument.update({
          where: { id: doc.id },
          data: { current_version_id: version.id },
        })

        // ActivityLog
        await tx.activityLog.create({
          data: {
            workspace_id: workspaceId,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: doc.id,
            action: 'document_imported',
            new_value: {
              title: validated.title,
              document_type: validated.documentType,
              source_file: file.name,
            },
          },
        })

        return doc
      })

      return {
        success: true,
        data: {
          id: document.id,
          title: document.title,
          versionNumber: 1,
        },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.12: Document Linking
// ============================================================================

export async function linkDocumentToTask(
  documentId: string,
  taskId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Verify document belongs to workspace
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true, title: true, workspace_id: true },
      })
      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      // Verify task belongs to workspace
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspace_id: workspaceId },
        select: { id: true, title: true },
      })
      if (!task) {
        return { success: false, error: 'Uppgift hittades inte' }
      }

      await prisma.workspaceDocumentTaskLink.create({
        data: {
          document_id: documentId,
          task_id: taskId,
          linked_by: userId,
        },
      })

      // ActivityLog
      await prisma.activityLog.create({
        data: {
          workspace_id: document.workspace_id,
          user_id: userId,
          entity_type: 'workspace_document',
          entity_id: documentId,
          action: 'document_linked_to_task',
          new_value: { task_id: taskId, task_title: task.title },
        },
      })

      return { success: true }
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return {
          success: false,
          error: 'Dokumentet är redan länkat till denna uppgift',
        }
      }
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function linkDocumentToListItem(
  documentId: string,
  listItemId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true, title: true, workspace_id: true },
      })
      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const listItem = await prisma.lawListItem.findFirst({
        where: { id: listItemId, law_list: { workspace_id: workspaceId } },
        select: { id: true, document: { select: { title: true } } },
      })
      if (!listItem) {
        return { success: false, error: 'Lagkrav hittades inte' }
      }

      await prisma.workspaceDocumentListItemLink.create({
        data: {
          document_id: documentId,
          list_item_id: listItemId,
          linked_by: userId,
        },
      })

      await prisma.activityLog.create({
        data: {
          workspace_id: document.workspace_id,
          user_id: userId,
          entity_type: 'workspace_document',
          entity_id: documentId,
          action: 'document_linked_to_list_item',
          new_value: {
            list_item_id: listItemId,
            list_item_title: listItem.document?.title ?? null,
          },
        },
      })

      return { success: true }
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return {
          success: false,
          error: 'Dokumentet är redan länkat till detta lagkrav',
        }
      }
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function unlinkDocumentFromTask(
  documentId: string,
  taskId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true, workspace_id: true },
      })
      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      await prisma.workspaceDocumentTaskLink.deleteMany({
        where: { document_id: documentId, task_id: taskId },
      })

      await prisma.activityLog.create({
        data: {
          workspace_id: document.workspace_id,
          user_id: userId,
          entity_type: 'workspace_document',
          entity_id: documentId,
          action: 'document_unlinked_from_task',
          new_value: { task_id: taskId },
        },
      })

      return { success: true }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function unlinkDocumentFromListItem(
  documentId: string,
  listItemId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true, workspace_id: true },
      })
      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      await prisma.workspaceDocumentListItemLink.deleteMany({
        where: { document_id: documentId, list_item_id: listItemId },
      })

      await prisma.activityLog.create({
        data: {
          workspace_id: document.workspace_id,
          user_id: userId,
          entity_type: 'workspace_document',
          entity_id: documentId,
          action: 'document_unlinked_from_list_item',
          new_value: { list_item_id: listItemId },
        },
      })

      return { success: true }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function getDocumentLinks(documentId: string): Promise<
  ActionResult<{
    tasks: Array<{ id: string; title: string; linkId: string }>
    listItems: Array<{
      id: string
      title: string
      documentNumber: string | null
      linkId: string
    }>
  }>
> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true },
      })
      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const [taskLinks, listItemLinks] = await Promise.all([
        prisma.workspaceDocumentTaskLink.findMany({
          where: { document_id: documentId },
          include: {
            task: { select: { id: true, title: true } },
          },
        }),
        prisma.workspaceDocumentListItemLink.findMany({
          where: { document_id: documentId },
          include: {
            list_item: {
              select: {
                id: true,
                document: { select: { title: true, document_number: true } },
              },
            },
          },
        }),
      ])

      return {
        success: true,
        data: {
          tasks: taskLinks.map((l) => ({
            id: l.task.id,
            title: l.task.title,
            linkId: l.id,
          })),
          listItems: listItemLinks.map((l) => ({
            id: l.list_item.id,
            title: l.list_item.document?.title ?? 'Okänt lagkrav',
            documentNumber: l.list_item.document?.document_number ?? null,
            linkId: l.id,
          })),
        },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function getDocumentsForTask(taskId: string): Promise<
  ActionResult<
    Array<{
      id: string
      title: string
      documentType: string
      status: string
      versionNumber: number
      linkId: string
    }>
  >
> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspace_id: workspaceId },
        select: { id: true },
      })
      if (!task) {
        return { success: false, error: 'Uppgift hittades inte' }
      }

      const links = await prisma.workspaceDocumentTaskLink.findMany({
        where: { task_id: taskId },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              document_type: true,
              status: true,
              current_version_number: true,
            },
          },
        },
      })

      return {
        success: true,
        data: links.map((l) => ({
          id: l.document.id,
          title: l.document.title,
          documentType: l.document.document_type,
          status: l.document.status,
          versionNumber: l.document.current_version_number,
          linkId: l.id,
        })),
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function getDocumentsForListItem(listItemId: string): Promise<
  ActionResult<
    Array<{
      id: string
      title: string
      documentType: string
      status: string
      versionNumber: number
      linkId: string
    }>
  >
> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const listItem = await prisma.lawListItem.findFirst({
        where: { id: listItemId, law_list: { workspace_id: workspaceId } },
        select: { id: true },
      })
      if (!listItem) {
        return { success: false, error: 'Lagkrav hittades inte' }
      }

      const links = await prisma.workspaceDocumentListItemLink.findMany({
        where: { list_item_id: listItemId },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              document_type: true,
              status: true,
              current_version_number: true,
            },
          },
        },
      })

      return {
        success: true,
        data: links.map((l) => ({
          id: l.document.id,
          title: l.document.title,
          documentType: l.document.document_type,
          status: l.document.status,
          versionNumber: l.document.current_version_number,
          linkId: l.id,
        })),
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.2: Upload Document Image
// ============================================================================

export async function uploadDocumentImageAction(
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const file = formData.get('file') as File | null
      const documentId = formData.get('documentId') as string | null

      if (!file || !documentId) {
        return { success: false, error: 'Fil och dokument-ID krävs' }
      }

      // Verify document belongs to workspace
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const allowedTypes = [
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
      ]
      if (!allowedTypes.includes(file.type)) {
        return { success: false, error: 'Ogiltigt filformat' }
      }

      if (file.size > 10 * 1024 * 1024) {
        return { success: false, error: 'Bilden är för stor (max 10MB)' }
      }

      const imageId = crypto.randomUUID()
      const storagePath = `${workspaceId}/document-images/${imageId}/${file.name}`

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const storageClient = getStorageClient()
      const { error: uploadError } = await storageClient.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        return { success: false, error: 'Bilduppladdning misslyckades' }
      }

      const {
        data: { publicUrl },
      } = storageClient.storage.from(BUCKET_NAME).getPublicUrl(storagePath)

      return { success: true, data: { url: publicUrl } }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}
