/**
 * create_task tool — create a workspace task, optionally linked to a law
 * Story 14.7c, Task 1 (AC: 1, 5-7)
 * Story 14.22: on execute=false, persist a PendingAgentAction row (the inline
 * approval card) and return its id in the envelope's `data` field.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { createTask } from '@/app/actions/tasks'
import { prisma } from '@/lib/prisma'
import { markdownToHtml } from '@/lib/markdown/markdown-to-html'
import { wrapWriteToolResponse, wrapToolResponse, wrapToolError } from './utils'

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Låg',
  MEDIUM: 'Medel',
  HIGH: 'Hög',
  CRITICAL: 'Kritisk',
}

/**
 * Story 14.22: per-turn context threaded from the chat route so the proposal
 * can be persisted as a PendingAgentAction. `assistantMessageId` is the id of
 * the stub assistant ChatMessage written before the tool loop (ADR-14.22-A).
 */
export interface CreateTaskToolContext {
  userId: string
  assistantMessageId?: string
  contextType?: 'GLOBAL' | 'TASK' | 'LAW' | 'CHANGE'
  contextId?: string | null
  conversationId?: string | null
}

const createTaskSchema = z.object({
  title: z.string().describe('Task title'),
  description: z.string().optional().describe('Task description'),
  relatedDocumentId: z
    .string()
    .optional()
    .describe('LawListItem ID to link the task to'),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .optional()
    .default('MEDIUM')
    .describe('Task priority'),
  execute: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'false = return proposal for confirmation, true = execute the action'
    ),
})

type CreateTaskInput = z.infer<typeof createTaskSchema>

export function createCreateTaskTool(
  workspaceId: string,
  context?: CreateTaskToolContext
) {
  return tool({
    description: `Skapa en uppgift på arbetsytans uppgiftstavla, valfritt kopplad till en specifik lag.

Använd detta verktyg när användaren har identifierat en åtgärd som behöver genomföras
och vill spåra den som en uppgift. Uppgiften skapas i den första kolumnen på tavlan.

Bekräftelsemönster: Anropa ALLTID först med execute=false för att visa ett förslag.
Vänta tills användaren godkänner innan du anropar med execute=true.

Returnerar vid execute=false: ett förslag med confirmation_required: true och en förhandsvisning.
Returnerar vid execute=true: den skapade uppgiftens ID och titel.

Om skapandet misslyckas returneras ett felmeddelande med vägledning.`,
    inputSchema: zodSchema(createTaskSchema),
    execute: async ({
      title,
      description,
      relatedDocumentId,
      priority,
      execute,
    }: CreateTaskInput) => {
      const startTime = Date.now()
      const priorityLabel = PRIORITY_LABELS[priority ?? 'MEDIUM'] ?? 'Medel'

      if (!execute) {
        // Story 14.22: persist the proposal as a PendingAgentAction so the
        // inline card survives chat close/reopen. The chat_message_id FK points
        // at the pre-loop stub assistant message (guaranteed to exist).
        let pendingActionId: string | undefined
        if (context?.assistantMessageId) {
          try {
            const row = await prisma.pendingAgentAction.create({
              data: {
                workspace_id: workspaceId,
                user_id: context.userId,
                chat_message_id: context.assistantMessageId,
                conversation_id: context.conversationId ?? null,
                context_type: context.contextType ?? 'GLOBAL',
                context_id: context.contextId ?? null,
                action_type: 'CREATE_TASK',
                status: 'PENDING',
                params: {
                  title,
                  description: description ?? null,
                  relatedDocumentId: relatedDocumentId ?? null,
                  priority: priority ?? 'MEDIUM',
                },
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              },
              select: { id: true },
            })
            pendingActionId = row.id
          } catch (err) {
            // Non-fatal: if the row can't be created the agent still returns a
            // proposal envelope (legacy sidebar fallback handles it).
            console.error('[create_task] pending row creation failed', err)
          }
        }

        const envelope = wrapWriteToolResponse(
          'create_task',
          'create_task',
          { title, description, relatedDocumentId, priority },
          `Skapa uppgift: "${title}" med prioritet ${priorityLabel}`,
          startTime
        )
        return pendingActionId
          ? { ...envelope, data: { pendingActionId } }
          : envelope
      }

      try {
        const result = await createTask({
          title,
          // Task.description is a rich-text/HTML field — convert the agent's
          // markdown so it renders structured (Story 14.22).
          ...(description != null && {
            description: markdownToHtml(description),
          }),
          priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
          ...(relatedDocumentId != null && {
            linkedListItemIds: [relatedDocumentId],
          }),
        })

        if (!result.success) {
          return wrapToolError(
            'create_task',
            `Kunde inte skapa uppgiften: ${result.error}`,
            'Kontrollera att arbetsytan har en uppgiftstavla med minst en kolumn.',
            startTime
          )
        }

        return wrapToolResponse(
          'create_task',
          { taskId: result.data!.id, title: result.data!.title },
          startTime
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'create_task',
          `Kunde inte skapa uppgiften: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
