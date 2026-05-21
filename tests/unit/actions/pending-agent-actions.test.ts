/**
 * Story 14.22: Tests for pending-agent-action server actions.
 * Covers ownership checks, approve-dispatch (success + failure), reject,
 * update-params, and expire.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockWithWorkspace, mockCreateTask } = vi.hoisted(() => ({
  mockWithWorkspace: vi.fn(),
  mockCreateTask: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pendingAgentAction: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: mockWithWorkspace,
}))

vi.mock('@/app/actions/tasks', () => ({
  createTask: mockCreateTask,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  getPendingAgentAction,
  approvePendingAction,
  rejectPendingAction,
  updatePendingActionParams,
  expirePendingActions,
} from '@/app/actions/pending-agent-actions'
import { prisma } from '@/lib/prisma'

const ctx = { userId: 'user_123', workspaceId: 'ws_123' }

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pa_1',
    workspace_id: 'ws_123',
    user_id: 'user_123',
    conversation_id: null,
    chat_message_id: 'cm_1',
    context_type: 'GLOBAL',
    context_id: null,
    action_type: 'CREATE_TASK',
    status: 'PENDING',
    params: { title: 'Test', description: null, priority: 'HIGH' },
    result_ref: null,
    created_at: new Date(),
    decided_at: null,
    expires_at: new Date(Date.now() + 1_000_000),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWithWorkspace.mockImplementation((cb: (_c: typeof ctx) => unknown) =>
    cb(ctx)
  )
})

describe('getPendingAgentAction', () => {
  it('returns the row when owned', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row())
    const result = await getPendingAgentAction('pa_1')
    expect(result.success).toBe(true)
    expect(result.data?.id).toBe('pa_1')
  })

  it('returns Forbidden for a cross-workspace row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row({ workspace_id: 'other_ws' }))
    const result = await getPendingAgentAction('pa_1')
    expect(result).toEqual({ success: false, error: 'Forbidden' })
  })

  it('returns Forbidden when the row does not exist', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null)
    const result = await getPendingAgentAction('missing')
    expect(result).toEqual({ success: false, error: 'Forbidden' })
  })
})

describe('approvePendingAction', () => {
  it('dispatches CREATE_TASK and marks APPROVED on success', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row())
    mockCreateTask.mockResolvedValue({
      success: true,
      data: { id: 'task_1', title: 'Test' },
    })
    ;(
      prisma.pendingAgentAction.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue({})

    const result = await approvePendingAction('pa_1')

    // params mapped to createTask args (HIGH priority, no description)
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test', priority: 'HIGH' })
    )
    expect(prisma.pendingAgentAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pa_1' },
        data: expect.objectContaining({
          status: 'APPROVED',
          result_ref: { taskId: 'task_1' },
        }),
      })
    )
    expect(result.success).toBe(true)
    expect(result.data?.resultRef).toEqual({ taskId: 'task_1' })
  })

  it('leaves the row PENDING when dispatch fails', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row())
    mockCreateTask.mockResolvedValue({ success: false, error: 'no column' })

    const result = await approvePendingAction('pa_1')

    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, error: 'no column' })
  })

  it('rejects a non-PENDING row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row({ status: 'APPROVED' }))
    const result = await approvePendingAction('pa_1')
    expect(result.success).toBe(false)
    expect(mockCreateTask).not.toHaveBeenCalled()
  })

  it('returns Forbidden for a cross-user row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row({ user_id: 'other_user' }))
    const result = await approvePendingAction('pa_1')
    expect(result).toEqual({ success: false, error: 'Forbidden' })
  })
})

describe('rejectPendingAction', () => {
  it('sets REJECTED for a PENDING row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row())
    ;(
      prisma.pendingAgentAction.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue({})
    const result = await rejectPendingAction('pa_1')
    expect(prisma.pendingAgentAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED' }),
      })
    )
    expect(result.success).toBe(true)
  })

  it('refuses a non-PENDING row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row({ status: 'EXPIRED' }))
    const result = await rejectPendingAction('pa_1')
    expect(result.success).toBe(false)
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })
})

describe('updatePendingActionParams', () => {
  it('updates params for a PENDING row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row())
    ;(
      prisma.pendingAgentAction.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue({})
    const result = await updatePendingActionParams('pa_1', {
      title: 'Edited',
      priority: 'LOW',
    })
    expect(prisma.pendingAgentAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { params: { title: 'Edited', priority: 'LOW' } },
      })
    )
    expect(result.success).toBe(true)
  })

  it('refuses to edit a non-PENDING row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row({ status: 'APPROVED' }))
    const result = await updatePendingActionParams('pa_1', { title: 'x' })
    expect(result.success).toBe(false)
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })
})

describe('expirePendingActions', () => {
  it('expires only PENDING rows past their expiry and returns the count', async () => {
    ;(
      prisma.pendingAgentAction.updateMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 3 })
    const result = await expirePendingActions()
    const call = (
      prisma.pendingAgentAction.updateMany as ReturnType<typeof vi.fn>
    ).mock.calls[0][0]
    expect(call.where.status).toBe('PENDING')
    expect(call.where.expires_at).toHaveProperty('lt')
    expect(call.data).toEqual({ status: 'EXPIRED' })
    expect(result).toEqual({ expiredCount: 3 })
  })
})
