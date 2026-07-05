/**
 * Story 7.6 (DUP-001): shared storage-upload core.
 *
 * ONE implementation of the workspace-file upload legs that
 * `app/actions/files.ts#uploadFile` and
 * `app/actions/collective-agreements.ts#uploadCollectiveAgreement` previously
 * duplicated: file validation (mime allowlist + 25MB cap), same-folder
 * filename dedupe, the storage-quota gate, filename sanitization, sha256
 * content hash, and the Supabase Storage write (`upsert: false`).
 *
 * The callers keep their own DB-row creation (different shapes/includes),
 * their own FormData contracts and their own revalidate paths — this module
 * owns exactly the shared storage staging, nothing else. Behavior is kept
 * byte-equivalent with the pre-7.6 implementations (identical error copy,
 * identical ordering: dedupe → quota → sanitize/hash → upload).
 */

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getStorageClient } from '@/lib/supabase/storage'
import {
  assertWithinStorageQuota,
  formatBytesSwedish,
  StorageQuotaExceededError,
  type StorageWarning,
} from '@/lib/usage/storage'
import { isExtractableMimeType } from '@/lib/documents/extractable-mime'
import type { FileExtractionStatus } from '@prisma/client'

// ============================================================================
// Constants (single source — previously duplicated per action module)
// ============================================================================

export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
export const BUCKET_NAME = 'workspace-files'
export const PDF_MIME_TYPE = 'application/pdf'

export const ALLOWED_MIME_TYPES = [
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
  // Story 17.8: plain-text formats are extractable (direct → markdown).
  'text/plain',
  'text/markdown',
  'text/csv',
] as const

// ============================================================================
// Validation (presence → mime allowlist → size, in that order)
// ============================================================================

export type UploadFileValidation =
  | { ok: true; file: File }
  | { ok: false; error: string }

/**
 * Validate an uploaded FormData entry: present, allowed mime type, ≤25MB.
 * The mime allowlist and its error copy are caller-supplied (Filer accepts
 * the full document set; kollektivavtal is PDF-only with domain copy).
 */
export function validateUploadFile(
  candidate: FormDataEntryValue | null,
  options: { allowedMimeTypes: readonly string[]; typeError: string }
): UploadFileValidation {
  if (!candidate || !(candidate instanceof File)) {
    return { ok: false, error: 'Ingen fil vald' }
  }
  if (!options.allowedMimeTypes.includes(candidate.type)) {
    return { ok: false, error: options.typeError }
  }
  if (candidate.size > MAX_FILE_SIZE) {
    return { ok: false, error: 'Filen är för stor (max 25MB)' }
  }
  return { ok: true, file: candidate }
}

// ============================================================================
// Storage staging (dedupe → quota → sanitize/hash → upload)
// ============================================================================

export interface StagedUpload {
  fileId: string
  storagePath: string
  contentHash: string
  /** PENDING self-queues the file for the extract-files cron; else UNSUPPORTED. */
  extractionStatus: Extract<FileExtractionStatus, 'PENDING' | 'UNSUPPORTED'>
  /** Story 5.5b soft-warn payload when storage usage crosses 80%. */
  warning?: StorageWarning | undefined
}

export type StageUploadResult =
  | ({ ok: true } & StagedUpload)
  | { ok: false; error: string; code?: string }

/**
 * Run the shared pre-DB upload legs for a validated file. On success the
 * Storage object exists and the caller creates its own WorkspaceFile row from
 * the staged values. Quota failures return the structured
 * `STORAGE_QUOTA_EXCEEDED` code; unexpected quota errors rethrow (caller's
 * catch-all owns those).
 */
export async function stageWorkspaceFileUpload(params: {
  workspaceId: string
  file: File
  parentFolderId: string | null
  /** Same-folder duplicate-filename error copy (caller-context wording). */
  duplicateError: string
}): Promise<StageUploadResult> {
  const { workspaceId, file, parentFolderId, duplicateError } = params

  // Duplicate filename in the target folder (workspace-scoped).
  const existingFile = await prisma.workspaceFile.findFirst({
    where: {
      workspace_id: workspaceId,
      parent_folder_id: parentFolderId,
      filename: file.name,
    },
  })
  if (existingFile) {
    return { ok: false, error: duplicateError }
  }

  // Storage-quota gate BEFORE the Storage write so a blocked upload never
  // creates an orphaned object.
  let warning: StorageWarning | undefined
  try {
    const result = await assertWithinStorageQuota(workspaceId, file.size)
    warning = result.warning
  } catch (error) {
    if (error instanceof StorageQuotaExceededError) {
      return {
        ok: false,
        error: `Lagringsgräns uppnådd. Du har använt ${formatBytesSwedish(error.currentBytes)} av ${formatBytesSwedish(error.limitBytes)}. Filen kunde inte laddas upp. Frigör utrymme eller uppgradera planen.`,
        code: 'STORAGE_QUOTA_EXCEEDED',
      }
    }
    throw error
  }

  const fileId = crypto.randomUUID()
  // Supabase Storage rejects spaces and most non-ASCII chars in keys —
  // sanitize the filename portion while keeping the original on the row.
  const safeFileName = file.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
  const storagePath = `${workspaceId}/files/${fileId}/${safeFileName}`

  const buffer = Buffer.from(await file.arrayBuffer())
  // Story 17.8: content hash (dedupe + 17.9 incremental sync).
  const contentHash = createHash('sha256').update(buffer).digest('hex')

  const storageClient = getStorageClient()
  const { error: uploadError } = await storageClient.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })
  if (uploadError) {
    console.error('[upload-core] storage upload error:', uploadError)
    return { ok: false, error: 'Kunde inte ladda upp filen' }
  }

  return {
    ok: true,
    fileId,
    storagePath,
    contentHash,
    // Story 17.8: queue extractable types for the extract-files cron; others
    // are UNSUPPORTED. Extraction never runs inline (Vercel).
    extractionStatus: isExtractableMimeType(file.type)
      ? 'PENDING'
      : 'UNSUPPORTED',
    ...(warning ? { warning } : {}),
  }
}
