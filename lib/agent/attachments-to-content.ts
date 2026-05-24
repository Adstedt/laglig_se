/**
 * Story 19.1: chat attachment → Claude content-block conversion.
 *
 * Converts uploaded `WorkspaceFile`s (by id, workspace-scoped) into AI-SDK v6
 * user-content parts for the chat request:
 *   - PDF ≤ 10 MB        → FilePart (base64 `application/pdf` document block)
 *   - Image ≤ 5 MB       → ImagePart (base64)
 *   - PDF > 10 MB, DOCX, XLSX, PPTX, other text-path → TextPart from extracted_text
 *     (with on-demand extraction if the cron hasn't run yet — AC 9)
 *   - oversized image / missing / wrong-workspace / unreadable → TextPart placeholder
 *
 * Workspace isolation (AC 10): a file whose workspace_id ≠ the caller's, or that is
 * missing, degrades to a placeholder — never a thrown 403 that would abort the message.
 *
 * Types are the AI SDK's own content-part types (re-exported from `ai`), NOT raw
 * `@anthropic-ai/sdk` types (Epic 19 compatibility requirement).
 *
 * Story 19.2: the download / routing / extraction core now lives in
 * `lib/agent/file-content.ts` and is shared with the `read_file` tool. This module
 * only maps the neutral `ResolvedFile` onto user-message content parts.
 */

import type { TextPart, ImagePart, FilePart } from 'ai'
import { resolveFileForReading, type ResolvedFile } from './file-content'

export type AttachmentContentBlock = TextPart | ImagePart | FilePart

function textBlock(text: string): TextPart {
  return { type: 'text', text }
}

/** Map the shared `ResolvedFile` onto an AI-SDK user-message content part. */
function resolvedToBlock(resolved: ResolvedFile): AttachmentContentBlock {
  switch (resolved.kind) {
    case 'pdf':
      return {
        type: 'file',
        mediaType: resolved.mediaType,
        filename: resolved.file.filename,
        data: resolved.bytes.toString('base64'),
      }
    case 'image':
      return {
        type: 'image',
        image: resolved.bytes.toString('base64'),
        mediaType: resolved.mediaType,
      }
    case 'text':
      return textBlock(`[Fil: ${resolved.file.filename}]\n${resolved.text}`)
    case 'unavailable': {
      if (resolved.reason === 'not_found') {
        return textBlock('[Fil: okänd — filen hittades inte]')
      }
      if (resolved.reason === 'image') {
        return textBlock(
          `[Bild: ${resolved.file?.filename ?? 'okänd'} — för stor för direkt analys]`
        )
      }
      // folder + no_content → generic placeholder
      return textBlock(
        `[Fil: ${resolved.file?.filename ?? 'okänd'} — innehåll ej tillgängligt]`
      )
    }
  }
}

export async function attachmentsToContent(
  fileIds: string[],
  workspaceId: string
): Promise<AttachmentContentBlock[]> {
  if (!fileIds || fileIds.length === 0) return []

  const blocks: AttachmentContentBlock[] = []
  for (const fileId of fileIds) {
    blocks.push(
      resolvedToBlock(await resolveFileForReading(fileId, workspaceId))
    )
  }
  return blocks
}
