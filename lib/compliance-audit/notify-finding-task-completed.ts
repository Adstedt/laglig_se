/**
 * Story 21.8 — notify lead auditor when a corrective-action task is completed.
 *
 * Fire-and-forget: callers do NOT await, and exceptions are swallowed with
 * `console.error`. Mirrors the pattern at `app/actions/tasks.ts:1275-1278` for
 * `createTaskNotification` error handling.
 *
 * Wired into three task-status actions:
 *   - updateTaskStatusColumn (app/actions/task-modal.ts)
 *   - updateTaskStatus       (app/actions/tasks.ts)
 *   - updateTasksBulk        (app/actions/tasks.ts)
 *
 * The transition guard (caller-side) ensures the hook only fires when a task
 * is moved from NOT-completed to DONE column — no notification on reopen, no
 * re-notification on re-completion.
 */

import { NotificationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/services/activity-logger'

export interface NotifyIfFindingTaskCompletedArgs {
  taskId: string
  workspaceId: string
  actorUserId: string
}

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000 // 24h

export async function notifyIfFindingTaskCompleted(
  args: NotifyIfFindingTaskCompletedArgs
): Promise<void> {
  try {
    const task = await prisma.task.findFirst({
      where: { id: args.taskId, workspace_id: args.workspaceId },
      select: {
        id: true,
        title: true,
        completed_at: true,
        compliance_finding_id: true,
        compliance_finding: {
          select: {
            id: true,
            closed_at: true,
            cycle: {
              select: {
                id: true,
                name: true,
                lead_auditor_user_id: true,
              },
            },
          },
        },
      },
    })

    // Early-exit cases (all silent).
    if (!task) return
    if (task.compliance_finding_id === null) return
    if (task.compliance_finding === null) return
    if (task.compliance_finding.closed_at !== null) return
    if (task.completed_at === null) return

    const finding = task.compliance_finding
    const cycle = finding.cycle

    // Dedup gate: check the ActivityLog for a prior
    // `finding_task_completion_notified` row on this finding in the last 24h.
    // The activity log IS the canonical audit trail for this loop (we write to
    // it below), so gating on its own prior entries is single-source-of-truth.
    const recentNotification = await prisma.activityLog.findFirst({
      where: {
        workspace_id: args.workspaceId,
        entity_type: 'compliance_finding',
        entity_id: finding.id,
        action: 'finding_task_completion_notified',
        created_at: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
      },
      select: { id: true },
    })
    if (recentNotification) return

    // Create the in-app Notification row.
    // Epic 21 follow-up (verify step): copy shifted from "kan stängas" to
    // "verifiera" framing. The auditor's explicit verification moment is
    // what produces defensible audit evidence — the notification cues that
    // act, not a passive close. Enum value `FINDING_READY_TO_CLOSE` kept
    // (internal name) to avoid migration.
    await prisma.notification.create({
      data: {
        workspace_id: args.workspaceId,
        user_id: cycle.lead_auditor_user_id,
        type: NotificationType.FINDING_READY_TO_CLOSE,
        title: 'Åtgärd redo att verifieras',
        body: `Åtgärdsuppgiften "${task.title}" är slutförd i kontrollen "${cycle.name}". Verifiera att åtgärden är effektiv.`,
        entity_type: 'compliance_finding',
        entity_id: finding.id,
      },
    })

    // Log activity — actor on the log row is the task completer, the recipient
    // lives in the payload.
    await logActivity(
      args.workspaceId,
      args.actorUserId,
      'compliance_finding',
      finding.id,
      'finding_task_completion_notified',
      null,
      {
        recipient_user_id: cycle.lead_auditor_user_id,
        task_id: task.id,
        cycle_id: cycle.id,
      }
    )
  } catch (error) {
    console.error('notifyIfFindingTaskCompleted error:', error)
  }
}
