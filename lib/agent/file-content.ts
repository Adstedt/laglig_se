/**
 * Story 19.2: shared file→content conversion core.
 *
 * Extracted from Story 19.1's `attachments-to-content.ts` so both the chat-attachment
 * converter (user-message parts) and the `read_file` agent tool (tool-result parts)
 * share ONE routing core: workspace-scoped lookup, PDF≤10 MB / image≤5 MB thresholds,
 * Supabase download, and on-demand extraction. The two callers differ only in how they
 * map the neutral `ResolvedFile` onto their respective content-part shapes.
 *
 * Workspace isolation: every lookup is scoped to the caller's `workspaceId`
 * (`findFirst({ where: { id, workspace_id } })`); a miss/mismatch resolves to
 * `kind: 'unavailable'`, never a thrown 403 and never another workspace's bytes.
 */

import { prisma } from '@/lib/prisma'
import { getStorageClient } from '@/lib/supabase/storage'
import { extractFile } from '@/lib/documents/extract-file'

export const PDF_INLINE_MAX = 10 * 1024 * 1024 // 10 MB → base64 document block
export const IMAGE_INLINE_MAX = 5 * 1024 * 1024 // 5 MB → base64 image block
export const PDF_MIME = 'application/pdf'
export const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif'])

const BUCKET = 'workspace-files'

export interface WorkspaceFileLite {
  id: string
  filename: string
  workspace_id: string
  is_folder: boolean
  mime_type: string | null
  file_size: number | null
  storage_path: string | null
  extracted_text: string | null
  extraction_status: string
}

/** The columns both callers need — shared so the select stays in one place. */
const FILE_SELECT = {
  id: true,
  filename: true,
  workspace_id: true,
  is_folder: true,
  mime_type: true,
  file_size: true,
  storage_path: true,
  extracted_text: true,
  extraction_status: true,
} as const

/** Lightweight read-kind for a file, derived from MIME + size alone (no IO). */
export type ContentKind = 'pdf' | 'image' | 'text' | 'unavailable'

export type UnavailableReason = 'not_found' | 'folder' | 'image' | 'no_content'

/** Fully resolved file ready to render (download + extraction already done). */
export type ResolvedFile =
  | { kind: 'pdf'; file: WorkspaceFileLite; bytes: Buffer; mediaType: string }
  | { kind: 'image'; file: WorkspaceFileLite; bytes: Buffer; mediaType: string }
  | { kind: 'text'; file: WorkspaceFileLite; text: string }
  | {
      kind: 'unavailable'
      file: WorkspaceFileLite | null
      reason: UnavailableReason
    }

/** Cheap classification (no download) for the lean `read_file` execute envelope. */
export type ClassifiedFile =
  | { ok: true; file: WorkspaceFileLite; contentKind: ContentKind }
  | {
      ok: false
      reason: 'not_found' | 'folder'
      file: WorkspaceFileLite | null
    }

/** Pure MIME/size → read-kind. Mirrors the routing in `resolveFileForReading`. */
export function classifyKind(mime: string, size: number): ContentKind {
  if (mime === PDF_MIME && size <= PDF_INLINE_MAX) return 'pdf'
  if (IMAGE_MIMES.has(mime))
    return size <= IMAGE_INLINE_MAX ? 'image' : 'unavailable'
  return 'text' // PDF > 10 MB, DOCX, XLSX, PPTX, other → extracted text
}

/** Download the raw bytes for a stored file (null on any storage error). */
export async function downloadBytes(
  storagePath: string
): Promise<Buffer | null> {
  try {
    const client = getStorageClient()
    const { data: blob, error } = await client.storage
      .from(BUCKET)
      .download(storagePath)
    if (error || !blob) return null
    return Buffer.from(await blob.arrayBuffer())
  } catch {
    return null
  }
}

/**
 * Resolve the text body for a file via `extracted_text`, running extraction
 * on-demand when the cron hasn't populated it yet. Best-effort persists the result
 * so a re-read (or a later promotion, Story 19.1b) is cached.
 */
export async function resolveText(
  file: WorkspaceFileLite
): Promise<string | null> {
  if (file.extracted_text && file.extracted_text.trim().length > 0) {
    return file.extracted_text
  }
  // On-demand extraction: the every-10-min cron may not have run yet.
  if (file.extraction_status === 'DONE' || !file.storage_path) return null
  const buffer = await downloadBytes(file.storage_path)
  if (!buffer) return null
  const result = await extractFile(buffer, file.mime_type)
  if (result.status === 'DONE' && result.markdown) {
    // Cache for re-reads / promotion. Best-effort — never block on a write error.
    try {
      await prisma.workspaceFile.update({
        where: { id: file.id },
        data: {
          extracted_text: result.markdown,
          extraction_status: 'DONE',
          extracted_at: new Date(),
        },
      })
    } catch {
      /* best-effort cache; the text is still returned below */
    }
    return result.markdown
  }
  return null
}

/**
 * Cheap, download-free classification for the `read_file` tool's `execute` envelope
 * (Story 19.2 AC 6 — keeps base64 out of the lean return / AgentDecisionLog). The
 * heavy download/extraction happens later in `resolveFileForReading` (via the tool's
 * `toModelOutput`).
 */
export async function classifyFileForReading(
  fileId: string,
  workspaceId: string
): Promise<ClassifiedFile> {
  const file = (await prisma.workspaceFile.findFirst({
    where: { id: fileId, workspace_id: workspaceId },
    select: FILE_SELECT,
  })) as WorkspaceFileLite | null

  if (!file) return { ok: false, reason: 'not_found', file: null }
  if (file.is_folder) return { ok: false, reason: 'folder', file }
  return {
    ok: true,
    file,
    contentKind: classifyKind(file.mime_type ?? '', file.file_size ?? 0),
  }
}

/**
 * Fully resolve a workspace file for reading: workspace-scoped lookup → size/MIME
 * routing → download (PDF/image) or extracted-text (with on-demand extraction).
 * Returns a neutral `ResolvedFile` that each caller maps to its own content shape.
 */
export async function resolveFileForReading(
  fileId: string,
  workspaceId: string
): Promise<ResolvedFile> {
  // Workspace isolation: scope the read to the caller's workspace.
  const file = (await prisma.workspaceFile.findFirst({
    where: { id: fileId, workspace_id: workspaceId },
    select: FILE_SELECT,
  })) as WorkspaceFileLite | null

  if (!file) return { kind: 'unavailable', file: null, reason: 'not_found' }
  if (file.is_folder) return { kind: 'unavailable', file, reason: 'folder' }

  const size = file.file_size ?? 0
  const mime = file.mime_type ?? ''

  // PDF ≤ 10 MB → inline bytes. On download failure, fall through to the text path.
  if (mime === PDF_MIME && size <= PDF_INLINE_MAX && file.storage_path) {
    const bytes = await downloadBytes(file.storage_path)
    if (bytes) return { kind: 'pdf', file, bytes, mediaType: PDF_MIME }
  }

  // Image → inline bytes if ≤ 5 MB and downloadable; else degrade ('för stor').
  if (IMAGE_MIMES.has(mime)) {
    if (size <= IMAGE_INLINE_MAX && file.storage_path) {
      const bytes = await downloadBytes(file.storage_path)
      if (bytes) return { kind: 'image', file, bytes, mediaType: mime }
    }
    return { kind: 'unavailable', file, reason: 'image' }
  }

  // Everything else (PDF > 10 MB, DOCX, XLSX, PPTX, …) → extracted text.
  const text = await resolveText(file)
  if (text) return { kind: 'text', file, text }
  return { kind: 'unavailable', file, reason: 'no_content' }
}
