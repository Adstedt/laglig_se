/**
 * add_obligation tool — propose a new kravpunkt (LawListItemRequirement) on a
 * law list item. Story 14.23, Task 2.3 (AC: 2-4).
 *
 * Always proposes a PendingAgentAction of type ADD_OBLIGATION. Dispatch on
 * approve calls createRequirement (app/actions/law-list-item-requirements.ts,
 * Story 17.16), passing bevisRequired through to the opt-in bevis gap signal.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapWriteToolResponse, wrapToolError } from './utils'
import {
  createPendingActionRow,
  type PendingActionToolContext,
} from './pending-action'

const schema = z.object({
  lawListItemId: z
    .string()
    .optional()
    .describe(
      'ID of the LawListItem to add the kravpunkt to. Utelämna i en lag-chatt — då används den aktiva laglistposten automatiskt (Story 19.4a).'
    ),
  text: z
    .string()
    .describe('The obligation / requirement text (max 500 characters)'),
  bevisRequired: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Whether this kravpunkt requires linked evidence ("bevis krävs")'
    ),
  execute: z
    .boolean()
    .optional()
    .default(false)
    .describe('Ignored — this action always requires inline approval'),
})

type Input = z.infer<typeof schema>

export function createAddObligationTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Lägg till en kravpunkt (specifikt krav att uppfylla) på en lag i bevakningslistan.

Använd detta verktyg när ni tillsammans har brutit ner en lag i konkreta krav,
t.ex. "dokumentera riskbedömning årligen" eller "utse brandskyddsansvarig".

Sätt bevisRequired=true om kravpunkten ska kräva kopplat bevis för att räknas som uppfylld.

Detta skapar alltid ett förslag som användaren godkänner i chatten — kravpunkten
skapas först efter godkännande.`,
    inputSchema: zodSchema(schema),
    execute: async ({ lawListItemId, text, bevisRequired }: Input) => {
      const startTime = Date.now()

      // Story 19.4a: default to the active law-list item from the chat context
      // when the agent didn't supply an explicit id (e.g. in a LAW chat).
      const resolvedId = lawListItemId ?? context?.lawListItemId
      if (!resolvedId) {
        return wrapToolError(
          'add_obligation',
          'Ingen laglistpost angiven.',
          'Ange lawListItemId, eller använd search_law_list_items för att hitta rätt post i bevakningslistan.',
          startTime
        )
      }

      const item = await prisma.lawListItem.findFirst({
        where: { id: resolvedId, law_list: { workspace_id: workspaceId } },
        include: {
          document: { select: { title: true, document_number: true } },
        },
      })

      if (!item) {
        return wrapToolError(
          'add_obligation',
          'Laglistposten hittades inte.',
          'Kontrollera att ID:t är korrekt och att posten tillhör arbetsytan.',
          startTime
        )
      }

      const lawTitle =
        item.document?.title ?? item.document?.document_number ?? resolvedId

      const params = {
        lawListItemId: resolvedId,
        lawTitle,
        text,
        bevisRequired,
      }

      const pendingActionId = await createPendingActionRow(
        workspaceId,
        context,
        'ADD_OBLIGATION',
        params
      )

      const bevisNote = bevisRequired ? ' (bevis krävs)' : ''
      const envelope = wrapWriteToolResponse(
        'add_obligation',
        'add_obligation',
        params,
        `Lägg till kravpunkt för ${lawTitle}: "${text}"${bevisNote}`,
        startTime
      )
      return pendingActionId
        ? { ...envelope, data: { pendingActionId } }
        : envelope
    },
  })
}
