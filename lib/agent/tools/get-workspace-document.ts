/**
 * get_workspace_document tool — Story 17.10: read the full content + metadata
 * of a single authored styrdokument by id.
 *
 * Content source (AC 9 / C3 from 2026-05-22 PO review): converts the current
 * version's `content_html` via `htmlToMarkdown(...)`. Does NOT use
 * `WorkspaceDocumentVersion.extracted_text` — that's lossy tag-stripped
 * plaintext (`extractPlaintext`) with no headings.
 *
 * Workspace-scoped (AC 11): `findFirst({ where: { id, workspace_id } })`. A
 * styrdokument from another tenant resolves to "not found" — the closure
 * `workspaceId` is the only tenant source.
 *
 * Truncation (AC 10): `truncateMarkdown(20000)` with a Swedish note about
 * total length, so the model can ask the user to narrow the scope.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { htmlToMarkdown } from '@/lib/transforms/html-to-markdown'
import { wrapToolResponse, wrapToolError, truncateMarkdown } from './utils'

const getWorkspaceDocumentSchema = z.object({
  document_id: z
    .string()
    .describe(
      'UUID för styrdokumentet (kommer från search_workspace_documents eller list_workspace_documents).'
    ),
})

type GetWorkspaceDocumentInput = z.infer<typeof getWorkspaceDocumentSchema>

// AC 10 says "first 20,000 chars". `truncateMarkdown` is keyed on token count
// (chars ÷ 4), so 5000 tokens ≈ 20,000 chars at its paragraph-boundary cut.
const CONTENT_TOKEN_LIMIT = 5000
const CONTENT_CHAR_LIMIT = CONTENT_TOKEN_LIMIT * 4 // 20,000

export function createGetWorkspaceDocumentTool(workspaceId: string) {
  return tool({
    description: `Läs hela innehållet och metadatan för ett specifikt styrdokument (policy, rutin, riskbedömning etc.) i arbetsytan.

Använd när du behöver hela texten för ett styrdokument — t.ex. efter att ha hittat det via search_workspace_documents, eller när användaren refererar till ett specifikt dokument.

Returnerar titel, dokumenttyp, status, nuvarande version, dokumentnummer, hela innehållet (markdown, konverterat från Tiptap-källan), granskningsdatum, godkännare och godkänningsdatum, samt länkade uppgifter och länkade laglistposter. Innehållet trunkeras vid ${CONTENT_CHAR_LIMIT} tecken; det totala antalet tecken redovisas så du kan be användaren begränsa frågan om dokumentet är mycket långt.

Citera styrdokument med [Källa: <titel>] (samma nyckel som search_workspace_documents returnerar i \`citationKey\`).

Returnerar ett "hittades inte"-fel om dokumentet inte tillhör den aktiva arbetsytan eller inte finns.`,
    inputSchema: zodSchema(getWorkspaceDocumentSchema),
    execute: async ({ document_id }: GetWorkspaceDocumentInput) => {
      const startTime = Date.now()

      try {
        const doc = await prisma.workspaceDocument.findFirst({
          where: { id: document_id, workspace_id: workspaceId },
          select: {
            id: true,
            title: true,
            document_type: true,
            status: true,
            document_number: true,
            review_date: true,
            approved_at: true,
            current_version_number: true,
            approver: { select: { name: true } },
            current_version: {
              select: { content_html: true, version_number: true },
            },
            task_links: {
              select: {
                task: { select: { id: true, title: true } },
              },
            },
            list_item_links: {
              select: {
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

        if (!doc) {
          return wrapToolError(
            'get_workspace_document',
            'Styrdokumentet hittades inte.',
            'Kontrollera att document_id är korrekt och att dokumentet tillhör den aktiva arbetsytan. Använd search_workspace_documents eller list_workspace_documents för att hitta rätt id.',
            startTime
          )
        }

        // Convert from the Tiptap-sourced HTML (AC 9 / C3). NOT extracted_text.
        const rawMarkdown = doc.current_version?.content_html
          ? htmlToMarkdown(doc.current_version.content_html)
          : ''
        const totalChars = rawMarkdown.length
        const content = truncateMarkdown(rawMarkdown, CONTENT_TOKEN_LIMIT)
        // truncateMarkdown adds its own "[…]"-style marker on cut; if it
        // truncated, append the Swedish "[Trunkerat – {N} tecken totalt]"
        // hint per AC 10 so the model knows the dialed-back size.
        const contentWithHint =
          totalChars > content.length
            ? `${content}\n\n[Trunkerat — dokumentet har ${totalChars} tecken totalt]`
            : content

        const result = {
          documentId: doc.id,
          title: doc.title,
          documentType: doc.document_type,
          status: doc.status,
          documentNumber: doc.document_number,
          currentVersionNumber: doc.current_version_number,
          reviewDate: doc.review_date,
          approvedBy: doc.approver?.name ?? null,
          approvedAt: doc.approved_at,
          content: contentWithHint,
          linkedTasks: doc.task_links.map((l) => ({
            id: l.task.id,
            title: l.task.title,
          })),
          linkedLawListItems: doc.list_item_links.map((l) => ({
            id: l.list_item.id,
            lawTitle: l.list_item.document.title,
            documentNumber: l.list_item.document.document_number,
          })),
        }

        return wrapToolResponse('get_workspace_document', result, startTime)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'get_workspace_document',
          `Kunde inte hämta styrdokumentet: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
