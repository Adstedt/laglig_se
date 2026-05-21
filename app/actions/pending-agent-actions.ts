'use server'

/**
 * Story 14.22: Agent Action Card — pending-action server actions.
 *
 * Persistence + lifecycle for the inline agent approval cards that replace the
 * ephemeral sidebar write-preview pattern. All per-row mutating/read actions
 * are workspace-scoped via `withWorkspace` and additionally verify per-row
 * ownership (`workspace_id` + `user_id`) — cross-workspace/user access returns
 * `{ success: false, error: 'Forbidden' }` (AC 9a).
 *
 * `expirePendingActions` is the one exception: it is a global, system-level
 * batch sweep invoked by the `expire-pending-actions` cron (which gates on the
 * cron secret), so it is intentionally NOT workspace-scoped.
 */

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { createTask } from './tasks'
import { markdownToHtml } from '@/lib/markdown/markdown-to-html'
import type { PendingAgentAction, Prisma, TaskPriority } from '@prisma/client'

// ============================================================================
// Action Result Type
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

/** Shape of `params` for the CREATE_TASK action type (set by the create_task tool). */
interface CreateTaskParams {
  title: string
  description?: string
  relatedDocumentId?: string // LawListItem id
  priority?: TaskPriority
}

// ============================================================================
// Read helper (SWR fetcher) — AC 9
// ============================================================================

export async function getPendingAgentAction(
  id: string
): Promise<ActionResult<PendingAgentAction>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const action = await prisma.pendingAgentAction.findUnique({
        where: { id },
      })
      if (
        !action ||
        action.workspace_id !== workspaceId ||
        action.user_id !== userId
      ) {
        return { success: false, error: 'Forbidden' }
      }
      return { success: true, data: action }
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod',
    }
  }
}

// ============================================================================
// Approve — AC 5
// ============================================================================

export async function approvePendingAction(
  id: string
): Promise<ActionResult<{ resultRef: unknown }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const action = await prisma.pendingAgentAction.findUnique({
        where: { id },
      })
      if (
        !action ||
        action.workspace_id !== workspaceId ||
        action.user_id !== userId
      ) {
        return { success: false, error: 'Forbidden' }
      }
      if (action.status !== 'PENDING') {
        return { success: false, error: 'Förslaget är inte längre väntande' }
      }

      // Dispatch by action_type. On dispatch failure the row stays PENDING and
      // we return the error WITHOUT marking it APPROVED (Task 2.3). 14.23+
      // extend this switch with additional action types.
      let resultRef: Prisma.InputJsonValue
      switch (action.action_type) {
        case 'CREATE_TASK': {
          const params = action.params as unknown as CreateTaskParams
          const result = await createTask({
            title: params.title,
            // Task.description is a rich-text/HTML field; the agent proposes
            // markdown — convert so it renders structured (Story 14.22).
            ...(params.description != null && {
              description: markdownToHtml(params.description),
            }),
            ...(params.priority != null && { priority: params.priority }),
            ...(params.relatedDocumentId != null && {
              linkedListItemIds: [params.relatedDocumentId],
            }),
          })
          if (!result.success || !result.data) {
            return {
              success: false,
              error: result.error ?? 'Kunde inte skapa uppgiften',
            }
          }
          resultRef = { taskId: result.data.id }
          break
        }
        default:
          return {
            success: false,
            error: `Den här typen av förslag stöds inte ännu: ${action.action_type}`,
          }
      }

      // Dispatch succeeded — mark the row APPROVED. `createTask` runs its own
      // transaction, so this is a sequential follow-up update (Task 2.4: the
      // domain action is self-contained, not tx-aware, so we cannot fold it
      // into one $transaction; the row only flips APPROVED after a confirmed
      // successful write).
      await prisma.pendingAgentAction.update({
        where: { id },
        data: {
          status: 'APPROVED',
          result_ref: resultRef,
          decided_at: new Date(),
        },
      })

      // AC: revalidate the surfaces a CREATE_TASK approval affects.
      revalidatePath('/laglistor')
      revalidatePath('/tasks')

      return { success: true, data: { resultRef } }
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod',
    }
  }
}

// ============================================================================
// Reject — AC 6
// ============================================================================

export async function rejectPendingAction(id: string): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const action = await prisma.pendingAgentAction.findUnique({
        where: { id },
      })
      if (
        !action ||
        action.workspace_id !== workspaceId ||
        action.user_id !== userId
      ) {
        return { success: false, error: 'Forbidden' }
      }
      if (action.status !== 'PENDING') {
        return { success: false, error: 'Förslaget är inte längre väntande' }
      }

      await prisma.pendingAgentAction.update({
        where: { id },
        data: { status: 'REJECTED', decided_at: new Date() },
      })

      return { success: true }
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod',
    }
  }
}

// ============================================================================
// Update params (debounced edits from the renderer) — AC 7
// ============================================================================

export async function updatePendingActionParams(
  id: string,
  params: Prisma.InputJsonValue
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const action = await prisma.pendingAgentAction.findUnique({
        where: { id },
      })
      if (
        !action ||
        action.workspace_id !== workspaceId ||
        action.user_id !== userId
      ) {
        return { success: false, error: 'Forbidden' }
      }
      // Only PENDING rows are editable — rejected/approved/expired are frozen.
      if (action.status !== 'PENDING') {
        return { success: false, error: 'Endast väntande förslag kan ändras' }
      }

      await prisma.pendingAgentAction.update({
        where: { id },
        data: { params },
      })

      return { success: true }
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod',
    }
  }
}

// ============================================================================
// Expire — AC 8 / 31 (global; invoked by the expire-pending-actions cron)
// ============================================================================

/**
 * Batch-expire stale pending rows. Sets `status = EXPIRED` for every row that
 * is still `PENDING` and past its `expires_at`. Non-PENDING rows are untouched
 * (the `status` filter guarantees AC 31). Returns the number expired.
 *
 * NOT workspace-scoped — this is a system sweep run by the daily cron, which
 * authenticates via the cron secret. Safe to call repeatedly (idempotent).
 */
export async function expirePendingActions(): Promise<{
  expiredCount: number
}> {
  const result = await prisma.pendingAgentAction.updateMany({
    where: { status: 'PENDING', expires_at: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  })
  return { expiredCount: result.count }
}
