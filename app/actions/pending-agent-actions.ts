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
  updateDocumentStatus,
  // Story 17.11c AC 7: atomic branch + write for APPROVED-no-draft auto-branch.
  createDraftFromApprovedWithEdit,
  // Story 17.22: in-place update of an already-open draft (no new version row).
  updateDraftVersionInPlace,
} from './documents'
// Story 17.11 + 17.11b: UPDATE_DOCUMENT / ADD_DOCUMENT_SECTION dispatch —
// section-replace + section-add + server-side HTML.
import {
  addSection,
  updateSection,
  type InsertPosition,
  type TiptapNode,
} from '@/lib/documents/update-document-section'
import { tiptapDocToHtml } from '@/lib/documents/tiptap-to-html'
import {
  createRequirement,
  updateRequirement,
} from './law-list-item-requirements'
// Story 14.29: ADD_TASK_COMMENT dispatch target.
import { createComment } from './task-modal'
import { markdownToHtml } from '@/lib/markdown/markdown-to-html'
import type {
  ComplianceStatus,
  PendingAgentAction,
  Prisma,
  TaskPriority,
  WorkspaceDocumentStatus,
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
// Story 14.28 — UPDATE_REQUIREMENT params. `patch` keys map 1:1 to the
// updateRequirement `updates` object; `oldSnapshot` + `entity_version` are
// renderer/staleness concerns and are not read by dispatch.
interface UpdateRequirementParams {
  requirementId: string
  patch: {
    text?: string
    isFulfilled?: boolean
    comment?: string | null
    bevisRequired?: boolean
  }
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

// Story 14.29 — ADD_TASK_COMMENT params. Dispatch calls createComment with
// (taskId, content, parentCommentId?). `taskTitle` + `entity_version` are
// renderer/staleness concerns and are not read by dispatch.
interface AddTaskCommentParams {
  taskId: string
  content: string
  parentCommentId?: string
}

// Story 14.30 — TRANSITION_DOCUMENT_STATUS params. Dispatch calls
// updateDocumentStatus with (documentId, newStatus, comment?). `documentTitle`,
// `oldStatus`, and `entity_version` are renderer/staleness concerns and are
// not read by dispatch. NOTE: `newStatus` MUST never be 'APPROVED' here — the
// AC 13 guard refuses it as the authoritative trusted gate, independent of
// the tool-level guard (defence-in-depth).
interface TransitionDocumentStatusParams {
  documentId: string
  newStatus: WorkspaceDocumentStatus
  oldStatus?: WorkspaceDocumentStatus
  comment?: string
}

// Story 17.11 — UPDATE_DOCUMENT params (set by the update_document tool).
// Dispatch re-reads the live document, re-asserts the DRAFT/IN_REVIEW guard,
// applies updateSection() to produce the full updated contentJson, and calls
// saveDocumentVersion. `oldSectionContentJson` + `entity_version` are
// renderer/staleness concerns and are not read by dispatch — the only fields
// dispatch consumes are `documentId`, `sectionHeading`,
// `newSectionContentJson`, and `changeSummary`.
interface UpdateDocumentParams {
  documentId: string
  // Section fields are optional: a proposal may be a pure rename (newTitle only),
  // a section edit, or both. Dispatch applies updateSection only when present.
  sectionHeading?: string
  oldSectionContentJson?: unknown
  newSectionContentJson?: unknown
  // Optional rename — when set, the document's title is updated as part of the
  // same version write (no separate version is created for the rename).
  newTitle?: string
  changeSummary: string
  entity_version: string
  // Story 17.11c AC 6: forks the dispatch between plain saveDocumentVersion
  // and createDraftFromApprovedWithEdit. Optional for backward-compat with
  // pre-17.11c pending rows still in flight (default false).
  creates_draft?: boolean
  newVersionNumber?: number
}

// Story 17.11b — ADD_DOCUMENT_SECTION params (set by the add_document_section
// tool). Dispatch re-reads the live document, re-asserts DRAFT/IN_REVIEW +
// no-duplicate-heading + position-target (when applicable), applies
// addSection() to produce the full updated contentJson, and calls
// saveDocumentVersion. `documentTitle` + `entity_version` are renderer /
// staleness concerns and are NOT read by dispatch — the fields dispatch
// consumes are documentId, newSectionHeading, newSectionLevel,
// newSectionContentJson, position, and changeSummary.
interface AddDocumentSectionParams {
  documentId: string
  documentTitle?: string
  newSectionHeading: string
  newSectionLevel: 1 | 2 | 3 | 4 | 5 | 6
  newSectionContentJson: unknown
  position: InsertPosition
  changeSummary: string
  entity_version: string
  // Story 17.11c AC 6: forks the dispatch between plain saveDocumentVersion
  // and createDraftFromApprovedWithEdit. Optional for backward-compat with
  // pre-17.11c pending rows still in flight (default false).
  creates_draft?: boolean
  newVersionNumber?: number
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

          // ── Story 14.28: edit kravpunkt (requirement) ──────────────────────
          case 'UPDATE_REQUIREMENT': {
            const p = action.params as unknown as UpdateRequirementParams
            const result = await updateRequirement(p.requirementId, p.patch)
            if (!result.success) {
              return {
                success: false,
                error: result.error ?? 'Kunde inte uppdatera kravpunkten',
              }
            }
            resultRef = { requirementId: p.requirementId }
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

          // ── Story 14.29: agent-proposed task comment ────────────────────────
          case 'ADD_TASK_COMMENT': {
            const p = action.params as unknown as AddTaskCommentParams
            const result = await createComment(
              p.taskId,
              p.content,
              p.parentCommentId
            )
            // AC 13: dispatch failure keeps the row PENDING (do NOT mark APPROVED).
            if (!result.success || !result.data) {
              return {
                success: false,
                error: result.error ?? 'Kunde inte spara kommentaren',
              }
            }
            resultRef = { commentId: result.data.id }
            // createComment already revalidates '/tasks' itself
            // (task-modal.ts:1025); we still declare it for the dispatcher's
            // AC-13 revalidate-paths contract.
            revalidatePaths = ['/tasks']
            break
          }

          // ── Story 17.11: agent-proposed section-level edit ─────────────────
          case 'UPDATE_DOCUMENT': {
            const p = action.params as unknown as UpdateDocumentParams

            // Story 17.16 AC 10: re-read the live document with the dual-
            // pointer fields. Content source MUST be current_draft_version
            // (or current_approved_version for never-approved DRAFT) — NOT
            // the deprecated current_version alias (which under Model B points
            // at the approved version during a revision window and would cause
            // the agent's diff to be computed against approved content while
            // writing to the draft pointer).
            const document = await prisma.workspaceDocument.findFirst({
              where: { id: p.documentId, workspace_id: workspaceId },
              select: {
                id: true,
                status: true,
                workspace_id: true,
                current_draft_version_id: true,
                current_approved_version_id: true,
                current_draft_version: { select: { content_json: true } },
                current_approved_version: { select: { content_json: true } },
              },
            })
            if (!document) {
              return { success: false, error: 'Dokumentet hittades inte' }
            }

            // Story 17.11c AC 7 — widened writeable predicate accepts the
            // APPROVED-no-draft case as the auto-branch path. Three accepted
            // shapes:
            //   - existing draft in progress (writes against draft)
            //   - never-approved DRAFT (writes against draft)
            //   - APPROVED with no draft (atomic branch + write via the new
            //     createDraftFromApprovedWithEdit server action — only when
            //     params.creates_draft is true)
            // SUPERSEDED / ARCHIVED stay non-writeable.
            const autoBranchEligible =
              document.status === 'APPROVED' &&
              document.current_draft_version_id == null
            const writeable =
              document.current_draft_version_id != null ||
              (document.status === 'DRAFT' &&
                document.current_approved_version_id == null) ||
              autoBranchEligible
            if (!writeable) {
              return {
                success: false,
                error: `Dokumentet kan inte uppdateras i status "${document.status}".`,
              }
            }

            // Story 17.11c AC 7: routing fork between auto-branch and plain save.
            //   - creates_draft AND APPROVED-no-draft → call new server action.
            //   - creates_draft AND has draft now (raced — user manually
            //     branched between propose and approve) → graceful fall-through
            //     to plain saveDocumentVersion against the now-existing draft.
            //   - !creates_draft → existing path (Row 1 / Row 2 from decision
            //     matrix).
            const shouldAutoBranch =
              p.creates_draft === true && autoBranchEligible

            const currentContent =
              document.current_draft_version?.content_json ??
              document.current_approved_version?.content_json
            if (
              !currentContent ||
              typeof currentContent !== 'object' ||
              !Array.isArray((currentContent as { content?: unknown }).content)
            ) {
              return {
                success: false,
                error: 'Dokumentet saknar en aktuell version att uppdatera.',
              }
            }

            // Apply the section replacement when this proposal carries one. A
            // pure rename (newTitle only) leaves content untouched and just
            // re-saves the current tree with the new title. Heading-not-found at
            // dispatch (drift since propose) → keep the row PENDING with a clear
            // error.
            const hasSectionEdit =
              typeof p.sectionHeading === 'string' &&
              p.newSectionContentJson !== undefined
            let fullContentJson = currentContent as unknown as ReturnType<
              typeof updateSection
            >
            if (hasSectionEdit) {
              try {
                fullContentJson = updateSection(
                  currentContent as unknown as Parameters<
                    typeof updateSection
                  >[0],
                  p.sectionHeading as string,
                  p.newSectionContentJson as Parameters<typeof updateSection>[2]
                )
              } catch (err) {
                return {
                  success: false,
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Kunde inte hitta sektionen i dokumentet.',
                }
              }
            }

            const contentHtml = tiptapDocToHtml(fullContentJson)

            // Story 17.11c AC 7: routing fork. Both paths write ONE new version
            // and trigger the after() reindex; the difference is that the
            // auto-branch path ALSO writes a paired document_draft_created
            // ActivityLog row + populates current_draft_version_id atomically.
            // Optional rename rides along in the same version write — no extra
            // version row is created for the title change.
            const newTitle =
              typeof p.newTitle === 'string' && p.newTitle.trim().length > 0
                ? p.newTitle.trim()
                : undefined
            const saveResult = shouldAutoBranch
              ? await createDraftFromApprovedWithEdit(
                  p.documentId,
                  fullContentJson as object,
                  p.changeSummary,
                  contentHtml,
                  newTitle
                )
              : // Story 17.22: a draft already exists → update it IN PLACE
                // (no new version row / no version bump) instead of minting a
                // version. Same arg order as saveDocumentVersion.
                await updateDraftVersionInPlace(
                  p.documentId,
                  fullContentJson as object,
                  p.changeSummary,
                  newTitle,
                  contentHtml
                )
            if (!saveResult.success || !saveResult.data) {
              return {
                success: false,
                error: saveResult.error ?? 'Kunde inte spara dokumentversionen',
              }
            }

            // Story 17.11c AC 8 / Story 17.22 — stamp agent authorship onto the
            // audit row. Branch path → `document_version_saved` (matched by
            // version_number). In-place path → `document_draft_edited` (no
            // version bump, so matched by the id returned from
            // updateDraftVersionInPlace). Fire-and-forget: a missed stamp never
            // rolls back the write.
            if (shouldAutoBranch) {
              try {
                const logRow = await prisma.activityLog.findFirst({
                  where: {
                    entity_type: 'workspace_document',
                    entity_id: p.documentId,
                    action: 'document_version_saved',
                    new_value: {
                      path: ['version_number'],
                      equals: saveResult.data.versionNumber,
                    },
                  },
                  orderBy: { created_at: 'desc' },
                  select: { id: true, new_value: true },
                })
                if (logRow) {
                  const existing =
                    logRow.new_value && typeof logRow.new_value === 'object'
                      ? (logRow.new_value as Record<string, unknown>)
                      : {}
                  await prisma.activityLog.update({
                    where: { id: logRow.id },
                    data: {
                      new_value: {
                        ...existing,
                        by: 'agent',
                        pendingActionId: action.id,
                        operation: 'auto_branch_then_update_section',
                      } as Prisma.InputJsonValue,
                    },
                  })
                }
              } catch (err) {
                console.error(
                  `[UPDATE_DOCUMENT] activity-log stamp failed for ${p.documentId}:`,
                  err instanceof Error ? err.message : err
                )
              }
            } else {
              // Story 17.22: in-place edit — stamp the `document_draft_edited`
              // audit row by the id returned from updateDraftVersionInPlace.
              try {
                const data = saveResult.data as { activityLogId?: string }
                if (data.activityLogId) {
                  const logRow = await prisma.activityLog.findUnique({
                    where: { id: data.activityLogId },
                    select: { new_value: true },
                  })
                  const existing =
                    logRow?.new_value && typeof logRow.new_value === 'object'
                      ? (logRow.new_value as Record<string, unknown>)
                      : {}
                  await prisma.activityLog.update({
                    where: { id: data.activityLogId },
                    data: {
                      new_value: {
                        ...existing,
                        by: 'agent',
                        pendingActionId: action.id,
                        operation: 'in_place_update_section',
                      } as Prisma.InputJsonValue,
                    },
                  })
                }
              } catch (err) {
                console.error(
                  `[UPDATE_DOCUMENT] in-place activity-log stamp failed for ${p.documentId}:`,
                  err instanceof Error ? err.message : err
                )
              }
            }

            // Story 17.11c AC 14: when the auto-branch path fires, also stamp
            // the paired `document_draft_created` row with the agent author +
            // operation discriminator. Lets audit consumers see the branch +
            // write as a single semantic event (vs a user-initiated branch via
            // `createDraftFromApproved`, which writes the same action WITHOUT
            // a `by` field). Fire-and-forget — same trade-off as the AC 8 stamp.
            if (shouldAutoBranch) {
              try {
                const draftLogRow = await prisma.activityLog.findFirst({
                  where: {
                    entity_type: 'workspace_document',
                    entity_id: p.documentId,
                    action: 'document_draft_created',
                    new_value: {
                      path: ['draft_version_id'],
                      equals: saveResult.data.id,
                    },
                  },
                  orderBy: { created_at: 'desc' },
                  select: { id: true, new_value: true },
                })
                if (draftLogRow) {
                  const existing =
                    draftLogRow.new_value &&
                    typeof draftLogRow.new_value === 'object'
                      ? (draftLogRow.new_value as Record<string, unknown>)
                      : {}
                  await prisma.activityLog.update({
                    where: { id: draftLogRow.id },
                    data: {
                      new_value: {
                        ...existing,
                        by: 'agent',
                        pendingActionId: action.id,
                        operation: 'auto_branch_then_update_section',
                      } as Prisma.InputJsonValue,
                    },
                  })
                }
              } catch (err) {
                console.error(
                  `[UPDATE_DOCUMENT] draft-created stamp failed for ${p.documentId}:`,
                  err instanceof Error ? err.message : err
                )
              }
            }

            resultRef = {
              documentId: p.documentId,
              versionId: saveResult.data.id,
              versionNumber: saveResult.data.versionNumber,
            }
            revalidatePaths = [
              '/workspace/styrdokument',
              `/workspace/styrdokument/${p.documentId}/edit`,
            ]
            break
          }

          // ── Story 17.11b: agent-proposed insert of a new section ───────────
          case 'ADD_DOCUMENT_SECTION': {
            const p = action.params as unknown as AddDocumentSectionParams

            // Story 17.16 AC 10: re-read with dual-pointer fields (mirrors the
            // UPDATE_DOCUMENT branch). Content source = draft pointer when
            // set, else approved; NEVER the deprecated current_version alias.
            const document = await prisma.workspaceDocument.findFirst({
              where: { id: p.documentId, workspace_id: workspaceId },
              select: {
                id: true,
                status: true,
                workspace_id: true,
                current_draft_version_id: true,
                current_approved_version_id: true,
                current_draft_version: { select: { content_json: true } },
                current_approved_version: { select: { content_json: true } },
              },
            })
            if (!document) {
              return { success: false, error: 'Dokumentet hittades inte' }
            }

            // Story 17.11c AC 7 — widened writeable predicate (mirrors
            // UPDATE_DOCUMENT). Accepts APPROVED-no-draft as the auto-branch
            // path; SUPERSEDED / ARCHIVED stay non-writeable.
            const autoBranchEligible =
              document.status === 'APPROVED' &&
              document.current_draft_version_id == null
            const writeable =
              document.current_draft_version_id != null ||
              (document.status === 'DRAFT' &&
                document.current_approved_version_id == null) ||
              autoBranchEligible
            if (!writeable) {
              return {
                success: false,
                error: `Dokumentet kan inte uppdateras i status "${document.status}".`,
              }
            }

            // Story 17.11c AC 7: routing fork — same shape as the UPDATE_DOCUMENT
            // branch. Race-with-user-branch: falls through to plain save.
            const shouldAutoBranch =
              p.creates_draft === true && autoBranchEligible

            const currentContent =
              document.current_draft_version?.content_json ??
              document.current_approved_version?.content_json
            if (
              !currentContent ||
              typeof currentContent !== 'object' ||
              !Array.isArray((currentContent as { content?: unknown }).content)
            ) {
              return {
                success: false,
                error: 'Dokumentet saknar en aktuell version att lägga till i.',
              }
            }

            // Apply addSection — its internal guards handle the
            // duplicate-heading-since-propose AND position-target-missing-
            // since-propose cases. Caught here so the row stays PENDING with
            // a Swedish-language message that reuses the tool-time copy.
            let fullContentJson: ReturnType<typeof addSection>
            try {
              fullContentJson = addSection(
                currentContent as unknown as Parameters<typeof addSection>[0],
                p.newSectionHeading,
                p.newSectionLevel,
                p.newSectionContentJson as TiptapNode[],
                p.position
              )
            } catch (err) {
              const msg = err instanceof Error ? err.message : ''
              if (
                err instanceof Error &&
                err.name === 'SectionAlreadyExistsError'
              ) {
                return {
                  success: false,
                  error: `Avsnittet "${p.newSectionHeading}" finns redan i dokumentet.`,
                }
              }
              if (
                err instanceof Error &&
                err.name === 'SectionNotFoundError' &&
                (p.position.at === 'after' || p.position.at === 'before')
              ) {
                return {
                  success: false,
                  error: `Rubriken "${p.position.heading}" finns inte i dokumentet — kan inte positionera det nya avsnittet.`,
                }
              }
              return {
                success: false,
                error: msg || 'Kunde inte lägga till avsnittet i dokumentet.',
              }
            }

            const contentHtml = tiptapDocToHtml(fullContentJson)

            // Story 17.11c AC 7: routing fork — same shape as UPDATE_DOCUMENT.
            const saveResult = shouldAutoBranch
              ? await createDraftFromApprovedWithEdit(
                  p.documentId,
                  fullContentJson as object,
                  p.changeSummary,
                  contentHtml
                )
              : // Story 17.23: a draft already exists → add the section IN PLACE
                // (no new version / no bump), mirroring the UPDATE_DOCUMENT arm.
                await updateDraftVersionInPlace(
                  p.documentId,
                  fullContentJson as object,
                  p.changeSummary,
                  undefined,
                  contentHtml
                )
            if (!saveResult.success || !saveResult.data) {
              return {
                success: false,
                error: saveResult.error ?? 'Kunde inte spara dokumentversionen',
              }
            }

            // AC 10 / Story 17.23 — stamp agent authorship onto the audit row.
            // Branch path → `document_version_saved` (matched by version_number);
            // in-place path → `document_draft_edited` (no version bump, matched
            // by the id returned from updateDraftVersionInPlace). Fire-and-forget.
            if (shouldAutoBranch) {
              try {
                const logRow = await prisma.activityLog.findFirst({
                  where: {
                    entity_type: 'workspace_document',
                    entity_id: p.documentId,
                    action: 'document_version_saved',
                    new_value: {
                      path: ['version_number'],
                      equals: saveResult.data.versionNumber,
                    },
                  },
                  orderBy: { created_at: 'desc' },
                  select: { id: true, new_value: true },
                })
                if (logRow) {
                  const existing =
                    logRow.new_value && typeof logRow.new_value === 'object'
                      ? (logRow.new_value as Record<string, unknown>)
                      : {}
                  await prisma.activityLog.update({
                    where: { id: logRow.id },
                    data: {
                      new_value: {
                        ...existing,
                        by: 'agent',
                        pendingActionId: action.id,
                        operation: 'auto_branch_then_add_section',
                      } as Prisma.InputJsonValue,
                    },
                  })
                }
              } catch (err) {
                console.error(
                  `[ADD_DOCUMENT_SECTION] activity-log stamp failed for ${p.documentId}:`,
                  err instanceof Error ? err.message : err
                )
              }
            } else {
              // Story 17.23: in-place add — stamp the `document_draft_edited`
              // audit row by the id returned from updateDraftVersionInPlace.
              try {
                const data = saveResult.data as { activityLogId?: string }
                if (data.activityLogId) {
                  const logRow = await prisma.activityLog.findUnique({
                    where: { id: data.activityLogId },
                    select: { new_value: true },
                  })
                  const existing =
                    logRow?.new_value && typeof logRow.new_value === 'object'
                      ? (logRow.new_value as Record<string, unknown>)
                      : {}
                  await prisma.activityLog.update({
                    where: { id: data.activityLogId },
                    data: {
                      new_value: {
                        ...existing,
                        by: 'agent',
                        pendingActionId: action.id,
                        operation: 'in_place_add_section',
                      } as Prisma.InputJsonValue,
                    },
                  })
                }
              } catch (err) {
                console.error(
                  `[ADD_DOCUMENT_SECTION] in-place activity-log stamp failed for ${p.documentId}:`,
                  err instanceof Error ? err.message : err
                )
              }
            }

            // Story 17.11c AC 14: when the auto-branch path fires, also stamp
            // the paired `document_draft_created` row. Mirrors UPDATE_DOCUMENT.
            if (shouldAutoBranch) {
              try {
                const draftLogRow = await prisma.activityLog.findFirst({
                  where: {
                    entity_type: 'workspace_document',
                    entity_id: p.documentId,
                    action: 'document_draft_created',
                    new_value: {
                      path: ['draft_version_id'],
                      equals: saveResult.data.id,
                    },
                  },
                  orderBy: { created_at: 'desc' },
                  select: { id: true, new_value: true },
                })
                if (draftLogRow) {
                  const existing =
                    draftLogRow.new_value &&
                    typeof draftLogRow.new_value === 'object'
                      ? (draftLogRow.new_value as Record<string, unknown>)
                      : {}
                  await prisma.activityLog.update({
                    where: { id: draftLogRow.id },
                    data: {
                      new_value: {
                        ...existing,
                        by: 'agent',
                        pendingActionId: action.id,
                        operation: 'auto_branch_then_add_section',
                      } as Prisma.InputJsonValue,
                    },
                  })
                }
              } catch (err) {
                console.error(
                  `[ADD_DOCUMENT_SECTION] draft-created stamp failed for ${p.documentId}:`,
                  err instanceof Error ? err.message : err
                )
              }
            }

            resultRef = {
              documentId: p.documentId,
              versionId: saveResult.data.id,
              versionNumber: saveResult.data.versionNumber,
            }
            revalidatePaths = [
              '/workspace/styrdokument',
              `/workspace/styrdokument/${p.documentId}/edit`,
            ]
            break
          }

          // ── Story 14.30: agent-proposed styrdokument status transition ─────
          case 'TRANSITION_DOCUMENT_STATUS': {
            const p = action.params as unknown as TransitionDocumentStatusParams
            // AC 13 — Authoritative APPROVED guard (defence-in-depth, the
            // dispatch is the trusted gate, independent of the tool refusal).
            // Row stays PENDING with the Swedish error surfaced; we do NOT
            // mark APPROVED. Deliberate string divergence vs. the longer
            // tool-level message (this is a last-line backstop the agent
            // should rarely hit; see AC 13 note).
            if (p.newStatus === 'APPROVED') {
              return {
                success: false,
                error: 'Agenten kan inte godkänna styrdokument.',
              }
            }
            const result = await updateDocumentStatus({
              documentId: p.documentId,
              newStatus: p.newStatus,
              ...(p.comment !== undefined && { comment: p.comment }),
            })
            // AC 14: dispatch failure (incl. now-invalid transition because
            // the live status drifted, surfacing "Ogiltig statusövergång")
            // keeps the row PENDING.
            if (!result.success) {
              return {
                success: false,
                error: result.error ?? 'Kunde inte ändra dokumentstatusen',
              }
            }
            resultRef = { documentId: p.documentId, status: p.newStatus }
            // AC 15: revalidate the styrdokument list page + the specific
            // document's edit route.
            revalidatePaths = [
              '/workspace/styrdokument',
              `/workspace/styrdokument/${p.documentId}/edit`,
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

        // Story 19.5: best-effort — mark this proposal's AgentDecisionLog row
        // accepted. Keyed on pending_action_id (the exact proposal). Never blocks.
        try {
          await prisma.agentDecisionLog.updateMany({
            where: { pending_action_id: id, outcome: 'WRITE_PROPOSED' },
            data: {
              outcome: 'WRITE_ACCEPTED',
              accepted_at: new Date(),
              accepted_by: userId,
            },
          })
        } catch (err) {
          console.error('[AGENT_DECISION_LOG_UPDATE_FAIL]', err)
        }

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
// Batch approve — consolidate multiple document edits into ONE version
// ============================================================================

type PendingRow = Awaited<
  ReturnType<typeof prisma.pendingAgentAction.findMany>
>[number]

/**
 * Apply every UPDATE_DOCUMENT / ADD_DOCUMENT_SECTION edit in `group` (which all
 * target the same document) to a single in-memory content tree and persist it
 * as ONE new version — instead of one version per edit. Folds edits in
 * created_at order; a per-edit failure (e.g. a heading that drifted since
 * propose) is skipped and reported, the rest still apply. An optional rename
 * (UPDATE_DOCUMENT.newTitle) rides along in the same write. Rows that applied
 * are marked APPROVED with a shared result_ref pointing at the one new version.
 */
async function applyConsolidatedDocumentEdits(
  documentId: string,
  group: PendingRow[],
  workspaceId: string,
  userId: string
): Promise<{
  approved: number
  failed: number
  errors: string[]
  revalidatePaths: string[]
}> {
  const document = await prisma.workspaceDocument.findFirst({
    where: { id: documentId, workspace_id: workspaceId },
    select: {
      id: true,
      status: true,
      workspace_id: true,
      current_draft_version_id: true,
      current_approved_version_id: true,
      current_draft_version: { select: { content_json: true } },
      current_approved_version: { select: { content_json: true } },
    },
  })
  if (!document) {
    return {
      approved: 0,
      failed: group.length,
      errors: ['Dokumentet hittades inte'],
      revalidatePaths: [],
    }
  }

  // Widened writeable predicate — mirrors the per-action dispatch (Story 17.11c
  // AC 7). APPROVED-no-draft auto-branches once for the whole consolidated write.
  const autoBranchEligible =
    document.status === 'APPROVED' && document.current_draft_version_id == null
  const writeable =
    document.current_draft_version_id != null ||
    (document.status === 'DRAFT' &&
      document.current_approved_version_id == null) ||
    autoBranchEligible
  if (!writeable) {
    return {
      approved: 0,
      failed: group.length,
      errors: [`Dokumentet kan inte uppdateras i status "${document.status}".`],
      revalidatePaths: [],
    }
  }

  const currentContent =
    document.current_draft_version?.content_json ??
    document.current_approved_version?.content_json
  if (
    !currentContent ||
    typeof currentContent !== 'object' ||
    !Array.isArray((currentContent as { content?: unknown }).content)
  ) {
    return {
      approved: 0,
      failed: group.length,
      errors: ['Dokumentet saknar en aktuell version att uppdatera.'],
      revalidatePaths: [],
    }
  }

  // Fold every edit onto one tree in created_at order.
  let content = currentContent as unknown as ReturnType<typeof updateSection>
  let titleChange: string | undefined
  const summaries: string[] = []
  const appliedIds: string[] = []
  const errors: string[] = []
  for (const row of group) {
    try {
      if (row.action_type === 'UPDATE_DOCUMENT') {
        const p = row.params as unknown as UpdateDocumentParams
        if (
          typeof p.sectionHeading === 'string' &&
          p.newSectionContentJson !== undefined
        ) {
          content = updateSection(
            content as unknown as Parameters<typeof updateSection>[0],
            p.sectionHeading,
            p.newSectionContentJson as Parameters<typeof updateSection>[2]
          )
        }
        if (typeof p.newTitle === 'string' && p.newTitle.trim().length > 0) {
          titleChange = p.newTitle.trim()
        }
        summaries.push(p.changeSummary)
      } else {
        const p = row.params as unknown as AddDocumentSectionParams
        content = addSection(
          content as unknown as Parameters<typeof addSection>[0],
          p.newSectionHeading,
          p.newSectionLevel,
          p.newSectionContentJson as TiptapNode[],
          p.position
        )
        summaries.push(p.changeSummary)
      }
      appliedIds.push(row.id)
    } catch (err) {
      errors.push(
        err instanceof Error
          ? err.message
          : 'Kunde inte tillämpa en av ändringarna.'
      )
    }
  }

  if (appliedIds.length === 0) {
    return { approved: 0, failed: group.length, errors, revalidatePaths: [] }
  }

  const contentHtml = tiptapDocToHtml(content)
  const combinedSummary = (
    summaries.length === 1
      ? (summaries[0] ?? 'Ändring')
      : `${appliedIds.length} ändringar: ${summaries.join('; ')}`
  ).slice(0, 500)

  // One write for the whole batch — auto-branch once when APPROVED-no-draft.
  const saveResult = autoBranchEligible
    ? await createDraftFromApprovedWithEdit(
        documentId,
        content as object,
        combinedSummary,
        contentHtml,
        titleChange
      )
    : // Story 17.22: a draft already exists → the one batch write updates it
      // IN PLACE (no new version / no bump) instead of minting a version.
      await updateDraftVersionInPlace(
        documentId,
        content as object,
        combinedSummary,
        titleChange,
        contentHtml
      )
  if (!saveResult.success || !saveResult.data) {
    // Nothing persisted — keep every row PENDING so the user can retry.
    return {
      approved: 0,
      failed: group.length,
      errors: [saveResult.error ?? 'Kunde inte spara dokumentversionen'],
      revalidatePaths: [],
    }
  }

  const resultRef = {
    documentId,
    versionId: saveResult.data.id,
    versionNumber: saveResult.data.versionNumber,
  }

  // Mark every applied row APPROVED, sharing the single consolidated version.
  await prisma.pendingAgentAction.updateMany({
    where: { id: { in: appliedIds } },
    data: {
      status: 'APPROVED',
      result_ref: resultRef,
      decided_at: new Date(),
    },
  })

  // Best-effort: accept the AgentDecisionLog rows for the applied proposals.
  try {
    await prisma.agentDecisionLog.updateMany({
      where: {
        pending_action_id: { in: appliedIds },
        outcome: 'WRITE_PROPOSED',
      },
      data: {
        outcome: 'WRITE_ACCEPTED',
        accepted_at: new Date(),
        accepted_by: userId,
      },
    })
  } catch (err) {
    console.error('[AGENT_DECISION_LOG_UPDATE_FAIL]', err)
  }

  // Story 17.22: stamp agent authorship onto the batch audit row. Branch path →
  // `document_version_saved` (by version_number); in-place path →
  // `document_draft_edited` (by the id returned from updateDraftVersionInPlace).
  // Mirrors the single path's fork; a missed stamp never rolls back the write.
  try {
    if (autoBranchEligible) {
      const logRow = await prisma.activityLog.findFirst({
        where: {
          entity_type: 'workspace_document',
          entity_id: documentId,
          action: 'document_version_saved',
          new_value: {
            path: ['version_number'],
            equals: saveResult.data.versionNumber,
          },
        },
        orderBy: { created_at: 'desc' },
        select: { id: true, new_value: true },
      })
      if (logRow) {
        const existing =
          logRow.new_value && typeof logRow.new_value === 'object'
            ? (logRow.new_value as Record<string, unknown>)
            : {}
        await prisma.activityLog.update({
          where: { id: logRow.id },
          data: {
            new_value: {
              ...existing,
              by: 'agent',
              operation: 'auto_branch_then_batch_update',
              batch_size: appliedIds.length,
            } as Prisma.InputJsonValue,
          },
        })
      }
    } else {
      const data = saveResult.data as { activityLogId?: string }
      if (data.activityLogId) {
        const logRow = await prisma.activityLog.findUnique({
          where: { id: data.activityLogId },
          select: { new_value: true },
        })
        const existing =
          logRow?.new_value && typeof logRow.new_value === 'object'
            ? (logRow.new_value as Record<string, unknown>)
            : {}
        await prisma.activityLog.update({
          where: { id: data.activityLogId },
          data: {
            new_value: {
              ...existing,
              by: 'agent',
              operation: 'in_place_batch_update',
              batch_size: appliedIds.length,
            } as Prisma.InputJsonValue,
          },
        })
      }
    }
  } catch (err) {
    console.error(
      `[approvePendingActions] activity-log stamp failed for ${documentId}:`,
      err instanceof Error ? err.message : err
    )
  }

  return {
    approved: appliedIds.length,
    failed: group.length - appliedIds.length,
    errors,
    revalidatePaths: [
      '/workspace/styrdokument',
      `/workspace/styrdokument/${documentId}/edit`,
    ],
  }
}

/**
 * Approve several pending actions in one call. Multiple document edits that
 * target the SAME document are consolidated into a SINGLE new version (v+1)
 * rather than bumping the version once per edit. All other actions — and
 * single-edit document groups — dispatch through the proven per-action
 * approvePendingAction path, in created_at order so dependencies (e.g. link
 * after create) are honoured. Partial success is allowed: failed rows stay
 * PENDING with their error surfaced.
 */
export async function approvePendingActions(
  ids: string[]
): Promise<
  ActionResult<{ approved: number; failed: number; errors: string[] }>
> {
  try {
    return await withWorkspace(
      async ({ workspaceId, userId, hasPermission }) => {
        if (!hasPermission('tasks:edit')) {
          return {
            success: false,
            error: 'Du har inte behörighet att genomföra den här åtgärden',
          }
        }
        if (!Array.isArray(ids) || ids.length === 0) {
          return { success: true, data: { approved: 0, failed: 0, errors: [] } }
        }

        const rows = await prisma.pendingAgentAction.findMany({
          where: {
            id: { in: ids },
            workspace_id: workspaceId,
            user_id: userId,
          },
        })
        const pending = rows
          .filter((r) => r.status === 'PENDING')
          .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())

        // Partition: consolidatable document edits grouped by documentId; the
        // rest fall back to the single-action path. Map insertion order follows
        // created_at (pending is sorted), so each group stays in apply order.
        const docGroups = new Map<string, PendingRow[]>()
        const others: PendingRow[] = []
        for (const r of pending) {
          if (
            r.action_type === 'UPDATE_DOCUMENT' ||
            r.action_type === 'ADD_DOCUMENT_SECTION'
          ) {
            const docId = (r.params as { documentId?: string } | null)
              ?.documentId
            if (typeof docId === 'string') {
              const arr = docGroups.get(docId) ?? []
              arr.push(r)
              docGroups.set(docId, arr)
              continue
            }
          }
          others.push(r)
        }

        let approved = 0
        let failed = 0
        const errors: string[] = []
        const revalidate = new Set<string>()

        // Non-document + singleton groups → proven per-action path, in order.
        for (const r of others) {
          const res = await approvePendingAction(r.id)
          if (res.success) approved++
          else {
            failed++
            if (res.error) errors.push(res.error)
          }
        }

        for (const [documentId, group] of docGroups) {
          if (group.length === 1) {
            const res = await approvePendingAction(group[0]!.id)
            if (res.success) approved++
            else {
              failed++
              if (res.error) errors.push(res.error)
            }
            continue
          }
          const r = await applyConsolidatedDocumentEdits(
            documentId,
            group,
            workspaceId,
            userId
          )
          approved += r.approved
          failed += r.failed
          errors.push(...r.errors)
          for (const p of r.revalidatePaths) revalidate.add(p)
        }

        for (const p of revalidate) revalidatePath(p)

        return { success: true, data: { approved, failed, errors } }
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

        // Story 19.5: best-effort — mark this proposal's AgentDecisionLog row rejected.
        try {
          await prisma.agentDecisionLog.updateMany({
            where: { pending_action_id: id, outcome: 'WRITE_PROPOSED' },
            data: { outcome: 'WRITE_REJECTED' },
          })
        } catch (err) {
          console.error('[AGENT_DECISION_LOG_UPDATE_FAIL]', err)
        }

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
