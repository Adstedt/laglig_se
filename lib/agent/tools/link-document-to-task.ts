/**
 * link_document_to_task tool — propose linking an existing document to a task.
 * Story 14.23, Task 2.2 (AC: 2-4, 10a).
 *
 * Mirror of link_task_to_document with swapped framing. Dispatches to the same
 * symmetric server action (linkDocumentToTask) on approve, but is a distinct
 * action_type so the renderer can show the direction-appropriate preview
 * ("Koppla dokument → uppgift"). Always proposes — no execute=true branch.
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
  documentId: z.string().describe('ID of the workspace document to link'),
  taskId: z.string().describe('ID of the task to link to'),
  execute: z
    .boolean()
    .optional()
    .default(false)
    .describe('Ignored — this action always requires inline approval'),
})

type Input = z.infer<typeof schema>

export function createLinkDocumentToTaskTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Koppla ett befintligt styrdokument till en uppgift i arbetsytan.

Använd detta verktyg när användaren utgår från ett dokument och vill knyta det till
en uppgift, t.ex. "koppla vår kemikaliepolicy till uppgiften om riskbedömning".

Detta skapar alltid ett förslag som användaren godkänner i chatten — kopplingen
genomförs först efter godkännande.`,
    inputSchema: zodSchema(schema),
    execute: async ({ documentId, taskId }: Input) => {
      const startTime = Date.now()

      const [document, task] = await Promise.all([
        prisma.workspaceDocument.findFirst({
          where: { id: documentId, workspace_id: workspaceId },
          select: { id: true, title: true },
        }),
        prisma.task.findFirst({
          where: { id: taskId, workspace_id: workspaceId },
          select: { id: true, title: true },
        }),
      ])

      if (!document) {
        return wrapToolError(
          'link_document_to_task',
          'Dokumentet hittades inte.',
          'Kontrollera att dokument-ID:t är korrekt och tillhör arbetsytan.',
          startTime
        )
      }
      if (!task) {
        return wrapToolError(
          'link_document_to_task',
          'Uppgiften hittades inte.',
          'Kontrollera att uppgifts-ID:t är korrekt och tillhör arbetsytan.',
          startTime
        )
      }

      const params = {
        documentId,
        documentTitle: document.title,
        taskId,
        taskTitle: task.title,
      }

      const pendingActionId = await createPendingActionRow(
        workspaceId,
        context,
        'LINK_DOCUMENT_TO_TASK',
        params
      )

      const envelope = wrapWriteToolResponse(
        'link_document_to_task',
        'link_document_to_task',
        params,
        `Koppla dokument "${document.title}" → uppgift "${task.title}"`,
        startTime
      )
      return pendingActionId
        ? { ...envelope, data: { pendingActionId } }
        : envelope
    },
  })
}
