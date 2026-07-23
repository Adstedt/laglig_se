/**
 * get_finding tool — Story 29.1 (cycle read tier).
 *
 * Reads one finding's (avvikelse/observation/förbättringsförslag) full state
 * incl. closure metadata + four NULLABLE neighbour handles (cycle, law item,
 * requirement, corrective task). Epic 23 tolerance rule: the cycle handle is
 * typed and shaped nullable from day one — Epic 23 will make
 * `ComplianceFinding.cycle_id` nullable (ad-hoc findings without a cycle).
 * Names-not-IDs; workspace-scoped via the parent cycle (the finding has no own
 * workspace_id column until Epic 23).
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'
import {
  shortText,
  userNameOrNull,
  isoDate,
  findingTypeLabel,
  findingSeverityLabel,
} from './reader-utils'
import type { ContextHandle } from './types'

const schema = z.object({
  findingId: z
    .string()
    .describe(
      'ID för avvikelsen/observationen. Hitta id via get_cycle (findingRows).'
    ),
})

type Input = z.infer<typeof schema>

export function createGetFindingTool(workspaceId: string) {
  return tool({
    description: `Läs en avvikelses/observations fullständiga tillstånd: typ, allvarlighetsgrad, titel, beskrivning, grundorsak, förfallodatum, samt stängningsmetadata (när, av vem, verifieringsanteckning, stängningsorsak) och handtag till kontrollen, laglistposten, kravpunkten och åtgärdsuppgiften.

Hitta id via get_cycle (findingRows). Ett null-värde för laglistposten betyder att avvikelsen är på system-/processnivå (t.ex. "ingen aktuell lagefterlevnadskontroll") — inte ett fel.`,
    inputSchema: zodSchema(schema),
    execute: async ({ findingId }: Input) => {
      const startTime = Date.now()

      try {
        const finding = await prisma.complianceFinding.findFirst({
          // Epic 23: move the workspace scope to the finding's own
          // workspace_id column once Story 23.1 lands (23.1 owns that
          // migration) — the parent-cycle relation is the only path today.
          where: { id: findingId, cycle: { workspace_id: workspaceId } },
          include: {
            cycle: { select: { id: true, name: true } },
            law_list_item: {
              select: {
                id: true,
                document: { select: { title: true, document_number: true } },
              },
            },
            requirement: { select: { id: true, text: true } },
            corrective_action_task: { select: { id: true, title: true } },
            closed_by: { select: { name: true, email: true } },
          },
        })

        if (!finding) {
          return wrapToolError(
            'get_finding',
            'Avvikelsen hittades inte.',
            'Kontrollera ID:t. Hitta avvikelser via get_cycle (findingRows).',
            startTime
          )
        }

        // Epic 23 tolerance: shape the cycle handle with a runtime null-guard
        // even though Prisma types the relation non-null today — Epic 23 makes
        // cycle_id nullable and this reader must not break when it does.
        const cycleRelation = finding.cycle as {
          id: string
          name: string
        } | null

        const data = {
          id: finding.id,
          type: findingTypeLabel(finding.type) ?? '',
          severity: findingSeverityLabel(finding.severity),
          title: finding.title,
          description: shortText(finding.description),
          rootCause: shortText(finding.root_cause),
          dueDate: isoDate(finding.due_date),
          createdAt: finding.created_at.toISOString(),
          closedAt: isoDate(finding.closed_at),
          closedByName: userNameOrNull(finding.closed_by),
          verificationNote: shortText(finding.verification_note),
          closeReason: shortText(finding.close_reason),
          cycle: cycleRelation
            ? ({
                id: cycleRelation.id,
                type: 'cycle',
                label: cycleRelation.name,
              } satisfies ContextHandle)
            : null,
          // MAY BE NULL: system-level findings carry no law item.
          lawItem: finding.law_list_item
            ? ({
                id: finding.law_list_item.id,
                type: 'law_item',
                label:
                  finding.law_list_item.document?.title ??
                  finding.law_list_item.document?.document_number ??
                  finding.law_list_item.id,
              } satisfies ContextHandle)
            : null,
          requirement: finding.requirement
            ? ({
                id: finding.requirement.id,
                type: 'requirement',
                label: shortText(finding.requirement.text) ?? '',
              } satisfies ContextHandle)
            : null,
          correctiveTask: finding.corrective_action_task
            ? ({
                id: finding.corrective_action_task.id,
                type: 'task',
                label: finding.corrective_action_task.title,
              } satisfies ContextHandle)
            : null,
        }

        return wrapToolResponse('get_finding', data, startTime)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'get_finding',
          `Kunde inte läsa avvikelsen: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
