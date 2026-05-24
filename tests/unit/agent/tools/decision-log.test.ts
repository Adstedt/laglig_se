/**
 * Unit tests for wrapWithDecisionLog (Story 19.5, Task 4 + 6).
 * Mocks prisma.agentDecisionLog.create — asserts outcome mapping + fail-safe.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { agentDecisionLog: { create: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { wrapWithDecisionLog } from '@/lib/agent/tools/decision-log'

const mockCreate = (
  prisma as unknown as {
    agentDecisionLog: { create: ReturnType<typeof vi.fn> }
  }
).agentDecisionLog.create

const ctx = {
  workspaceId: 'ws-1',
  userId: 'u-1',
  chatMessageId: 'm-1',
  modelVersion: 'claude-sonnet-4-6',
}

function loggedData() {
  return mockCreate.mock.calls[0]![0].data as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue({})
})

describe('wrapWithDecisionLog — outcome mapping', () => {
  it('read result → SUCCESS, returns the result unchanged, pending_action_id null', async () => {
    const wrapped = wrapWithDecisionLog(
      'search_laws',
      async () => ({ data: [1, 2] }),
      ctx
    )
    const out = await wrapped({ query: 'x' })
    expect(out).toEqual({ data: [1, 2] })
    expect(mockCreate).toHaveBeenCalledTimes(1)
    const d = loggedData()
    expect(d.outcome).toBe('SUCCESS')
    expect(d.tool_name).toBe('search_laws')
    expect(d.workspace_id).toBe('ws-1')
    expect(d.model_version).toBe('claude-sonnet-4-6')
    expect(d.pending_action_id).toBeNull()
  })

  it('proposal result → WRITE_PROPOSED + extracts pending_action_id (SF-1)', async () => {
    const wrapped = wrapWithDecisionLog(
      'create_task',
      async () => ({
        confirmation_required: true,
        data: { pendingActionId: 'pa-99' },
      }),
      ctx
    )
    await wrapped({})
    const d = loggedData()
    expect(d.outcome).toBe('WRITE_PROPOSED')
    expect(d.pending_action_id).toBe('pa-99')
  })

  it('ToolError envelope → ERROR', async () => {
    const wrapped = wrapWithDecisionLog(
      'search_laws',
      async () => ({ error: true, message: 'inga resultat' }),
      ctx
    )
    await wrapped({})
    expect(loggedData().outcome).toBe('ERROR')
  })

  it('thrown error → ERROR and re-throws', async () => {
    const wrapped = wrapWithDecisionLog(
      'search_laws',
      async () => {
        throw new Error('boom')
      },
      ctx
    )
    await expect(wrapped({})).rejects.toThrow('boom')
    expect(loggedData().outcome).toBe('ERROR')
    // output is the Prisma JSON-null sentinel (not JS null) when execute threw
  })
})

describe('wrapWithDecisionLog — fail-safe (AC 10)', () => {
  it('a log-write failure never breaks the tool call', async () => {
    mockCreate.mockRejectedValue(new Error('db down'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapped = wrapWithDecisionLog(
      'search_laws',
      async () => ({ data: [1] }),
      ctx
    )
    const out = await wrapped({})
    expect(out).toEqual({ data: [1] }) // inner result returned despite the log failure
    expect(errSpy).toHaveBeenCalledWith(
      '[AGENT_DECISION_LOG_WRITE_FAIL]',
      expect.any(Error)
    )
    errSpy.mockRestore()
  })
})
