/**
 * assign_task tool — propose assigning an existing task to a workspace member.
 * Story 14.23, Task 2.4 (AC: 2-4).
 *
 * Always proposes a PendingAgentAction of type ASSIGN_TASK. Dispatch on approve
 * calls updateTasksBulk([taskId], { assigneeId }) (app/actions/tasks.ts) — no
 * dedicated single-task assign action exists today.
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
  taskId: z.string().describe('ID of the task to assign'),
  userId: z
    .string()
    .describe('ID of the workspace member to assign the task to'),
  execute: z
    .boolean()
    .optional()
    .default(false)
    .describe('Ignored — this action always requires inline approval'),
})

type Input = z.infer<typeof schema>

export function createAssignTaskTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Tilldela en befintlig uppgift till en medlem i arbetsytan.

Använd detta verktyg när användaren vill ange vem som ansvarar för en uppgift,
t.ex. "tilldela brandskyddsuppgiften till Anna".

Detta skapar alltid ett förslag som användaren godkänner i chatten — uppgiften
tilldelas först efter godkännande.`,
    inputSchema: zodSchema(schema),
    execute: async ({ taskId, userId }: Input) => {
      const startTime = Date.now()

      const [task, member] = await Promise.all([
        prisma.task.findFirst({
          where: { id: taskId, workspace_id: workspaceId },
          select: { id: true, title: true },
        }),
        prisma.workspaceMember.findFirst({
          where: { workspace_id: workspaceId, user_id: userId },
          select: { user: { select: { name: true, email: true } } },
        }),
      ])

      if (!task) {
        return wrapToolError(
          'assign_task',
          'Uppgiften hittades inte.',
          'Kontrollera att uppgifts-ID:t är korrekt och tillhör arbetsytan.',
          startTime
        )
      }
      if (!member) {
        return wrapToolError(
          'assign_task',
          'Användaren är inte medlem i arbetsytan.',
          'Endast medlemmar i den aktiva arbetsytan kan tilldelas uppgifter.',
          startTime
        )
      }

      const userName = member.user.name ?? member.user.email
      const params = { taskId, taskTitle: task.title, userId, userName }

      const pendingActionId = await createPendingActionRow(
        workspaceId,
        context,
        'ASSIGN_TASK',
        params
      )

      const envelope = wrapWriteToolResponse(
        'assign_task',
        'assign_task',
        params,
        `Tilldela uppgift "${task.title}" till ${userName}`,
        startTime
      )
      return pendingActionId
        ? { ...envelope, data: { pendingActionId } }
        : envelope
    },
  })
}
