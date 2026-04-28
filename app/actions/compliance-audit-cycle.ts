'use server'

/**
 * Story 21.2: Cycle CRUD server actions for ComplianceAuditCycle.
 * Pattern mirrors app/actions/law-list-item-requirements.ts.
 *
 * Exposes: createCycle, listCyclesForWorkspace, getCycleById,
 * updateCycleMetadata, softDeleteCycle.
 *
 * NOTE: Materialisation of ComplianceAuditItem rows (PLANERAD → PAGAENDE)
 * is deliberately OUT OF SCOPE for this story — belongs to Story 21.4's
 * materialiseCycleItems action.
 *
 * NOTE: Story 21.10's assertCycleEditable(tx, cycleId) guard does NOT yet
 * exist. Mutation actions (updateCycleMetadata, softDeleteCycle) carry a
 * TODO(21.10) comment at entry so 21.10's dev can grep + wire them up.
 *
 * Story 21.12: `sealCycle` schedules eager sealed-PDF generation via
 * `after()` so the seal dialog returns immediately while Puppeteer renders
 * in the background. The continuation inherits the caller route's
 * `maxDuration` — the cycle detail page at
 * `app/(workspace)/laglistor/kontroller/[cycleId]/page.tsx` exports
 * `maxDuration = 300` to give the render headroom. Failures are non-fatal:
 * the seal transaction is already committed; the route handler at
 * `/laglistor/kontroller/[cycleId]/rapport/pdf` lazy-generates on first
 * download if the eager path didn't complete.
 */

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { logActivity } from '@/lib/services/activity-logger'
import { canCompleteOrRevertCycle } from '@/lib/compliance-audit/authorization'
import { generateCycleReport } from '@/app/actions/compliance-audit-report'
import {
  AuditType,
  ComplianceCycleStatus,
  ComplianceStatus,
  EfterlevnadsBedomning,
  Prisma,
  type ComplianceAuditCycle,
} from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
  /**
   * Non-blocking warnings surfaced to the caller alongside a successful result.
   * Story 21.4: `materialiseCycleItems` uses this to report the subset-resolution
   * edge case where some scope items no longer exist in the laglista.
   */
  warnings?: string[]
}

/**
 * Cycle scope shape. Stored on ComplianceAuditCycle.scope_definition (Json).
 * Source: prisma/schema.prisma:1861 + docs/architecture/epic-21-lagefterlevnadskontroll.md §4.1.
 */
export type ScopeDefinition =
  | { kind: 'all' }
  | { kind: 'groups'; groupIds: string[] }
  | { kind: 'items'; itemIds: string[] }

export interface CycleSummary {
  id: string
  name: string
  status: ComplianceCycleStatus
  auditType: AuditType
  scheduledStart: Date
  scheduledEnd: Date
  lawChangeCutoffDate: Date
  leadAuditor: { id: string; name: string | null }
  lawList: { id: string; name: string }
  itemCount: number
  createdAt: Date
  updatedAt: Date
}

export interface CycleDetail extends CycleSummary {
  lawListId: string
  scopeDefinition: ScopeDefinition
  sealedAt: Date | null
  sealedBy: { id: string; name: string | null } | null
  createdBy: { id: string; name: string | null }
  deletedAt: Date | null
  description: string | null
}

export interface ListCyclesResult {
  cycles: CycleSummary[]
  nextCursor: string | null
}

// ============================================================================
// Zod schemas
// ============================================================================

const ScopeDefinitionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({
    kind: z.literal('groups'),
    groupIds: z.array(z.string().uuid()).min(1),
  }),
  z.object({
    kind: z.literal('items'),
    itemIds: z.array(z.string().uuid()).min(1),
  }),
])

const CreateCycleSchema = z
  .object({
    lawListId: z.string().uuid(),
    name: z.string().min(1, 'Namn krävs').max(200, 'Max 200 tecken'),
    auditType: z.nativeEnum(AuditType),
    scheduledStart: z.coerce.date(),
    scheduledEnd: z.coerce.date(),
    lawChangeCutoffDate: z.coerce.date(),
    leadAuditorUserId: z.string().uuid(),
    scopeDefinition: ScopeDefinitionSchema,
    description: z.string().max(2000, 'Max 2000 tecken').nullable().optional(),
  })
  .refine((data) => data.scheduledEnd >= data.scheduledStart, {
    message: 'Slutdatum måste vara lika med eller efter startdatum',
    path: ['scheduledEnd'],
  })

const UpdateCycleMetadataSchema = z
  .object({
    cycleId: z.string().uuid(),
    name: z.string().min(1).max(200).optional(),
    auditType: z.nativeEnum(AuditType).optional(),
    scheduledStart: z.coerce.date().optional(),
    scheduledEnd: z.coerce.date().optional(),
    lawChangeCutoffDate: z.coerce.date().optional(),
    leadAuditorUserId: z.string().uuid().optional(),
    description: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.auditType !== undefined ||
      data.scheduledStart !== undefined ||
      data.scheduledEnd !== undefined ||
      data.lawChangeCutoffDate !== undefined ||
      data.leadAuditorUserId !== undefined ||
      data.description !== undefined,
    { message: 'Minst ett fält måste uppdateras' }
  )

const ListFiltersSchema = z.object({
  status: z
    .union([
      z.nativeEnum(ComplianceCycleStatus),
      z.array(z.nativeEnum(ComplianceCycleStatus)).min(1),
    ])
    .optional(),
  leadAuditorUserId: z.string().uuid().optional(),
  lawListId: z.string().uuid().optional(),
  includeDeleted: z.boolean().default(false),
  take: z.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
})

const GetCycleByIdSchema = z.object({
  cycleId: z.string().uuid(),
})

const SoftDeleteSchema = z.object({
  cycleId: z.string().uuid(),
})

// Story 21.6 — cycle lifecycle transitions (PAGAENDE ↔ AVSLUTAD).
const CompleteCycleSchema = z.object({
  cycleId: z.string().uuid(),
})

const RevertCycleSchema = z.object({
  cycleId: z.string().uuid(),
})

// Story 21.26 — `SealCycleSchema` removed alongside `sealCycle` action.

// ============================================================================
// Module-private helpers
// ============================================================================

async function assertIsWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const member = await prisma.workspaceMember.findFirst({
    where: { workspace_id: workspaceId, user_id: userId },
    select: { id: true },
  })
  return member !== null
}

async function loadCycleScopedToWorkspace(
  cycleId: string,
  workspaceId: string
): Promise<ComplianceAuditCycle | null> {
  return prisma.complianceAuditCycle.findFirst({
    where: { id: cycleId, workspace_id: workspaceId },
  })
}

// Story 21.6 — shared CycleDetail include shape. Hoisted so `getCycleById`
// and `loadCycleDetailInline` (the post-transition refresh helper used by
// completeCycle + revertCycleToPagaende) load the same relation set.
const CYCLE_DETAIL_INCLUDE = {
  lead_auditor: { select: { id: true, name: true } },
  law_list: { select: { id: true, name: true } },
  created_by: { select: { id: true, name: true } },
  sealed_by: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} as const

type CycleDetailRow = Prisma.ComplianceAuditCycleGetPayload<{
  include: typeof CYCLE_DETAIL_INCLUDE
}>

function mapCycleRowToDetail(row: CycleDetailRow): CycleDetail {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    auditType: row.audit_type,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    lawChangeCutoffDate: row.law_change_cutoff_date,
    leadAuditor: {
      id: row.lead_auditor.id,
      name: row.lead_auditor.name,
    },
    lawList: { id: row.law_list.id, name: row.law_list.name },
    itemCount: row._count.items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lawListId: row.law_list_id,
    scopeDefinition: row.scope_definition as unknown as ScopeDefinition,
    sealedAt: row.sealed_at,
    sealedBy: row.sealed_by
      ? { id: row.sealed_by.id, name: row.sealed_by.name }
      : null,
    createdBy: {
      id: row.created_by.id,
      name: row.created_by.name,
    },
    deletedAt: row.deleted_at,
    description: row.description,
  }
}

/**
 * Story 21.6 — post-transition refresh helper used by `completeCycle` and
 * `revertCycleToPagaende`. Re-reads the cycle with the full CycleDetail
 * include shape and maps it, all WITHOUT re-entering `withWorkspace` (avoids
 * the redundant session + permission re-check of a nested `getCycleById`
 * call). One DB round-trip; no permission re-evaluation.
 *
 * SF-4 fix from PO v0.2 validation: the original draft suggested calling
 * `getCycleById(cycleId)` inline, which is re-entrant but wasteful.
 */
async function loadCycleDetailInline(
  cycleId: string,
  workspaceId: string
): Promise<CycleDetail | null> {
  const row = await prisma.complianceAuditCycle.findFirst({
    where: { id: cycleId, workspace_id: workspaceId },
    include: CYCLE_DETAIL_INCLUDE,
  })
  if (!row) return null
  return mapCycleRowToDetail(row)
}

// ============================================================================
// createCycle (Story 21.2 AC 1, 2, 3, 4, 5, 7, 8)
// ============================================================================

export async function createCycle(input: {
  lawListId: string
  name: string
  auditType: AuditType
  scheduledStart: Date | string
  scheduledEnd: Date | string
  lawChangeCutoffDate: Date | string
  leadAuditorUserId: string
  scopeDefinition: ScopeDefinition
  description?: string | null
}): Promise<ActionResult<{ cycle: ComplianceAuditCycle }>> {
  const parsed = CreateCycleSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const lawList = await prisma.lawList.findFirst({
        where: { id: parsed.data.lawListId, workspace_id: ctx.workspaceId },
        select: { id: true },
      })
      if (!lawList) {
        return { success: false, error: 'Laglistan hittades inte' }
      }

      if (
        !(await assertIsWorkspaceMember(
          ctx.workspaceId,
          parsed.data.leadAuditorUserId
        ))
      ) {
        return {
          success: false,
          error: 'Ansvarig användare är inte medlem i arbetsytan',
        }
      }

      const cycle = await prisma.complianceAuditCycle.create({
        data: {
          name: parsed.data.name,
          audit_type: parsed.data.auditType,
          scheduled_start: parsed.data.scheduledStart,
          scheduled_end: parsed.data.scheduledEnd,
          law_change_cutoff_date: parsed.data.lawChangeCutoffDate,
          lead_auditor_user_id: parsed.data.leadAuditorUserId,
          law_list_id: parsed.data.lawListId,
          scope_definition: parsed.data.scopeDefinition,
          status: ComplianceCycleStatus.PLANERAD,
          workspace_id: ctx.workspaceId,
          created_by_user_id: ctx.userId,
          description: parsed.data.description ?? null,
        },
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_audit_cycle',
        cycle.id,
        'cycle_created',
        null,
        {
          name: parsed.data.name,
          auditType: parsed.data.auditType,
          lawListId: parsed.data.lawListId,
          leadAuditorUserId: parsed.data.leadAuditorUserId,
          description: parsed.data.description ?? null,
        }
      )

      revalidatePath('/laglistor/kontroller')
      return { success: true, data: { cycle } }
    }, 'tasks:edit')
  } catch (error) {
    console.error('createCycle error:', error)
    return { success: false, error: 'Kunde inte skapa kontrollen' }
  }
}

// ============================================================================
// listCyclesForWorkspace (Story 21.2 AC 1, 2, 9)
// ============================================================================

export async function listCyclesForWorkspace(
  filters: Partial<z.input<typeof ListFiltersSchema>> = {}
): Promise<ActionResult<ListCyclesResult>> {
  const parsed = ListFiltersSchema.safeParse(filters)
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

      const statusFilter = Array.isArray(parsed.data.status)
        ? { in: parsed.data.status }
        : parsed.data.status !== undefined
          ? parsed.data.status
          : undefined

      const rows = await prisma.complianceAuditCycle.findMany({
        where: {
          workspace_id: ctx.workspaceId,
          ...(parsed.data.includeDeleted ? {} : { deleted_at: null }),
          ...(statusFilter !== undefined ? { status: statusFilter } : {}),
          ...(parsed.data.leadAuditorUserId !== undefined
            ? { lead_auditor_user_id: parsed.data.leadAuditorUserId }
            : {}),
          ...(parsed.data.lawListId !== undefined
            ? { law_list_id: parsed.data.lawListId }
            : {}),
        },
        take: parsed.data.take + 1, // +1 to detect hasMore (arch §11.7.1 pattern).
        ...(parsed.data.cursor !== undefined
          ? { cursor: { id: parsed.data.cursor }, skip: 1 }
          : {}),
        orderBy: { created_at: 'desc' },
        include: {
          lead_auditor: { select: { id: true, name: true } },
          law_list: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      })

      const hasMore = rows.length > parsed.data.take
      const items = hasMore ? rows.slice(0, -1) : rows
      const nextCursor = hasMore ? items[items.length - 1]!.id : null

      const cycles: CycleSummary[] = items.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        auditType: row.audit_type,
        scheduledStart: row.scheduled_start,
        scheduledEnd: row.scheduled_end,
        lawChangeCutoffDate: row.law_change_cutoff_date,
        leadAuditor: {
          id: row.lead_auditor.id,
          name: row.lead_auditor.name,
        },
        lawList: { id: row.law_list.id, name: row.law_list.name },
        itemCount: row._count.items,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      return { success: true, data: { cycles, nextCursor } }
    }, 'read')
  } catch (error) {
    console.error('listCyclesForWorkspace error:', error)
    return { success: false, error: 'Kunde inte hämta kontroller' }
  }
}

// ============================================================================
// getCycleById (Story 21.2 AC 1, 2, 10)
// ============================================================================

export async function getCycleById(
  cycleId: string
): Promise<ActionResult<{ cycle: CycleDetail }>> {
  const parsed = GetCycleByIdSchema.safeParse({ cycleId })
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

      // Story 21.6 — delegated to the shared `loadCycleDetailInline` +
      // `mapCycleRowToDetail` helpers so `getCycleById` + post-transition
      // refresh paths share one include shape + one mapper.
      const cycle = await loadCycleDetailInline(
        parsed.data.cycleId,
        ctx.workspaceId
      )

      if (!cycle) {
        return { success: false, error: 'Kontrollen hittades inte' }
      }

      return { success: true, data: { cycle } }
    }, 'read')
  } catch (error) {
    console.error('getCycleById error:', error)
    return { success: false, error: 'Kunde inte hämta kontrollen' }
  }
}

// ============================================================================
// getDraftEvidenceDocuments (Story 21.9 v0.5 — INTEGRITY-001 softening)
// ============================================================================

export interface DraftDocumentSummary {
  id: string
  title: string
  /** "AFS 2023:14 Gränsvärden" — helps disambiguate when multiple drafts share titles. */
  contextLabel: string | null
}

const GetDraftEvidenceDocumentsSchema = z.object({
  cycleId: z.string().uuid(),
})

/**
 * Returns the DRAFT-status `WorkspaceDocument` rows linked as evidence to
 * any item in the cycle's scope. Consumed by `SealCycleDialog` to surface
 * the offending drafts BEFORE seal so the user can write a meaningful
 * override motivering (snapshot-and-accept-with-override pattern, v0.5).
 *
 * Three pathways considered (mirrors `gatherSealEvidenceForCycle` doc-only):
 *  - direct `WorkspaceDocumentListItemLink`
 *  - kravpunkt-bevis via `RequirementEvidenceLink.workspace_document_id`
 *  - via task: `TaskListItemLink → task → WorkspaceDocumentTaskLink`
 *
 * Deduped by document id. Each result includes `contextLabel` formed from
 * the parent law (`SFS 1977:1160 Lag (1977:1160)`) when one exists; null
 * for documents that surface via tasks not bridged to the item directly.
 */
export async function getDraftEvidenceDocuments(
  cycleId: string
): Promise<ActionResult<{ draftDocuments: DraftDocumentSummary[] }>> {
  const parsed = GetDraftEvidenceDocumentsSchema.safeParse({ cycleId })
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

      // Load the cycle's items + their linked DOCUMENT-kind evidence (all
      // three pathways) in one batched query. Items that don't exist or
      // belong to a different workspace return [] (no leak).
      const items = await prisma.complianceAuditItem.findMany({
        where: {
          cycle_id: parsed.data.cycleId,
          cycle: { workspace_id: ctx.workspaceId },
        },
        select: {
          law_list_item: {
            select: {
              document: {
                select: { document_number: true, title: true },
              },
              workspace_document_links: {
                select: {
                  document: {
                    select: { id: true, title: true, status: true },
                  },
                },
              },
              requirements: {
                select: {
                  evidence_links: {
                    select: {
                      workspace_document: {
                        select: { id: true, title: true, status: true },
                      },
                    },
                  },
                },
              },
              task_links: {
                select: {
                  task: {
                    select: {
                      workspace_document_links: {
                        select: {
                          document: {
                            select: {
                              id: true,
                              title: true,
                              status: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      // Dedup by doc id; keep the FIRST contextLabel encountered (parent law
      // title for direct/kravpunkt-bevis links; null for task-bridged links
      // since the doc didn't surface via a per-item lawListItem path on the
      // task side).
      const byId = new Map<string, DraftDocumentSummary>()

      const consider = (
        doc: { id: string; title: string; status: string } | null | undefined,
        contextLabel: string | null
      ) => {
        if (!doc || doc.status !== 'DRAFT') return
        if (byId.has(doc.id)) return
        byId.set(doc.id, { id: doc.id, title: doc.title, contextLabel })
      }

      for (const item of items) {
        const ll = item.law_list_item
        const ctxLabel = ll.document
          ? `${ll.document.document_number} ${ll.document.title}`
          : null

        for (const link of ll.workspace_document_links) {
          consider(link.document, ctxLabel)
        }
        for (const req of ll.requirements) {
          for (const ev of req.evidence_links) {
            consider(ev.workspace_document, ctxLabel)
          }
        }
        for (const taskLink of ll.task_links) {
          for (const dLink of taskLink.task.workspace_document_links) {
            // Task-bridged docs don't carry a kravpunkt back-ref, but we
            // still attribute them to the parent lawListItem's law for
            // disambiguation in the dialog.
            consider(dLink.document, ctxLabel)
          }
        }
      }

      // Stable sort by title for deterministic UI ordering.
      const draftDocuments = Array.from(byId.values()).sort((a, b) =>
        a.title.localeCompare(b.title, 'sv')
      )

      return { success: true, data: { draftDocuments } }
    }, 'read')
  } catch (error) {
    console.error('getDraftEvidenceDocuments error:', error)
    return { success: false, error: 'Kunde inte hämta kontrollen' }
  }
}

// ============================================================================
// updateCycleMetadata (Story 21.2 AC 1, 2, 3, 5, 7, 8)
// ============================================================================

export async function updateCycleMetadata(
  cycleId: string,
  updates: {
    name?: string
    auditType?: AuditType
    scheduledStart?: Date | string
    scheduledEnd?: Date | string
    lawChangeCutoffDate?: Date | string
    leadAuditorUserId?: string
    description?: string | null
  }
): Promise<ActionResult> {
  const parsed = UpdateCycleMetadataSchema.safeParse({ cycleId, ...updates })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): replace with assertCycleEditable(tx, cycleId) once shared.
      const existing = await loadCycleScopedToWorkspace(
        parsed.data.cycleId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Kontrollen hittades inte' }
      }

      // Story 21.26 + 21.27 — SEALED + ARKIVERAD collapsed into AVSLUTAD;
      // AVSLUTAD is the only terminal active state.
      if (existing.status === ComplianceCycleStatus.AVSLUTAD) {
        return {
          success: false,
          error:
            'Kontrollen är avslutad — ändringar är inte tillåtna. Återställ till pågående för att redigera.',
        }
      }

      if (
        parsed.data.leadAuditorUserId !== undefined &&
        !(await assertIsWorkspaceMember(
          ctx.workspaceId,
          parsed.data.leadAuditorUserId
        ))
      ) {
        return {
          success: false,
          error: 'Ansvarig användare är inte medlem i arbetsytan',
        }
      }

      // Date refine on effective values (update-or-existing).
      if (
        parsed.data.scheduledStart !== undefined ||
        parsed.data.scheduledEnd !== undefined
      ) {
        const effectiveStart =
          parsed.data.scheduledStart ?? existing.scheduled_start
        const effectiveEnd = parsed.data.scheduledEnd ?? existing.scheduled_end
        if (effectiveEnd < effectiveStart) {
          return {
            success: false,
            error: 'Slutdatum måste vara lika med eller efter startdatum',
          }
        }
      }

      // Build snake_case data object with ONLY the mutated fields.
      const data: Record<string, unknown> = {}
      if (parsed.data.name !== undefined) data.name = parsed.data.name
      if (parsed.data.auditType !== undefined)
        data.audit_type = parsed.data.auditType
      if (parsed.data.scheduledStart !== undefined)
        data.scheduled_start = parsed.data.scheduledStart
      if (parsed.data.scheduledEnd !== undefined)
        data.scheduled_end = parsed.data.scheduledEnd
      if (parsed.data.lawChangeCutoffDate !== undefined)
        data.law_change_cutoff_date = parsed.data.lawChangeCutoffDate
      if (parsed.data.leadAuditorUserId !== undefined)
        data.lead_auditor_user_id = parsed.data.leadAuditorUserId
      if (parsed.data.description !== undefined)
        data.description = parsed.data.description

      await prisma.complianceAuditCycle.update({
        where: { id: parsed.data.cycleId },
        data,
      })

      // Build before/after snapshots of only the mutated fields.
      const oldValue: Record<string, unknown> = {}
      const newValue: Record<string, unknown> = {}
      if (parsed.data.name !== undefined) {
        oldValue.name = existing.name
        newValue.name = parsed.data.name
      }
      if (parsed.data.auditType !== undefined) {
        oldValue.auditType = existing.audit_type
        newValue.auditType = parsed.data.auditType
      }
      if (parsed.data.scheduledStart !== undefined) {
        oldValue.scheduledStart = existing.scheduled_start
        newValue.scheduledStart = parsed.data.scheduledStart
      }
      if (parsed.data.scheduledEnd !== undefined) {
        oldValue.scheduledEnd = existing.scheduled_end
        newValue.scheduledEnd = parsed.data.scheduledEnd
      }
      if (parsed.data.lawChangeCutoffDate !== undefined) {
        oldValue.lawChangeCutoffDate = existing.law_change_cutoff_date
        newValue.lawChangeCutoffDate = parsed.data.lawChangeCutoffDate
      }
      if (parsed.data.leadAuditorUserId !== undefined) {
        oldValue.leadAuditorUserId = existing.lead_auditor_user_id
        newValue.leadAuditorUserId = parsed.data.leadAuditorUserId
      }
      if (parsed.data.description !== undefined) {
        oldValue.description = existing.description
        newValue.description = parsed.data.description
      }

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_audit_cycle',
        parsed.data.cycleId,
        'cycle_metadata_updated',
        oldValue,
        newValue
      )

      revalidatePath('/laglistor/kontroller')
      return { success: true }
    }, 'tasks:edit')
  } catch (error) {
    console.error('updateCycleMetadata error:', error)
    return { success: false, error: 'Kunde inte uppdatera kontrollen' }
  }
}

// ============================================================================
// softDeleteCycle (Story 21.2 AC 1, 2, 3, 6, 7, 8)
// ============================================================================

export async function softDeleteCycle(cycleId: string): Promise<ActionResult> {
  const parsed = SoftDeleteSchema.safeParse({ cycleId })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): assertCycleEditable(tx, cycleId) — reject writes on AVSLUTAD.

      const existing = await loadCycleScopedToWorkspace(
        parsed.data.cycleId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Kontrollen hittades inte' }
      }

      if (existing.deleted_at !== null) {
        return { success: false, error: 'Kontrollen är redan borttagen' }
      }

      if (existing.status !== ComplianceCycleStatus.PLANERAD) {
        return {
          success: false,
          error: 'Kontrollen kan bara tas bort i status Planerad',
        }
      }

      await prisma.complianceAuditCycle.update({
        where: { id: parsed.data.cycleId },
        data: { deleted_at: new Date() },
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_audit_cycle',
        parsed.data.cycleId,
        'cycle_soft_deleted',
        { status: existing.status },
        null
      )

      revalidatePath('/laglistor/kontroller')
      return { success: true }
    }, 'tasks:edit')
  } catch (error) {
    console.error('softDeleteCycle error:', error)
    return { success: false, error: 'Kunde inte ta bort kontrollen' }
  }
}

// ============================================================================
// completeCycle (Story 21.6 AC 1, 3, 12, 15-IV1, 15-IV3, 16)
// ============================================================================

/**
 * Story 21.6 — transition cycle from PAGAENDE → AVSLUTAD.
 *
 * Gate: `tasks:edit` permission + every item has `signed_off_at != null` +
 * `items.length > 0`. The transition is reversible via `revertCycleToPagaende`.
 * Story 21.27 — AVSLUTAD is the only terminal active state; items lock here,
 * findings stay editable forever, revert is the only way back.
 */
export async function completeCycle(
  cycleId: string
): Promise<ActionResult<{ cycle: CycleDetail }>> {
  const parsed = CompleteCycleSchema.safeParse({ cycleId })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): assertCycleEditable(tx, cycleId) — reject writes on AVSLUTAD.

      const existing = await loadCycleScopedToWorkspace(
        parsed.data.cycleId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Kontrollen hittades inte' }
      }

      if (existing.status !== ComplianceCycleStatus.PAGAENDE) {
        return {
          success: false,
          error: 'Kontrollen kan bara slutföras från status Pågående',
        }
      }

      // Items-signed guard: parallel counts for total + unsigned so the error
      // can reference both numbers. Runs outside a transaction — AC 3 notes
      // that the subsequent `update { status: AVSLUTAD }` is safe even under
      // a racing sign-off because the only consequence of a stale count is a
      // benign false-block here (user retries).
      const [totalCount, unsignedCount] = await Promise.all([
        prisma.complianceAuditItem.count({
          where: { cycle_id: parsed.data.cycleId },
        }),
        prisma.complianceAuditItem.count({
          where: { cycle_id: parsed.data.cycleId, signed_off_at: null },
        }),
      ])

      if (totalCount === 0) {
        return {
          success: false,
          error: 'Kontrollen innehåller inga dokument att slutföra',
        }
      }

      if (unsignedCount > 0) {
        return {
          success: false,
          error: `${unsignedCount} av ${totalCount} dokument är inte signerade`,
        }
      }

      // Story 21.26 — completeCycle absorbs former sealCycle responsibilities:
      // populate sealed_at + sealed_by_user_id (column names retained for
      // migration safety; semantically these now record the AVSLUTAD transition's
      // timestamp + actor). The cryptographic seal_hash ceremony was dropped.
      const completedAt = new Date()
      await prisma.complianceAuditCycle.update({
        where: { id: parsed.data.cycleId },
        data: {
          status: ComplianceCycleStatus.AVSLUTAD,
          sealed_at: completedAt,
          sealed_by_user_id: ctx.userId,
        },
      })

      // Story 21.12 SF-3: invalidate any existing COMPLETE-kind report PDF
      // pointer so the revert-and-recomplete edge case (AVSLUTAD → PAGAENDE
      // → AVSLUTAD with no content edits) does not serve a stale PDF. Row
      // is preserved for audit continuity; the next download triggers
      // regeneration via the route handler's staleness check.
      await prisma.complianceAuditReport.updateMany({
        where: {
          cycle_id: parsed.data.cycleId,
          report_kind: 'COMPLETE',
        },
        data: {
          pdf_storage_path: null,
          html_storage_path: null,
        },
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_audit_cycle',
        parsed.data.cycleId,
        'cycle_completed',
        { status: ComplianceCycleStatus.PAGAENDE },
        {
          status: ComplianceCycleStatus.AVSLUTAD,
          completedAt: completedAt.toISOString(),
        }
      )

      revalidatePath('/laglistor/kontroller')
      revalidatePath(`/laglistor/kontroller/${parsed.data.cycleId}`)

      // Story 21.26 — eager PDF generation moves from sealCycle to completeCycle.
      // Fire-and-forget via after() so the user response isn't blocked.
      // Failures are logged but don't fail the user-visible response.
      after(async () => {
        try {
          await generateCycleReport({
            cycleId: parsed.data.cycleId,
            kind: 'COMPLETE',
          })
        } catch (err) {
          console.error(
            '[completeCycle] eager PDF generation failed (non-fatal):',
            err
          )
        }
      })

      // SF-4: refresh via the inline helper (no nested withWorkspace).
      const cycle = await loadCycleDetailInline(
        parsed.data.cycleId,
        ctx.workspaceId
      )
      if (!cycle) {
        // Should be unreachable — the update succeeded so the row exists.
        return {
          success: false,
          error: 'Kontrollen kunde inte hämtas efter uppdatering',
        }
      }

      return { success: true, data: { cycle } }
    }, 'tasks:edit')
  } catch (error) {
    console.error('completeCycle error:', error)
    return { success: false, error: 'Kunde inte slutföra kontrollen' }
  }
}

// ============================================================================
// revertCycleToPagaende (Story 21.6 AC 6, 13, 15-IV3)
// ============================================================================

/**
 * Story 21.6 — revert cycle from AVSLUTAD → PAGAENDE.
 *
 * Gate: `tasks:edit` permission + runtime `canCompleteOrRevertCycle`
 * (OWNER/ADMIN via audit:seal OR the cycle's lead auditor). Soft revert —
 * item signatures + bedömningar are preserved; only the cycle status flips.
 * This is the pre-seal escape hatch per epic AC 6.
 */
export async function revertCycleToPagaende(
  cycleId: string
): Promise<ActionResult<{ cycle: CycleDetail }>> {
  const parsed = RevertCycleSchema.safeParse({ cycleId })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): assertCycleEditable(tx, cycleId) — reject writes on AVSLUTAD.

      const existing = await loadCycleScopedToWorkspace(
        parsed.data.cycleId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Kontrollen hittades inte' }
      }

      // Runtime authorization: lead auditor OR OWNER/ADMIN.
      const allowed = await canCompleteOrRevertCycle({
        role: ctx.role,
        userId: ctx.userId,
        cycleId: parsed.data.cycleId,
        workspaceId: ctx.workspaceId,
      })
      if (!allowed) {
        return {
          success: false,
          error:
            'Endast revisionsledaren eller administratörer kan återställa kontrollen',
        }
      }

      if (existing.status !== ComplianceCycleStatus.AVSLUTAD) {
        return {
          success: false,
          error: 'Endast avslutade kontroller kan återställas till Pågående',
        }
      }

      // Story 21.26 — defensive sealed_at != null check removed alongside the
      // SEAL collapse. Now sealed_at is populated on every AVSLUTAD cycle by
      // completeCycle, so that check would block all reverts. Status guard
      // (existing.status === AVSLUTAD) is sufficient.

      await prisma.complianceAuditCycle.update({
        where: { id: parsed.data.cycleId },
        data: { status: ComplianceCycleStatus.PAGAENDE },
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_audit_cycle',
        parsed.data.cycleId,
        'cycle_reverted_to_pagaende',
        { status: ComplianceCycleStatus.AVSLUTAD },
        { status: ComplianceCycleStatus.PAGAENDE }
      )

      revalidatePath('/laglistor/kontroller')
      revalidatePath(`/laglistor/kontroller/${parsed.data.cycleId}`)

      const cycle = await loadCycleDetailInline(
        parsed.data.cycleId,
        ctx.workspaceId
      )
      if (!cycle) {
        return {
          success: false,
          error: 'Kontrollen kunde inte hämtas efter uppdatering',
        }
      }

      return { success: true, data: { cycle } }
    }, 'tasks:edit')
  } catch (error) {
    console.error('revertCycleToPagaende error:', error)
    return { success: false, error: 'Kunde inte återställa kontrollen' }
  }
}

// ============================================================================
// Story 21.26 — sealCycle deleted. AVSLUTAD is now the terminal active state;
// completeCycle absorbs the timestamp + signer + eager-PDF responsibilities.
// ============================================================================

// ============================================================================
// materialiseCycleItems (Story 21.4 AC 6–11)
// ============================================================================

/**
 * Story 21.4: frozen per-requirement snapshot taken at materialisation time.
 * Point-in-time copy — subsequent edits to source LawListItemRequirement rows
 * do NOT mutate this snapshot (FR4 frozen-scope guarantee).
 */
export interface KravpunkterSnapshotRequirement {
  id: string
  text: string
  comment: string | null
  is_fulfilled: boolean
  bevis_required: boolean
  position: number
  responsible_user_id: string | null
  created_by: string
}

export interface KravpunkterSnapshot {
  frozen_at: string // ISO 8601
  requirements: KravpunkterSnapshotRequirement[]
}

const MaterialiseCycleItemsSchema = z.object({
  cycleId: z.string().uuid(),
})

/**
 * Pure mapping — source LawListItem.compliance_status → initial cycle-item bedömning.
 * PRD AC 5 / Story 21.4 AC 9. PAGAENDE and EJ_PABORJAD map to null (reviewer decides).
 */
function mapComplianceStatusToBedomning(
  status: ComplianceStatus
): EfterlevnadsBedomning | null {
  switch (status) {
    case ComplianceStatus.UPPFYLLD:
      return EfterlevnadsBedomning.UPPFYLLD
    case ComplianceStatus.EJ_UPPFYLLD:
      return EfterlevnadsBedomning.EJ_UPPFYLLD
    case ComplianceStatus.EJ_TILLAMPLIG:
      return EfterlevnadsBedomning.EJ_TILLAMPLIG
    case ComplianceStatus.PAGAENDE:
    case ComplianceStatus.EJ_PABORJAD:
      return null
  }
}

/**
 * Resolves a ScopeDefinition to a concrete list of LawListItem ids inside
 * the materialisation transaction. Story 21.4 AC 7.
 */
async function resolveScopeToItemIds(
  scope: ScopeDefinition,
  lawListId: string,
  tx: Prisma.TransactionClient
): Promise<string[]> {
  switch (scope.kind) {
    case 'all': {
      const rows = await tx.lawListItem.findMany({
        where: { law_list_id: lawListId },
        select: { id: true },
      })
      return rows.map((r) => r.id)
    }
    case 'groups': {
      const rows = await tx.lawListItem.findMany({
        where: { law_list_id: lawListId, group_id: { in: scope.groupIds } },
        select: { id: true },
      })
      return rows.map((r) => r.id)
    }
    case 'items': {
      const rows = await tx.lawListItem.findMany({
        where: { law_list_id: lawListId, id: { in: scope.itemIds } },
        select: { id: true },
      })
      return rows.map((r) => r.id)
    }
  }
}

/**
 * Batch-fetches requirements for every resolved LawListItem in a SINGLE query,
 * then groups them in-memory by `list_item_id`. Replaces the prior per-id loop
 * that issued N serial round-trips through the same transaction connection —
 * that pattern violated NFR1 (500-item materialisation < 3s) at production DB
 * latencies. With this batch helper, materialisation is 2 tx queries + 1
 * createMany + 1 cycle update, regardless of item count.
 *
 * Story 21.4 AC 9 — JSON shape stored on ComplianceAuditItem.kravpunkter_snapshot.
 */
async function buildKravpunkterSnapshotsById(
  resolvedIds: string[],
  tx: Prisma.TransactionClient,
  frozenAt: string
): Promise<Map<string, KravpunkterSnapshot>> {
  const reqs = await tx.lawListItemRequirement.findMany({
    where: { list_item_id: { in: resolvedIds } },
    orderBy: { position: 'asc' },
    select: {
      list_item_id: true,
      id: true,
      text: true,
      comment: true,
      is_fulfilled: true,
      bevis_required: true,
      position: true,
      responsible_user_id: true,
      created_by: true,
    },
  })

  // Group by list_item_id. Iteration order of `reqs` is position-asc
  // (per the orderBy above), so each per-item array preserves that order.
  const requirementsByItemId = new Map<
    string,
    KravpunkterSnapshotRequirement[]
  >()
  for (const r of reqs) {
    const existing = requirementsByItemId.get(r.list_item_id) ?? []
    existing.push({
      id: r.id,
      text: r.text,
      comment: r.comment,
      is_fulfilled: r.is_fulfilled,
      bevis_required: r.bevis_required,
      position: r.position,
      responsible_user_id: r.responsible_user_id,
      created_by: r.created_by,
    })
    requirementsByItemId.set(r.list_item_id, existing)
  }

  // Produce a snapshot for every resolved id — items with zero requirements
  // still get a `{ frozen_at, requirements: [] }` snapshot.
  return new Map(
    resolvedIds.map((id) => [
      id,
      {
        frozen_at: frozenAt,
        requirements: requirementsByItemId.get(id) ?? [],
      },
    ])
  )
}

/**
 * Human-readable summary of the resolved scope — written to ActivityLog.newValue
 * for Story 21.13's activity-feed display.
 */
function summariseResolvedScope(
  scope: ScopeDefinition,
  itemCount: number
): string {
  switch (scope.kind) {
    case 'all':
      return `all → ${itemCount} items`
    case 'groups':
      return `groups (${scope.groupIds.length}) → ${itemCount} items`
    case 'items':
      return `items (${scope.itemIds.length} requested) → ${itemCount} items`
  }
}

/**
 * Story 21.4: materialise a PLANERAD cycle's item set from its scope_definition
 * and transition the cycle to PAGAENDE. Atomic via prisma.$transaction — if any
 * step fails, nothing is written and the cycle stays in PLANERAD.
 *
 * Idempotency: calling on a non-PLANERAD cycle returns a structured error; no writes.
 *
 * Defence-in-depth against duplicate items:
 *  1. Client-side submit lock (Task 3.6)
 *  2. This action's PLANERAD status guard
 *  3. DB-level @@unique([cycle_id, law_list_item_id]) index (Story 21.4 AC 10)
 */
export async function materialiseCycleItems(
  cycleId: string
): Promise<ActionResult<{ itemCount: number }>> {
  const parsed = MaterialiseCycleItemsSchema.safeParse({ cycleId })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): assertCycleEditable(tx, cycleId) — reject writes on AVSLUTAD.

      const existing = await loadCycleScopedToWorkspace(
        parsed.data.cycleId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Kontrollen hittades inte' }
      }

      if (existing.status !== ComplianceCycleStatus.PLANERAD) {
        return {
          success: false,
          error:
            'Kontrollen har redan materialiserats eller är inte i status Planerad',
        }
      }

      const scope = existing.scope_definition as unknown as ScopeDefinition
      const frozenAt = new Date().toISOString()
      const warnings: string[] = []

      // Pre-tx: resolve the requested scope size against the original scope
      // (itemIds only — groups/all are dynamic by definition).
      const requestedItemCount =
        scope.kind === 'items' ? scope.itemIds.length : null

      const result = await prisma.$transaction(
        async (tx) => {
          const resolvedIds = await resolveScopeToItemIds(
            scope,
            existing.law_list_id,
            tx
          )

          if (resolvedIds.length === 0) {
            // Throw a sentinel error — the outer catch maps it to the user-facing Swedish string.
            throw new Error('EMPTY_SCOPE')
          }

          const sourceItems = await tx.lawListItem.findMany({
            where: { id: { in: resolvedIds } },
            select: { id: true, compliance_status: true },
          })

          // Single batched fetch of ALL requirements across resolved items
          // (replaces a prior per-id loop that issued N serial round-trips).
          const snapshotsById = await buildKravpunkterSnapshotsById(
            resolvedIds,
            tx,
            frozenAt
          )

          const sourceStatusById = new Map(
            sourceItems.map((it) => [it.id, it.compliance_status])
          )

          const itemsPayload = resolvedIds.map((lawListItemId) => {
            const sourceStatus =
              sourceStatusById.get(lawListItemId) ??
              ComplianceStatus.EJ_PABORJAD
            const bedomning = mapComplianceStatusToBedomning(sourceStatus)
            return {
              cycle_id: parsed.data.cycleId,
              law_list_item_id: lawListItemId,
              // `efterlevnadsbedomning` is optional (nullable) — only set it when non-null
              // to satisfy exactOptionalPropertyTypes.
              ...(bedomning !== null
                ? { efterlevnadsbedomning: bedomning }
                : {}),
              kravpunkter_snapshot: snapshotsById.get(
                lawListItemId
              ) as unknown as Prisma.InputJsonValue,
            }
          })

          await tx.complianceAuditItem.createMany({ data: itemsPayload })

          await tx.complianceAuditCycle.update({
            where: { id: parsed.data.cycleId },
            data: { status: ComplianceCycleStatus.PAGAENDE },
          })

          return { itemCount: resolvedIds.length }
        },
        { timeout: 10_000 } // 10s ceiling for 500-item worst case (NFR1 / IV2).
      )

      if (
        requestedItemCount !== null &&
        result.itemCount < requestedItemCount
      ) {
        const missing = requestedItemCount - result.itemCount
        // Swedish inflection: `dokument` is neuter-singular + neuter-plural
        // (same form for 1 and 2+). Adjective agreement: `valt` / `valda`.
        const valdWord = missing === 1 ? 'valt' : 'valda'
        warnings.push(
          `${missing} ${valdWord} dokument kunde inte materialiseras (borttagna eller inte längre i laglistan)`
        )
      }

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_audit_cycle',
        parsed.data.cycleId,
        'cycle_materialised',
        null,
        {
          itemCount: result.itemCount,
          resolvedScopeSummary: summariseResolvedScope(scope, result.itemCount),
        }
      )

      revalidatePath('/laglistor/kontroller')
      return {
        success: true,
        data: { itemCount: result.itemCount },
        ...(warnings.length > 0 ? { warnings } : {}),
      }
    }, 'tasks:edit')
  } catch (error) {
    if (error instanceof Error && error.message === 'EMPTY_SCOPE') {
      return { success: false, error: 'Omfattningen matchar inga dokument' }
    }
    console.error('materialiseCycleItems error:', error)
    return { success: false, error: 'Kunde inte materialisera kontrollen' }
  }
}
