/**
 * list_cycles tool — Story 29.1 (cycle read tier, discovery).
 *
 * Workspace-wide read over Epic 21's lagefterlevnadskontroll cycles. Returns
 * the true `count` (separate query) + a capped list where every row carries a
 * `scopeSummary` (kind + group/item counts) so a skill can evaluate aggregate
 * coverage across rolling partial cycles WITHOUT opening each one (Journey A3).
 * Soft-deleted cycles (`deleted_at`) are invisible. Follows the 19.3
 * true-count + capped-list + positive-zero conventions (list_bevis_gaps).
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'
import {
  isoDate,
  cycleStatusLabel,
  auditTypeLabel,
  parseScopeSummary,
} from './reader-utils'

const schema = z.object({
  status: z
    .enum(['PLANERAD', 'PAGAENDE', 'AVSLUTAD'])
    .optional()
    .describe('Filtrera på kontrollens status.'),
  auditType: z
    .enum(['INTERN', 'EXTERN'])
    .optional()
    .describe('Filtrera på revisionstyp (intern/extern).'),
  lawListId: z
    .string()
    .optional()
    .describe('Filtrera på en specifik laglista.'),
  completedAfter: z
    .string()
    .optional()
    .describe(
      'ISO-datum — visa endast kontroller avslutade på eller efter datumet.'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Max antal kontroller att visa (standard 20).'),
})

type Input = z.infer<typeof schema>

export function createListCyclesTool(workspaceId: string) {
  return tool({
    description: `Lista arbetsytans lagefterlevnadskontroller (revisionscykler): namn, typ (intern/extern), status, period, "ändringar bedömda t.o.m."-datum, laglista, omfattning (hela listan / grupper / enskilda poster med antal), granskningsframsteg och öppna/stängda avvikelser. Använd för "visa er senaste lagefterlevnadskontroll" / "vilka kontroller har genomförts?". Returnerar totalt antal + de översta kontrollerna — läs en enskild kontroll i detalj med get_cycle. 0 kontroller är ett viktigt fynd — rapportera det tydligt, det är exakt vad en revisor frågar efter.`,
    inputSchema: zodSchema(schema),
    execute: async ({
      status,
      auditType,
      lawListId,
      completedAfter,
      limit,
    }: Input) => {
      const startTime = Date.now()
      const take = limit ?? 20

      // Invalid ISO string → steering error before any query.
      let completedAfterDate: Date | undefined
      if (completedAfter != null) {
        completedAfterDate = new Date(completedAfter)
        if (Number.isNaN(completedAfterDate.getTime())) {
          return wrapToolError(
            'list_cycles',
            `Ogiltigt datum: "${completedAfter}".`,
            'Ange completedAfter som ett ISO-datum, t.ex. "2026-01-01".',
            startTime
          )
        }
      }

      try {
        // Soft-deleted cycles are invisible to every path (AC 4).
        const where: Prisma.ComplianceAuditCycleWhereInput = {
          workspace_id: workspaceId,
          deleted_at: null,
          ...(status && { status }),
          ...(auditType && { audit_type: auditType }),
          ...(lawListId && { law_list_id: lawListId }),
          ...(completedAfterDate && {
            sealed_at: { gte: completedAfterDate },
          }),
        }

        const [count, rows] = await Promise.all([
          prisma.complianceAuditCycle.count({ where }),
          prisma.complianceAuditCycle.findMany({
            where,
            take,
            // Latest completed first, then planned/running by recency.
            orderBy: [
              { sealed_at: { sort: 'desc', nulls: 'last' } },
              { scheduled_start: 'desc' },
            ],
            include: {
              law_list: { select: { name: true } },
              _count: { select: { items: true, findings: true } },
            },
          }),
        ])

        // Bounded progress/finding math: two groupBys over the page's ids —
        // no per-cycle N+1 (AC 7).
        const ids = rows.map((r) => r.id)
        const [reviewed, open] = await Promise.all([
          prisma.complianceAuditItem.groupBy({
            by: ['cycle_id'],
            where: { cycle_id: { in: ids }, reviewed_at: { not: null } },
            _count: { _all: true },
          }),
          prisma.complianceFinding.groupBy({
            by: ['cycle_id'],
            where: { cycle_id: { in: ids }, closed_at: null },
            _count: { _all: true },
          }),
        ])
        const reviewedByCycle = new Map(
          reviewed.map((r) => [r.cycle_id, r._count._all])
        )
        const openByCycle = new Map(
          open.map((r) => [r.cycle_id, r._count._all])
        )

        const cycles = rows.map((r) => {
          const openCount = openByCycle.get(r.id) ?? 0
          return {
            id: r.id,
            name: r.name,
            auditType: auditTypeLabel(r.audit_type) ?? '',
            status: cycleStatusLabel(r.status) ?? '',
            scheduledStart: r.scheduled_start.toISOString(),
            scheduledEnd: r.scheduled_end.toISOString(),
            // 21.26 semantics: sealed_at is the completion timestamp.
            completedAt: isoDate(r.sealed_at),
            lawChangeCutoffDate: r.law_change_cutoff_date.toISOString(),
            lawListName: r.law_list.name,
            scopeSummary: parseScopeSummary(r.scope_definition, r._count.items),
            progress: {
              itemCount: r._count.items,
              reviewedCount: reviewedByCycle.get(r.id) ?? 0,
            },
            findings: {
              openCount,
              closedCount: r._count.findings - openCount,
            },
          }
        })

        return wrapToolResponse(
          'list_cycles',
          { count, cycles },
          startTime,
          count
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'list_cycles',
          `Kunde inte hämta kontroller: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}
