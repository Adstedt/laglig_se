/**
 * list_stale_documents tool — Story 19.3 (diagnostics).
 *
 * Workspace-wide read: styrdokument past their `review_date` (review overdue),
 * excluding retired docs (SUPERSEDED / ARCHIVED). Returns the true `count` + a
 * capped, oldest-review-first list, each carrying `documentId` so the agent can
 * drill in via get_document_details. Status as a Swedish label.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { Prisma, WorkspaceDocumentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'
import { isoDate, workspaceDocumentStatusLabel } from './reader-utils'

const MS_PER_DAY = 86_400_000

const schema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Max antal poster att visa (standard 20).'),
})

type Input = z.infer<typeof schema>

export function createListStaleDocumentsTool(workspaceId: string) {
  return tool({
    description: `Lista styrdokument vars granskningsdatum (review_date) passerat och som behöver granskas på nytt. Retirerade dokument (ersatta/arkiverade) räknas inte. Använd för "vilka dokument behöver granskas?" / "vad bör vi prioritera?". Returnerar totalt antal + de mest försenade först, med \`documentId\` (följ upp med get_document_details). Tomt resultat (count 0) = inga dokument behöver granskas; rapportera positivt.`,
    inputSchema: zodSchema(schema),
    execute: async ({ limit }: Input) => {
      const startTime = Date.now()
      const take = limit ?? 20
      const now = new Date()

      try {
        const where: Prisma.WorkspaceDocumentWhereInput = {
          workspace_id: workspaceId,
          review_date: { not: null, lt: now },
          status: {
            notIn: [
              WorkspaceDocumentStatus.SUPERSEDED,
              WorkspaceDocumentStatus.ARCHIVED,
            ],
          },
        }

        const [count, rows] = await Promise.all([
          prisma.workspaceDocument.count({ where }),
          prisma.workspaceDocument.findMany({
            where,
            take,
            orderBy: { review_date: 'asc' },
            select: {
              id: true,
              title: true,
              document_type: true,
              status: true,
              review_date: true,
            },
          }),
        ])

        const documents = rows.map((d) => ({
          documentId: d.id,
          title: d.title,
          documentType: d.document_type, // coarse category — raw enum is fine
          status: workspaceDocumentStatusLabel(d.status),
          reviewDate: isoDate(d.review_date),
          daysOverdue: d.review_date
            ? Math.floor((now.getTime() - d.review_date.getTime()) / MS_PER_DAY)
            : 0,
        }))

        return wrapToolResponse(
          'list_stale_documents',
          { count, documents },
          startTime,
          count
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'list_stale_documents',
          `Kunde inte hämta dokument att granska: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
