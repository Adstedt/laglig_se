/**
 * Test fixtures for Epic 21 — Lagefterlevnadskontroll.
 *
 * Story 21.1: provides `createTestCycle` + `cleanupTestCycles` helpers for
 * integration tests. Callers must provide pre-existing workspace, law-list,
 * user, and law-list-item ids (the fixture does NOT seed those — use the
 * existing test-workspace seeders for that).
 *
 * Consumed by:
 * - tests/integration/compliance-audit/schema.test.ts (Story 21.1)
 * - Future Epic 21 stories' tests
 */

import {
  AuditType,
  ComplianceCycleStatus,
  EfterlevnadsBedomning,
  type ComplianceAuditCycle,
  type ComplianceAuditItem,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface CreateTestCycleInput {
  workspaceId: string
  lawListId: string
  leadAuditorUserId: string
  createdByUserId: string
  /**
   * LawListItem ids to materialise as ComplianceAuditItem rows. The fixture
   * creates one ComplianceAuditItem per id, with `efterlevnadsbedomning: null`
   * and no motivering/signoff. Subsequent tests can mutate these items.
   */
  lawListItemIds: string[]
  /** Optional cycle metadata overrides. */
  name?: string
  auditType?: AuditType
  scheduledStart?: Date
  scheduledEnd?: Date
  lawChangeCutoffDate?: Date
  status?: ComplianceCycleStatus
  /** If provided, replaces the default empty scope_definition. */
  scopeDefinition?: unknown
}

export interface ComplianceAuditCycleWithItems extends ComplianceAuditCycle {
  items: ComplianceAuditItem[]
}

/**
 * Creates a ComplianceAuditCycle + materialised ComplianceAuditItem rows
 * inside a single Prisma transaction. Returns the cycle with items eagerly
 * loaded.
 */
export async function createTestCycle(
  input: CreateTestCycleInput
): Promise<ComplianceAuditCycleWithItems> {
  const now = new Date()
  const defaultStart = new Date(now.getTime())
  const defaultEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30) // +30d
  const defaultCutoff = new Date(now.getTime())

  return prisma.$transaction(async (tx) => {
    const cycle = await tx.complianceAuditCycle.create({
      data: {
        workspace_id: input.workspaceId,
        law_list_id: input.lawListId,
        name: input.name ?? `Test kontroll ${now.toISOString()}`,
        scope_definition: (input.scopeDefinition as
          | object
          | null
          | undefined) ?? {
          kind: 'items',
          itemIds: input.lawListItemIds,
        },
        audit_type: input.auditType ?? AuditType.INTERN,
        scheduled_start: input.scheduledStart ?? defaultStart,
        scheduled_end: input.scheduledEnd ?? defaultEnd,
        law_change_cutoff_date: input.lawChangeCutoffDate ?? defaultCutoff,
        status: input.status ?? ComplianceCycleStatus.PAGAENDE,
        lead_auditor_user_id: input.leadAuditorUserId,
        created_by_user_id: input.createdByUserId,
      },
    })

    if (input.lawListItemIds.length > 0) {
      await tx.complianceAuditItem.createMany({
        data: input.lawListItemIds.map((itemId) => ({
          cycle_id: cycle.id,
          law_list_item_id: itemId,
          efterlevnadsbedomning: null as EfterlevnadsBedomning | null,
        })),
      })
    }

    const items = await tx.complianceAuditItem.findMany({
      where: { cycle_id: cycle.id },
      orderBy: { created_at: 'asc' },
    })

    return { ...cycle, items }
  })
}

/**
 * Deletes all ComplianceAuditCycle records for a workspace. Cascade takes
 * care of items, findings, snapshots, and reports. Safe to call in afterEach.
 */
export async function cleanupTestCycles(workspaceId: string): Promise<void> {
  await prisma.complianceAuditCycle.deleteMany({
    where: { workspace_id: workspaceId },
  })
}
