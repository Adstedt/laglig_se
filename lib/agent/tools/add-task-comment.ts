/**
 * add_task_comment tool — Story 14.29: propose a comment on a task.
 *
 * Always proposes a PendingAgentAction of type ADD_TASK_COMMENT (inline
 * approval only — no `execute: true` direct write). Append-only: there is no
 * diff and no in-editor finalize path. On approve, dispatch calls the existing
 * `createComment` server action (`app/actions/task-modal.ts:946`).
 *
 * Mentions hazard (AC 5 — steered, not enforced at dispatch): `createComment`
 * parses `@[name](id)` tokens out of the content and fires MENTION
 * notifications. The agent MUST NOT emit that syntax — keep the comment
 * self-contained. The tool description below explicitly forbids it.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapWriteToolResponse, wrapToolError } from './utils'
import {
  createPendingActionRow,
  type PendingActionToolContext,
} from './pending-action'

const addTaskCommentSchema = z.object({
  taskId: z.string().uuid().describe('ID på uppgiften som ska kommenteras.'),
  content: z
    .string()
    .min(1)
    .max(5000)
    .describe(
      'Kommentartexten. Max 5000 tecken, måste vara icke-tom. ANVÄND INTE `@[namn](id)`-syntax — kommentaren ska vara självständig (mention-tokens skulle skicka notiser och får inte autogenereras av agenten).'
    ),
  parentCommentId: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Valfritt: ID på kommentaren detta är ett svar på. Utelämna för att skriva i trådens rot (standard).'
    ),
  execute: z
    .boolean()
    .optional()
    .default(false)
    .describe('Ignored — this action always requires inline approval'),
})

type AddTaskCommentInput = z.infer<typeof addTaskCommentSchema>

export function createAddTaskCommentTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Föreslå en kommentar på en uppgift — t.ex. för att skriva ner din bedömning eller en kortfattad sammanfattning där ansvarig person ser den.

Använd när användaren ber dig lägga en notering på en uppgift, eller när du vill dokumentera resonemang/slutsatser på rätt uppgift istället för bara i chatten.

VIKTIGT: skriv ALDRIG \`@[namn](id)\`-mentions i \`content\` — kommentaren måste vara självständig text. Mention-syntax skulle plockas ut server-side och skicka notiser, vilket inte får ske från ett agentförslag.

Detta skapar alltid ett förslag som användaren godkänner i chatten — kommentaren postas först efter godkännande. Kortet är bekräftelsen: beskriv inte kommentartexten i löpande svar och fråga inte om lov först.

Returnerar fel om uppgiften inte hittas eller inte tillhör den aktiva arbetsytan, eller om \`content\` är tom.`,
    inputSchema: zodSchema(addTaskCommentSchema),
    execute: async ({
      taskId,
      content,
      parentCommentId,
      execute,
    }: AddTaskCommentInput) => {
      const startTime = Date.now()

      // Inline approval is the only finalization path (mirrors 14.23 / 14.28).
      if (execute) {
        return wrapToolError(
          'add_task_comment',
          'Den här åtgärden kan inte köras direkt.',
          'Uppgiftskommentarer bekräftas alltid via godkännandekortet i chatten — anropa utan execute.',
          startTime
        )
      }

      // AC 3: explicit Swedish error for empty content (defence-in-depth — the
      // .min(1) schema already guards at AI-SDK call time, but a direct execute
      // call would otherwise create a useless empty-comment proposal).
      if (!content || content.trim().length === 0) {
        return wrapToolError(
          'add_task_comment',
          'Kommentaren får inte vara tom.',
          'Skriv en kommentar med minst ett tecken. Om du inte har något att kommentera — använd inte verktyget.',
          startTime
        )
      }

      // Workspace-scoped read (matches createComment's own task lookup at
      // task-modal.ts:959-961) — scopes ownership AND snapshots the title +
      // updated_at in one query (per AC 4).
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspace_id: workspaceId },
        select: { id: true, title: true, updated_at: true },
      })
      if (!task) {
        return wrapToolError(
          'add_task_comment',
          'Uppgiften hittades inte.',
          'Kontrollera att taskId är korrekt och att uppgiften tillhör den aktiva arbetsytan. Använd search_tasks för att hitta rätt uppgift.',
          startTime
        )
      }

      // Denormalise the title at propose-time so the renderer shows the
      // title-as-proposed even if the task is later renamed/deleted (per AC 7
      // and the add-context-note precedent).
      const params = {
        taskId: task.id,
        taskTitle: task.title,
        content,
        ...(parentCommentId !== undefined && { parentCommentId }),
        // Forward-compat with Story 14.31 (staleness guard).
        entity_version: task.updated_at.toISOString(),
      }

      const pendingActionId = await createPendingActionRow(
        workspaceId,
        context,
        'ADD_TASK_COMMENT',
        params
      )

      const previewSnippet =
        content.length > 40 ? `${content.slice(0, 40)}…` : content
      const envelope = wrapWriteToolResponse(
        'add_task_comment',
        'add_task_comment',
        params,
        `Kommentar till "${task.title}": "${previewSnippet}"`,
        startTime
      )
      return pendingActionId
        ? { ...envelope, data: { pendingActionId } }
        : envelope
    },
  })
}
