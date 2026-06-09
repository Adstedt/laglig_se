/**
 * read_file tool — open and read ANY of the workspace's uploaded files in FULL.
 * Story 19.2.
 *
 * Unlike `search_workspace_files` (which returns ranked *snippets*), `read_file`
 * returns the whole file to the model as native content: a PDF document block, an
 * image block, or the full extracted text (Word/Excel/large-PDF). It reads any
 * `WorkspaceFile` — uploaded bevis, chat attachments, styrdokument attachments —
 * via the same routing core the chat-attachment converter uses (`lib/agent/file-content.ts`).
 *
 * Delivery model (AC 5/6):
 *   - `execute` does a cheap, download-free classification → a LEAN JSON envelope
 *     (no base64). This is what 19.5's `wrapWithDecisionLog` persists and what the
 *     chat-history tool-result renders — keeping multi-MB blobs out of the audit log.
 *   - `toModelOutput` does the heavy Supabase download / on-demand extraction and
 *     returns the native content blocks the MODEL reads. Its output is not logged.
 *
 * Workspace isolation (AC 3): both paths resolve the file scoped to `workspaceId`
 * (`findFirst({ where: { id, workspace_id } })`); a miss/cross-tenant id returns a
 * Swedish `wrapToolError`, never another workspace's bytes.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import {
  classifyFileForReading,
  resolveFileForReading,
} from '@/lib/agent/file-content'
import { wrapToolResponse, wrapToolError } from './utils'

const readFileSchema = z.object({
  fileId: z
    .string()
    .describe(
      'WorkspaceFile-id för filen som ska läsas (t.ex. fileId från en search_workspace_files-träff)'
    ),
})

type ReadFileInput = z.infer<typeof readFileSchema>

export function createReadFileTool(workspaceId: string) {
  return tool({
    description: `Öppna och läs en HEL fil i arbetsytan via dess fileId — inte bara utdrag.
Använd detta verktyg när du behöver hela innehållet i en uppladdad fil (bevis-PDF, policy, avtal, kalkylblad eller bild) för att resonera om den — t.ex. efter att search_workspace_files gett dig ett \`fileId\` och frågan kräver mer än de utdrag sökningen returnerade.

PDF:er och bilder läses direkt av modellen (layout, tabeller, inskannad text); Word/Excel och stora PDF:er läses som utvunnen text. Reads only — ingen bekräftelse behövs.

Returnerar filens metadata (\`filename\`, \`mimeType\`, \`contentKind\`) och en \`citationKey\` (filnamnet). Citera innehåll du läser med [Källa: <filnamn>]. Filens faktiska innehåll levereras direkt till dig som läsbart innehåll.`,
    inputSchema: zodSchema(readFileSchema),
    execute: async ({ fileId }: ReadFileInput) => {
      const startTime = Date.now()
      try {
        // Cheap, download-free classification (AC 6 — lean envelope, no base64).
        const c = await classifyFileForReading(fileId, workspaceId)
        if (!c.ok) {
          if (c.reason === 'folder') {
            return wrapToolError(
              'read_file',
              'Detta är en mapp, inte en fil.',
              'Ange en fil-id, inte en mapp. Använd search_workspace_files för att hitta rätt fil.',
              startTime
            )
          }
          return wrapToolError(
            'read_file',
            'Filen hittades inte.',
            'Kontrollera fil-id:t. Använd search_workspace_files för att hitta filer i arbetsytan.',
            startTime
          )
        }

        return wrapToolResponse(
          'read_file',
          {
            fileId: c.file.id,
            filename: c.file.filename,
            mimeType: c.file.mime_type,
            sizeBytes: c.file.file_size,
            contentKind: c.contentKind,
            // citation stub: files cite by filename (matches search_workspace_files)
            citationKey: c.file.filename,
          },
          startTime
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'read_file',
          `Kunde inte läsa filen: ${message}`,
          'Ett tekniskt fel uppstod vid läsning av filen. Försök igen om en stund.',
          startTime
        )
      }
    },
    /**
     * Deliver the actual file content to the model. Runs the heavy download /
     * extraction here so the logged `execute` envelope stays lean (AC 5/6). Any IO
     * failure degrades to a text note so the model always receives something.
     */
    toModelOutput: async ({ input, output }) => {
      // execute returned a wrapToolError envelope → relay message + guidance as
      // text so the agent can self-recover (e.g. "använd search_workspace_files").
      const o = output as {
        error?: boolean
        message?: string
        guidance?: string
      }
      if (o?.error === true) {
        const msg = o.message ?? 'Filen kunde inte läsas.'
        return {
          type: 'text',
          value: o.guidance ? `${msg}\n${o.guidance}` : msg,
        }
      }

      const { fileId } = input as ReadFileInput
      try {
        const r = await resolveFileForReading(fileId, workspaceId)
        switch (r.kind) {
          case 'pdf':
            return {
              type: 'content',
              value: [
                {
                  type: 'file-data',
                  data: r.bytes.toString('base64'),
                  mediaType: r.mediaType,
                  filename: r.file.filename,
                },
              ],
            }
          case 'image':
            return {
              type: 'content',
              value: [
                {
                  type: 'image-data',
                  data: r.bytes.toString('base64'),
                  mediaType: r.mediaType,
                },
              ],
            }
          case 'text':
            return {
              type: 'content',
              value: [
                { type: 'text', text: `[Fil: ${r.file.filename}]\n${r.text}` },
              ],
            }
          case 'unavailable': {
            const name = r.file?.filename ?? 'okänd'
            const note =
              r.reason === 'image'
                ? `[Bild: ${name} — för stor för direkt analys]`
                : `[Fil: ${name} — innehåll ej tillgängligt]`
            return { type: 'text', value: note }
          }
          // Defensive (READ-005): the switch is exhaustive over today's
          // ResolvedFile kinds; a future kind degrades gracefully instead of
          // returning undefined to the SDK.
          default:
            return { type: 'text', value: '[Fil: kunde inte läsas]' }
        }
      } catch {
        return { type: 'text', value: '[Fil: kunde inte läsas]' }
      }
    },
  })
}
