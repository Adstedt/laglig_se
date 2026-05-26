/**
 * list_overdue tool — Story 19.3 (diagnostics).
 *
 * Workspace-wide read: tasks past their `due_date` that are NOT done
 * (`column.is_done = false` — the canonical "done" signal, not `completed_at`).
 * Returns the true `count` + a capped, oldest-overdue-first list, each carrying
 * `taskId` so the agent can drill in via get_task. Names, not raw user ids.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'
import { isoDate, userNameOrNull } from './reader-utils'

const MS_PER_DAY = 86_400_000

const schema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Max antal poster att visa (standard 20).'),
})

type Input = z.infer<typeof schema>

export function createListOverdueTool(workspaceId: string) {
  return tool({
    description: `Lista försenade uppgifter i arbetsytan — uppgifter vars slutdatum passerat och som inte ligger i en "klar"-kolumn. Använd för "vad är försenat?" / "vad bör vi prioritera?". Returnerar totalt antal + de mest försenade först, med \`taskId\` (följ upp med get_task). Tomt resultat (count 0) = inget är försenat; rapportera positivt.`,
    inputSchema: zodSchema(schema),
    execute: async ({ limit }: Input) => {
      const startTime = Date.now()
      const take = limit ?? 20
      const now = new Date()

      try {
        const where: Prisma.TaskWhereInput = {
          workspace_id: workspaceId,
          due_date: { not: null, lt: now },
          column: { is_done: false },
        }

        const [count, rows] = await Promise.all([
          prisma.task.count({ where }),
          prisma.task.findMany({
            where,
            take,
            orderBy: { due_date: 'asc' },
            select: {
              id: true,
              title: true,
              due_date: true,
              assignee: { select: { name: true, email: true } },
              column: { select: { name: true } },
            },
          }),
        ])

        const tasks = rows.map((t) => ({
          taskId: t.id,
          title: t.title,
          dueDate: isoDate(t.due_date),
          daysOverdue: t.due_date
            ? Math.floor((now.getTime() - t.due_date.getTime()) / MS_PER_DAY)
            : 0,
          assigneeName: userNameOrNull(t.assignee),
          status: t.column?.name ?? null,
        }))

        return wrapToolResponse(
          'list_overdue',
          { count, tasks },
          startTime,
          count
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'list_overdue',
          `Kunde inte hämta försenade uppgifter: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
