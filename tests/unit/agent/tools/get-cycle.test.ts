/**
 * Unit tests for get_cycle (Story 29.1).
 * Asserts: workspace + deleted_at:null scoping (miss → wrapToolError), caps at
 * the Prisma take level (items/findingRows/task_links = 20), leadAuditorName
 * resolved with NO raw user-id in output, bedömning/status/type labels, report
 * row shape, progress counts.
 */

import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    complianceAuditCycle: { findFirst: vi.fn() },
    complianceAuditItem: { count: vi.fn() },
    complianceFinding: { count: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { createGetCycleTool } from '@/lib/agent/tools/get-cycle'

const p = prisma as unknown as {
  complianceAuditCycle: { findFirst: ReturnType<typeof vi.fn> }
  complianceAuditItem: { count: ReturnType<typeof vi.fn> }
  complianceFinding: { count: ReturnType<typeof vi.fn> }
}

const WS = 'ws-1'
type Exec = (
  _i: { cycleId: string },
  _o: unknown
) => Promise<Record<string, unknown>>
const opts = {
  toolCallId: 'tc',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

function cycle(over: Record<string, unknown> = {}) {
  return {
    id: 'cycle-1',
    name: 'Q2 kontroll',
    description: 'Kvartalsvis genomgång',
    audit_type: 'EXTERN',
    status: 'AVSLUTAD',
    scope_definition: { kind: 'all' },
    scheduled_start: new Date('2026-04-01T00:00:00.000Z'),
    scheduled_end: new Date('2026-06-30T00:00:00.000Z'),
    law_change_cutoff_date: new Date('2026-06-01T00:00:00.000Z'),
    sealed_at: new Date('2026-06-28T00:00:00.000Z'),
    law_list: { id: 'list-1', name: 'Miljölaglista' },
    lead_auditor: { name: 'Johan', email: 'johan@x.se' },
    sealed_by: { name: 'Anna', email: 'anna@x.se' },
    items: [
      {
        id: 'item-1',
        efterlevnadsbedomning: 'DELVIS',
        motivering: 'Delvis dokumenterat',
        reviewed_at: new Date('2026-05-01T00:00:00.000Z'),
        signed_off_at: null,
        law_list_item: {
          id: 'lli-1',
          document: { title: 'Miljöbalk', document_number: 'SFS 1998:808' },
        },
      },
    ],
    findings: [
      {
        id: 'finding-1',
        type: 'AVVIKELSE',
        severity: 'MAJOR',
        title: 'Kemikalieförteckning saknas',
        closed_at: null,
        due_date: new Date('2026-08-01T00:00:00.000Z'),
      },
    ],
    reports: [
      {
        id: 'report-1',
        report_kind: 'COMPLETE',
        generated_at: new Date('2026-06-28T00:00:00.000Z'),
      },
    ],
    task_links: [{ task: { id: 'task-1', title: 'Upprätta förteckning' } }],
    _count: { items: 12, findings: 5 },
    ...over,
  }
}

const execute = createGetCycleTool(WS).execute as Exec

beforeEach(() => {
  vi.clearAllMocks()
  p.complianceAuditItem.count.mockResolvedValue(0)
  p.complianceFinding.count.mockResolvedValue(0)
})

it('workspace + deleted_at:null scoped findFirst', async () => {
  p.complianceAuditCycle.findFirst.mockResolvedValue(cycle())
  await execute({ cycleId: 'cycle-1' }, opts)
  expect(p.complianceAuditCycle.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'cycle-1', workspace_id: WS, deleted_at: null },
    })
  )
})

it('cross-workspace / soft-deleted miss → wrapToolError steering to list_cycles', async () => {
  p.complianceAuditCycle.findFirst.mockResolvedValue(null)
  const result = await execute({ cycleId: 'deleted-or-foreign' }, opts)
  expect(result.error).toBe(true)
  expect((result as { guidance: string }).guidance).toContain('list_cycles')
})

it('caps items/findings/task_links at the Prisma take level (20)', async () => {
  p.complianceAuditCycle.findFirst.mockResolvedValue(cycle())
  await execute({ cycleId: 'cycle-1' }, opts)
  const include = p.complianceAuditCycle.findFirst.mock.calls[0][0].include
  expect(include.items.take).toBe(20)
  expect(include.items.orderBy).toEqual({ created_at: 'asc' })
  expect(include.findings.take).toBe(20)
  expect(include.findings.orderBy).toEqual({ created_at: 'desc' })
  expect(include.task_links.take).toBe(20)
  // reports uncapped — DB-unique max 1 COMPLETE per cycle
  expect(include.reports.take).toBeUndefined()
})

it('resolves names, never raw user-id columns', async () => {
  p.complianceAuditCycle.findFirst.mockResolvedValue(cycle())
  const result = await execute({ cycleId: 'cycle-1' }, opts)
  const data = result.data as Record<string, unknown>
  expect(data.leadAuditorName).toBe('Johan')
  expect(data.completedByName).toBe('Anna')
  const serialized = JSON.stringify(data)
  expect(serialized).not.toContain('lead_auditor_user_id')
  expect(serialized).not.toContain('sealed_by_user_id')
})

it('emits canonical Swedish labels (status/type/bedömning/finding), never raw enums', async () => {
  p.complianceAuditCycle.findFirst.mockResolvedValue(cycle())
  const result = await execute({ cycleId: 'cycle-1' }, opts)
  const data = result.data as Record<string, unknown>
  expect(data.status).toBe('Avslutad')
  expect(data.auditType).toBe('Extern revision')
  const item = (data.items as Array<Record<string, unknown>>)[0]!
  expect(item.bedomning).toBe('Delvis')
  expect(item.lawName).toBe('Miljöbalk')
  const finding = (data.findingRows as Array<Record<string, unknown>>)[0]!
  expect(finding.type).toBe('Avvikelse')
  expect(finding.severity).toBe('Större')
  expect(finding.isClosed).toBe(false)
  const serialized = JSON.stringify(data)
  expect(serialized).not.toContain('AVSLUTAD')
  expect(serialized).not.toContain('AVVIKELSE')
  expect(serialized).not.toContain('DELVIS')
})

it('report row shape + linked-task handles', async () => {
  p.complianceAuditCycle.findFirst.mockResolvedValue(cycle())
  const result = await execute({ cycleId: 'cycle-1' }, opts)
  const data = result.data as Record<string, unknown>
  expect(data.reports).toEqual([
    {
      id: 'report-1',
      reportKind: 'COMPLETE',
      generatedAt: '2026-06-28T00:00:00.000Z',
    },
  ])
  expect((data.linkedTasks as Array<unknown>)[0]).toEqual({
    id: 'task-1',
    type: 'task',
    label: 'Upprätta förteckning',
  })
})

it('progress carries true counts (itemCount from _count, reviewed/signedOff/open from count queries)', async () => {
  p.complianceAuditCycle.findFirst.mockResolvedValue(cycle())
  p.complianceAuditItem.count
    .mockResolvedValueOnce(9) // reviewed
    .mockResolvedValueOnce(6) // signed off
  p.complianceFinding.count.mockResolvedValue(2) // open
  const result = await execute({ cycleId: 'cycle-1' }, opts)
  const data = result.data as Record<string, unknown>
  expect(data.progress).toEqual({
    itemCount: 12,
    reviewedCount: 9,
    signedOffCount: 6,
  })
  expect(data.findings).toEqual({ openCount: 2, closedCount: 3 })
})
