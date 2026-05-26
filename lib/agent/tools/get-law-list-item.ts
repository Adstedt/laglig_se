/**
 * get_law_list_item tool — Story 19.4 (lazy graph traversal, flagship).
 *
 * Reads a LawListItem's own compliance state (status, business context,
 * narrative, status-log summary) + typed neighbour handles (requirements,
 * change-assessments, linked tasks/artifacts, document). The agent follows the
 * handles on demand (list_linked_artifacts, get_task, get_document_details).
 *
 * Caps applied at the Prisma `take` level; long text truncated; participant
 * NAMES only (never raw user ids). Workspace-scoped via `law_list.workspace_id`.
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
  complianceStatusLabel,
  priorityLabel,
  impactLevelLabel,
} from './reader-utils'
import type { ContextHandle } from './types'
import type { PendingActionToolContext } from './pending-action'

const schema = z.object({
  lawListItemId: z
    .string()
    .optional()
    .describe(
      'ID för laglistposten. Utelämna i en lag-chatt — då används den aktiva posten automatiskt (t.ex. lawListItemId från en search_law_list_items-träff).'
    ),
})

type Input = z.infer<typeof schema>

export function createGetLawListItemTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Läs en laglistposts faktiska efterlevnadstillstånd: status, affärskontext, "hur efterlever vi"-narrativ, statushistorik + kravpunkter (med bevis-antal), tidigare ändringsbedömningar, kopplade uppgifter och dokument.

**Läs detta INNAN du föreslår en statusändring (update_compliance_status) eller en ny kravpunkt (add_obligation)** — så att förslaget speglar nuläget (befintliga kravpunkter, bevisluckor, tidigare bedömningar) istället för en gissning.

Utelämna \`lawListItemId\` i en lag-chatt (den aktiva posten används). I en global chatt: hitta posten först med search_law_list_items. För hela listan av kopplade filer/dokument (inklusive via uppgifter och bevis), anropa list_linked_artifacts.`,
    inputSchema: zodSchema(schema),
    execute: async ({ lawListItemId }: Input) => {
      const startTime = Date.now()

      // Story 19.4a: default to the active law-list item from the chat context.
      const resolvedId = lawListItemId ?? context?.lawListItemId
      if (!resolvedId) {
        return wrapToolError(
          'get_law_list_item',
          'Ingen laglistpost angiven.',
          'Ange lawListItemId, eller använd search_law_list_items för att hitta rätt post i bevakningslistan.',
          startTime
        )
      }

      try {
        const item = await prisma.lawListItem.findFirst({
          where: { id: resolvedId, law_list: { workspace_id: workspaceId } },
          include: {
            responsible_user: { select: { name: true, email: true } },
            document: {
              select: { id: true, title: true, document_number: true },
            },
            requirements: {
              take: 15,
              orderBy: { position: 'asc' },
              select: {
                id: true,
                text: true,
                is_fulfilled: true,
                bevis_required: true,
                _count: { select: { evidence_links: true } },
              },
            },
            change_assessments: {
              take: 5,
              orderBy: { assessed_at: 'desc' },
              select: {
                id: true,
                impact_level: true,
                ai_analysis: true,
                user_notes: true,
                assessed_at: true,
                change_event: { select: { amendment_sfs: true } },
              },
            },
            compliance_status_logs: {
              take: 5,
              orderBy: { changed_at: 'desc' },
              select: {
                previous_status: true,
                new_status: true,
                reason: true,
                changed_at: true,
                changed_by_user: { select: { name: true, email: true } },
              },
            },
            task_links: {
              take: 20,
              select: { task: { select: { id: true, title: true } } },
            },
            _count: {
              select: { file_links: true, workspace_document_links: true },
            },
          },
        })

        if (!item) {
          return wrapToolError(
            'get_law_list_item',
            'Laglistposten hittades inte.',
            'Kontrollera ID:t. Använd search_law_list_items för att hitta posten i arbetsytan.',
            startTime
          )
        }

        const document: ContextHandle = {
          id: item.document.id,
          type: 'document',
          label: `${item.document.title} (${item.document.document_number})`,
        }

        const data = {
          id: item.id,
          complianceStatus: complianceStatusLabel(item.compliance_status),
          priority: priorityLabel(item.priority),
          dueDate: isoDate(item.due_date),
          category: item.category,
          businessContext: shortText(item.business_context),
          complianceNarrative: shortText(item.compliance_narrative),
          responsibleName: userNameOrNull(item.responsible_user),
          statusLogSummary: item.compliance_status_logs.map((l) => ({
            from: complianceStatusLabel(l.previous_status),
            to: complianceStatusLabel(l.new_status),
            reason: shortText(l.reason, 40),
            date: isoDate(l.changed_at),
            byName: userName(l.changed_by_user),
          })),
          requirements: item.requirements.map((r) => ({
            id: r.id,
            text: shortText(r.text, 60) ?? '',
            isFulfilled: r.is_fulfilled,
            bevisRequired: r.bevis_required,
            bevisCount: r._count.evidence_links,
          })),
          changeAssessments: item.change_assessments.map((a) => ({
            id: a.id,
            amendmentSfs: a.change_event?.amendment_sfs ?? null,
            conclusion: shortText(a.user_notes?.trim() || a.ai_analysis),
            impactLevel: impactLevelLabel(a.impact_level),
            date: isoDate(a.assessed_at),
          })),
          linkedTasks: item.task_links.map(
            (t): ContextHandle => ({
              id: t.task.id,
              type: 'task',
              label: t.task.title,
            })
          ),
          linkedArtifacts: {
            directFileCount: item._count.file_links,
            directDocumentCount: item._count.workspace_document_links,
          },
          document,
        }

        return wrapToolResponse('get_law_list_item', data, startTime)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'get_law_list_item',
          `Kunde inte läsa laglistposten: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
