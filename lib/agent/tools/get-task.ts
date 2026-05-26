/**
 * get_task tool — Story 19.4 (lazy graph traversal).
 *
 * Reads a Task's details + capped comments + typed handles to its linked
 * law-list items, artifacts, and the finding that spawned it. Defaults from the
 * chat context when scoped to a TASK. Names-not-IDs; caps at the Prisma `take`
 * level; workspace-scoped.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'
import {
  shortText,
  userName,
  userNameOrNull,
  isoDate,
  priorityLabel,
} from './reader-utils'
import type { ContextHandle } from './types'
import type { PendingActionToolContext } from './pending-action'

const schema = z.object({
  taskId: z
    .string()
    .optional()
    .describe(
      'ID för uppgiften. Utelämna i en uppgifts-chatt — då används den aktiva uppgiften (t.ex. taskId från search_tasks / list_linked_artifacts).'
    ),
})

type Input = z.infer<typeof schema>

export function createGetTaskTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Läs en uppgifts detaljer: titel, beskrivning, status (kolumn), prioritet, ansvarig, datum, samt kapade kommentarer och handtag till kopplade laglistposter, filer/dokument och en eventuell avvikelse som skapade uppgiften.

Utelämna \`taskId\` i en uppgifts-chatt (den aktiva uppgiften används); annars hitta uppgiften med search_tasks eller via list_linked_artifacts.`,
    inputSchema: zodSchema(schema),
    execute: async ({ taskId }: Input) => {
      const startTime = Date.now()

      // Default to the active task in a TASK-scoped chat (contextId = taskId).
      const resolvedId =
        taskId ??
        (context?.contextType === 'TASK'
          ? (context?.contextId ?? undefined)
          : undefined)
      if (!resolvedId) {
        return wrapToolError(
          'get_task',
          'Ingen uppgift angiven.',
          'Ange taskId, eller använd search_tasks för att hitta rätt uppgift.',
          startTime
        )
      }

      try {
        const task = await prisma.task.findFirst({
          where: { id: resolvedId, workspace_id: workspaceId },
          include: {
            column: { select: { name: true } },
            assignee: { select: { name: true, email: true } },
            comments: {
              take: 10,
              orderBy: { created_at: 'desc' },
              select: {
                content: true,
                created_at: true,
                author: { select: { name: true, email: true } },
              },
            },
            list_item_links: {
              take: 20,
              select: {
                law_list_item: {
                  select: {
                    id: true,
                    document: {
                      select: { title: true, document_number: true },
                    },
                  },
                },
              },
            },
            compliance_finding: { select: { id: true } },
            _count: {
              select: { file_links: true, workspace_document_links: true },
            },
          },
        })

        if (!task) {
          return wrapToolError(
            'get_task',
            'Uppgiften hittades inte.',
            'Kontrollera ID:t. Använd search_tasks för att hitta uppgiften i arbetsytan.',
            startTime
          )
        }

        const data = {
          id: task.id,
          title: task.title,
          description: shortText(task.description),
          status: task.column?.name ?? null,
          priority: priorityLabel(task.priority),
          assigneeName: userNameOrNull(task.assignee),
          dueDate: isoDate(task.due_date),
          completedAt: isoDate(task.completed_at),
          comments: task.comments.map((c) => ({
            authorName: userName(c.author),
            text: shortText(c.content, 60) ?? '',
            date: isoDate(c.created_at),
          })),
          linkedLawItems: task.list_item_links.map(
            (l): ContextHandle => ({
              id: l.law_list_item.id,
              type: 'law_item',
              label:
                l.law_list_item.document?.title ??
                l.law_list_item.document?.document_number ??
                l.law_list_item.id,
            })
          ),
          linkedArtifacts: {
            fileCount: task._count.file_links,
            documentCount: task._count.workspace_document_links,
          },
          spawnedByFinding: task.compliance_finding
            ? ({
                id: task.compliance_finding.id,
                type: 'finding',
                label: 'Avvikelse som skapade uppgiften',
              } satisfies ContextHandle)
            : null,
        }

        return wrapToolResponse('get_task', data, startTime)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'get_task',
          `Kunde inte läsa uppgiften: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
