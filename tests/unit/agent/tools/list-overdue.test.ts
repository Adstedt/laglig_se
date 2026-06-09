/**
 * Unit tests for list_overdue (Story 19.3).
 * Asserts: workspace + due_date<now + not-done (is_done:false) where, take cap,
 * daysOverdue derivation, names-not-IDs, status=columnName, empty-state.
 */

import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { task: { count: vi.fn(), findMany: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { createListOverdueTool } from '@/lib/agent/tools/list-overdue'

const tasks = (
  prisma as unknown as {
    task: {
      count: ReturnType<typeof vi.fn>
      findMany: ReturnType<typeof vi.fn>
    }
  }
).task
const mockCount = tasks.count
const mockFindMany = tasks.findMany

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
    id: 't1',
    title: 'Brandskyddsrond',
    due_date: new Date(Date.now() - 3 * 86_400_000), // 3 days overdue
    assignee: { name: 'Johan', email: 'johan@x.se' },
    column: { name: 'Att göra' },
    ...over,
  }
}

const execute = createListOverdueTool(WS).execute as Exec

beforeEach(() => vi.clearAllMocks())

it('where: workspace + due_date<now + column not done; ordered + capped', async () => {
  mockCount.mockResolvedValue(2)
  mockFindMany.mockResolvedValue([row()])
  await execute({}, opts)
  const arg = mockFindMany.mock.calls[0][0]
  expect(arg.where.workspace_id).toBe(WS)
  expect(arg.where.column).toEqual({ is_done: false })
  expect(arg.where.due_date.lt).toBeInstanceOf(Date)
  expect(arg.take).toBe(20)
  expect(arg.orderBy).toEqual({ due_date: 'asc' })
})

it('derives daysOverdue + assigneeName + status; no raw ids', async () => {
  mockCount.mockResolvedValue(1)
  mockFindMany.mockResolvedValue([row()])
  const result = await execute({}, opts)
  const data = result.data as {
    count: number
    tasks: Array<Record<string, unknown>>
  }
  expect(data.count).toBe(1)
  expect(data.tasks[0].daysOverdue as number).toBeGreaterThanOrEqual(3)
  expect(data.tasks[0].assigneeName).toBe('Johan')
  expect(data.tasks[0].status).toBe('Att göra')
  expect(data.tasks[0].taskId).toBe('t1')
  expect(JSON.stringify(data.tasks[0])).not.toContain('assignee_id')
})

it('empty state → { count: 0, tasks: [] }', async () => {
  mockCount.mockResolvedValue(0)
  mockFindMany.mockResolvedValue([])
  const result = await execute({}, opts)
  expect(result.data).toEqual({ count: 0, tasks: [] })
})
