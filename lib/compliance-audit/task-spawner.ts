/**
 * Story 21.8 — corrective-action task spawner.
 *
 * Called from `createFinding` (app/actions/compliance-finding.ts) when the
 * finding type is AVVIKELSE. Runs entirely on the caller's Prisma transaction
 * client so the finding create + task create + link row + finding back-fill
 * are atomic. Pure-transactional: no activity log, no revalidatePath, no cache
 * invalidation — caller owns those side-effects so the activity log's
 * `entity_type` reflects the spawning cause (`compliance_finding`) rather
 * than the side-effect (`task`).
 *
 * Signature mirrors the `assertCycleEditable(tx, cycleId)` pattern called out
 * in architecture §5.1 (cycle-guards take a TransactionClient as first arg).
 */

import type { Prisma } from '@prisma/client'
import { TaskPriority } from '@prisma/client'

export interface SpawnCorrectiveActionTaskArgs {
  workspaceId: string
  cycleId: string
  cycleName: string
  leadAuditorUserId: string
  itemResponsibleUserId: string | null
  finding: {
    id: string
    title: string
    description: string
    dueDate: Date | null
  }
  createdByUserId: string
  /**
   * Epic 21 follow-up (phase 2): optional user-supplied overrides from the
   * finding-editor inline task section. When a field is undefined or null,
   * the spawner uses the existing default chain (assignee = item responsible
   * ?? lead auditor; dueDate = finding.dueDate; priority = HIGH). When a
   * field is set, it wins — enabling the user to delegate, reschedule, or
   * re-prioritise the spawned task at creation time without a follow-up edit.
   *
   * Phase 3 extension: `title` + `description` let the user decouple the
   * task's phrasing from the finding's (finding = state; task = action).
   * When `description` is provided, the "Korrigerande åtgärd för avvikelse: "
   * prefix is NOT auto-prepended — user's text is authoritative. When omitted,
   * the default prefix chain is preserved (guards `spawnTaskForFinding` +
   * legacy behaviour byte-for-byte).
   */
  overrides?: {
    assigneeUserId?: string | null
    dueDate?: Date | null
    priority?: TaskPriority
    title?: string
    description?: string
  }
}

export interface SpawnCorrectiveActionTaskResult {
  taskId: string
  columnId: string
  /** Resolved assignee — itemResponsibleUserId when present, else leadAuditorUserId.
   *  Returned by the spawner so callers don't re-compute the fallback chain for
   *  activity-log payloads (single source of truth). */
  assigneeId: string
}

export async function spawnCorrectiveActionTask(
  tx: Prisma.TransactionClient,
  args: SpawnCorrectiveActionTaskArgs
): Promise<SpawnCorrectiveActionTaskResult> {
  // 1. Resolve the target column — the lowest-position non-done column.
  const openColumns = await tx.taskColumn.findMany({
    where: { workspace_id: args.workspaceId, is_done: false },
    orderBy: { position: 'asc' },
    select: { id: true },
    take: 1,
  })

  let columnId: string
  if (openColumns.length > 0 && openColumns[0]) {
    columnId = openColumns[0].id
  } else {
    // Two sub-cases split:
    //   a) Workspace has ZERO TaskColumns → create the default 'Att göra'.
    //   b) Workspace has columns but all are is_done=true → throw.
    const anyColumn = await tx.taskColumn.findFirst({
      where: { workspace_id: args.workspaceId },
      select: { id: true },
    })
    if (anyColumn) {
      throw new Error('Ingen öppen uppgiftskolumn i arbetsytan')
    }
    const created = await tx.taskColumn.create({
      data: {
        workspace_id: args.workspaceId,
        name: 'Att göra',
        color: '#6b7280',
        position: 0,
        is_default: true,
        is_done: false,
      },
      select: { id: true },
    })
    columnId = created.id
  }

  // 2. Compute position = (max(position) in target column) + 1.
  const maxPosition = await tx.task.aggregate({
    where: { column_id: columnId },
    _max: { position: true },
  })
  const position = (maxPosition._max.position ?? -1) + 1

  // 3. Create the Task.
  // Override precedence: explicit override (if provided) > item responsible
  // user > lead auditor. `undefined` means "not supplied → fall through".
  // `null` on assigneeUserId is deliberately collapsed to the default chain —
  // we never ship an unassigned corrective-action task.
  const overrideAssignee =
    args.overrides?.assigneeUserId != null
      ? args.overrides.assigneeUserId
      : null
  const assigneeId =
    overrideAssignee ?? args.itemResponsibleUserId ?? args.leadAuditorUserId
  const dueDate =
    args.overrides?.dueDate !== undefined
      ? args.overrides.dueDate
      : args.finding.dueDate
  const priority = args.overrides?.priority ?? TaskPriority.HIGH

  // Phase 3 resolution: explicit override wins, else derive from finding.
  // `description` override is stored verbatim — no prefix auto-prepended.
  const title = args.overrides?.title ?? args.finding.title
  const description =
    args.overrides?.description ??
    'Korrigerande åtgärd för avvikelse: ' + args.finding.description

  const newTask = await tx.task.create({
    data: {
      workspace_id: args.workspaceId,
      column_id: columnId,
      title,
      description,
      assignee_id: assigneeId,
      created_by: args.createdByUserId,
      due_date: dueDate,
      priority,
      position,
      compliance_finding_id: args.finding.id,
    },
    select: { id: true },
  })

  // 4. Create the M:N cycle link row in the same tx (PO v0.5 invariant —
  // spawned task MUST carry both compliance_finding_id AND a link row).
  await tx.complianceCycleTaskLink.create({
    data: {
      task_id: newTask.id,
      cycle_id: args.cycleId,
    },
  })

  return { taskId: newTask.id, columnId, assigneeId }
}
