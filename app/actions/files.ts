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
import type { FileCategory } from '@prisma/client'

// ============================================================================
// Constants
// ============================================================================

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const BUCKET_NAME = 'workspace-files'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
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
}

export interface FileFilters {
  category?: FileCategory
  uploadedBy?: string
  dateFrom?: Date
  dateTo?: Date
  search?: string
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
    .enum(['BEVIS', 'POLICY', 'AVTAL', 'CERTIFIKAT', 'OVRIGT'])
    .optional(),
  description: z.string().max(1000).optional().nullable(),
})

// ============================================================================
// Upload Actions
// ============================================================================

/**
 * Upload a file to workspace storage
 * Creates database record and stores file in Supabase Storage
 */
export async function uploadFile(
  formData: FormData
): Promise<ActionResult<WorkspaceFileWithLinks>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const file = formData.get('file') as File
      if (!file || !(file instanceof File)) {
        return { success: false, error: 'Ingen fil vald' }
      }

      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return { success: false, error: 'Otillåten filtyp' }
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return { success: false, error: 'Filen är för stor (max 25MB)' }
      }

      // Get optional category from formData
      const categoryValue = formData.get('category') as string | null
      const category = (categoryValue as FileCategory) || 'OVRIGT'

      // Generate unique file ID
      const fileId = crypto.randomUUID()
      const storagePath = `${workspaceId}/files/${fileId}/${file.name}`

      // Convert File to Buffer for upload
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Upload to Supabase Storage
      const storageClient = getStorageClient()
      const { error: uploadError } = await storageClient.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        return { success: false, error: 'Kunde inte ladda upp filen' }
      }

      // Create database record
      const workspaceFile = await prisma.workspaceFile.create({
        data: {
          id: fileId,
          workspace_id: workspaceId,
          uploaded_by: userId,
          filename: file.name,
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          storage_path: storagePath,
          category,
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
        },
      })

      revalidatePath('/documents')
      return { success: true, data: workspaceFile as WorkspaceFileWithLinks }
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
      revalidatePath('/documents')
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
      revalidatePath('/documents')
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
        },
      })

      revalidatePath('/documents')
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

      // Delete from storage
      const storageClient = getStorageClient()
      const { error: deleteError } = await storageClient.storage
        .from(BUCKET_NAME)
        .remove([file.storage_path])

      if (deleteError) {
        console.error('Storage delete error:', deleteError)
        // Continue with database deletion even if storage fails
      }

      // Delete from database (cascades to links)
      await prisma.workspaceFile.delete({ where: { id: fileId } })

      revalidatePath('/documents')
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

      revalidatePath('/documents')
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

      revalidatePath('/documents')
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

      revalidatePath('/documents')
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

      revalidatePath('/documents')
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

      revalidatePath('/documents')
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

      // Delete from storage
      const storageClient = getStorageClient()
      const paths = files.map((f) => f.storage_path)
      await storageClient.storage.from(BUCKET_NAME).remove(paths)

      // Delete from database
      const deleteResult = await prisma.workspaceFile.deleteMany({
        where: { id: { in: files.map((f) => f.id) } },
      })

      revalidatePath('/documents')
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

      revalidatePath('/documents')
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
