/**
 * create_task tool — create a workspace task, optionally linked to a law
 * Story 14.7c, Task 1 (AC: 1, 5-7)
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { createTask } from '@/app/actions/tasks'
import { wrapWriteToolResponse, wrapToolResponse, wrapToolError } from './utils'

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Låg',
  MEDIUM: 'Medel',
  HIGH: 'Hög',
  CRITICAL: 'Kritisk',
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

export function createCreateTaskTool(_workspaceId: string) {
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
        return wrapWriteToolResponse(
          'create_task',
          'create_task',
          { title, description, relatedDocumentId, priority },
          `Skapa uppgift: "${title}" med prioritet ${priorityLabel}`,
          startTime
        )
      }

      try {
        const result = await createTask({
          title,
          ...(description != null && { description }),
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
