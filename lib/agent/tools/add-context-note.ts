/**
 * add_context_note tool — add a note explaining why a law matters to this company
 * Story 14.7c, Task 4 (AC: 4, 5-7)
 * Story 14.23, Task 7.1: migrated to the inline pending-action pattern. Always
 * proposes a PendingAgentAction of type ADD_CONTEXT_NOTE; the execute=true
 * direct-write branch is removed (the sidebar preview path is gone). The
 * approve dispatch performs the actual business_context append.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapWriteToolResponse, wrapToolError } from './utils'
import {
  createPendingActionRow,
  type PendingActionToolContext,
} from './pending-action'

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
    .describe('Ignored — this action always requires inline approval'),
})

type AddContextNoteInput = z.infer<typeof addContextNoteSchema>

export function createAddContextNoteTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Lägg till en kontextanteckning som förklarar varför en specifik lag är relevant
för detta företag.

Använd detta verktyg när du tillsammans med användaren har identifierat varför en lag
är viktig för deras verksamhet — t.ex. "Ni hanterar kemikalier, därför gäller AFS 2011:19".

Anteckningen sparas i LawListItem.business_context. Om det redan finns en anteckning
läggs den nya till med en separator.

Anropa verktyget direkt — det skapar ett inline-förslagskort som användaren granskar och
godkänner. Kortet är bekräftelsen: beskriv inte anteckningen i löpande text och fråga inte
om lov först.

Returnerar fel om lawListItemId inte hittas eller inte tillhör den aktiva arbetsytan.`,
    inputSchema: zodSchema(addContextNoteSchema),
    execute: async ({ lawListItemId, note }: AddContextNoteInput) => {
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

      const params = { lawListItemId, lawTitle, note }

      const pendingActionId = await createPendingActionRow(
        workspaceId,
        context,
        'ADD_CONTEXT_NOTE',
        params
      )

      const envelope = wrapWriteToolResponse(
        'add_context_note',
        'add_context_note',
        params,
        `Lägg till kontextanteckning för ${lawTitle}: "${note}"`,
        startTime
      )
      return pendingActionId
        ? { ...envelope, data: { pendingActionId } }
        : envelope
    },
  })
}
