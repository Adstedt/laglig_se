'use server'

/**
 * Story 14.22: Agent Action Card — pending-action server actions.
 *
 * Persistence + lifecycle for the inline agent approval cards that replace the
 * ephemeral sidebar preview pattern. All per-row mutating/read actions
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
import { createTask, updateTasksBulk } from './tasks'
import {
  createDocument,
  linkDocumentToTask,
  linkDocumentToListItem,
} from './documents'
import { createRequirement } from './law-list-item-requirements'
import { markdownToHtml } from '@/lib/markdown/markdown-to-html'
import type {
  ComplianceStatus,
  PendingAgentAction,
  Prisma,
  TaskPriority,
  WorkspaceDocumentType,
} from '@prisma/client'

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

// Story 14.23 — per-type `params` shapes. The tools persist a denormalised
// title snapshot alongside each id for display; dispatch reads only the ids.
interface LinkParams {
  taskId: string
  documentId: string
}
interface AddObligationParams {
  lawListItemId: string
  text: string
  bevisRequired?: boolean
}
interface AssignTaskParams {
  taskId: string
  userId: string
}
interface AddContextNoteParams {
  lawListItemId: string
  note: string
}
interface UpdateComplianceStatusParams {
  lawListItemId: string
  newStatus: ComplianceStatus
}

// Story 14.24 — DRAFT_DOCUMENT params (set by the draft_styrdokument tool).
// contextLinks are resolved to WorkspaceDocumentTaskLink / WorkspaceDocumentListItemLink
// rows at approval time; the link actions are POSITIONAL and return no row id.
type ContextLink = { kind: 'TASK' | 'LIST_ITEM'; id: string }
interface DraftDocumentParams {
  title: string
  docType: string
  contentJson: unknown
  contextLinks: ContextLink[]
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
// Batch read (SWR fetcher for AgentActionBatchCard) — Story 14.23 AC 15
// ============================================================================

/**
 * Return every pending-action row that shares a `chat_message_id`, ordered by
 * `created_at` ascending (the agent's tool-call order = the approval order,
 * AC 18a). Workspace + user scoped — cross-workspace/user access yields an
 * empty list rather than leaking rows.
 */
export async function getPendingAgentActionsByMessage(
  chatMessageId: string
): Promise<ActionResult<PendingAgentAction[]>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const actions = await prisma.pendingAgentAction.findMany({
        where: {
          chat_message_id: chatMessageId,
          workspace_id: workspaceId,
          user_id: userId,
        },
        orderBy: { created_at: 'asc' },
      })
      return { success: true, data: actions }
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
    return await withWorkspace(
      async ({ workspaceId, userId, hasPermission }) => {
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
        // Story 14.23 (SEC-001): approving a proposal triggers a real write, so
        // gate on `tasks:edit` — the scope that governs editing tasks/compliance
        // (OWNER/ADMIN/HR_MANAGER/MEMBER). A read-only AUDITOR who can open chat
        // must not be able to finalize link/obligation/assign/status writes.
        if (!hasPermission('tasks:edit')) {
          return {
            success: false,
            error: 'Du har inte behörighet att genomföra den här åtgärden',
          }
        }
        if (action.status !== 'PENDING') {
          return { success: false, error: 'Förslaget är inte längre väntande' }
        }

        // Dispatch by action_type. On dispatch failure the row stays PENDING and
        // we return the error WITHOUT marking it APPROVED (Task 2.3). Each branch
        // also declares which surfaces to revalidate (AC 13).
        let resultRef: Prisma.InputJsonValue
        let revalidatePaths: string[] = []
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
            revalidatePaths = ['/laglistor', '/tasks']
            break
          }

          // ── Story 14.23: link task ↔ document (symmetric server action) ──────
          case 'LINK_TASK_TO_DOCUMENT':
          case 'LINK_DOCUMENT_TO_TASK': {
            const p = action.params as unknown as LinkParams
            const result = await linkDocumentToTask(p.documentId, p.taskId)
            if (!result.success) {
              return {
                success: false,
                error: result.error ?? 'Kunde inte skapa kopplingen',
              }
            }
            resultRef = { taskId: p.taskId, documentId: p.documentId }
            revalidatePaths = ['/tasks', '/dokument']
            break
          }

          // ── Story 14.23: add kravpunkt (obligation) ─────────────────────────
          case 'ADD_OBLIGATION': {
            const p = action.params as unknown as AddObligationParams
            const result = await createRequirement(p.lawListItemId, p.text, {
              bevisRequired: p.bevisRequired ?? false,
            })
            if (!result.success || !result.data) {
              return {
                success: false,
                error: result.error ?? 'Kunde inte skapa kravpunkten',
              }
            }
            resultRef = { requirementId: result.data.id }
            revalidatePaths = ['/laglistor']
            break
          }

          // ── Story 14.23: assign task ────────────────────────────────────────
          case 'ASSIGN_TASK': {
            const p = action.params as unknown as AssignTaskParams
            const result = await updateTasksBulk([p.taskId], {
              assigneeId: p.userId,
            })
            if (!result.success) {
              return {
                success: false,
                error: result.error ?? 'Kunde inte tilldela uppgiften',
              }
            }
            resultRef = { taskId: p.taskId, assigneeId: p.userId }
            revalidatePaths = ['/tasks', '/dashboard']
            break
          }

          // ── Story 14.23: migrated sidebar tools ─────────────────────────────
          case 'ADD_CONTEXT_NOTE': {
            const p = action.params as unknown as AddContextNoteParams
            // No dedicated server action exists; mirror the legacy tool's
            // workspace-scoped business_context append inline.
            const item = await prisma.lawListItem.findFirst({
              where: {
                id: p.lawListItemId,
                law_list: { workspace_id: workspaceId },
              },
              select: { id: true, business_context: true },
            })
            if (!item) {
              return { success: false, error: 'Laglistposten hittades inte' }
            }
            const existing = item.business_context ?? ''
            await prisma.lawListItem.update({
              where: { id: p.lawListItemId },
              data: {
                business_context: existing
                  ? `${existing}\n\n---\n\n${p.note}`
                  : p.note,
              },
            })
            resultRef = { lawListItemId: p.lawListItemId }
            revalidatePaths = ['/laglistor']
            break
          }

          case 'UPDATE_COMPLIANCE_STATUS': {
            const p = action.params as unknown as UpdateComplianceStatusParams
            const item = await prisma.lawListItem.findFirst({
              where: {
                id: p.lawListItemId,
                law_list: { workspace_id: workspaceId },
              },
              select: { id: true },
            })
            if (!item) {
              return { success: false, error: 'Laglistposten hittades inte' }
            }
            await prisma.lawListItem.update({
              where: { id: p.lawListItemId },
              data: { compliance_status: p.newStatus },
            })
            resultRef = {
              lawListItemId: p.lawListItemId,
              newStatus: p.newStatus,
            }
            revalidatePaths = ['/laglistor']
            break
          }

          // ── Story 14.24: draft styrdokument (no-edit approve path) ──────────
          case 'DRAFT_DOCUMENT': {
            const p = action.params as unknown as DraftDocumentParams
            const created = await createDocument({
              title: p.title,
              documentType: p.docType as WorkspaceDocumentType,
              contentJson: p.contentJson as Prisma.InputJsonValue,
            })
            // AC 13: document-create failure → row stays PENDING (no APPROVED).
            if (!created.success || !created.data) {
              return {
                success: false,
                error: created.error ?? 'Kunde inte skapa dokumentet',
              }
            }
            const documentId = created.data.id

            // AC 12/13: wire contextLinks. Link actions are POSITIONAL and return
            // no row id. A link failure does NOT roll back the document — collect
            // it as a partial error; the row still goes APPROVED with a warning.
            const partialLinkErrors: Array<{
              kind: string
              id: string
              error: string
            }> = []
            for (const link of p.contextLinks ?? []) {
              const r =
                link.kind === 'TASK'
                  ? await linkDocumentToTask(documentId, link.id)
                  : await linkDocumentToListItem(documentId, link.id)
              if (!r.success) {
                partialLinkErrors.push({
                  kind: link.kind,
                  id: link.id,
                  error: r.error ?? 'Kunde inte skapa kopplingen',
                })
              }
            }

            resultRef = {
              documentId,
              links: p.contextLinks ?? [],
              ...(partialLinkErrors.length > 0 ? { partialLinkErrors } : {}),
            }
            revalidatePaths = [
              '/workspace/styrdokument',
              '/laglistor',
              '/tasks',
            ]
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

        // AC 13: revalidate the surfaces this action type affects.
        for (const path of revalidatePaths) {
          revalidatePath(path)
        }

        return { success: true, data: { resultRef } }
      }
    )
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
    return await withWorkspace(
      async ({ workspaceId, userId, hasPermission }) => {
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
        // Story 14.24 (AC 17): a DRAFT_DOCUMENT can be rejected from the card while
        // IN_EDITOR (a real document was already created on the open-editor path).
        const isInEditorDraft =
          action.action_type === 'DRAFT_DOCUMENT' &&
          action.status === 'IN_EDITOR'
        if (action.status !== 'PENDING' && !isInEditorDraft) {
          return { success: false, error: 'Förslaget är inte längre väntande' }
        }

        // Task 8 / AC 17: rejecting an IN_EDITOR draft deletes the orphaned
        // WorkspaceDocument first. This is a destructive write, so gate it on
        // `tasks:edit` (AC 23) — plain PENDING rejects stay ownership-only
        // (non-destructive, matches 14.22/14.23 behaviour).
        if (isInEditorDraft) {
          if (!hasPermission('tasks:edit')) {
            return {
              success: false,
              error: 'Du har inte behörighet att genomföra den här åtgärden',
            }
          }
          const ref = (action.result_ref ?? {}) as { documentId?: string }
          if (ref.documentId) {
            await prisma.workspaceDocument.deleteMany({
              where: { id: ref.documentId, workspace_id: workspaceId },
            })
          }
        }

        await prisma.pendingAgentAction.update({
          where: { id },
          data: { status: 'REJECTED', decided_at: new Date() },
        })

        if (isInEditorDraft) revalidatePath('/workspace/styrdokument')

        return { success: true }
      }
    )
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod',
    }
  }
}

// ============================================================================
// Open-editor path (Story 14.24, AC 14-17 + 23) — DRAFT_DOCUMENT only.
// These three actions bypass approvePendingAction, so each re-asserts the
// SEC-001 `tasks:edit` gate itself (AC 23).
// ============================================================================

/**
 * AC 14: create the WorkspaceDocument in DRAFT, stamp result_ref.documentId,
 * transition the row to IN_EDITOR, and return the documentId for navigation.
 * createDocument runs its own transaction; if it fails the row stays PENDING
 * (never IN_EDITOR), so there is no orphan + dangling-status combination.
 */
export async function openDraftInEditor(
  id: string
): Promise<ActionResult<{ documentId: string }>> {
  try {
    return await withWorkspace(
      async ({ workspaceId, userId, hasPermission }) => {
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
        if (!hasPermission('tasks:edit')) {
          return {
            success: false,
            error: 'Du har inte behörighet att genomföra den här åtgärden',
          }
        }
        if (action.action_type !== 'DRAFT_DOCUMENT') {
          return { success: false, error: 'Fel åtgärdstyp för editorn' }
        }
        if (action.status !== 'PENDING') {
          return { success: false, error: 'Förslaget är inte längre väntande' }
        }

        const p = action.params as unknown as DraftDocumentParams
        const created = await createDocument({
          title: p.title,
          documentType: p.docType as WorkspaceDocumentType,
          contentJson: p.contentJson as Prisma.InputJsonValue,
        })
        if (!created.success || !created.data) {
          return {
            success: false,
            error: created.error ?? 'Kunde inte skapa dokumentet',
          }
        }
        const documentId = created.data.id

        await prisma.pendingAgentAction.update({
          where: { id },
          data: { status: 'IN_EDITOR', result_ref: { documentId } },
        })

        revalidatePath('/workspace/styrdokument')
        return { success: true, data: { documentId } }
      }
    )
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod',
    }
  }
}

/**
 * AC 15: finalize the draft from the editor — wire the contextLinks and flip the
 * row to APPROVED. The editor autosaves content to the document independently
 * (`useDocumentAutosave` → `autosaveDocument`), so the persisted draft is already
 * current; finalize does not re-save content (avoids a redundant extra version).
 * Link failures are non-fatal (kept as partialLinkErrors) — the document is never
 * rolled back (AC 13). Gated on `tasks:edit` (AC 23).
 */
export async function finalizeDraftFromEditor(
  id: string
): Promise<ActionResult<{ documentId: string }>> {
  try {
    return await withWorkspace(
      async ({ workspaceId, userId, hasPermission }) => {
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
        if (!hasPermission('tasks:edit')) {
          return {
            success: false,
            error: 'Du har inte behörighet att genomföra den här åtgärden',
          }
        }
        if (
          action.action_type !== 'DRAFT_DOCUMENT' ||
          action.status !== 'IN_EDITOR'
        ) {
          return { success: false, error: 'Förslaget är inte öppet i editorn' }
        }
        const ref = (action.result_ref ?? {}) as { documentId?: string }
        const documentId = ref.documentId
        if (!documentId) {
          return {
            success: false,
            error: 'Inget dokument kopplat till förslaget',
          }
        }

        const p = action.params as unknown as DraftDocumentParams
        const partialLinkErrors: Array<{
          kind: string
          id: string
          error: string
        }> = []
        for (const link of p.contextLinks ?? []) {
          const r =
            link.kind === 'TASK'
              ? await linkDocumentToTask(documentId, link.id)
              : await linkDocumentToListItem(documentId, link.id)
          if (!r.success) {
            partialLinkErrors.push({
              kind: link.kind,
              id: link.id,
              error: r.error ?? 'Kunde inte skapa kopplingen',
            })
          }
        }

        await prisma.pendingAgentAction.update({
          where: { id },
          data: {
            status: 'APPROVED',
            decided_at: new Date(),
            result_ref: {
              documentId,
              links: p.contextLinks ?? [],
              ...(partialLinkErrors.length > 0 ? { partialLinkErrors } : {}),
            },
          },
        })

        revalidatePath('/workspace/styrdokument')
        revalidatePath('/laglistor')
        revalidatePath('/tasks')
        return { success: true, data: { documentId } }
      }
    )
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod',
    }
  }
}

/**
 * AC 17: reject from the editor banner — delete the draft WorkspaceDocument and
 * set the row REJECTED. Gated on `tasks:edit` (AC 23).
 */
export async function rejectDraftFromEditor(id: string): Promise<ActionResult> {
  try {
    return await withWorkspace(
      async ({ workspaceId, userId, hasPermission }) => {
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
        if (!hasPermission('tasks:edit')) {
          return {
            success: false,
            error: 'Du har inte behörighet att genomföra den här åtgärden',
          }
        }
        if (
          action.action_type !== 'DRAFT_DOCUMENT' ||
          action.status !== 'IN_EDITOR'
        ) {
          return { success: false, error: 'Förslaget är inte öppet i editorn' }
        }
        const ref = (action.result_ref ?? {}) as { documentId?: string }
        if (ref.documentId) {
          await prisma.workspaceDocument.deleteMany({
            where: { id: ref.documentId, workspace_id: workspaceId },
          })
        }
        await prisma.pendingAgentAction.update({
          where: { id },
          data: { status: 'REJECTED', decided_at: new Date() },
        })
        revalidatePath('/workspace/styrdokument')
        return { success: true }
      }
    )
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
    return await withWorkspace(
      async ({ workspaceId, userId, hasPermission }) => {
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
        // Story 14.23 (QA UPDATEPARAMS-GATE): editing a proposal is part of the
        // write workflow — gate on `tasks:edit` for consistency with
        // approvePendingAction so a read-only role can't mutate proposal params.
        if (!hasPermission('tasks:edit')) {
          return {
            success: false,
            error: 'Du har inte behörighet att ändra det här förslaget',
          }
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
      }
    )
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
