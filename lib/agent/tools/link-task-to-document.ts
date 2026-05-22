/**
 * link_task_to_document tool — propose linking an existing task to a document.
 * Story 14.23, Task 2.1 (AC: 2-4).
 *
 * Always proposes: creates a PendingAgentAction of type LINK_TASK_TO_DOCUMENT
 * and returns the proposal envelope. There is no execute=true direct-write
 * branch — inline approval is the only finalization path (AC 4). Dispatch on
 * approve calls linkDocumentToTask (app/actions/documents.ts).
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
  taskId: z.string().describe('ID of the task to link'),
  documentId: z.string().describe('ID of the workspace document to link to'),
  execute: z
    .boolean()
    .optional()
    .default(false)
    .describe('Ignored — this action always requires inline approval'),
})

type Input = z.infer<typeof schema>

export function createLinkTaskToDocumentTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Koppla en befintlig uppgift till ett styrdokument i arbetsytan.

Använd detta verktyg när användaren vill knyta en uppgift till ett dokument, t.ex.
"koppla uppgiften om brandskydd till vår brandskyddspolicy".

Detta skapar alltid ett förslag som användaren godkänner i chatten — kopplingen
genomförs först efter godkännande.`,
    inputSchema: zodSchema(schema),
    execute: async ({ taskId, documentId }: Input) => {
      const startTime = Date.now()

      const [task, document] = await Promise.all([
        prisma.task.findFirst({
          where: { id: taskId, workspace_id: workspaceId },
          select: { id: true, title: true },
        }),
        prisma.workspaceDocument.findFirst({
          where: { id: documentId, workspace_id: workspaceId },
          select: { id: true, title: true },
        }),
      ])

      if (!task) {
        return wrapToolError(
          'link_task_to_document',
          'Uppgiften hittades inte.',
          'Kontrollera att uppgifts-ID:t är korrekt och tillhör arbetsytan.',
          startTime
        )
      }
      if (!document) {
        return wrapToolError(
          'link_task_to_document',
          'Dokumentet hittades inte.',
          'Kontrollera att dokument-ID:t är korrekt och tillhör arbetsytan.',
          startTime
        )
      }

      const params = {
        taskId,
        taskTitle: task.title,
        documentId,
        documentTitle: document.title,
      }

      const pendingActionId = await createPendingActionRow(
        workspaceId,
        context,
        'LINK_TASK_TO_DOCUMENT',
        params
      )

      const envelope = wrapWriteToolResponse(
        'link_task_to_document',
        'link_task_to_document',
        params,
        `Koppla uppgift "${task.title}" → dokument "${document.title}"`,
        startTime
      )
      return pendingActionId
        ? { ...envelope, data: { pendingActionId } }
        : envelope
    },
  })
}
