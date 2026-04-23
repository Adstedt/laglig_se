/**
 * Story 21.8 — notifyIfFindingTaskCompleted unit tests.
 *
 * Covers the 5-step body: load task + finding + cycle, early-exit guards,
 * 24h activity-log-based dedup, Notification row creation, activity log
 * emission, error swallowing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notifyIfFindingTaskCompleted } from '@/lib/compliance-audit/notify-finding-task-completed'
import { prisma } from '@/lib/prisma'
import * as activityLogger from '@/lib/services/activity-logger'
import { NotificationType } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: { findFirst: vi.fn() },
    notification: { create: vi.fn() },
    activityLog: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/services/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}))

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const TASK_ID = '22222222-2222-4222-8222-222222222222'
const FINDING_ID = '33333333-3333-4333-8333-333333333333'
const CYCLE_ID = '44444444-4444-4444-8444-444444444444'
const ACTOR_ID = '55555555-5555-4555-8555-555555555555'
const LEAD_AUDITOR_ID = '66666666-6666-4666-8666-666666666666'

function makeFullTask(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: TASK_ID,
    title: 'Korrigerande åtgärd',
    completed_at: new Date('2026-04-23T10:00:00Z'),
    compliance_finding_id: FINDING_ID,
    compliance_finding: {
      id: FINDING_ID,
      closed_at: null,
      cycle: {
        id: CYCLE_ID,
        name: 'Q2 Internrevision',
        lead_auditor_user_id: LEAD_AUDITOR_ID,
      },
    },
    ...overrides,
  }
}

const baseArgs = {
  taskId: TASK_ID,
  workspaceId: WORKSPACE_ID,
  actorUserId: ACTOR_ID,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notifyIfFindingTaskCompleted', () => {
  it('happy path — creates Notification + logs activity', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(makeFullTask() as never)
    vi.mocked(prisma.activityLog.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never)

    await notifyIfFindingTaskCompleted(baseArgs)

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        workspace_id: WORKSPACE_ID,
        user_id: LEAD_AUDITOR_ID,
        type: NotificationType.FINDING_READY_TO_CLOSE,
        // Epic 21 follow-up (verify step): title/body reframed from
        // "kan stängas" to "verifiera" to cue the auditor's explicit
        // verification act rather than a passive close.
        title: 'Åtgärd redo att verifieras',
        body: expect.stringContaining('Q2 Internrevision'),
        entity_type: 'compliance_finding',
        entity_id: FINDING_ID,
      },
    })
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      WORKSPACE_ID,
      ACTOR_ID,
      'compliance_finding',
      FINDING_ID,
      'finding_task_completion_notified',
      null,
      {
        recipient_user_id: LEAD_AUDITOR_ID,
        task_id: TASK_ID,
        cycle_id: CYCLE_ID,
      }
    )
  })

  it('no-op: task not found', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null)

    await notifyIfFindingTaskCompleted(baseArgs)

    expect(prisma.notification.create).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('no-op: task has no compliance_finding_id (regression pin)', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(
      makeFullTask({
        compliance_finding_id: null,
        compliance_finding: null,
      }) as never
    )

    await notifyIfFindingTaskCompleted(baseArgs)

    expect(prisma.notification.create).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('no-op: finding already closed', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(
      makeFullTask({
        compliance_finding: {
          id: FINDING_ID,
          closed_at: new Date(),
          cycle: {
            id: CYCLE_ID,
            name: 'X',
            lead_auditor_user_id: LEAD_AUDITOR_ID,
          },
        },
      }) as never
    )

    await notifyIfFindingTaskCompleted(baseArgs)

    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('no-op: task not completed (defensive against caller misuse)', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(
      makeFullTask({ completed_at: null }) as never
    )

    await notifyIfFindingTaskCompleted(baseArgs)

    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('dedup: recent finding_task_completion_notified entry blocks second notification', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(makeFullTask() as never)
    vi.mocked(prisma.activityLog.findFirst).mockResolvedValue({
      id: 'some-log-id',
    } as never)

    await notifyIfFindingTaskCompleted(baseArgs)

    expect(prisma.notification.create).not.toHaveBeenCalled()
    expect(activityLogger.logActivity).not.toHaveBeenCalled()
  })

  it('error swallowed — notification.create throws → function resolves + console.error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(prisma.task.findFirst).mockResolvedValue(makeFullTask() as never)
    vi.mocked(prisma.activityLog.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.notification.create).mockRejectedValue(
      new Error('DB down')
    )

    await expect(
      notifyIfFindingTaskCompleted(baseArgs)
    ).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('activity log carries the actor (ActorUserId) — not the recipient', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(makeFullTask() as never)
    vi.mocked(prisma.activityLog.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never)

    await notifyIfFindingTaskCompleted(baseArgs)

    const call = vi.mocked(activityLogger.logActivity).mock.calls[0]
    expect(call[1]).toBe(ACTOR_ID) // user_id slot = actor
    const payload = call[6] as Record<string, unknown>
    expect(payload.recipient_user_id).toBe(LEAD_AUDITOR_ID)
  })
})
