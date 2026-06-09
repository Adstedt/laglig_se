/**
 * update_compliance_status tool — update a LawListItem's compliance status
 * Story 14.7c, Task 2 (AC: 2, 5-7)
 * Story 14.23, Task 7.2: migrated to the inline pending-action pattern. Always
 * proposes a PendingAgentAction of type UPDATE_COMPLIANCE_STATUS; the
 * execute=true direct-write branch is removed. The approve dispatch performs
 * the actual status update.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapWriteToolResponse, wrapToolError } from './utils'
import {
  createPendingActionRow,
  type PendingActionToolContext,
} from './pending-action'

const STATUS_LABELS: Record<string, string> = {
  EJ_PABORJAD: 'Ej påbörjad',
  PAGAENDE: 'Delvis uppfylld',
  UPPFYLLD: 'Uppfylld',
  EJ_UPPFYLLD: 'Ej uppfylld',
  EJ_TILLAMPLIG: 'Ej tillämplig',
}

const updateComplianceStatusSchema = z.object({
  lawListItemId: z
    .string()
    .optional()
    .describe(
      'ID of the LawListItem to update. Utelämna i en lag-chatt — då används den aktiva laglistposten automatiskt (Story 19.4a).'
    ),
  newStatus: z
    .enum([
      'EJ_PABORJAD',
      'PAGAENDE',
      'UPPFYLLD',
      'EJ_UPPFYLLD',
      'EJ_TILLAMPLIG',
    ])
    .describe('New compliance status'),
  reason: z
    .string()
    .describe('Reason for the status change — recorded in the activity log'),
  execute: z
    .boolean()
    .optional()
    .default(false)
    .describe('Ignored — this action always requires inline approval'),
})

type UpdateComplianceStatusInput = z.infer<typeof updateComplianceStatusSchema>

export function createUpdateComplianceStatusTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Uppdatera efterlevnadsstatusen för en lag i användarens bevakningslista.

Använd detta verktyg när användaren vill ändra en lags efterlevnadsstatus, t.ex. från
"Ej påbörjad" till "Delvis uppfylld" eller "Uppfylld".

Giltiga statusar: EJ_PABORJAD, PAGAENDE, UPPFYLLD, EJ_UPPFYLLD, EJ_TILLAMPLIG.

Anropa verktyget direkt — det skapar ett inline-förslagskort med gammal → ny status som
användaren granskar och godkänner. Kortet är bekräftelsen: beskriv inte ändringen i löpande
text och fråga inte om lov först.

Returnerar fel om lawListItemId inte hittas eller inte tillhör den aktiva arbetsytan.`,
    inputSchema: zodSchema(updateComplianceStatusSchema),
    execute: async ({
      lawListItemId,
      newStatus,
      reason,
    }: UpdateComplianceStatusInput) => {
      const startTime = Date.now()

      // Story 19.4a: default to the active law-list item from the chat context.
      const resolvedId = lawListItemId ?? context?.lawListItemId
      if (!resolvedId) {
        return wrapToolError(
          'update_compliance_status',
          'Ingen laglistpost angiven.',
          'Ange lawListItemId, eller använd search_law_list_items för att hitta rätt post i bevakningslistan.',
          startTime
        )
      }

      // Validate item exists and belongs to workspace
      const item = await prisma.lawListItem.findFirst({
        where: {
          id: resolvedId,
          law_list: { workspace_id: workspaceId },
        },
        include: {
          document: { select: { title: true, document_number: true } },
        },
      })

      if (!item) {
        return wrapToolError(
          'update_compliance_status',
          'Laglistposten hittades inte.',
          'Kontrollera att ID:t är korrekt och att posten tillhör den aktiva arbetsytan.',
          startTime
        )
      }

      const lawTitle =
        item.document?.title ?? item.document?.document_number ?? resolvedId
      const oldStatusLabel =
        STATUS_LABELS[item.compliance_status] ?? item.compliance_status
      const newStatusLabel = STATUS_LABELS[newStatus] ?? newStatus

      const params = {
        lawListItemId: resolvedId,
        lawTitle,
        newStatus,
        oldStatus: item.compliance_status,
        oldStatusLabel,
        newStatusLabel,
        reason,
      }

      const pendingActionId = await createPendingActionRow(
        workspaceId,
        context,
        'UPDATE_COMPLIANCE_STATUS',
        params
      )

      const envelope = wrapWriteToolResponse(
        'update_compliance_status',
        'update_compliance_status',
        params,
        `Ändra efterlevnadsstatus för ${lawTitle}: ${oldStatusLabel} → ${newStatusLabel}. Anledning: ${reason}`,
        startTime
      )
      return pendingActionId
        ? { ...envelope, data: { pendingActionId } }
        : envelope
    },
  })
}
