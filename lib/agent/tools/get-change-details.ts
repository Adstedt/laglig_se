/**
 * get_change_details tool — ChangeEvent details with amendment context
 * Story 14.7a, Task 2 (AC: 9)
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'

const changeDetailsSchema = z.object({
  changeEventId: z.string().describe('The ID of the change event to look up'),
})

type ChangeDetailsInput = z.infer<typeof changeDetailsSchema>

export function createGetChangeDetailsTool() {
  return tool({
    description: `Retrieve details about a specific legal change event, including what changed, which amendment caused it, and which sections were affected.
Use this tool when you need to explain a specific change to a law — for example when the user asks "what changed in SFS 2026:145?" or when exploring a change notification.

Returns the change type, amendment SFS number, AI-generated summary of the change, detection date, affected sections (with old/new text), and information about the base law that was changed.

Requires a changeEventId (available from change notifications or dashboard).`,
    inputSchema: zodSchema(changeDetailsSchema),
    execute: async ({ changeEventId }: ChangeDetailsInput) => {
      const startTime = Date.now()

      try {
        const changeEvent = await prisma.changeEvent.findUnique({
          where: { id: changeEventId },
          include: { document: true },
        })

        if (!changeEvent) {
          return wrapToolError(
            'get_change_details',
            `Ändringshändelsen hittades inte: ${changeEventId}`,
            'Kontrollera att ID:t är korrekt. Ändringshändelser finns tillgängliga via ändringsnotiser på instrumentpanelen.',
            startTime
          )
        }

        // Resolve affected sections via indirect join:
        // changeEvent.amendment_sfs → AmendmentDocument → SectionChange
        let affectedSections: Array<{
          chapter: string | null
          section: string
          changeType: string
          description: string | null
          oldText: string | null
          newText: string | null
        }> = []

        if (changeEvent.amendment_sfs) {
          const amendmentDoc = await prisma.amendmentDocument.findFirst({
            where: { sfs_number: changeEvent.amendment_sfs },
          })

          if (amendmentDoc) {
            const sections = await prisma.sectionChange.findMany({
              where: { amendment_id: amendmentDoc.id },
              orderBy: { sort_order: 'asc' },
              select: {
                chapter: true,
                section: true,
                change_type: true,
                description: true,
                old_text: true,
                new_text: true,
              },
            })

            affectedSections = sections.map((s) => ({
              chapter: s.chapter,
              section: s.section,
              changeType: s.change_type,
              description: s.description,
              oldText: s.old_text,
              newText: s.new_text,
            }))
          }
        }

        return wrapToolResponse(
          'get_change_details',
          {
            changeEventId: changeEvent.id,
            changeType: changeEvent.change_type,
            amendmentSfs: changeEvent.amendment_sfs,
            aiSummary: changeEvent.ai_summary,
            detectedAt: changeEvent.detected_at,
            changedSections: changeEvent.changed_sections,
            affectedSections,
            baseLaw: {
              id: changeEvent.document.id,
              title: changeEvent.document.title,
              documentNumber: changeEvent.document.document_number,
              slug: changeEvent.document.slug,
            },
          },
          startTime
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'get_change_details',
          `Databasfel: ${message}`,
          'Ett tekniskt fel uppstod vid hämtning av ändringshändelsen. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
