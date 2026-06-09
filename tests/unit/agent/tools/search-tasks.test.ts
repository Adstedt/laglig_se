/**
 * Unit tests for search_tasks (Story 19.4a).
 * Mocks Prisma; asserts workspace scoping, title ILIKE, columnName shape.
 */

import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { task: { findMany: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { createSearchTasksTool } from '@/lib/agent/tools/search-tasks'

const mockFindMany = (
  prisma as unknown as { task: { findMany: ReturnType<typeof vi.fn> } }
).task.findMany

const WS = 'ws-1'
const tool = createSearchTasksTool(WS)
const execute = tool.execute as (
  _i: { query: string; limit?: number },
  _o: unknown
) => Promise<Record<string, unknown>>
const opts = {
  toolCallId: 'tc',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

beforeEach(() => vi.clearAllMocks())

it('workspace-scoped + title ILIKE; returns taskId/title/columnName', async () => {
  mockFindMany.mockResolvedValue([
    { id: 'task-1', title: 'Brandskyddsrond', column: { name: 'Att göra' } },
  ])

  const result = await execute({ query: 'brand', limit: 5 }, opts)

  expect(mockFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        workspace_id: WS,
        title: { contains: 'brand', mode: 'insensitive' },
      },
      take: 5,
    })
  )
  const data = result.data as Array<Record<string, unknown>>
  expect(data[0]).toMatchObject({
    taskId: 'task-1',
    title: 'Brandskyddsrond',
    columnName: 'Att göra',
  })
})

it('no matches → wrapToolError', async () => {
  mockFindMany.mockResolvedValue([])
  const result = await execute({ query: 'zzz', limit: 5 }, opts)
  expect(result.error).toBe(true)
})
