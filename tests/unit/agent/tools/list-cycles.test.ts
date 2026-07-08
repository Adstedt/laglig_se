/**
 * Unit tests for list_cycles (Story 29.1).
 * Asserts: workspace-scoped where incl. deleted_at:null, filter mapping
 * (completedAfter → sealed_at.gte), true count independent of take, limit
 * default/clamp, labels-not-enums, scopeSummary all kinds + malformed
 * fallback, open/closed finding math, positive-zero success payload.
 */

import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    complianceAuditCycle: { count: vi.fn(), findMany: vi.fn() },
    complianceAuditItem: { groupBy: vi.fn() },
    complianceFinding: { groupBy: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { createListCyclesTool } from '@/lib/agent/tools/list-cycles'

const p = prisma as unknown as {
  complianceAuditCycle: {
    count: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
  }
  complianceAuditItem: { groupBy: ReturnType<typeof vi.fn> }
  complianceFinding: { groupBy: ReturnType<typeof vi.fn> }
}

const WS = 'ws-1'
type Exec = (
  _i: Record<string, unknown>,
  _o: unknown
) => Promise<Record<string, unknown>>
const opts = {
  toolCallId: 'tc',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

function cycleRow(over: Record<string, unknown> = {}) {
  return {
    id: 'cycle-1',
    name: 'Q2 lagefterlevnadskontroll',
    audit_type: 'INTERN',
    status: 'AVSLUTAD',
    scheduled_start: new Date('2026-04-01T00:00:00.000Z'),
    scheduled_end: new Date('2026-06-30T00:00:00.000Z'),
    sealed_at: new Date('2026-06-28T00:00:00.000Z'),
    law_change_cutoff_date: new Date('2026-06-01T00:00:00.000Z'),
    scope_definition: { kind: 'groups', groupIds: ['g1', 'g2'] },
    law_list: { name: 'Miljölaglista' },
    _count: { items: 12, findings: 5 },
    ...over,
  }
}

const execute = createListCyclesTool(WS).execute as Exec

beforeEach(() => {
  vi.clearAllMocks()
  p.complianceAuditItem.groupBy.mockResolvedValue([])
  p.complianceFinding.groupBy.mockResolvedValue([])
})

it('workspace-scoped where incl. deleted_at: null + take 20 default + ordering', async () => {
  p.complianceAuditCycle.count.mockResolvedValue(1)
  p.complianceAuditCycle.findMany.mockResolvedValue([cycleRow()])
  await execute({}, opts)
  const arg = p.complianceAuditCycle.findMany.mock.calls[0][0]
  expect(arg.where).toEqual({ workspace_id: WS, deleted_at: null })
  expect(arg.take).toBe(20)
  expect(arg.orderBy).toEqual([
    { sealed_at: { sort: 'desc', nulls: 'last' } },
    { scheduled_start: 'desc' },
  ])
  // count uses the same where (true total, not rows.length)
  expect(p.complianceAuditCycle.count).toHaveBeenCalledWith({
    where: arg.where,
  })
})

it('maps every filter, incl. completedAfter → sealed_at.gte', async () => {
  p.complianceAuditCycle.count.mockResolvedValue(0)
  p.complianceAuditCycle.findMany.mockResolvedValue([])
  await execute(
    {
      status: 'AVSLUTAD',
      auditType: 'INTERN',
      lawListId: 'list-1',
      completedAfter: '2026-01-01',
    },
    opts
  )
  const where = p.complianceAuditCycle.findMany.mock.calls[0][0].where
  expect(where).toEqual({
    workspace_id: WS,
    deleted_at: null,
    status: 'AVSLUTAD',
    audit_type: 'INTERN',
    law_list_id: 'list-1',
    sealed_at: { gte: new Date('2026-01-01') },
  })
})

it('invalid completedAfter ISO string → wrapToolError, no query fired', async () => {
  const result = await execute({ completedAfter: 'inte-ett-datum' }, opts)
  expect(result.error).toBe(true)
  expect(p.complianceAuditCycle.findMany).not.toHaveBeenCalled()
})

it('returns the true count independent of the capped rows; honors limit', async () => {
  p.complianceAuditCycle.count.mockResolvedValue(47)
  p.complianceAuditCycle.findMany.mockResolvedValue([cycleRow()])
  const result = await execute({ limit: 5 }, opts)
  expect(p.complianceAuditCycle.findMany.mock.calls[0][0].take).toBe(5)
  const data = result.data as { count: number; cycles: unknown[] }
  expect(data.count).toBe(47)
  expect(data.cycles).toHaveLength(1)
})

it('emits canonical Swedish labels, never raw enums', async () => {
  p.complianceAuditCycle.count.mockResolvedValue(1)
  p.complianceAuditCycle.findMany.mockResolvedValue([
    cycleRow({ status: 'PAGAENDE', sealed_at: null }),
  ])
  const result = await execute({}, opts)
  const row = (result.data as { cycles: Array<Record<string, unknown>> })
    .cycles[0]
  expect(row.status).toBe('Pågående')
  expect(row.auditType).toBe('Intern revision')
  expect(row.completedAt).toBeNull()
  const serialized = JSON.stringify(result.data)
  expect(serialized).not.toContain('PAGAENDE')
  expect(serialized).not.toContain('INTERN')
})

it('scopeSummary carries kind + counts for all three kinds + malformed fallback', async () => {
  p.complianceAuditCycle.count.mockResolvedValue(4)
  p.complianceAuditCycle.findMany.mockResolvedValue([
    cycleRow({ id: 'c-all', scope_definition: { kind: 'all' } }),
    cycleRow({
      id: 'c-groups',
      scope_definition: { kind: 'groups', groupIds: ['g1', 'g2', 'g3'] },
    }),
    cycleRow({
      id: 'c-items',
      scope_definition: { kind: 'items', itemIds: ['i1'] },
      _count: { items: 1, findings: 0 },
    }),
    cycleRow({ id: 'c-broken', scope_definition: 'garbage' }),
  ])
  const result = await execute({}, opts)
  const cycles = (result.data as { cycles: Array<Record<string, unknown>> })
    .cycles
  expect(cycles[0]!.scopeSummary).toEqual({
    kind: 'all',
    groupCount: null,
    itemCount: null,
    materialisedItemCount: 12,
  })
  expect(cycles[1]!.scopeSummary).toEqual({
    kind: 'groups',
    groupCount: 3,
    itemCount: null,
    materialisedItemCount: 12,
  })
  expect(cycles[2]!.scopeSummary).toEqual({
    kind: 'items',
    groupCount: null,
    itemCount: 1,
    materialisedItemCount: 1,
  })
  // malformed Json → defensive all-fallback, never a throw
  expect(cycles[3]!.scopeSummary).toEqual({
    kind: 'all',
    groupCount: null,
    itemCount: null,
    materialisedItemCount: 12,
  })
})

it('open/closed finding math: closedCount = _count.findings − openCount', async () => {
  p.complianceAuditCycle.count.mockResolvedValue(1)
  p.complianceAuditCycle.findMany.mockResolvedValue([cycleRow()])
  p.complianceAuditItem.groupBy.mockResolvedValue([
    { cycle_id: 'cycle-1', _count: { _all: 9 } },
  ])
  p.complianceFinding.groupBy.mockResolvedValue([
    { cycle_id: 'cycle-1', _count: { _all: 2 } },
  ])
  const result = await execute({}, opts)
  const row = (result.data as { cycles: Array<Record<string, unknown>> })
    .cycles[0]!
  expect(row.progress).toEqual({ itemCount: 12, reviewedCount: 9 })
  expect(row.findings).toEqual({ openCount: 2, closedCount: 3 })
  // groupBy is scoped to the page's ids + the reviewed/open predicates
  expect(p.complianceAuditItem.groupBy).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { cycle_id: { in: ['cycle-1'] }, reviewed_at: { not: null } },
    })
  )
  expect(p.complianceFinding.groupBy).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { cycle_id: { in: ['cycle-1'] }, closed_at: null },
    })
  )
})

it('count 0 → success payload (positive-zero), not an error', async () => {
  p.complianceAuditCycle.count.mockResolvedValue(0)
  p.complianceAuditCycle.findMany.mockResolvedValue([])
  const result = await execute({}, opts)
  expect(result.error).toBeUndefined()
  expect(result.data).toEqual({ count: 0, cycles: [] })
})
