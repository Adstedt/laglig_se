/**
 * Unit tests for get_task (Story 19.4).
 * Asserts: default-from-TASK-context + workspace scoping, caps, names-not-IDs,
 * handle mapping (linked law items, spawning finding).
 */

import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { task: { findFirst: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { createGetTaskTool } from '@/lib/agent/tools/get-task'

const mockFindFirst = (
  prisma as unknown as { task: { findFirst: ReturnType<typeof vi.fn> } }
).task.findFirst

const WS = 'ws-1'
type Exec = (
  _i: { taskId?: string },
  _o: unknown
) => Promise<Record<string, unknown>>
const opts = {
  toolCallId: 'tc',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

function task(over: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Brandskyddsrond',
    description: 'Genomför rond',
    priority: 'HIGH',
    due_date: null,
    completed_at: null,
    column: { name: 'Att göra' },
    assignee: { name: 'Johan', email: 'johan@x.se' },
    comments: [
      {
        content: 'Påbörjad',
        created_at: new Date('2026-04-01'),
        author: { name: 'Anna', email: 'anna@x.se' },
      },
    ],
    list_item_links: [
      {
        law_list_item: {
          id: 'item-1',
          document: { title: 'LSO', document_number: 'SFS 2003:778' },
        },
      },
    ],
    compliance_finding: { id: 'finding-1' },
    _count: { file_links: 2, workspace_document_links: 1 },
    ...over,
  }
}

beforeEach(() => vi.clearAllMocks())

it('defaults from contextId when contextType=TASK; workspace-scoped', async () => {
  mockFindFirst.mockResolvedValue(task())
  const tool = createGetTaskTool(WS, {
    userId: 'u',
    contextType: 'TASK',
    contextId: 'task-1',
  })
  const result = await (tool.execute as Exec)({}, opts)
  expect(mockFindFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'task-1', workspace_id: WS } })
  )
  expect((result.data as { status: string }).status).toBe('Att göra')
  // Priority surfaces as the canonical Swedish label, not the raw enum.
  expect((result.data as { priority: string }).priority).toBe('Hög') // HIGH
})

it('caps comments + links at the Prisma take level; names-not-IDs', async () => {
  mockFindFirst.mockResolvedValue(task())
  const tool = createGetTaskTool(WS)
  const result = await (tool.execute as Exec)({ taskId: 'task-1' }, opts)
  const include = mockFindFirst.mock.calls[0][0].include
  expect(include.comments.take).toBe(10)
  expect(include.list_item_links.take).toBe(20)
  const data = result.data as Record<string, unknown>
  expect((data.comments as Array<{ authorName: string }>)[0].authorName).toBe(
    'Anna'
  )
  expect(data.assigneeName).toBe('Johan')
  expect(data).not.toHaveProperty('assignee_id')
})

it('maps law-item handles + spawning finding + artifact counts', async () => {
  mockFindFirst.mockResolvedValue(task())
  const tool = createGetTaskTool(WS)
  const result = await (tool.execute as Exec)({ taskId: 'task-1' }, opts)
  const data = result.data as Record<string, unknown>
  expect((data.linkedLawItems as Array<unknown>)[0]).toMatchObject({
    id: 'item-1',
    type: 'law_item',
    label: 'LSO',
  })
  expect(data.spawnedByFinding).toMatchObject({
    id: 'finding-1',
    type: 'finding',
  })
  expect(data.linkedArtifacts).toEqual({ fileCount: 2, documentCount: 1 })
})

it('no id + non-TASK context → wrapToolError', async () => {
  const tool = createGetTaskTool(WS, { userId: 'u', contextType: 'LAW' })
  const result = await (tool.execute as Exec)({}, opts)
  expect(result.error).toBe(true)
  expect(mockFindFirst).not.toHaveBeenCalled()
})

it('not found → wrapToolError (parity with get_law_list_item)', async () => {
  mockFindFirst.mockResolvedValue(null)
  const tool = createGetTaskTool(WS)
  const result = await (tool.execute as Exec)({ taskId: 'missing' }, opts)
  expect(result.error).toBe(true)
})
