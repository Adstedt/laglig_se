'use server'

/**
 * Story 6.7a: Workspace File Server Actions
 * Server actions for file upload, management, and linking
 */

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { getStorageClient } from '@/lib/supabase/storage'
import { z } from 'zod'
import type { FileCategory, FileExtractionStatus } from '@prisma/client'
import { type StorageWarning } from '@/lib/usage/storage'
// Story 7.6 (DUP-001): the storage-upload legs (validation, dedupe, quota,
// hash, Storage write) live in the shared upload core — one implementation
// for Filer uploads and kollektivavtal uploads.
import {
  ALLOWED_MIME_TYPES,
  BUCKET_NAME,
  stageWorkspaceFileUpload,
  validateUploadFile,
} from '@/lib/files/upload-core'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
  // Story 5.5b: structured error code for client-side branching (e.g.,
  // STORAGE_QUOTA_EXCEEDED → upgrade modal).
  code?: string
  // Story 5.5b: soft-warn payload when storage usage crosses 80%. Surfaced
  // alongside `success: true` results so the client can show a non-blocking
  // toast without breaking the existing success branch.
  warning?: StorageWarning
}

export interface WorkspaceFileWithLinks {
  id: string
  workspace_id: string
  uploaded_by: string
  filename: string
  original_filename: string
  file_size: number
  mime_type: string
  storage_path: string
  category: FileCategory
  description: string | null
  created_at: Date
  updated_at: Date
  uploader: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
  task_links: Array<{
    id: string
    task: {
      id: string
      title: string
    }
  }>
  list_item_links: Array<{
    id: string
    list_item: {
      id: string
      document: {
        title: string
        document_number: string
      }
    }
  }>
  requirement_evidence_links: Array<{
    id: string
    requirement: {
      id: string
      text: string
      list_item: {
        id: string
        document: {
          title: string
          document_number: string | null
        } | null
      } | null
    }
  }>
}

export interface FileFilters {
  category?: FileCategory
  uploadedBy?: string
  dateFrom?: Date
  dateTo?: Date
  search?: string
  // Filter by attachment state, derived from the link tables (no schema change):
  // 'standalone' = no task/list-item/requirement links; 'linked' = has ≥1.
  linkState?: 'standalone' | 'linked'
}

export interface PaginatedFilesResult {
  files: WorkspaceFileWithLinks[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ============================================================================
// Schemas
// ============================================================================

const UpdateFileSchema = z.object({
  filename: z.string().min(1).max(255).optional(),
  category: z
    .enum([
      'BEVIS',
      'POLICY',
      'AVTAL',
      'CERTIFIKAT',
      'OVRIGT',
      'CHAT_ATTACHMENT',
    ])
    .optional(),
  description: z.string().max(1000).optional().nullable(),
})

// Story 6.7b: Folder schemas
const CreateFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Mappnamn krävs')
    .max(255, 'Mappnamn får inte överstiga 255 tecken')
    .regex(/^[^<>:"/\\|?*]+$/, 'Ogiltigt mappnamn')
    .refine(
      (name) => name !== '.' && name !== '..',
      'Ogiltigt mappnamn - reserverade tecken'
    ),
  parentFolderId: z.string().uuid().optional().nullable(),
})

const RenameFolderSchema = z.object({
  folderId: z.string().uuid(),
  newName: z
    .string()
    .min(1, 'Mappnamn krävs')
    .max(255, 'Mappnamn får inte överstiga 255 tecken')
    .regex(/^[^<>:"/\\|?*]+$/, 'Ogiltigt mappnamn')
    .refine(
      (name) => name !== '.' && name !== '..',
      'Ogiltigt mappnamn - reserverade tecken'
    ),
})

const MoveItemSchema = z.object({
  itemId: z.string().uuid(),
  targetFolderId: z.string().uuid().nullable(),
})

// ============================================================================
// Security Helpers
// ============================================================================

/**
 * Validate path segments don't contain traversal attempts
 * Security: Prevents path traversal attacks
 */
function validatePathSegments(segments: string[]): boolean {
  return segments.every(
    (seg) =>
      seg !== '.' && seg !== '..' && !seg.includes('/') && !seg.includes('\\')
  )
}

/**
 * Get folder depth from root
 * Used to enforce max nesting depth (5 levels)
 */
async function getFolderDepth(folderId: string): Promise<number> {
  let depth = 0
  let currentId: string | null = folderId

  while (currentId && depth < 10) {
    // Safety limit
    const folderResult: { parent_folder_id: string | null } | null =
      await prisma.workspaceFile.findUnique({
        where: { id: currentId },
        select: { parent_folder_id: true },
      })
    if (!folderResult || !folderResult.parent_folder_id) break
    currentId = folderResult.parent_folder_id
    depth++
  }

  return depth
}

/**
 * Check if moving folder would create a cycle (folder into itself or descendant)
 */
async function wouldCreateCycle(
  folderId: string,
  targetFolderId: string | null
): Promise<boolean> {
  if (!targetFolderId) return false
  if (folderId === targetFolderId) return true

  // Walk up from target to see if we hit the source folder
  let currentId: string | null = targetFolderId
  while (currentId) {
    if (currentId === folderId) return true
    const folderResult: { parent_folder_id: string | null } | null =
      await prisma.workspaceFile.findUnique({
        where: { id: currentId },
        select: { parent_folder_id: true },
      })
    currentId = folderResult?.parent_folder_id ?? null
  }
  return false
}

// ============================================================================
// Upload Actions
// ============================================================================

/**
 * Upload a file to workspace storage
 * Creates database record and stores file in Supabase Storage
 * Story 6.7b: Now supports parentFolderId for folder context
 */
export async function uploadFile(
  formData: FormData
): Promise<ActionResult<WorkspaceFileWithLinks>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Story 7.6 (DUP-001): shared validation (presence → mime → size).
      const validated = validateUploadFile(formData.get('file'), {
        allowedMimeTypes: ALLOWED_MIME_TYPES,
        typeError: 'Otillåten filtyp',
      })
      if (!validated.ok) {
        return { success: false, error: validated.error }
      }
      const file = validated.file

      // Get optional category from formData
      const categoryValue = formData.get('category') as string | null
      const category = (categoryValue as FileCategory) || 'OVRIGT'

      // Story 6.7b: Get optional parent folder ID
      const parentFolderIdValue = formData.get('parentFolderId') as
        | string
        | null
      const parentFolderId = parentFolderIdValue || null

      // Validate parent folder exists and belongs to workspace
      if (parentFolderId) {
        const parentFolder = await prisma.workspaceFile.findFirst({
          where: {
            id: parentFolderId,
            workspace_id: workspaceId,
            is_folder: true,
          },
        })
        if (!parentFolder) {
          return { success: false, error: 'Målmappen hittades inte' }
        }
      }

      // Story 7.6 (DUP-001): shared staging — same-folder dedupe, Story 5.5b
      // storage-quota gate (soft warn at 80% surfaced on the result), filename
      // sanitization + sha256 hash, and the Storage write (`upsert: false`).
      const staged = await stageWorkspaceFileUpload({
        workspaceId,
        file,
        parentFolderId,
        duplicateError: 'En fil med samma namn finns redan i mappen',
      })
      if (!staged.ok) {
        return {
          success: false,
          error: staged.error,
          ...(staged.code ? { code: staged.code } : {}),
        }
      }
      const storageWarning: StorageWarning | undefined = staged.warning

      // Create database record
      const workspaceFile = await prisma.workspaceFile.create({
        data: {
          id: staged.fileId,
          workspace_id: workspaceId,
          uploaded_by: userId,
          parent_folder_id: parentFolderId, // Story 6.7b: folder context
          filename: file.name,
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          storage_path: staged.storagePath,
          category,
          // Story 17.8: PENDING self-queues extractable types for the
          // extract-files cron (computed in the shared core).
          extraction_status: staged.extractionStatus,
          content_hash: staged.contentHash,
        },
        include: {
          uploader: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar_url: true,
            },
          },
          task_links: {
            include: {
              task: {
                select: { id: true, title: true },
              },
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
          requirement_evidence_links: {
            include: {
              requirement: {
                select: {
                  id: true,
                  text: true,
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
          },
        },
      })

      revalidatePath('/filer')
      return {
        success: true,
        data: workspaceFile as WorkspaceFileWithLinks,
        // Story 5.5b: pass the soft-warn payload (if any) up so UI can show
        // a non-blocking "you're at 80% of your storage" toast.
        ...(storageWarning ? { warning: storageWarning } : {}),
      }
    })
  } catch (error) {
    console.error('uploadFile error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Story 17.8: Manually (re-)trigger extraction for a single file. Workspace-scoped
 * — the extract-files cron is the bulk path; this is the on-demand/admin path
 * (e.g. retrying a FAILED file). Re-downloads from Storage and re-runs extractFile.
 */
export async function extractWorkspaceFile(
  fileId: string
): Promise<ActionResult<{ status: FileExtractionStatus }>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const file = await prisma.workspaceFile.findFirst({
        where: { id: fileId, workspace_id: workspaceId, is_folder: false },
        select: {
          id: true,
          workspace_id: true,
          uploaded_by: true,
          mime_type: true,
          storage_path: true,
        },
      })
      if (!file || !file.storage_path) {
        return { success: false, error: 'Filen hittades inte' }
      }

      const storageClient = getStorageClient()
      const { data: blob, error } = await storageClient.storage
        .from(BUCKET_NAME)
        .download(file.storage_path)
      if (error || !blob) {
        return {
          success: false,
          error: 'Kunde inte hämta filen från lagringen',
        }
      }

      const buffer = Buffer.from(await blob.arrayBuffer())
      // Dynamic import keeps xlsx/papaparse/Anthropic out of the other file actions.
      const { extractFile } = await import('@/lib/documents/extract-file')
      const result = await extractFile(buffer, file.mime_type)

      await prisma.workspaceFile.update({
        where: { id: file.id },
        data: {
          extraction_status: result.status,
          extracted_text: result.markdown,
          extracted_at: new Date(),
        },
      })

      // FILE_EXTRACTION cost telemetry (PDF/LLM path only). Fail-safe.
      if (result.usage) {
        try {
          const { estimateCostUsd } = await import('@/lib/usage/cost-estimator')
          await prisma.chatUsageEvent.create({
            data: {
              workspace_id: file.workspace_id,
              user_id: file.uploaded_by,
              model: result.usage.model,
              context_type: 'FILE_EXTRACTION',
              input_tokens: result.usage.inputTokens,
              output_tokens: result.usage.outputTokens,
              cost_usd_estimate: estimateCostUsd({
                model: result.usage.model,
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
                cacheReadInputTokens: 0,
                cacheWriteInputTokens: 0,
                reasoningTokens: 0,
              }),
            },
          })
        } catch (e) {
          console.error(
            '[extractWorkspaceFile] usage telemetry write failed:',
            e
          )
        }
      }

      revalidatePath('/filer')
      return { success: true, data: { status: result.status } }
    })
  } catch (error) {
    console.error('extractWorkspaceFile error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Upload file and link directly to a task
 * Used for uploading evidence from the task modal
 */
export async function uploadFileAndLinkToTask(
  formData: FormData,
  taskId: string
): Promise<ActionResult<WorkspaceFileWithLinks>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      // First verify task belongs to workspace
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspace_id: workspaceId },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      // Upload the file
      const uploadResult = await uploadFile(formData)
      if (!uploadResult.success || !uploadResult.data) {
        return uploadResult
      }

      // Link to task
      await prisma.fileTaskLink.create({
        data: {
          file_id: uploadResult.data.id,
          task_id: taskId,
          linked_by: userId,
        },
      })

      // Fetch updated file with links
      const file = await getFileById(uploadResult.data.id)
      if (!file.success || !file.data) {
        return uploadResult
      }

      revalidatePath('/tasks')
      revalidatePath('/filer')
      return { success: true, data: file.data }
    })
  } catch (error) {
    console.error('uploadFileAndLinkToTask error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Upload file and link directly to a law list item
 */
export async function uploadFileAndLinkToListItem(
  formData: FormData,
  listItemId: string
): Promise<ActionResult<WorkspaceFileWithLinks>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Verify list item belongs to workspace
      const listItem = await prisma.lawListItem.findFirst({
        where: {
          id: listItemId,
          law_list: { workspace_id: workspaceId },
        },
      })

      if (!listItem) {
        return { success: false, error: 'Lagpunkten hittades inte' }
      }

      // Upload the file
      const uploadResult = await uploadFile(formData)
      if (!uploadResult.success || !uploadResult.data) {
        return uploadResult
      }

      // Link to list item
      await prisma.fileListItemLink.create({
        data: {
          file_id: uploadResult.data.id,
          list_item_id: listItemId,
          linked_by: userId,
        },
      })

      // Fetch updated file with links
      const file = await getFileById(uploadResult.data.id)
      if (!file.success || !file.data) {
        return uploadResult
      }

      revalidatePath('/laglistor')
      revalidatePath('/filer')
      return { success: true, data: file.data }
    })
  } catch (error) {
    console.error('uploadFileAndLinkToListItem error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

// ============================================================================
// File CRUD Actions
// ============================================================================

/**
 * Get a single file by ID with all relations
 */
export async function getFileById(
  fileId: string
): Promise<ActionResult<WorkspaceFileWithLinks>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const file = await prisma.workspaceFile.findFirst({
        where: { id: fileId, workspace_id: workspaceId },
        include: {
          uploader: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar_url: true,
            },
          },
          task_links: {
            include: {
              task: {
                select: { id: true, title: true },
              },
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
          requirement_evidence_links: {
            include: {
              requirement: {
                select: {
                  id: true,
                  text: true,
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
          },
        },
      })

      if (!file) {
        return { success: false, error: 'Filen hittades inte' }
      }

      return { success: true, data: file as WorkspaceFileWithLinks }
    })
  } catch (error) {
    console.error('getFileById error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get paginated workspace files with filtering
 */
export async function getWorkspaceFiles(
  filters?: FileFilters,
  pagination?: { page?: number; limit?: number }
): Promise<ActionResult<PaginatedFilesResult>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const page = Math.max(1, pagination?.page || 1)
      const limit = Math.min(100, Math.max(1, pagination?.limit || 24))
      const offset = (page - 1) * limit

      // Build where clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { workspace_id: workspaceId }

      if (filters?.category) {
        where.category = filters.category
      } else {
        // Story 19.1: chat attachments are conversational, not curated workspace
        // files — exclude them from the default Filer listing. (An explicit
        // category filter still resolves normally.)
        where.category = { not: 'CHAT_ATTACHMENT' }
      }

      if (filters?.uploadedBy) {
        where.uploaded_by = filters.uploadedBy
      }

      if (filters?.dateFrom || filters?.dateTo) {
        where.created_at = {}
        if (filters.dateFrom) {
          where.created_at.gte = filters.dateFrom
        }
        if (filters.dateTo) {
          where.created_at.lte = filters.dateTo
        }
      }

      if (filters?.search) {
        where.OR = [
          { filename: { contains: filters.search, mode: 'insensitive' } },
          {
            original_filename: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
        ]
      }

      // Get total count
      const totalCount = await prisma.workspaceFile.count({ where })

      // Fetch files with pagination
      const files = await prisma.workspaceFile.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          uploader: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar_url: true,
            },
          },
          task_links: {
            include: {
              task: {
                select: { id: true, title: true },
              },
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
          requirement_evidence_links: {
            include: {
              requirement: {
                select: {
                  id: true,
                  text: true,
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
          },
        },
      })

      const totalPages = Math.ceil(totalCount / limit)

      return {
        success: true,
        data: {
          files: files as WorkspaceFileWithLinks[],
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
      }
    })
  } catch (error) {
    console.error('getWorkspaceFiles error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Update file metadata (name, category, description)
 */
export async function updateFile(
  fileId: string,
  updates: {
    filename?: string
    category?: FileCategory
    description?: string | null
  }
): Promise<ActionResult<WorkspaceFileWithLinks>> {
  try {
    const validated = UpdateFileSchema.parse(updates)

    return await withWorkspace(async ({ workspaceId }) => {
      const file = await prisma.workspaceFile.findFirst({
        where: { id: fileId, workspace_id: workspaceId },
      })

      if (!file) {
        return { success: false, error: 'Filen hittades inte' }
      }

      const updatedFile = await prisma.workspaceFile.update({
        where: { id: fileId },
        data: {
          ...(validated.filename && { filename: validated.filename }),
          ...(validated.category && { category: validated.category }),
          ...(validated.description !== undefined && {
            description: validated.description,
          }),
        },
        include: {
          uploader: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar_url: true,
            },
          },
          task_links: {
            include: {
              task: {
                select: { id: true, title: true },
              },
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
          requirement_evidence_links: {
            include: {
              requirement: {
                select: {
                  id: true,
                  text: true,
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
          },
        },
      })

      revalidatePath('/filer')
      return { success: true, data: updatedFile as WorkspaceFileWithLinks }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltiga data',
      }
    }
    console.error('updateFile error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Delete a file (uploader or admin only)
 */
export async function deleteFile(fileId: string): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const file = await prisma.workspaceFile.findFirst({
        where: { id: fileId, workspace_id: workspaceId },
      })

      if (!file) {
        return { success: false, error: 'Filen hittades inte' }
      }

      // Check permission (uploader or admin/owner)
      const member = await prisma.workspaceMember.findFirst({
        where: { workspace_id: workspaceId, user_id: userId },
      })

      const isUploader = file.uploaded_by === userId
      const isAdmin = member?.role === 'ADMIN' || member?.role === 'OWNER'

      if (!isUploader && !isAdmin) {
        return {
          success: false,
          error: 'Du har inte behörighet att radera denna fil',
        }
      }

      // Story 21.26 — evidence-snapshot deletion guard removed alongside
      // the SEALED collapse and ComplianceEvidenceSnapshot model deletion.
      // If we re-add evidence-protection in the future, it'll live elsewhere.

      // Delete from storage (only if file has storage_path - folders don't)
      if (file.storage_path) {
        const storageClient = getStorageClient()
        const { error: deleteError } = await storageClient.storage
          .from(BUCKET_NAME)
          .remove([file.storage_path])

        if (deleteError) {
          console.error('Storage delete error:', deleteError)
          // Continue with database deletion even if storage fails
        }
      }

      // Delete from database (cascades to links)
      await prisma.workspaceFile.delete({ where: { id: fileId } })

      // Story 17.9 — de-index the file's RAG chunks. ContentChunk has no FK to its
      // polymorphic source, so onDelete: Cascade is infeasible — clean up manually
      // here so the agent can never retrieve a deleted file's content.
      await prisma.contentChunk.deleteMany({
        where: { source_type: 'USER_FILE', source_id: fileId },
      })

      revalidatePath('/filer')
      revalidatePath('/tasks')
      revalidatePath('/laglistor')
      return { success: true }
    })
  } catch (error) {
    console.error('deleteFile error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

// ============================================================================
// File Link Actions
// ============================================================================

/**
 * Link a file to a task
 */
export async function linkFileToTask(
  fileId: string,
  taskId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Verify file and task belong to workspace
      const [file, task] = await Promise.all([
        prisma.workspaceFile.findFirst({
          where: { id: fileId, workspace_id: workspaceId },
        }),
        prisma.task.findFirst({
          where: { id: taskId, workspace_id: workspaceId },
        }),
      ])

      if (!file) {
        return { success: false, error: 'Filen hittades inte' }
      }
      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      // Create link (upsert to handle duplicates)
      await prisma.fileTaskLink.upsert({
        where: { file_id_task_id: { file_id: fileId, task_id: taskId } },
        create: { file_id: fileId, task_id: taskId, linked_by: userId },
        update: {},
      })

      revalidatePath('/filer')
      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    console.error('linkFileToTask error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Link a file to a law list item
 */
export async function linkFileToListItem(
  fileId: string,
  listItemId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Verify file belongs to workspace
      const file = await prisma.workspaceFile.findFirst({
        where: { id: fileId, workspace_id: workspaceId },
      })

      if (!file) {
        return { success: false, error: 'Filen hittades inte' }
      }

      // Verify list item belongs to workspace
      const listItem = await prisma.lawListItem.findFirst({
        where: {
          id: listItemId,
          law_list: { workspace_id: workspaceId },
        },
      })

      if (!listItem) {
        return { success: false, error: 'Lagpunkten hittades inte' }
      }

      // Create link (upsert to handle duplicates)
      await prisma.fileListItemLink.upsert({
        where: {
          file_id_list_item_id: { file_id: fileId, list_item_id: listItemId },
        },
        create: {
          file_id: fileId,
          list_item_id: listItemId,
          linked_by: userId,
        },
        update: {},
      })

      revalidatePath('/filer')
      revalidatePath('/laglistor')
      return { success: true }
    })
  } catch (error) {
    console.error('linkFileToListItem error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Unlink a file from a task or list item
 */
export async function unlinkFile(
  fileId: string,
  entityType: 'task' | 'list_item',
  entityId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      // Verify file belongs to workspace
      const file = await prisma.workspaceFile.findFirst({
        where: { id: fileId, workspace_id: workspaceId },
      })

      if (!file) {
        return { success: false, error: 'Filen hittades inte' }
      }

      if (entityType === 'task') {
        await prisma.fileTaskLink.deleteMany({
          where: { file_id: fileId, task_id: entityId },
        })
        revalidatePath('/tasks')
      } else {
        await prisma.fileListItemLink.deleteMany({
          where: { file_id: fileId, list_item_id: entityId },
        })
        revalidatePath('/laglistor')
      }

      revalidatePath('/filer')
      return { success: true }
    })
  } catch (error) {
    console.error('unlinkFile error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Link multiple files to a task at once
 */
export async function linkFilesToTask(
  fileIds: string[],
  taskId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Verify task belongs to workspace
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspace_id: workspaceId },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      // Verify all files belong to workspace
      const files = await prisma.workspaceFile.findMany({
        where: { id: { in: fileIds }, workspace_id: workspaceId },
      })

      if (files.length !== fileIds.length) {
        return { success: false, error: 'Några filer hittades inte' }
      }

      // Create links (skip duplicates)
      for (const fileId of fileIds) {
        await prisma.fileTaskLink.upsert({
          where: { file_id_task_id: { file_id: fileId, task_id: taskId } },
          create: { file_id: fileId, task_id: taskId, linked_by: userId },
          update: {},
        })
      }

      revalidatePath('/filer')
      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    console.error('linkFilesToTask error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Link multiple files to a law list item at once
 */
export async function linkFilesToListItem(
  fileIds: string[],
  listItemId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Verify list item belongs to workspace
      const listItem = await prisma.lawListItem.findFirst({
        where: {
          id: listItemId,
          law_list: { workspace_id: workspaceId },
        },
      })

      if (!listItem) {
        return { success: false, error: 'Lagpunkten hittades inte' }
      }

      // Verify all files belong to workspace
      const files = await prisma.workspaceFile.findMany({
        where: { id: { in: fileIds }, workspace_id: workspaceId },
      })

      if (files.length !== fileIds.length) {
        return { success: false, error: 'Några filer hittades inte' }
      }

      // Create links (skip duplicates)
      for (const fileId of fileIds) {
        await prisma.fileListItemLink.upsert({
          where: {
            file_id_list_item_id: { file_id: fileId, list_item_id: listItemId },
          },
          create: {
            file_id: fileId,
            list_item_id: listItemId,
            linked_by: userId,
          },
          update: {},
        })
      }

      revalidatePath('/filer')
      revalidatePath('/laglistor')
      return { success: true }
    })
  } catch (error) {
    console.error('linkFilesToListItem error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

// ============================================================================
// Download Action
// ============================================================================

/**
 * Get a signed download URL for a file
 * URL is valid for 1 hour
 */
export async function getFileDownloadUrl(
  fileId: string
): Promise<ActionResult<{ url: string }>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const file = await prisma.workspaceFile.findFirst({
        where: { id: fileId, workspace_id: workspaceId },
      })

      if (!file) {
        return { success: false, error: 'Filen hittades inte' }
      }

      // Folders don't have storage_path
      if (!file.storage_path) {
        return { success: false, error: 'Mappar kan inte laddas ner' }
      }

      const storageClient = getStorageClient()
      const { data, error } = await storageClient.storage
        .from(BUCKET_NAME)
        .createSignedUrl(file.storage_path, 60 * 60) // 1 hour

      if (error || !data?.signedUrl) {
        console.error('Signed URL error:', error)
        return { success: false, error: 'Kunde inte skapa nedladdningslänk' }
      }

      return { success: true, data: { url: data.signedUrl } }
    })
  } catch (error) {
    console.error('getFileDownloadUrl error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

// ============================================================================
// Bulk Actions
// ============================================================================

/**
 * Delete multiple files (uploader or admin only)
 */
export async function deleteFilesBulk(
  fileIds: string[]
): Promise<ActionResult<{ deleted: number }>> {
  try {
    if (fileIds.length > 50) {
      return { success: false, error: 'Max 50 filer kan raderas åt gången' }
    }

    return await withWorkspace(async ({ workspaceId, userId }) => {
      const member = await prisma.workspaceMember.findFirst({
        where: { workspace_id: workspaceId, user_id: userId },
      })

      const isAdmin = member?.role === 'ADMIN' || member?.role === 'OWNER'

      // Get files that user can delete
      const files = await prisma.workspaceFile.findMany({
        where: {
          id: { in: fileIds },
          workspace_id: workspaceId,
          ...(isAdmin ? {} : { uploaded_by: userId }), // Admins can delete any, others only their own
        },
      })

      if (files.length === 0) {
        return { success: false, error: 'Inga filer att radera' }
      }

      // Story 21.26 — evidence-snapshot deletion guard removed alongside the
      // SEALED collapse and the ComplianceEvidenceSnapshot model deletion.

      // Delete from storage (filter out folders which don't have storage_path)
      const paths = files
        .map((f) => f.storage_path)
        .filter((p): p is string => p !== null)
      if (paths.length > 0) {
        const storageClient = getStorageClient()
        await storageClient.storage.from(BUCKET_NAME).remove(paths)
      }

      // Delete from database. `deletedIds` is the permission-filtered set actually
      // deleted (admins: any; others: own only) — never the raw `fileIds` input.
      const deletedIds = files.map((f) => f.id)
      const deleteResult = await prisma.workspaceFile.deleteMany({
        where: { id: { in: deletedIds } },
      })

      // Story 17.9 — de-index RAG chunks for exactly those files. ContentChunk has
      // no FK to its polymorphic source, so cleanup is manual; mirroring the
      // permission-filtered set guarantees we never de-index a file the caller
      // couldn't delete.
      await prisma.contentChunk.deleteMany({
        where: { source_type: 'USER_FILE', source_id: { in: deletedIds } },
      })

      revalidatePath('/filer')
      revalidatePath('/tasks')
      revalidatePath('/laglistor')
      return { success: true, data: { deleted: deleteResult.count } }
    })
  } catch (error) {
    console.error('deleteFilesBulk error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Update category for multiple files
 */
export async function updateFilesCategoryBulk(
  fileIds: string[],
  category: FileCategory
): Promise<ActionResult<{ updated: number }>> {
  try {
    if (fileIds.length > 50) {
      return { success: false, error: 'Max 50 filer kan uppdateras åt gången' }
    }

    return await withWorkspace(async ({ workspaceId }) => {
      const result = await prisma.workspaceFile.updateMany({
        where: {
          id: { in: fileIds },
          workspace_id: workspaceId,
        },
        data: { category },
      })

      revalidatePath('/filer')
      return { success: true, data: { updated: result.count } }
    })
  } catch (error) {
    console.error('updateFilesCategoryBulk error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

// ============================================================================
// Story 6.7b: Folder CRUD Actions
// ============================================================================

/** Folder data type */
export interface FolderInfo {
  id: string
  filename: string
  parent_folder_id: string | null
  workspace_id: string
  created_at: Date
  updated_at: Date
}

/** Folder tree node for sidebar */
export interface FolderTreeNode {
  id: string
  name: string
  parent_folder_id: string | null
  children: FolderTreeNode[]
  hasChildren: boolean
}

/** Breadcrumb segment */
export interface BreadcrumbSegment {
  id: string | null
  name: string
  path: string
}

/**
 * Create a new folder
 * AC: 1, 2, 3, 27 - Folder creation with nesting limits and name validation
 */
export async function createFolder(data: {
  name: string
  parentFolderId?: string | null
}): Promise<ActionResult<FolderInfo>> {
  try {
    const validated = CreateFolderSchema.parse(data)

    // Security: Path traversal check
    if (!validatePathSegments([validated.name])) {
      return { success: false, error: 'Ogiltig sökväg' }
    }

    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Check for duplicate name in same folder
      const existing = await prisma.workspaceFile.findFirst({
        where: {
          workspace_id: workspaceId,
          parent_folder_id: validated.parentFolderId ?? null,
          filename: validated.name,
        },
      })

      if (existing) {
        return {
          success: false,
          error: 'En mapp eller fil med det namnet finns redan',
        }
      }

      // If parent specified, verify it exists and is a folder
      if (validated.parentFolderId) {
        const parent = await prisma.workspaceFile.findFirst({
          where: {
            id: validated.parentFolderId,
            workspace_id: workspaceId,
            is_folder: true,
          },
        })
        if (!parent) {
          return { success: false, error: 'Överordnad mapp hittades inte' }
        }

        // Check depth (max 5 levels)
        const depth = await getFolderDepth(validated.parentFolderId)
        if (depth >= 5) {
          return {
            success: false,
            error: 'Maximal mappdjup (5 nivåer) har nåtts',
          }
        }
      }

      const folder = await prisma.workspaceFile.create({
        data: {
          workspace_id: workspaceId,
          uploaded_by: userId,
          parent_folder_id: validated.parentFolderId ?? null,
          is_folder: true,
          filename: validated.name,
          category: 'OVRIGT',
          // File-specific fields are null for folders
          original_filename: null,
          file_size: null,
          mime_type: null,
          storage_path: null,
        },
      })

      revalidatePath('/filer')
      return {
        success: true,
        data: {
          id: folder.id,
          filename: folder.filename,
          parent_folder_id: folder.parent_folder_id,
          workspace_id: folder.workspace_id,
          created_at: folder.created_at,
          updated_at: folder.updated_at,
        },
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltiga data',
      }
    }
    console.error('createFolder error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Rename a folder
 * AC: 7, 28 - Folder rename with name validation
 */
export async function renameFolder(data: {
  folderId: string
  newName: string
}): Promise<ActionResult<FolderInfo>> {
  try {
    const validated = RenameFolderSchema.parse(data)

    // Security: Path traversal check
    if (!validatePathSegments([validated.newName])) {
      return { success: false, error: 'Ogiltig sökväg' }
    }

    return await withWorkspace(async ({ workspaceId }) => {
      const folder = await prisma.workspaceFile.findFirst({
        where: {
          id: validated.folderId,
          workspace_id: workspaceId,
          is_folder: true,
        },
      })

      if (!folder) {
        return { success: false, error: 'Mappen hittades inte' }
      }

      // Check for duplicate name in same parent folder
      const existing = await prisma.workspaceFile.findFirst({
        where: {
          workspace_id: workspaceId,
          parent_folder_id: folder.parent_folder_id,
          filename: validated.newName,
          id: { not: validated.folderId },
        },
      })

      if (existing) {
        return {
          success: false,
          error: 'En mapp eller fil med det namnet finns redan',
        }
      }

      const updated = await prisma.workspaceFile.update({
        where: { id: validated.folderId },
        data: { filename: validated.newName },
      })

      revalidatePath('/filer')
      return {
        success: true,
        data: {
          id: updated.id,
          filename: updated.filename,
          parent_folder_id: updated.parent_folder_id,
          workspace_id: updated.workspace_id,
          created_at: updated.created_at,
          updated_at: updated.updated_at,
        },
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltiga data',
      }
    }
    console.error('renameFolder error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Move a file or folder to a new location
 * AC: 6, 28 - Move with cycle detection for folders
 */
export async function moveItem(data: {
  itemId: string
  targetFolderId: string | null
}): Promise<ActionResult> {
  try {
    const validated = MoveItemSchema.parse(data)

    return await withWorkspace(async ({ workspaceId }) => {
      const item = await prisma.workspaceFile.findFirst({
        where: {
          id: validated.itemId,
          workspace_id: workspaceId,
        },
      })

      if (!item) {
        return { success: false, error: 'Filen eller mappen hittades inte' }
      }

      // If target folder specified, verify it exists and is a folder
      if (validated.targetFolderId) {
        const targetFolder = await prisma.workspaceFile.findFirst({
          where: {
            id: validated.targetFolderId,
            workspace_id: workspaceId,
            is_folder: true,
          },
        })

        if (!targetFolder) {
          return { success: false, error: 'Målmappen hittades inte' }
        }

        // If moving a folder, check for cycles
        if (item.is_folder) {
          const hasCycle = await wouldCreateCycle(
            validated.itemId,
            validated.targetFolderId
          )
          if (hasCycle) {
            return {
              success: false,
              error:
                'Kan inte flytta en mapp till sig själv eller en undermapp',
            }
          }
        }

        // Check nesting depth
        const depth = await getFolderDepth(validated.targetFolderId)
        if (depth >= 5) {
          return {
            success: false,
            error: 'Maximal mappdjup (5 nivåer) har nåtts',
          }
        }
      }

      // Check for duplicate name in target folder
      const existing = await prisma.workspaceFile.findFirst({
        where: {
          workspace_id: workspaceId,
          parent_folder_id: validated.targetFolderId,
          filename: item.filename,
          id: { not: validated.itemId },
        },
      })

      if (existing) {
        return {
          success: false,
          error: 'En fil eller mapp med samma namn finns redan i målmappen',
        }
      }

      await prisma.workspaceFile.update({
        where: { id: validated.itemId },
        data: { parent_folder_id: validated.targetFolderId },
      })

      revalidatePath('/filer')
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltiga data',
      }
    }
    console.error('moveItem error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Delete a folder
 * AC: 7, 28 - Delete with confirmation for non-empty folders
 * Note: Cascade delete is handled by the database FK constraint
 */
export async function deleteFolder(
  folderId: string,
  confirmNonEmpty?: boolean
): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const folder = await prisma.workspaceFile.findFirst({
        where: {
          id: folderId,
          workspace_id: workspaceId,
          is_folder: true,
        },
        include: {
          children: {
            take: 1, // Just check if any children exist
          },
        },
      })

      if (!folder) {
        return { success: false, error: 'Mappen hittades inte' }
      }

      // Check permission (uploader or admin/owner)
      const member = await prisma.workspaceMember.findFirst({
        where: { workspace_id: workspaceId, user_id: userId },
      })

      const isUploader = folder.uploaded_by === userId
      const isAdmin = member?.role === 'ADMIN' || member?.role === 'OWNER'

      if (!isUploader && !isAdmin) {
        return {
          success: false,
          error: 'Du har inte behörighet att radera denna mapp',
        }
      }

      // Check if folder has contents
      const hasContents = folder.children.length > 0
      if (hasContents && !confirmNonEmpty) {
        return {
          success: false,
          error: 'FOLDER_NOT_EMPTY',
        }
      }

      // Get all descendant files (for storage cleanup)
      const allDescendants = await getDescendantFiles(folderId, workspaceId)

      // Delete files from storage
      const storagePaths = allDescendants
        .map((f) => f.storage_path)
        .filter((p): p is string => p !== null)

      if (storagePaths.length > 0) {
        const storageClient = getStorageClient()
        await storageClient.storage.from(BUCKET_NAME).remove(storagePaths)
      }

      // Delete folder (cascade deletes children)
      await prisma.workspaceFile.delete({ where: { id: folderId } })

      revalidatePath('/filer')
      return {
        success: true,
        data: { deletedCount: allDescendants.length + 1 },
      }
    })
  } catch (error) {
    console.error('deleteFolder error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Helper: Get all descendant files (recursive)
 */
async function getDescendantFiles(
  folderId: string,
  workspaceId: string
): Promise<Array<{ id: string; storage_path: string | null }>> {
  const children = await prisma.workspaceFile.findMany({
    where: {
      parent_folder_id: folderId,
      workspace_id: workspaceId,
    },
    select: { id: true, storage_path: true, is_folder: true },
  })

  const descendants: Array<{ id: string; storage_path: string | null }> = []

  for (const child of children) {
    descendants.push({ id: child.id, storage_path: child.storage_path })
    if (child.is_folder) {
      const subDescendants = await getDescendantFiles(child.id, workspaceId)
      descendants.push(...subDescendants)
    }
  }

  return descendants
}

/**
 * Get folder tree for sidebar navigation
 * AC: 4, 35 - Full folder tree with lazy loading support
 */
export async function getFolderTree(): Promise<ActionResult<FolderTreeNode[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      // Get all folders for this workspace
      const folders = await prisma.workspaceFile.findMany({
        where: {
          workspace_id: workspaceId,
          is_folder: true,
        },
        select: {
          id: true,
          filename: true,
          parent_folder_id: true,
          _count: { select: { children: true } },
        },
        orderBy: { filename: 'asc' },
      })

      // Build tree structure
      const folderMap = new Map<string, FolderTreeNode>()
      const rootFolders: FolderTreeNode[] = []

      // First pass: create all nodes
      for (const folder of folders) {
        folderMap.set(folder.id, {
          id: folder.id,
          name: folder.filename,
          parent_folder_id: folder.parent_folder_id,
          children: [],
          hasChildren: folder._count.children > 0,
        })
      }

      // Second pass: build tree
      for (const folder of folders) {
        const node = folderMap.get(folder.id)!
        if (folder.parent_folder_id) {
          const parent = folderMap.get(folder.parent_folder_id)
          if (parent) {
            parent.children.push(node)
          }
        } else {
          rootFolders.push(node)
        }
      }

      return { success: true, data: rootFolders }
    })
  } catch (error) {
    console.error('getFolderTree error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get contents of a folder (files and subfolders)
 * AC: 9, 10 - Folder contents with sorting and filtering
 */
export async function getFolderContents(
  folderId: string | null,
  options?: {
    filters?: FileFilters
    pagination?: { page?: number; limit?: number }
    sortBy?: 'name' | 'modified' | 'size' | 'type'
    sortOrder?: 'asc' | 'desc'
  }
): Promise<ActionResult<PaginatedFilesResult & { folders: FolderInfo[] }>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const page = Math.max(1, options?.pagination?.page || 1)
      const limit = Math.min(100, Math.max(1, options?.pagination?.limit || 24))
      const offset = (page - 1) * limit
      const sortBy = options?.sortBy || 'name'
      const sortOrder = options?.sortOrder || 'asc'

      // If folderId specified, verify it exists
      if (folderId) {
        const folder = await prisma.workspaceFile.findFirst({
          where: {
            id: folderId,
            workspace_id: workspaceId,
            is_folder: true,
          },
        })
        if (!folder) {
          return { success: false, error: 'Mappen hittades inte' }
        }
      }

      // Build order by clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let orderBy: any = { filename: sortOrder }
      if (sortBy === 'modified') {
        orderBy = { updated_at: sortOrder }
      } else if (sortBy === 'size') {
        orderBy = { file_size: sortOrder }
      } else if (sortBy === 'type') {
        orderBy = { mime_type: sortOrder }
      }

      // Build where clause for files
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        workspace_id: workspaceId,
        parent_folder_id: folderId,
        is_folder: false, // Only files in file list
      }

      if (options?.filters?.category) {
        where.category = options.filters.category
      }
      if (options?.filters?.uploadedBy) {
        where.uploaded_by = options.filters.uploadedBy
      }
      if (options?.filters?.search) {
        where.OR = [
          {
            filename: { contains: options.filters.search, mode: 'insensitive' },
          },
          {
            original_filename: {
              contains: options.filters.search,
              mode: 'insensitive',
            },
          },
        ]
      }
      // Attachment filter: standalone vs linked. Uses a dedicated AND array so
      // it never collides with the search OR above (both are ANDed together).
      if (options?.filters?.linkState === 'linked') {
        where.AND = [
          {
            OR: [
              { task_links: { some: {} } },
              { list_item_links: { some: {} } },
              { requirement_evidence_links: { some: {} } },
            ],
          },
        ]
      } else if (options?.filters?.linkState === 'standalone') {
        where.AND = [
          { task_links: { none: {} } },
          { list_item_links: { none: {} } },
          { requirement_evidence_links: { none: {} } },
        ]
      }

      // Get folders in this directory (separate query, always shown first)
      const folders = await prisma.workspaceFile.findMany({
        where: {
          workspace_id: workspaceId,
          parent_folder_id: folderId,
          is_folder: true,
        },
        orderBy: { filename: 'asc' },
      })

      // Get files count
      const totalCount = await prisma.workspaceFile.count({ where })

      // Get files with pagination
      const files = await prisma.workspaceFile.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy,
        include: {
          uploader: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar_url: true,
            },
          },
          task_links: {
            include: {
              task: {
                select: { id: true, title: true },
              },
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
          requirement_evidence_links: {
            include: {
              requirement: {
                select: {
                  id: true,
                  text: true,
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
          },
        },
      })

      const totalPages = Math.ceil(totalCount / limit)

      return {
        success: true,
        data: {
          folders: folders.map((f) => ({
            id: f.id,
            filename: f.filename,
            parent_folder_id: f.parent_folder_id,
            workspace_id: f.workspace_id,
            created_at: f.created_at,
            updated_at: f.updated_at,
          })),
          files: files as WorkspaceFileWithLinks[],
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
      }
    })
  } catch (error) {
    console.error('getFolderContents error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get breadcrumb path for a folder
 * AC: 5 - Breadcrumb navigation array
 */
export async function getFolderPath(
  folderId: string | null
): Promise<ActionResult<BreadcrumbSegment[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const segments: BreadcrumbSegment[] = [
        { id: null, name: 'Filer', path: '/filer' },
      ]

      if (!folderId) {
        return { success: true, data: segments }
      }

      // Walk up the tree from the folder to root
      const pathSegments: { id: string; name: string }[] = []
      let currentId: string | null = folderId

      while (currentId) {
        const folderResult: {
          id: string
          filename: string
          parent_folder_id: string | null
        } | null = await prisma.workspaceFile.findFirst({
          where: {
            id: currentId,
            workspace_id: workspaceId,
            is_folder: true,
          },
          select: { id: true, filename: true, parent_folder_id: true },
        })

        if (!folderResult) break

        pathSegments.unshift({
          id: folderResult.id,
          name: folderResult.filename,
        })
        currentId = folderResult.parent_folder_id
      }

      // Build path URLs
      let currentPath = '/filer'
      for (const seg of pathSegments) {
        currentPath += `/${encodeURIComponent(seg.name)}`
        segments.push({ id: seg.id, name: seg.name, path: currentPath })
      }

      return { success: true, data: segments }
    })
  } catch (error) {
    console.error('getFolderPath error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get aggregated size of folder contents
 * AC: 30 - Folder size display
 */
export async function getFolderSize(
  folderId: string
): Promise<ActionResult<{ size: number; fileCount: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const folder = await prisma.workspaceFile.findFirst({
        where: {
          id: folderId,
          workspace_id: workspaceId,
          is_folder: true,
        },
      })

      if (!folder) {
        return { success: false, error: 'Mappen hittades inte' }
      }

      // Get all descendant files
      const descendants = await getDescendantFiles(folderId, workspaceId)
      const fileIds = descendants.map((d) => d.id)

      // Get sizes
      const result = await prisma.workspaceFile.aggregate({
        where: { id: { in: fileIds }, is_folder: false },
        _sum: { file_size: true },
        _count: true,
      })

      return {
        success: true,
        data: {
          size: result._sum.file_size || 0,
          fileCount: result._count,
        },
      }
    })
  } catch (error) {
    console.error('getFolderSize error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Resolve folder from URL path segments
 * Used for URL-based folder routing
 */
export async function resolveFolderFromPath(
  pathSegments: string[]
): Promise<ActionResult<FolderInfo | null>> {
  try {
    // Security: Validate path segments
    if (!validatePathSegments(pathSegments)) {
      return { success: false, error: 'Ogiltig sökväg' }
    }

    return await withWorkspace(async ({ workspaceId }) => {
      if (pathSegments.length === 0) {
        return { success: true, data: null }
      }

      let currentFolderId: string | null = null

      for (const segment of pathSegments) {
        const folderResult: { id: string } | null =
          await prisma.workspaceFile.findFirst({
            where: {
              workspace_id: workspaceId,
              parent_folder_id: currentFolderId,
              filename: decodeURIComponent(segment),
              is_folder: true,
            },
            select: { id: true },
          })

        if (!folderResult) {
          return { success: false, error: 'Mappen hittades inte' }
        }

        currentFolderId = folderResult.id
      }

      const finalFolder = await prisma.workspaceFile.findUnique({
        where: { id: currentFolderId! },
      })

      if (!finalFolder) {
        return { success: false, error: 'Mappen hittades inte' }
      }

      return {
        success: true,
        data: {
          id: finalFolder.id,
          filename: finalFolder.filename,
          parent_folder_id: finalFolder.parent_folder_id,
          workspace_id: finalFolder.workspace_id,
          created_at: finalFolder.created_at,
          updated_at: finalFolder.updated_at,
        },
      }
    })
  } catch (error) {
    console.error('resolveFolderFromPath error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

// ============================================================================
// Query Helpers for UI
// ============================================================================

/**
 * Get files linked to a specific task
 */
export async function getFilesForTask(
  taskId: string
): Promise<ActionResult<WorkspaceFileWithLinks[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspace_id: workspaceId },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      const links = await prisma.fileTaskLink.findMany({
        where: { task_id: taskId },
        include: {
          file: {
            include: {
              uploader: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar_url: true,
                },
              },
              task_links: {
                include: {
                  task: {
                    select: { id: true, title: true },
                  },
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
              requirement_evidence_links: {
                include: {
                  requirement: {
                    select: {
                      id: true,
                      text: true,
                      list_item: {
                        select: {
                          id: true,
                          document: {
                            select: {
                              title: true,
                              document_number: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      const files = links.map((link) => link.file) as WorkspaceFileWithLinks[]
      return { success: true, data: files }
    })
  } catch (error) {
    console.error('getFilesForTask error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get files linked to a specific law list item
 */
export async function getFilesForListItem(
  listItemId: string
): Promise<ActionResult<WorkspaceFileWithLinks[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const listItem = await prisma.lawListItem.findFirst({
        where: {
          id: listItemId,
          law_list: { workspace_id: workspaceId },
        },
      })

      if (!listItem) {
        return { success: false, error: 'Lagpunkten hittades inte' }
      }

      const links = await prisma.fileListItemLink.findMany({
        where: { list_item_id: listItemId },
        include: {
          file: {
            include: {
              uploader: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar_url: true,
                },
              },
              task_links: {
                include: {
                  task: {
                    select: { id: true, title: true },
                  },
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
              requirement_evidence_links: {
                include: {
                  requirement: {
                    select: {
                      id: true,
                      text: true,
                      list_item: {
                        select: {
                          id: true,
                          document: {
                            select: {
                              title: true,
                              document_number: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      const files = links.map((link) => link.file) as WorkspaceFileWithLinks[]
      return { success: true, data: files }
    })
  } catch (error) {
    console.error('getFilesForListItem error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}
