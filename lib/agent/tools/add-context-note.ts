/**
 * add_context_note tool — add a note explaining why a law matters to this company
 * Story 14.7c, Task 4 (AC: 4, 5-7)
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapWriteToolResponse, wrapToolResponse, wrapToolError } from './utils'

const addContextNoteSchema = z.object({
  lawListItemId: z
    .string()
    .describe('ID of the LawListItem to add the note to'),
  note: z
    .string()
    .describe('Context note explaining why this law matters to the company'),
  execute: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'false = return proposal for confirmation, true = execute the action'
    ),
})

type AddContextNoteInput = z.infer<typeof addContextNoteSchema>

export function createAddContextNoteTool(workspaceId: string) {
  return tool({
    description: `Lägg till en kontextanteckning som förklarar varför en specifik lag är relevant
för detta företag.

Använd detta verktyg när du tillsammans med användaren har identifierat varför en lag
är viktig för deras verksamhet — t.ex. "Ni hanterar kemikalier, därför gäller AFS 2011:19".

Anteckningen sparas i LawListItem.business_context. Om det redan finns en anteckning
läggs den nya till med en separator.

Bekräftelsemönster: Anropa ALLTID först med execute=false för att visa ett förslag.
Vänta tills användaren godkänner innan du anropar med execute=true.

Returnerar fel om lawListItemId inte hittas eller inte tillhör den aktiva arbetsytan.`,
    inputSchema: zodSchema(addContextNoteSchema),
    execute: async ({ lawListItemId, note, execute }: AddContextNoteInput) => {
      const startTime = Date.now()

      // Validate item exists and belongs to workspace
      const item = await prisma.lawListItem.findFirst({
        where: {
          id: lawListItemId,
          law_list: { workspace_id: workspaceId },
        },
        include: {
          document: { select: { title: true, document_number: true } },
        },
      })

      if (!item) {
        return wrapToolError(
          'add_context_note',
          'Laglistposten hittades inte.',
          'Kontrollera att ID:t är korrekt och att posten tillhör den aktiva arbetsytan.',
          startTime
        )
      }

      const lawTitle =
        item.document?.title ?? item.document?.document_number ?? lawListItemId

      if (!execute) {
        return wrapWriteToolResponse(
          'add_context_note',
          'add_context_note',
          { lawListItemId, note },
          `Lägg till kontextanteckning för ${lawTitle}: "${note}"`,
          startTime
        )
      }

      try {
        const existingContext = item.business_context ?? ''
        const updatedContext = existingContext
          ? `${existingContext}\n\n---\n\n${note}`
          : note

        await prisma.lawListItem.update({
          where: { id: lawListItemId },
          data: { business_context: updatedContext },
        })

        return wrapToolResponse(
          'add_context_note',
          { lawListItemId, lawTitle, noteAdded: note },
          startTime
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'add_context_note',
          `Kunde inte lägga till anteckning: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
