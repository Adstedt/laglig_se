/**
 * search_tasks tool — find a workspace Task by title. Story 19.4a.
 *
 * Discovery entry point for tasks (mirrors search_law_list_items): the agent
 * resolves which task the user means, then acts on it. Title string match (not
 * semantic), workspace-scoped via `Task.workspace_id`.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'

const schema = z.object({
  query: z.string().describe('Sökord ur uppgiftens titel'),
  limit: z
    .number()
    .min(1)
    .max(20)
    .default(5)
    .describe('Antal träffar att returnera (1–20, standard 5)'),
})

type Input = z.infer<typeof schema>

export function createSearchTasksTool(workspaceId: string) {
  return tool({
    description: `Sök bland arbetsytans uppgifter (tasks) via titel.
Använd för att hitta en specifik uppgift som användaren refererar till — t.ex. innan du kommenterar, tilldelar eller länkar den.

Varje träff har \`taskId\`, \`title\` och \`columnName\` (vilken kolumn på tavlan uppgiften ligger i, t.ex. "Att göra" eller "Klar").`,
    inputSchema: zodSchema(schema),
    execute: async ({ query, limit }: Input) => {
      const startTime = Date.now()

      try {
        const tasks = await prisma.task.findMany({
          where: {
            // Workspace isolation (AC 10).
            workspace_id: workspaceId,
            title: { contains: query, mode: 'insensitive' },
          },
          select: {
            id: true,
            title: true,
            column: { select: { name: true } },
          },
          take: limit,
        })

        if (tasks.length === 0) {
          return wrapToolError(
            'search_tasks',
            'Inga uppgifter matchade sökningen.',
            'Försök med andra sökord ur uppgiftens titel.',
            startTime
          )
        }

        const results = tasks.map((t) => ({
          taskId: t.id,
          title: t.title,
          columnName: t.column?.name ?? null,
        }))

        return wrapToolResponse('search_tasks', results, startTime)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'search_tasks',
          `Sökningen misslyckades: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
