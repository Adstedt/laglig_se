/**
 * get_document_details tool — full content for a specific legal document
 * Story 14.7a, Task 2 (AC: 8)
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError, truncateMarkdown } from './utils'

const documentDetailsSchema = z.object({
  documentId: z
    .string()
    .optional()
    .describe('The database UUID of the document'),
  documentNumber: z
    .string()
    .optional()
    .describe(
      'The official document number, e.g., "SFS 1977:1160", "AFS 2023:1"'
    ),
})

type DocumentDetailsInput = z.infer<typeof documentDetailsSchema>

export function createGetDocumentDetailsTool() {
  return tool({
    description: `Retrieve full details for a specific legal document by ID or document number.
Use this tool when you need the complete text or metadata for a specific law, regulation, or directive — for example after finding it via search_laws, or when the user references a specific document number like "SFS 1977:1160" or "AFS 2023:1".

Returns the document title, number, type, status, summary, compliance commentary (kommentar), and the full markdown content (truncated if very long).

Accepts either a database ID or a document number (e.g., "SFS 1977:1160", "EU 2016/679"). At least one must be provided.`,
    inputSchema: zodSchema(documentDetailsSchema),
    execute: async ({ documentId, documentNumber }: DocumentDetailsInput) => {
      const startTime = Date.now()

      if (!documentId && !documentNumber) {
        return wrapToolError(
          'get_document_details',
          'Varken documentId eller documentNumber angavs.',
          'Ange antingen ett dokument-ID eller ett dokumentnummer, t.ex. "SFS 1977:1160".',
          startTime
        )
      }

      try {
        const doc = await prisma.legalDocument.findFirst({
          where: documentId
            ? { id: documentId }
            : { document_number: documentNumber! },
          select: {
            id: true,
            title: true,
            document_number: true,
            content_type: true,
            status: true,
            summary: true,
            kommentar: true,
            markdown_content: true,
            effective_date: true,
            slug: true,
          },
        })

        if (!doc) {
          const ref = documentNumber ?? documentId
          return wrapToolError(
            'get_document_details',
            `Dokumentet hittades inte: ${ref}`,
            'Kontrollera att dokumentnumret är korrekt, t.ex. "SFS 1977:1160". Använd search_laws för att söka efter dokument om du är osäker på numret.',
            startTime
          )
        }

        return wrapToolResponse(
          'get_document_details',
          {
            id: doc.id,
            title: doc.title,
            documentNumber: doc.document_number,
            contentType: doc.content_type,
            status: doc.status,
            effectiveDate: doc.effective_date,
            slug: doc.slug,
            summary: doc.summary,
            kommentar: doc.kommentar,
            markdownContent: doc.markdown_content
              ? truncateMarkdown(doc.markdown_content)
              : null,
            path: `/lagar/${doc.slug}`,
          },
          startTime
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'get_document_details',
          `Databasfel: ${message}`,
          'Ett tekniskt fel uppstod vid hämtning av dokumentet. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
