/**
 * Story 14.22, Task 7 (AC 24–27): tests for buildPendingActionsContext —
 * the agent feedback-loop system-prompt block.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    chatMessage: { findFirst: vi.fn() },
    pendingAgentAction: { findMany: vi.fn() },
  },
}))

import { buildPendingActionsContext } from '@/lib/agent/context-assembly'
import { prisma } from '@/lib/prisma'

const findFirst = prisma.chatMessage.findFirst as ReturnType<typeof vi.fn>
const findMany = prisma.pendingAgentAction.findMany as ReturnType<typeof vi.fn>

const scope = {
  workspaceId: 'ws_1',
  userId: 'u_1',
  contextType: 'GLOBAL' as const,
  contextId: null,
}

function row(o: Record<string, unknown> = {}) {
  return {
    id: 'pa',
    workspace_id: 'ws_1',
    user_id: 'u_1',
    conversation_id: null,
    chat_message_id: 'cm',
    context_type: 'GLOBAL',
    context_id: null,
    action_type: 'CREATE_TASK',
    status: 'PENDING',
    params: { title: 'T', priority: 'HIGH' },
    result_ref: null,
    created_at: new Date('2026-05-21T10:00:00Z'),
    decided_at: null,
    expires_at: new Date('2026-06-01T00:00:00Z'),
    ...o,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  findFirst.mockResolvedValue(null)
  findMany.mockResolvedValue([])
})

describe('buildPendingActionsContext', () => {
  it('returns null when there are no rows', async () => {
    expect(await buildPendingActionsContext(scope)).toBeNull()
  })

  it('lists pending rows with a Swedish summary', async () => {
    findMany.mockResolvedValue([
      row({ id: 'p1', params: { title: 'Brandskydd', priority: 'HIGH' } }),
    ])
    const out = await buildPendingActionsContext(scope)
    expect(out).toContain('<pending_agent_actions>')
    expect(out).toContain('Väntar på beslut')
    expect(out).toContain('Brandskydd')
    expect(out).toContain('(prioritet Hög)')
    expect(out).toContain('"id":"p1"')
  })

  it('excludes approved/rejected when there is no prior assistant message (cutoff null)', async () => {
    findFirst.mockResolvedValue(null)
    findMany.mockResolvedValue([
      row({
        id: 'a1',
        status: 'APPROVED',
        decided_at: new Date('2026-05-21T09:00:00Z'),
      }),
    ])
    // no pending + no cutoff → approved bucket empty → all buckets empty → null
    expect(await buildPendingActionsContext(scope)).toBeNull()
  })

  it('buckets approved/rejected decided after the cutoff (and excludes before)', async () => {
    findFirst.mockResolvedValue({
      created_at: new Date('2026-05-21T08:00:00Z'),
    })
    findMany.mockResolvedValue([
      row({
        id: 'a_after',
        status: 'APPROVED',
        decided_at: new Date('2026-05-21T09:00:00Z'),
        result_ref: { taskId: 't1' },
      }),
      row({
        id: 'a_before',
        status: 'APPROVED',
        decided_at: new Date('2026-05-21T07:00:00Z'),
      }),
      row({
        id: 'r_after',
        status: 'REJECTED',
        decided_at: new Date('2026-05-21T09:30:00Z'),
      }),
    ])
    const out = await buildPendingActionsContext(scope)
    expect(out).toContain('Godkända sedan senaste svar')
    expect(out).toContain('Avvisade sedan senaste svar')
    expect(out).toContain('"id":"a_after"')
    expect(out).toContain('"id":"r_after"')
    expect(out).not.toContain('"id":"a_before"') // decided before the cutoff
  })

  it('caps the pending bucket at 5 entries', async () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      row({ id: `p${i}`, created_at: new Date(2026, 4, 21, 10, i) })
    )
    findMany.mockResolvedValue(rows)
    const out = await buildPendingActionsContext(scope)
    // cutoff is null → only the pending bucket has entries; each carries one "id"
    const idCount = (out?.match(/"id":/g) ?? []).length
    expect(idCount).toBe(5)
  })
})
