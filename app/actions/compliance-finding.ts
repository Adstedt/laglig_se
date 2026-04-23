'use server'

/**
 * Story 21.7 — Finding CRUD + lifecycle server actions. Pattern mirrors
 * app/actions/compliance-audit-item.ts (Story 21.5). Task auto-spawn for
 * AVVIKELSE is Story 21.8's concern.
 *
 * NOTE: Story 21.10 will replace the inline `assertCycleEditableUi` helper
 * with `lib/compliance-audit/cycle-guards.ts#assertCycleEditable(tx, cycleId)`.
 * Every mutation carries a TODO(21.10) marker at the callback entry.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { logActivity } from '@/lib/services/activity-logger'
import { spawnCorrectiveActionTask } from '@/lib/compliance-audit/task-spawner'
import { invalidateTaskLinkedListItemsCache } from '@/app/actions/legal-document-modal'
import {
  ComplianceCycleStatus,
  FindingSeverity,
  FindingType,
  TaskPriority,
} from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

/**
 * Local ActionResult shape — mirrors the convention used across server-action
 * modules (compare `app/actions/compliance-audit-cycle.ts:37-47` +
 * `app/actions/compliance-audit-item.ts:38-42`). Each server-action module
 * declares its own; never imported across modules.
 */
interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface FindingRow {
  id: string
  cycleId: string
  type: FindingType
  severity: FindingSeverity | null
  title: string
  description: string
  rootCause: string | null
  dueDate: Date | null
  closedAt: Date | null
  closedBy: { id: string; name: string | null } | null
  lawListItemId: string | null
  lawListItem: { id: string; title: string; documentNumber: string } | null
  requirementId: string | null
  requirement: { id: string; text: string } | null
  correctiveActionTaskId: string | null
  correctiveActionTask: {
    id: string
    title: string
    completedAt: Date | null
  } | null
  createdAt: Date
  updatedAt: Date
}

export interface ListFindingsResult {
  findings: FindingRow[]
}

// ============================================================================
// Zod schemas
// ============================================================================

const FindingIdOnlySchema = z.object({ findingId: z.string().uuid() })

const CreateFindingSchema = z
  .object({
    cycleId: z.string().uuid(),
    type: z.nativeEnum(FindingType),
    severity: z.nativeEnum(FindingSeverity).nullable().optional(),
    title: z.string().min(1, 'Titel krävs').max(200, 'Max 200 tecken'),
    description: z
      .string()
      .min(1, 'Beskrivning krävs')
      .max(5000, 'Max 5000 tecken'),
    rootCause: z.string().max(5000, 'Max 5000 tecken').nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    lawListItemId: z.string().uuid().nullable().optional(),
    requirementId: z.string().uuid().nullable().optional(),
    // Epic 21 follow-up: opt-in/out for corrective-action Task auto-spawn.
    // Omitted → default derived from type (AVVIKELSE → true, others → false),
    // preserving backward-compat with the unconditional 21.8 contract.
    spawnTask: z.boolean().optional(),
    // Epic 21 follow-up (phase 2): inline task-editor overrides from the
    // finding editor. All optional — when omitted, spawner uses default
    // chain (assignee = item responsible ?? lead auditor; dueDate = finding
    // dueDate; priority = HIGH). Only applied when `shouldSpawn` is true.
    taskOverrides: z
      .object({
        assigneeUserId: z.string().uuid().nullable().optional(),
        dueDate: z.coerce.date().nullable().optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        // Phase 3 — user-editable task title + description (decouples task
        // phrasing from finding phrasing). Same max bounds as finding fields.
        title: z.string().min(1).max(200, 'Max 200 tecken').optional(),
        description: z.string().min(1).max(5000, 'Max 5000 tecken').optional(),
      })
      .optional(),
  })
  .refine(
    (d) =>
      d.type !== FindingType.AVVIKELSE ||
      d.severity === FindingSeverity.MAJOR ||
      d.severity === FindingSeverity.MINOR,
    {
      message: 'Allvarlighetsgrad krävs för avvikelser',
      path: ['severity'],
    }
  )

const UpdateFindingSchema = z
  .object({
    findingId: z.string().uuid(),
    type: z.nativeEnum(FindingType).optional(),
    severity: z.nativeEnum(FindingSeverity).nullable().optional(),
    title: z
      .string()
      .min(1, 'Titel krävs')
      .max(200, 'Max 200 tecken')
      .optional(),
    description: z
      .string()
      .min(1, 'Beskrivning krävs')
      .max(5000, 'Max 5000 tecken')
      .optional(),
    rootCause: z.string().max(5000, 'Max 5000 tecken').nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    lawListItemId: z.string().uuid().nullable().optional(),
    requirementId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (d) =>
      d.type !== FindingType.AVVIKELSE ||
      d.severity === undefined ||
      d.severity === FindingSeverity.MAJOR ||
      d.severity === FindingSeverity.MINOR,
    {
      message: 'Allvarlighetsgrad krävs för avvikelser',
      path: ['severity'],
    }
  )
  .refine(
    (d) =>
      d.type !== undefined ||
      d.severity !== undefined ||
      d.title !== undefined ||
      d.description !== undefined ||
      d.rootCause !== undefined ||
      d.dueDate !== undefined ||
      d.lawListItemId !== undefined ||
      d.requirementId !== undefined,
    { message: 'Minst ett fält måste uppdateras' }
  )

const CloseFindingSchema = z.object({
  findingId: z.string().uuid(),
  closeReason: z
    .string()
    .max(1000, 'Max 1000 tecken')
    .nullable()
    .optional()
    .transform((s) => (s && s.trim().length > 0 ? s.trim() : null)),
})

const ReopenFindingSchema = FindingIdOnlySchema

const ListFindingsSchema = z.object({
  cycleId: z.string().uuid(),
  type: z.nativeEnum(FindingType).optional(),
  severity: z.nativeEnum(FindingSeverity).optional(),
  status: z.enum(['open', 'closed', 'all']).default('all'),
})

// ============================================================================
// Module-private helpers
// ============================================================================

const FINDING_INCLUDE = {
  law_list_item: {
    select: {
      id: true,
      document: { select: { title: true, document_number: true } },
    },
  },
  requirement: { select: { id: true, text: true } },
  corrective_action_task: {
    select: { id: true, title: true, completed_at: true },
  },
  closed_by: { select: { id: true, name: true } },
  cycle: {
    select: {
      id: true,
      status: true,
      law_list_id: true,
      // Epic 21 follow-up: required by spawnTaskForFinding so the late-add
      // action can call spawnCorrectiveActionTask without a second round-trip.
      name: true,
      lead_auditor_user_id: true,
    },
  },
} as const

type LoadedFinding = {
  id: string
  cycle_id: string
  type: FindingType
  severity: FindingSeverity | null
  title: string
  description: string
  root_cause: string | null
  corrective_action_task_id: string | null
  due_date: Date | null
  closed_at: Date | null
  closed_by_user_id: string | null
  law_list_item_id: string | null
  requirement_id: string | null
  created_at: Date
  updated_at: Date
  law_list_item: {
    id: string
    document: { title: string; document_number: string }
  } | null
  requirement: { id: string; text: string } | null
  corrective_action_task: {
    id: string
    title: string
    completed_at: Date | null
  } | null
  closed_by: { id: string; name: string | null } | null
  cycle: {
    id: string
    status: ComplianceCycleStatus
    law_list_id: string
    name: string
    lead_auditor_user_id: string
  }
}

function mapRowToFindingRow(row: LoadedFinding): FindingRow {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    rootCause: row.root_cause,
    dueDate: row.due_date,
    closedAt: row.closed_at,
    closedBy: row.closed_by
      ? { id: row.closed_by.id, name: row.closed_by.name }
      : null,
    lawListItemId: row.law_list_item_id,
    lawListItem: row.law_list_item
      ? {
          id: row.law_list_item.id,
          title: row.law_list_item.document.title,
          documentNumber: row.law_list_item.document.document_number,
        }
      : null,
    requirementId: row.requirement_id,
    requirement: row.requirement
      ? { id: row.requirement.id, text: row.requirement.text }
      : null,
    correctiveActionTaskId: row.corrective_action_task_id,
    correctiveActionTask: row.corrective_action_task
      ? {
          id: row.corrective_action_task.id,
          title: row.corrective_action_task.title,
          completedAt: row.corrective_action_task.completed_at,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

type EditableCheck = { ok: true } | { ok: false; error: string }

/**
 * TODO(21.10): replace with lib/compliance-audit/cycle-guards.ts#assertCycleEditable
 * once Story 21.10 ships. Copy of compliance-audit-item.ts:196-208 — deliberate
 * duplication until the shared helper lands.
 */
function assertCycleEditableUi(status: ComplianceCycleStatus): EditableCheck {
  if (
    status === ComplianceCycleStatus.SEALED ||
    status === ComplianceCycleStatus.ARKIVERAD
  ) {
    return {
      ok: false,
      error:
        'Kontrollen är förseglad eller arkiverad — ändringar är inte tillåtna.',
    }
  }
  return { ok: true }
}

/**
 * Story 21.8 — resolves `LawListItem.responsible_user_id` for an item-linked
 * finding, or null when the item has no responsible user assigned. The
 * tenant-scoping filter is defence-in-depth — the caller already validated
 * the lawListItemId belongs to the cycle's laglista (workspace-scoped).
 * Returns null if the item is not found (shouldn't happen mid-tx but the
 * spawner degrades gracefully to the lead-auditor fallback).
 */
async function resolveItemResponsibleUserId(
  tx: Prisma.TransactionClient,
  lawListItemId: string,
  workspaceId: string
): Promise<string | null> {
  const item = await tx.lawListItem.findFirst({
    where: { id: lawListItemId, law_list: { workspace_id: workspaceId } },
    select: { responsible_user_id: true },
  })
  return item?.responsible_user_id ?? null
}

/**
 * Tenant-isolation helper. Mirrors `loadItemScopedToWorkspace` in
 * compliance-audit-item.ts:171-187 but scoped to findings via the cycle join.
 * Returns null on not-found OR cross-workspace — caller maps to the generic
 * Swedish error to avoid existence leakage.
 */
async function loadFindingScopedToWorkspace(
  findingId: string,
  workspaceId: string
): Promise<LoadedFinding | null> {
  return prisma.complianceFinding.findFirst({
    where: { id: findingId, cycle: { workspace_id: workspaceId } },
    include: FINDING_INCLUDE,
  }) as Promise<LoadedFinding | null>
}

// ============================================================================
// createFinding (Story 21.7 AC 3)
// ============================================================================

export async function createFinding(input: {
  cycleId: string
  type: FindingType
  severity?: FindingSeverity | null
  title: string
  description: string
  rootCause?: string | null
  dueDate?: Date | string | null
  lawListItemId?: string | null
  requirementId?: string | null
  // Epic 21 follow-up: opt-in/out for corrective-action Task auto-spawn.
  // Omitted → defaults to `type === AVVIKELSE` (backward-compat with 21.8).
  spawnTask?: boolean
  // Epic 21 follow-up (phase 2): optional user-supplied overrides from the
  // editor's inline task section. Only applied when `shouldSpawn` is true.
  // Phase 3 extends with title + description for full task editorial control.
  taskOverrides?: {
    assigneeUserId?: string | null
    dueDate?: Date | string | null
    priority?: TaskPriority
    title?: string
    description?: string
  }
}): Promise<ActionResult<{ finding: FindingRow }>> {
  const parsed = CreateFindingSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  // Default derivation: AVVIKELSE → spawn, others → no spawn.
  // Omitting the param preserves the pre-opt-in 21.8 contract.
  const shouldSpawn =
    parsed.data.spawnTask ?? parsed.data.type === FindingType.AVVIKELSE

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): assertCycleEditable(tx, cycleId) — transaction-participating guard.
      // Story 21.8: extended cycle select to include `name` and
      // `lead_auditor_user_id` — both required by the spawner for the
      // task's `created_by`/`assignee_id` fallback + activity log payload.
      const cycle = await prisma.complianceAuditCycle.findFirst({
        where: {
          id: parsed.data.cycleId,
          workspace_id: ctx.workspaceId,
        },
        select: {
          id: true,
          name: true,
          status: true,
          law_list_id: true,
          lead_auditor_user_id: true,
        },
      })
      if (!cycle) {
        return { success: false, error: 'Kontrollen hittades inte' }
      }

      const guard = assertCycleEditableUi(cycle.status)
      if (!guard.ok) {
        return { success: false, error: guard.error }
      }

      // Cross-link validation (tenant isolation).
      if (
        parsed.data.lawListItemId !== undefined &&
        parsed.data.lawListItemId !== null
      ) {
        const itemInWorkspace = await prisma.lawListItem.findFirst({
          where: {
            id: parsed.data.lawListItemId,
            law_list: { workspace_id: ctx.workspaceId },
          },
          select: { id: true, law_list_id: true },
        })
        if (!itemInWorkspace) {
          return {
            success: false,
            error: 'Den valda lagen tillhör inte arbetsytan',
          }
        }
        if (itemInWorkspace.law_list_id !== cycle.law_list_id) {
          return {
            success: false,
            error: 'Lagposten tillhör inte kontrollens laglista',
          }
        }
      }

      if (
        parsed.data.requirementId !== undefined &&
        parsed.data.requirementId !== null
      ) {
        const reqInLaglista = await prisma.lawListItemRequirement.findFirst({
          where: {
            id: parsed.data.requirementId,
            list_item: { law_list_id: cycle.law_list_id },
          },
          select: { id: true },
        })
        if (!reqInLaglista) {
          return {
            success: false,
            error: 'Kravpunkten tillhör inte kontrollens laglista',
          }
        }
      }

      const severity = parsed.data.severity ?? null
      const rootCause = parsed.data.rootCause ?? null
      const dueDate = parsed.data.dueDate ?? null
      const lawListItemId = parsed.data.lawListItemId ?? null
      const requirementId = parsed.data.requirementId ?? null

      // Story 21.8: wrap the finding create + task spawn + back-fill in one
      // transaction so partial state is impossible.
      const {
        finding: created,
        spawnedTaskId,
        spawnedTaskAssigneeId,
      } = await prisma.$transaction(async (tx) => {
        const findingRow = (await tx.complianceFinding.create({
          data: {
            cycle_id: cycle.id,
            type: parsed.data.type,
            severity,
            title: parsed.data.title,
            description: parsed.data.description,
            root_cause: rootCause,
            due_date: dueDate,
            law_list_item_id: lawListItemId,
            requirement_id: requirementId,
          },
          include: FINDING_INCLUDE,
        })) as unknown as LoadedFinding

        // Epic 21 follow-up: opt-in/out gate for task spawn.
        // `shouldSpawn` derived from `spawnTask` param (or type default).
        // Skipping spawn returns the raw findingRow with null task refs —
        // downstream activity-log + revalidate guards key off `spawnedTaskId`,
        // not type, so the opt-out path emits no `finding_task_spawned` log
        // and skips the `/tasks` revalidate.
        if (!shouldSpawn) {
          return {
            finding: findingRow,
            spawnedTaskId: null as string | null,
            spawnedTaskAssigneeId: null as string | null,
          }
        }

        const itemResponsibleUserId = lawListItemId
          ? await resolveItemResponsibleUserId(
              tx,
              lawListItemId,
              ctx.workspaceId
            )
          : null

        // PO gate-review DEV-001: `assigneeId` is returned by the spawner as
        // the single source of truth for the fallback chain — no parallel
        // re-computation in this closure.
        // Epic 21 follow-up (phase 2): forward editor-supplied overrides.
        // Spawner preserves the fallback chain for any omitted field.
        // Phase 3: also forward title + description when the user edited
        // them on step 2 of the wizard.
        const overrides = parsed.data.taskOverrides
          ? {
              ...(parsed.data.taskOverrides.assigneeUserId !== undefined
                ? { assigneeUserId: parsed.data.taskOverrides.assigneeUserId }
                : {}),
              ...(parsed.data.taskOverrides.dueDate !== undefined
                ? { dueDate: parsed.data.taskOverrides.dueDate }
                : {}),
              ...(parsed.data.taskOverrides.priority !== undefined
                ? { priority: parsed.data.taskOverrides.priority }
                : {}),
              ...(parsed.data.taskOverrides.title !== undefined
                ? { title: parsed.data.taskOverrides.title }
                : {}),
              ...(parsed.data.taskOverrides.description !== undefined
                ? { description: parsed.data.taskOverrides.description }
                : {}),
            }
          : undefined
        const { taskId, assigneeId } = await spawnCorrectiveActionTask(tx, {
          workspaceId: ctx.workspaceId,
          cycleId: cycle.id,
          cycleName: cycle.name,
          leadAuditorUserId: cycle.lead_auditor_user_id,
          itemResponsibleUserId,
          finding: {
            id: findingRow.id,
            title: findingRow.title,
            description: findingRow.description,
            dueDate: findingRow.due_date,
          },
          createdByUserId: ctx.userId,
          ...(overrides ? { overrides } : {}),
        })

        const backFilled = (await tx.complianceFinding.update({
          where: { id: findingRow.id },
          data: { corrective_action_task_id: taskId },
          include: FINDING_INCLUDE,
        })) as unknown as LoadedFinding

        return {
          finding: backFilled,
          spawnedTaskId: taskId,
          spawnedTaskAssigneeId: assigneeId,
        }
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_finding',
        created.id,
        'finding_created',
        null,
        {
          type: parsed.data.type,
          severity,
          title: parsed.data.title,
          lawListItemId,
          requirementId,
        }
      )

      if (spawnedTaskId !== null) {
        await logActivity(
          ctx.workspaceId,
          ctx.userId,
          'compliance_finding',
          created.id,
          'finding_task_spawned',
          null,
          {
            task_id: spawnedTaskId,
            task_title: created.title,
            assignee_id: spawnedTaskAssigneeId,
            cycle_id: cycle.id,
            cycle_name: cycle.name,
          }
        )
      }

      revalidatePath(`/laglistor/kontroller/${cycle.id}`)
      if (spawnedTaskId !== null) {
        revalidatePath('/tasks')
      }
      return {
        success: true,
        data: { finding: mapRowToFindingRow(created) },
      }
    }, 'tasks:edit')
  } catch (error) {
    console.error('createFinding error:', error)
    return { success: false, error: 'Kunde inte skapa finding' }
  }
}

// ============================================================================
// spawnTaskForFinding (Epic 21 follow-up — late-add corrective-action task)
// ============================================================================

/**
 * Late-add path: spawn a corrective-action Task for an existing finding that
 * doesn't yet have one. Mirrors the spawn branch of `createFinding` but works
 * on an existing `ComplianceFinding` row. Accepts any finding type — the
 * prototype decision tree explicitly allows late-adding a task to any type
 * when the user clicks the "+ Skapa åtgärdsuppgift" row button.
 *
 * Guards reject already-spawned findings, closed findings, and writes to
 * sealed/archived cycles. Uses the same `finding_task_spawned` activity log
 * action as `createFinding` — no new action string.
 */
export async function spawnTaskForFinding(input: {
  findingId: string
}): Promise<ActionResult<{ finding: FindingRow }>> {
  const parsed = FindingIdOnlySchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const existing = await loadFindingScopedToWorkspace(
        parsed.data.findingId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Finding hittades inte' }
      }

      if (existing.corrective_action_task_id !== null) {
        return { success: false, error: 'Åtgärdsuppgift finns redan' }
      }

      if (existing.closed_at !== null) {
        return {
          success: false,
          error: 'Kan inte skapa åtgärdsuppgift för stängd finding',
        }
      }

      // TODO(21.10): assertCycleEditable(tx, cycleId) — transaction-participating guard.
      const guard = assertCycleEditableUi(existing.cycle.status)
      if (!guard.ok) {
        return { success: false, error: guard.error }
      }

      const {
        finding: updatedFinding,
        spawnedTaskId,
        spawnedTaskTitle,
        spawnedTaskAssigneeId,
      } = await prisma.$transaction(async (tx) => {
        const itemResponsibleUserId = existing.law_list_item_id
          ? await resolveItemResponsibleUserId(
              tx,
              existing.law_list_item_id,
              ctx.workspaceId
            )
          : null

        const { taskId, assigneeId } = await spawnCorrectiveActionTask(tx, {
          workspaceId: ctx.workspaceId,
          cycleId: existing.cycle.id,
          cycleName: existing.cycle.name,
          leadAuditorUserId: existing.cycle.lead_auditor_user_id,
          itemResponsibleUserId,
          finding: {
            id: existing.id,
            title: existing.title,
            description: existing.description,
            dueDate: existing.due_date,
          },
          createdByUserId: ctx.userId,
        })

        const backFilled = (await tx.complianceFinding.update({
          where: { id: existing.id },
          data: { corrective_action_task_id: taskId },
          include: FINDING_INCLUDE,
        })) as unknown as LoadedFinding

        return {
          finding: backFilled,
          spawnedTaskId: taskId,
          spawnedTaskTitle: existing.title,
          spawnedTaskAssigneeId: assigneeId,
        }
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_finding',
        existing.id,
        'finding_task_spawned',
        null,
        {
          task_id: spawnedTaskId,
          task_title: spawnedTaskTitle,
          assignee_id: spawnedTaskAssigneeId,
          cycle_id: existing.cycle.id,
          cycle_name: existing.cycle.name,
        }
      )

      revalidatePath(`/laglistor/kontroller/${existing.cycle.id}`)
      revalidatePath('/tasks')

      return {
        success: true,
        data: { finding: mapRowToFindingRow(updatedFinding) },
      }
    }, 'tasks:edit')
  } catch (error) {
    console.error('spawnTaskForFinding error:', error)
    return { success: false, error: 'Kunde inte skapa åtgärdsuppgift' }
  }
}

// ============================================================================
// updateFinding (Story 21.7 AC 4)
// ============================================================================

export async function updateFinding(input: {
  findingId: string
  type?: FindingType
  severity?: FindingSeverity | null
  title?: string
  description?: string
  rootCause?: string | null
  dueDate?: Date | string | null
  lawListItemId?: string | null
  requirementId?: string | null
}): Promise<ActionResult<{ finding: FindingRow }>> {
  const parsed = UpdateFindingSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): assertCycleEditable(tx, cycleId) — transaction-participating guard.
      const existing = await loadFindingScopedToWorkspace(
        parsed.data.findingId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Finding hittades inte' }
      }

      const guard = assertCycleEditableUi(existing.cycle.status)
      if (!guard.ok) {
        return { success: false, error: guard.error }
      }

      if (existing.closed_at !== null) {
        return {
          success: false,
          error: 'Stängda findings kan inte redigeras. Återöppna först.',
        }
      }

      // Cross-link re-validation on changes.
      if (
        parsed.data.lawListItemId !== undefined &&
        parsed.data.lawListItemId !== null
      ) {
        const itemInWorkspace = await prisma.lawListItem.findFirst({
          where: {
            id: parsed.data.lawListItemId,
            law_list: { workspace_id: ctx.workspaceId },
          },
          select: { id: true, law_list_id: true },
        })
        if (!itemInWorkspace) {
          return {
            success: false,
            error: 'Den valda lagen tillhör inte arbetsytan',
          }
        }
        if (itemInWorkspace.law_list_id !== existing.cycle.law_list_id) {
          return {
            success: false,
            error: 'Lagposten tillhör inte kontrollens laglista',
          }
        }
      }

      if (
        parsed.data.requirementId !== undefined &&
        parsed.data.requirementId !== null
      ) {
        const reqInLaglista = await prisma.lawListItemRequirement.findFirst({
          where: {
            id: parsed.data.requirementId,
            list_item: { law_list_id: existing.cycle.law_list_id },
          },
          select: { id: true },
        })
        if (!reqInLaglista) {
          return {
            success: false,
            error: 'Kravpunkten tillhör inte kontrollens laglista',
          }
        }
      }

      // Build diff: only fields whose value actually changes.
      const data: Record<string, unknown> = {}
      const oldValue: Record<string, unknown> = {}
      const newValue: Record<string, unknown> = {}

      if (
        parsed.data.type !== undefined &&
        parsed.data.type !== existing.type
      ) {
        data.type = parsed.data.type
        oldValue.type = existing.type
        newValue.type = parsed.data.type
      }
      if (
        parsed.data.severity !== undefined &&
        (parsed.data.severity ?? null) !== existing.severity
      ) {
        const nextSeverity = parsed.data.severity ?? null
        data.severity = nextSeverity
        oldValue.severity = existing.severity
        newValue.severity = nextSeverity
      }
      if (
        parsed.data.title !== undefined &&
        parsed.data.title !== existing.title
      ) {
        data.title = parsed.data.title
        oldValue.title = existing.title
        newValue.title = parsed.data.title
      }
      if (
        parsed.data.description !== undefined &&
        parsed.data.description !== existing.description
      ) {
        data.description = parsed.data.description
        // Privacy pin: log LENGTH only (never raw text).
        oldValue.old_description_length = existing.description.length
        newValue.new_description_length = parsed.data.description.length
      }
      if (parsed.data.rootCause !== undefined) {
        const nextRoot = parsed.data.rootCause ?? null
        if (nextRoot !== existing.root_cause) {
          data.root_cause = nextRoot
          oldValue.old_root_cause_length = existing.root_cause?.length ?? 0
          newValue.new_root_cause_length = nextRoot?.length ?? 0
        }
      }
      if (parsed.data.dueDate !== undefined) {
        const nextDue =
          parsed.data.dueDate === null ? null : new Date(parsed.data.dueDate)
        const curDueTime = existing.due_date?.getTime() ?? null
        const nextDueTime = nextDue?.getTime() ?? null
        if (curDueTime !== nextDueTime) {
          data.due_date = nextDue
          oldValue.dueDate = existing.due_date
          newValue.dueDate = nextDue
        }
      }
      if (parsed.data.lawListItemId !== undefined) {
        const nextItemId = parsed.data.lawListItemId ?? null
        if (nextItemId !== existing.law_list_item_id) {
          data.law_list_item_id = nextItemId
          oldValue.lawListItemId = existing.law_list_item_id
          newValue.lawListItemId = nextItemId
        }
      }
      if (parsed.data.requirementId !== undefined) {
        const nextReqId = parsed.data.requirementId ?? null
        if (nextReqId !== existing.requirement_id) {
          data.requirement_id = nextReqId
          oldValue.requirementId = existing.requirement_id
          newValue.requirementId = nextReqId
        }
      }

      // Idempotent shortcut: nothing actually changed → no-op.
      if (Object.keys(data).length === 0) {
        return {
          success: true,
          data: { finding: mapRowToFindingRow(existing) },
        }
      }

      const refreshed = (await prisma.complianceFinding.update({
        where: { id: parsed.data.findingId },
        data,
        include: FINDING_INCLUDE,
      })) as unknown as LoadedFinding

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_finding',
        parsed.data.findingId,
        'finding_updated',
        oldValue,
        newValue
      )

      revalidatePath(`/laglistor/kontroller/${existing.cycle.id}`)
      return {
        success: true,
        data: { finding: mapRowToFindingRow(refreshed) },
      }
    }, 'tasks:edit')
  } catch (error) {
    console.error('updateFinding error:', error)
    return { success: false, error: 'Kunde inte uppdatera finding' }
  }
}

// ============================================================================
// closeFinding (Story 21.7 AC 5)
// ============================================================================

export async function closeFinding(input: {
  findingId: string
  closeReason?: string | null
}): Promise<ActionResult<{ finding: FindingRow }>> {
  const parsed = CloseFindingSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): assertCycleEditable(tx, cycleId) — transaction-participating guard.
      const existing = await loadFindingScopedToWorkspace(
        parsed.data.findingId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Finding hittades inte' }
      }

      const guard = assertCycleEditableUi(existing.cycle.status)
      if (!guard.ok) {
        return { success: false, error: guard.error }
      }

      // Idempotent: already closed → return current row, no write, no log.
      if (existing.closed_at !== null) {
        return {
          success: true,
          data: { finding: mapRowToFindingRow(existing) },
        }
      }

      const closeReason = parsed.data.closeReason

      // AVVIKELSE + linked task gate.
      if (
        existing.type === FindingType.AVVIKELSE &&
        existing.corrective_action_task_id !== null
      ) {
        const task = await prisma.task.findFirst({
          where: {
            id: existing.corrective_action_task_id,
            workspace_id: ctx.workspaceId,
          },
          select: { id: true, completed_at: true },
        })
        if (task && task.completed_at === null && !closeReason) {
          return {
            success: false,
            error:
              'FINDING_REQUIRES_TASK_CLOSURE: Den kopplade uppgiften är inte klar. Slutför uppgiften eller ange en manuell anledning.',
          }
        }
        // If task missing (stale FK / soft-deleted) → closure proceeds.
      }

      // Story 21.8: wrap the finding close + linked task auto-complete in a
      // single transaction so a failed task update rolls back the close.
      const now = new Date()
      const { refreshed, autoCompletedTask } = await prisma.$transaction(
        async (tx) => {
          const updated = (await tx.complianceFinding.update({
            where: { id: parsed.data.findingId },
            data: {
              closed_at: now,
              closed_by_user_id: ctx.userId,
            },
            include: FINDING_INCLUDE,
          })) as unknown as LoadedFinding

          let autoCompleted: {
            taskId: string
            newColumnId: string
          } | null = null

          // PO v0.3 — gate on closeReason == null so the manual-override close
          // path does NOT silently invert the user's explicit "close despite
          // incomplete task" intent. Happy path only.
          if (
            existing.corrective_action_task_id !== null &&
            closeReason === null
          ) {
            const linkedTask = await tx.task.findFirst({
              where: {
                id: existing.corrective_action_task_id,
                workspace_id: ctx.workspaceId,
              },
              select: { id: true, completed_at: true, column_id: true },
            })
            if (linkedTask && linkedTask.completed_at === null) {
              const doneColumn = await tx.taskColumn.findFirst({
                where: { workspace_id: ctx.workspaceId, is_done: true },
                orderBy: { position: 'asc' },
                select: { id: true },
              })
              if (doneColumn) {
                const maxPosition = await tx.task.aggregate({
                  where: { column_id: doneColumn.id },
                  _max: { position: true },
                })
                await tx.task.update({
                  where: { id: linkedTask.id },
                  data: {
                    column_id: doneColumn.id,
                    position: (maxPosition._max.position ?? -1) + 1,
                    completed_at: new Date(),
                  },
                })
                autoCompleted = {
                  taskId: linkedTask.id,
                  newColumnId: doneColumn.id,
                }
              } else {
                // Degenerate workspace — no is_done column. Skip silently +
                // log a warning. The finding still closes successfully; the
                // user can complete the task manually from the Kanban UI.
                console.warn(
                  'closeFinding: workspace has no is_done column; linked task not auto-completed',
                  {
                    findingId: parsed.data.findingId,
                    linkedTaskId: linkedTask.id,
                  }
                )
              }
            }
            // If linkedTask null (soft-deleted / FK stale), skip silently —
            // onDelete: SetNull already handled the reference.
          }

          return { refreshed: updated, autoCompletedTask: autoCompleted }
        }
      )

      const newValue: Record<string, unknown> = {
        closed_at: now.toISOString(),
        closed_by_user_id: ctx.userId,
      }
      if (closeReason) {
        newValue.manual_override = true
        newValue.close_reason = closeReason
      }

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_finding',
        parsed.data.findingId,
        'finding_closed',
        null,
        newValue
      )

      if (autoCompletedTask !== null) {
        await logActivity(
          ctx.workspaceId,
          ctx.userId,
          'compliance_finding',
          parsed.data.findingId,
          'finding_task_completed',
          null,
          {
            task_id: autoCompletedTask.taskId,
            new_column_id: autoCompletedTask.newColumnId,
          }
        )
        // Invalidate the linked-list-items cache so the document modal
        // shows the updated task status. Mirrors the updateTaskStatus
        // pattern at `app/actions/tasks.ts:675`.
        await invalidateTaskLinkedListItemsCache(autoCompletedTask.taskId)
      }

      revalidatePath(`/laglistor/kontroller/${existing.cycle.id}`)
      if (autoCompletedTask !== null) {
        revalidatePath('/tasks')
      }
      return {
        success: true,
        data: { finding: mapRowToFindingRow(refreshed) },
      }
    }, 'tasks:edit')
  } catch (error) {
    console.error('closeFinding error:', error)
    return { success: false, error: 'Kunde inte stänga finding' }
  }
}

// ============================================================================
// reopenFinding (Story 21.7 AC 6)
// ============================================================================

export async function reopenFinding(
  findingId: string
): Promise<ActionResult<{ finding: FindingRow }>> {
  const parsed = ReopenFindingSchema.safeParse({ findingId })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): assertCycleEditable(tx, cycleId) — transaction-participating guard.
      const existing = await loadFindingScopedToWorkspace(
        parsed.data.findingId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Finding hittades inte' }
      }

      const guard = assertCycleEditableUi(existing.cycle.status)
      if (!guard.ok) {
        return { success: false, error: guard.error }
      }

      // Idempotent: already open → no-op.
      if (existing.closed_at === null) {
        return {
          success: true,
          data: { finding: mapRowToFindingRow(existing) },
        }
      }

      const previousClosedAt = existing.closed_at
      const previousClosedBy = existing.closed_by_user_id

      const refreshed = (await prisma.complianceFinding.update({
        where: { id: parsed.data.findingId },
        data: {
          closed_at: null,
          closed_by_user_id: null,
        },
        include: FINDING_INCLUDE,
      })) as unknown as LoadedFinding

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_finding',
        parsed.data.findingId,
        'finding_reopened',
        {
          closed_at: previousClosedAt?.toISOString() ?? null,
          closed_by_user_id: previousClosedBy,
        },
        null
      )

      revalidatePath(`/laglistor/kontroller/${existing.cycle.id}`)
      return {
        success: true,
        data: { finding: mapRowToFindingRow(refreshed) },
      }
    }, 'tasks:edit')
  } catch (error) {
    console.error('reopenFinding error:', error)
    return { success: false, error: 'Kunde inte återöppna finding' }
  }
}

// ============================================================================
// listFindingsForCycle (Story 21.7 AC 7)
// ============================================================================

export async function listFindingsForCycle(input: {
  cycleId: string
  type?: FindingType
  severity?: FindingSeverity
  status?: 'open' | 'closed' | 'all'
}): Promise<ActionResult<ListFindingsResult>> {
  const parsed = ListFindingsSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      if (
        !(ctx.hasPermission('activity:view') || ctx.hasPermission('tasks:edit'))
      ) {
        return { success: false, error: 'Behörighet saknas' }
      }

      const cycle = await prisma.complianceAuditCycle.findFirst({
        where: {
          id: parsed.data.cycleId,
          workspace_id: ctx.workspaceId,
        },
        select: { id: true },
      })
      if (!cycle) {
        return { success: false, error: 'Kontrollen hittades inte' }
      }

      const where: Record<string, unknown> = { cycle_id: cycle.id }
      if (parsed.data.type !== undefined) where.type = parsed.data.type
      if (parsed.data.severity !== undefined)
        where.severity = parsed.data.severity
      if (parsed.data.status === 'open') where.closed_at = null
      else if (parsed.data.status === 'closed') where.closed_at = { not: null }

      const rows = (await prisma.complianceFinding.findMany({
        where,
        include: FINDING_INCLUDE,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      })) as unknown as LoadedFinding[]

      return {
        success: true,
        data: { findings: rows.map((r) => mapRowToFindingRow(r)) },
      }
    }, 'read')
  } catch (error) {
    console.error('listFindingsForCycle error:', error)
    return { success: false, error: 'Kunde inte hämta findings' }
  }
}
