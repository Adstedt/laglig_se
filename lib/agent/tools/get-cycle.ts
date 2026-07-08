/**
 * get_cycle tool — Story 29.1 (cycle read tier).
 *
 * Reads one lagefterlevnadskontroll cycle's own state fully hydrated + capped
 * neighbour rows/handles (items, findings, reports, linked tasks) with true
 * totals alongside — lazy edges per the 19.4 grammar (1 hop per call). Sealed
 * cycles are read-only by construction: this tool ships zero mutation paths.
 * Names-not-IDs; caps at the Prisma `take` level; workspace-scoped;
 * soft-deleted cycles are invisible.
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
  cycleStatusLabel,
  auditTypeLabel,
  bedomningLabel,
  findingTypeLabel,
  findingSeverityLabel,
  parseScopeSummary,
} from './reader-utils'
import type { ContextHandle } from './types'

const schema = z.object({
  cycleId: z.string().describe('ID för kontrollen. Hitta id via list_cycles.'),
})

type Input = z.infer<typeof schema>

export function createGetCycleTool(workspaceId: string) {
  return tool({
    description: `Läs en lagefterlevnadskontrolls fullständiga tillstånd: namn, typ, status, omfattning, period, "ändringar bedömda t.o.m."-datum, revisionsledare, laglista, framsteg (granskade/signerade poster), samt kapade rader för granskningsposter (med bedömning) och avvikelser (drill in via get_finding), rapporter och kopplade uppgifter.

Hitta kontrollens id via list_cycles.`,
    inputSchema: zodSchema(schema),
    execute: async ({ cycleId }: Input) => {
      const startTime = Date.now()

      try {
        const cycle = await prisma.complianceAuditCycle.findFirst({
          where: { id: cycleId, workspace_id: workspaceId, deleted_at: null },
          include: {
            law_list: { select: { id: true, name: true } },
            lead_auditor: { select: { name: true, email: true } },
            sealed_by: { select: { name: true, email: true } },
            items: {
              take: 20,
              orderBy: { created_at: 'asc' },
              select: {
                id: true,
                efterlevnadsbedomning: true,
                motivering: true,
                reviewed_at: true,
                signed_off_at: true,
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
            findings: {
              take: 20,
              orderBy: { created_at: 'desc' },
              select: {
                id: true,
                type: true,
                severity: true,
                title: true,
                closed_at: true,
                due_date: true,
              },
            },
            reports: {
              select: { id: true, report_kind: true, generated_at: true },
            },
            task_links: {
              take: 20,
              select: { task: { select: { id: true, title: true } } },
            },
            _count: { select: { items: true, findings: true } },
          },
        })

        if (!cycle) {
          return wrapToolError(
            'get_cycle',
            'Kontrollen hittades inte.',
            'Kontrollera ID:t. Använd list_cycles för att hitta arbetsytans kontroller.',
            startTime
          )
        }

        // True progress/finding counts (independent of the capped rows).
        const [reviewedCount, signedOffCount, openCount] = await Promise.all([
          prisma.complianceAuditItem.count({
            where: { cycle_id: cycle.id, reviewed_at: { not: null } },
          }),
          prisma.complianceAuditItem.count({
            where: { cycle_id: cycle.id, signed_off_at: { not: null } },
          }),
          prisma.complianceFinding.count({
            where: { cycle_id: cycle.id, closed_at: null },
          }),
        ])

        const data = {
          id: cycle.id,
          name: cycle.name,
          description: shortText(cycle.description),
          auditType: auditTypeLabel(cycle.audit_type) ?? '',
          status: cycleStatusLabel(cycle.status) ?? '',
          scopeSummary: parseScopeSummary(
            cycle.scope_definition,
            cycle._count.items
          ),
          scheduledStart: cycle.scheduled_start.toISOString(),
          scheduledEnd: cycle.scheduled_end.toISOString(),
          lawChangeCutoffDate: cycle.law_change_cutoff_date.toISOString(),
          // 21.26 semantics: sealed_at/sealed_by record completion, not sealing.
          completedAt: isoDate(cycle.sealed_at),
          completedByName: userNameOrNull(cycle.sealed_by),
          leadAuditorName: userName(cycle.lead_auditor),
          lawList: { id: cycle.law_list.id, name: cycle.law_list.name },
          progress: {
            itemCount: cycle._count.items,
            reviewedCount,
            signedOffCount,
          },
          findings: {
            openCount,
            closedCount: cycle._count.findings - openCount,
          },
          items: cycle.items.map((i) => ({
            id: i.id,
            lawName:
              i.law_list_item.document?.title ??
              i.law_list_item.document?.document_number ??
              i.law_list_item.id,
            bedomning: bedomningLabel(i.efterlevnadsbedomning),
            motivering: shortText(i.motivering),
            reviewedAt: isoDate(i.reviewed_at),
            signedOffAt: isoDate(i.signed_off_at),
          })),
          findingRows: cycle.findings.map((f) => ({
            id: f.id,
            type: findingTypeLabel(f.type) ?? '',
            severity: findingSeverityLabel(f.severity),
            title: f.title,
            isClosed: f.closed_at !== null,
            dueDate: isoDate(f.due_date),
          })),
          reports: cycle.reports.map((r) => ({
            id: r.id,
            reportKind: r.report_kind,
            generatedAt: r.generated_at.toISOString(),
          })),
          linkedTasks: cycle.task_links.map(
            (l): ContextHandle => ({
              id: l.task.id,
              type: 'task',
              label: l.task.title,
            })
          ),
        }

        return wrapToolResponse('get_cycle', data, startTime)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'get_cycle',
          `Kunde inte läsa kontrollen: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
