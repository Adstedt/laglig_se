/**
 * Story 14.22, Task 6.6: create_task tool — pending-row creation on execute=false.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { pendingAgentAction: { create: vi.fn() } },
}))
vi.mock('@/app/actions/tasks', () => ({ createTask: vi.fn() }))

import { createCreateTaskTool } from '@/lib/agent/tools/create-task'
import { prisma } from '@/lib/prisma'

// The AI SDK tool() wraps our handler; call .execute directly for the unit test.
type ExecFn = (
  _input: Record<string, unknown>
) => Promise<Record<string, unknown>>
function execOf(tool: unknown): ExecFn {
  return (tool as { execute: ExecFn }).execute
}

const createMock = prisma.pendingAgentAction.create as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

describe('create_task tool — execute:false', () => {
  it('creates a PendingAgentAction and returns its id in data', async () => {
    createMock.mockResolvedValue({ id: 'pa_x' })
    const tool = createCreateTaskTool('ws_1', {
      userId: 'u_1',
      assistantMessageId: 'cm_1',
      contextType: 'GLOBAL',
      contextId: null,
    })

    const result = await execOf(tool)({
      title: 'Uppdatera rutiner',
      priority: 'HIGH',
      execute: false,
    })

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspace_id: 'ws_1',
          user_id: 'u_1',
          chat_message_id: 'cm_1',
          action_type: 'CREATE_TASK',
          status: 'PENDING',
        }),
      })
    )
    expect(result.confirmation_required).toBe(true)
    expect(result.data).toEqual({ pendingActionId: 'pa_x' })
  })

  it('returns a bare envelope (no pending row) when no assistantMessageId', async () => {
    const tool = createCreateTaskTool('ws_1', { userId: 'u_1' })
    const result = await execOf(tool)({
      title: 'T',
      priority: 'MEDIUM',
      execute: false,
    })
    expect(createMock).not.toHaveBeenCalled()
    expect(result.data).toBeUndefined()
    expect(result.confirmation_required).toBe(true)
  })

  it('falls back to a bare envelope if the pending-row write throws', async () => {
    createMock.mockRejectedValue(new Error('db down'))
    const tool = createCreateTaskTool('ws_1', {
      userId: 'u_1',
      assistantMessageId: 'cm_1',
    })
    const result = await execOf(tool)({
      title: 'T',
      priority: 'LOW',
      execute: false,
    })
    expect(result.confirmation_required).toBe(true)
    expect(result.data).toBeUndefined()
  })
})
