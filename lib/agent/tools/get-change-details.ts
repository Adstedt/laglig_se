/**
 * get_change_details tool — ChangeEvent details with amendment context
 * Story 14.7a, Task 2 (AC: 9)
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'
import { extractCompactDiff } from '@/lib/agent/system-prompt'

const changeDetailsSchema = z.object({
  changeEventId: z
    .string()
    .describe(
      'The unique database ID (cuid) of the change event — NOT an SFS number. This ID is provided in the change_context section of your system prompt as the context identifier.'
    ),
})

type ChangeDetailsInput = z.infer<typeof changeDetailsSchema>

export function createGetChangeDetailsTool() {
  return tool({
    description: `Retrieve detailed section-level changes for a change event, including old and new text for each affected paragraph.
Use this tool when you need the exact old/new wording of amended sections — for example to compare what changed in specific paragraphs.

Returns affected sections with chapter, section number, change type, description, old text, and new text.

The changeEventId is the context ID from your system prompt (a cuid like "cmizrtihf007ti904accp48p8"), NOT an SFS number.`,
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

        // Include compact diff when no structured section changes are available
        const diffSummary =
          affectedSections.length === 0 && changeEvent.diff_summary
            ? extractCompactDiff(changeEvent.diff_summary)
            : null

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
            ...(diffSummary != null && { diffSummary }),
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
