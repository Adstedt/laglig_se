/**
 * update_compliance_status tool — update a LawListItem's compliance status
 * Story 14.7c, Task 2 (AC: 2, 5-7)
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapWriteToolResponse, wrapToolResponse, wrapToolError } from './utils'

const STATUS_LABELS: Record<string, string> = {
  EJ_PABORJAD: 'Ej påbörjad',
  PAGAENDE: 'Delvis uppfylld',
  UPPFYLLD: 'Uppfylld',
  EJ_UPPFYLLD: 'Ej uppfylld',
  EJ_TILLAMPLIG: 'Ej tillämplig',
}

const updateComplianceStatusSchema = z.object({
  lawListItemId: z.string().describe('ID of the LawListItem to update'),
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
    .describe('Reason for the status change — logged in compliance_actions'),
  execute: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'false = return proposal for confirmation, true = execute the action'
    ),
})

type UpdateComplianceStatusInput = z.infer<typeof updateComplianceStatusSchema>

export function createUpdateComplianceStatusTool(workspaceId: string) {
  return tool({
    description: `Uppdatera efterlevnadsstatusen för en lag i användarens bevakningslista.

Använd detta verktyg när användaren vill ändra en lags efterlevnadsstatus, t.ex. från
"Ej påbörjad" till "Delvis uppfylld" eller "Uppfylld".

Giltiga statusar: EJ_PABORJAD, PAGAENDE, UPPFYLLD, EJ_UPPFYLLD, EJ_TILLAMPLIG.

Bekräftelsemönster: Anropa ALLTID först med execute=false för att visa ett förslag
med gammal → ny status. Vänta tills användaren godkänner innan du anropar med execute=true.

Returnerar fel om lawListItemId inte hittas eller inte tillhör den aktiva arbetsytan.`,
    inputSchema: zodSchema(updateComplianceStatusSchema),
    execute: async ({
      lawListItemId,
      newStatus,
      reason,
      execute,
    }: UpdateComplianceStatusInput) => {
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
          'update_compliance_status',
          'Laglistposten hittades inte.',
          'Kontrollera att ID:t är korrekt och att posten tillhör den aktiva arbetsytan.',
          startTime
        )
      }

      const lawTitle =
        item.document?.title ?? item.document?.document_number ?? lawListItemId
      const oldStatusLabel =
        STATUS_LABELS[item.compliance_status] ?? item.compliance_status
      const newStatusLabel = STATUS_LABELS[newStatus] ?? newStatus

      if (!execute) {
        return wrapWriteToolResponse(
          'update_compliance_status',
          'update_compliance_status',
          { lawListItemId, newStatus, reason },
          `Ändra efterlevnadsstatus för ${lawTitle}: ${oldStatusLabel} → ${newStatusLabel}. Anledning: ${reason}`,
          startTime
        )
      }

      try {
        // Append status change reason to compliance_actions text field
        const logEntry = `[${new Date().toISOString()}] ${oldStatusLabel} → ${newStatusLabel}: ${reason}`
        const existingActions = item.compliance_actions ?? ''
        const updatedActions = existingActions
          ? `${existingActions}\n${logEntry}`
          : logEntry

        await prisma.lawListItem.update({
          where: { id: lawListItemId },
          data: {
            compliance_status: newStatus,
            compliance_actions: updatedActions,
            compliance_actions_updated_at: new Date(),
          },
        })

        return wrapToolResponse(
          'update_compliance_status',
          {
            lawListItemId,
            oldStatus: item.compliance_status,
            newStatus,
            lawTitle,
          },
          startTime
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'update_compliance_status',
          `Kunde inte uppdatera status: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
