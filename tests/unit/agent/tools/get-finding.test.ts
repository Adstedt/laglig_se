/**
 * Unit tests for get_finding (Story 29.1).
 * Asserts: workspace scoping via cycle.workspace_id (miss → error), full
 * closure metadata (verificationNote/closeReason), closedByName names-not-IDs,
 * null law_list_item → lawItem: null (system-level finding, SUCCESS), null
 * requirement/correctiveTask handles, and the Epic 23 cycle-null tolerance.
 */

import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { complianceFinding: { findFirst: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { createGetFindingTool } from '@/lib/agent/tools/get-finding'

const mockFindFirst = (
  prisma as unknown as {
    complianceFinding: { findFirst: ReturnType<typeof vi.fn> }
  }
).complianceFinding.findFirst

const WS = 'ws-1'
type Exec = (
  _i: { findingId: string },
  _o: unknown
) => Promise<Record<string, unknown>>
const opts = {
  toolCallId: 'tc',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

function finding(over: Record<string, unknown> = {}) {
  return {
    id: 'finding-1',
    type: 'AVVIKELSE',
    severity: 'MINOR',
    title: 'Kemikalieförteckning saknas',
    description: 'Förteckningen saknar tre produkter.',
    root_cause: 'Rutin ej uppdaterad efter inköp.',
    due_date: new Date('2026-08-01T00:00:00.000Z'),
    created_at: new Date('2026-06-01T00:00:00.000Z'),
    closed_at: new Date('2026-07-01T00:00:00.000Z'),
    verification_note: 'Verifierad mot uppdaterad förteckning.',
    close_reason: 'Åtgärdad och verifierad.',
    closed_by: { name: 'Anna', email: 'anna@x.se' },
    cycle: { id: 'cycle-1', name: 'Q2 kontroll' },
    law_list_item: {
      id: 'lli-1',
      document: { title: 'Miljöbalk', document_number: 'SFS 1998:808' },
    },
    requirement: { id: 'req-1', text: 'Kemikalieförteckning är upprättad' },
    corrective_action_task: { id: 'task-1', title: 'Uppdatera förteckningen' },
    ...over,
  }
}

const execute = createGetFindingTool(WS).execute as Exec

beforeEach(() => vi.clearAllMocks())

it('workspace-scoped via cycle.workspace_id (Epic 23: only path today)', async () => {
  mockFindFirst.mockResolvedValue(finding())
  await execute({ findingId: 'finding-1' }, opts)
  expect(mockFindFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'finding-1', cycle: { workspace_id: WS } },
    })
  )
})

it('cross-workspace / missing finding → wrapToolError', async () => {
  mockFindFirst.mockResolvedValue(null)
  const result = await execute({ findingId: 'foreign' }, opts)
  expect(result.error).toBe(true)
  expect((result as { guidance: string }).guidance).toContain('get_cycle')
})

it('full closure metadata incl. verificationNote/closeReason; closedByName names-not-IDs', async () => {
  mockFindFirst.mockResolvedValue(finding())
  const result = await execute({ findingId: 'finding-1' }, opts)
  const data = result.data as Record<string, unknown>
  expect(data.closedAt).toBe('2026-07-01T00:00:00.000Z')
  expect(data.closedByName).toBe('Anna')
  expect(data.verificationNote).toBe('Verifierad mot uppdaterad förteckning.')
  expect(data.closeReason).toBe('Åtgärdad och verifierad.')
  expect(JSON.stringify(data)).not.toContain('closed_by_user_id')
  // labels, never raw enums
  expect(data.type).toBe('Avvikelse')
  expect(data.severity).toBe('Mindre')
})

it('all four neighbour handles map with type + label', async () => {
  mockFindFirst.mockResolvedValue(finding())
  const result = await execute({ findingId: 'finding-1' }, opts)
  const data = result.data as Record<string, unknown>
  expect(data.cycle).toEqual({
    id: 'cycle-1',
    type: 'cycle',
    label: 'Q2 kontroll',
  })
  expect(data.lawItem).toEqual({
    id: 'lli-1',
    type: 'law_item',
    label: 'Miljöbalk',
  })
  expect(data.requirement).toEqual({
    id: 'req-1',
    type: 'requirement',
    label: 'Kemikalieförteckning är upprättad',
  })
  expect(data.correctiveTask).toEqual({
    id: 'task-1',
    type: 'task',
    label: 'Uppdatera förteckningen',
  })
})

it('null law_list_item → lawItem: null (system-level finding, SUCCESS not error)', async () => {
  mockFindFirst.mockResolvedValue(finding({ law_list_item: null }))
  const result = await execute({ findingId: 'finding-1' }, opts)
  expect(result.error).toBeUndefined()
  const data = result.data as Record<string, unknown>
  expect(data.lawItem).toBeNull()
})

it('null requirement / correctiveTask → null handles', async () => {
  mockFindFirst.mockResolvedValue(
    finding({ requirement: null, corrective_action_task: null })
  )
  const result = await execute({ findingId: 'finding-1' }, opts)
  const data = result.data as Record<string, unknown>
  expect(data.requirement).toBeNull()
  expect(data.correctiveTask).toBeNull()
})

it('Epic 23 tolerance: cycle: null shapes cycle: null without throwing', async () => {
  // Forward-compat assertion — after Epic 23 an ad-hoc finding has no cycle.
  mockFindFirst.mockResolvedValue(finding({ cycle: null }))
  const result = await execute({ findingId: 'finding-1' }, opts)
  expect(result.error).toBeUndefined()
  const data = result.data as Record<string, unknown>
  expect(data.cycle).toBeNull()
})

it('open finding → null closure metadata', async () => {
  mockFindFirst.mockResolvedValue(
    finding({
      closed_at: null,
      closed_by: null,
      verification_note: null,
      close_reason: null,
      severity: null,
      type: 'OBSERVATION',
    })
  )
  const result = await execute({ findingId: 'finding-1' }, opts)
  const data = result.data as Record<string, unknown>
  expect(data.closedAt).toBeNull()
  expect(data.closedByName).toBeNull()
  expect(data.verificationNote).toBeNull()
  expect(data.closeReason).toBeNull()
  expect(data.severity).toBeNull() // only AVVIKELSE carries one
  expect(data.type).toBe('Observation')
})
