/**
 * Unit tests for list_bevis_gaps (Story 19.3).
 * Asserts: workspace-scoped needs-evidence where, caps at the Prisma take level,
 * true count independent of shown rows, names-not-IDs (krav→parent fallback),
 * limit clamp, and empty-state.
 */

import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawListItemRequirement: { count: vi.fn(), findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { createListBevisGapsTool } from '@/lib/agent/tools/list-bevis-gaps'

const reqs = (
  prisma as unknown as {
    lawListItemRequirement: {
      count: ReturnType<typeof vi.fn>
      findMany: ReturnType<typeof vi.fn>
    }
  }
).lawListItemRequirement
const mockCount = reqs.count
const mockFindMany = reqs.findMany

const WS = 'ws-1'
type Exec = (
  _i: { limit?: number },
  _o: unknown
) => Promise<Record<string, unknown>>
const opts = {
  toolCallId: 'tc',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    text: 'Dokumentera riskbedömning',
    responsible_user: null, // krav-level responsible absent → parent fallback
    list_item: {
      id: 'item-1',
      responsible_user: { name: 'Anna', email: 'anna@x.se' },
      document: { title: 'Arbetsmiljölag', document_number: 'SFS 1977:1160' },
    },
    ...over,
  }
}

const execute = createListBevisGapsTool(WS).execute as Exec

beforeEach(() => vi.clearAllMocks())

it('workspace-scoped needs-evidence where + take 20', async () => {
  mockCount.mockResolvedValue(3)
  mockFindMany.mockResolvedValue([row()])
  await execute({}, opts)
  const arg = mockFindMany.mock.calls[0][0]
  expect(arg.where).toEqual({
    list_item: { law_list: { workspace_id: WS } },
    bevis_required: true,
    evidence_links: { none: {} },
  })
  expect(arg.take).toBe(20)
  expect(arg.orderBy).toEqual({ created_at: 'desc' })
  // count uses the same where (true total, not rows.length)
  expect(mockCount).toHaveBeenCalledWith({ where: arg.where })
})

it('returns the true count independent of the capped rows', async () => {
  mockCount.mockResolvedValue(47)
  mockFindMany.mockResolvedValue([row(), row({ id: 'r2' })])
  const result = await execute({}, opts)
  const data = result.data as { count: number; gaps: unknown[] }
  expect(data.count).toBe(47)
  expect(data.gaps).toHaveLength(2)
})

it('resolves responsible NAME (krav→parent fallback), never raw ids', async () => {
  mockCount.mockResolvedValue(1)
  mockFindMany.mockResolvedValue([row()])
  const result = await execute({}, opts)
  const gap = (result.data as { gaps: Array<Record<string, unknown>> }).gaps[0]
  expect(gap.responsibleName).toBe('Anna') // fell back to parent item
  expect(gap.lawName).toBe('Arbetsmiljölag')
  expect(gap.sfsNumber).toBe('SFS 1977:1160')
  expect(gap.lawListItemId).toBe('item-1')
  expect(JSON.stringify(gap)).not.toContain('responsible_user_id')
})

it('honors limit as the take cap', async () => {
  mockCount.mockResolvedValue(0)
  mockFindMany.mockResolvedValue([])
  await execute({ limit: 5 }, opts)
  expect(mockFindMany.mock.calls[0][0].take).toBe(5)
})

it('empty state → { count: 0, gaps: [] }', async () => {
  mockCount.mockResolvedValue(0)
  mockFindMany.mockResolvedValue([])
  const result = await execute({}, opts)
  expect(result.data).toEqual({ count: 0, gaps: [] })
})
