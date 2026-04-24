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
import {
  canCompleteOrRevertCycle,
  canSealCycle,
} from '@/lib/compliance-audit/authorization'
import { gatherSealEvidenceForCycle } from '@/lib/compliance-audit/gather-seal-evidence'
import {
  hashFileEvidence,
  hashDocumentEvidence,
} from '@/lib/compliance-audit/evidence-hash'
import { buildSealManifest } from '@/lib/compliance-audit/seal-manifest-builder'
import type {
  SealManifestInput,
  SealManifestItem,
  SealManifestFinding,
  SealManifestEvidence,
} from '@/lib/compliance-audit/seal-manifest-builder'
import { computeSealHash } from '@/lib/compliance-audit/seal-hash'
import { createHash } from 'node:crypto'
import {
  AuditType,
  ComplianceCycleStatus,
  ComplianceStatus,
  EfterlevnadsBedomning,
  Prisma,
  type ComplianceAuditCycle,
} from '@prisma/client'

/**
 * Story 21.9 — sentinel thrown inside the seal transaction when the
 * status-scoped `updateMany` matches zero rows (concurrent seal race).
 * Caught by the outer handler and mapped to a Swedish user-facing error.
 */
class SealRaceError extends Error {
  constructor() {
    super('CYCLE_STATUS_CHANGED')
    this.name = 'SealRaceError'
  }
}

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
  sealHash: string | null
  sealedAt: Date | null
  sealedBy: { id: string; name: string | null } | null
  createdBy: { id: string; name: string | null }
  deletedAt: Date | null
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
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.auditType !== undefined ||
      data.scheduledStart !== undefined ||
      data.scheduledEnd !== undefined ||
      data.lawChangeCutoffDate !== undefined ||
      data.leadAuditorUserId !== undefined,
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

// Story 21.9 — seal (AVSLUTAD → SEALED). SF-3: `.trim()` inside `.refine`
// is load-bearing — rejects whitespace-only override reasons that would
// otherwise pass a naive `.min(20)`.
const SealCycleSchema = z.object({
  cycleId: z.string().uuid(),
  overrideReason: z
    .string()
    .max(1000)
    .optional()
    .refine(
      (s) => s === undefined || s.trim().length >= 20,
      'Motivering måste vara minst 20 tecken (efter trimning)'
    ),
})

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
    sealHash: row.seal_hash,
    sealedAt: row.sealed_at,
    sealedBy: row.sealed_by
      ? { id: row.sealed_by.id, name: row.sealed_by.name }
      : null,
    createdBy: {
      id: row.created_by.id,
      name: row.created_by.name,
    },
    deletedAt: row.deleted_at,
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
      // TODO(21.10): assertCycleEditable(tx, cycleId) — reject writes on SEALED/ARKIVERAD.

      const existing = await loadCycleScopedToWorkspace(
        parsed.data.cycleId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Kontrollen hittades inte' }
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
      // TODO(21.10): assertCycleEditable(tx, cycleId) — reject writes on SEALED/ARKIVERAD.

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
 * `items.length > 0`. The transition is reversible via `revertCycleToPagaende`
 * until sealing (Story 21.9). Items, findings, and motivering all remain
 * editable post-complete; read-only only kicks in on SEALED/ARKIVERAD.
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
      // TODO(21.10): assertCycleEditable(tx, cycleId) — reject writes on SEALED/ARKIVERAD.

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

      const completedAt = new Date()
      await prisma.complianceAuditCycle.update({
        where: { id: parsed.data.cycleId },
        data: { status: ComplianceCycleStatus.AVSLUTAD },
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
      // TODO(21.10): assertCycleEditable(tx, cycleId) — reject writes on SEALED/ARKIVERAD.

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

      // Defensive: sealed cycles are already blocked by the status guard
      // (SEALED !== AVSLUTAD), but an explicit sealed-hash check gives future
      // logic a belt-and-braces barrier.
      if (existing.sealed_at !== null) {
        return {
          success: false,
          error: 'Förseglade kontroller kan inte återställas',
        }
      }

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
// sealCycle (Story 21.9)
// ============================================================================

/**
 * Story 21.9 — transition cycle from AVSLUTAD → SEALED with a tamper-evident
 * SHA-256 hash over a canonical manifest + frozen per-evidence SHA-256
 * snapshots. Irreversible per architecture §6.4; the only recovery path is
 * to create a new cycle.
 *
 * Gate: `tasks:edit` permission + runtime `canSealCycle` (OWNER/ADMIN via
 * `audit:seal` scope OR the cycle's lead auditor). See `lib/compliance-audit/
 * authorization.ts:52-67`. Open-AVVIKELSE gate (AC 6) — seal is blocked if
 * any open AVVIKELSE exists and no `overrideReason` was provided; override
 * is logged to ActivityLog + the canonical manifest.
 *
 * Transaction structure:
 *   1. Evidence gather (tx-participating, batched across all items).
 *   2. Per-evidence SHA-256 (OUTSIDE the tx — Storage I/O + compute that
 *      must not hold a Postgres connection).
 *   3. Manifest + hash (pure functions).
 *   4. Transactional persistence: status-scoped `updateMany`, snapshot
 *      `createMany`, report row upsert, ActivityLog.
 */
export async function sealCycle(input: {
  cycleId: string
  overrideReason?: string
}): Promise<ActionResult<{ cycle: CycleDetail }>> {
  const parsed = SealCycleSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  const { cycleId, overrideReason } = parsed.data

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): assertCycleEditable(tx, cycleId) — reject writes on SEALED/ARKIVERAD.

      const existing = await loadCycleScopedToWorkspace(
        cycleId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Kontrollen hittades inte' }
      }

      // Runtime authorization — SF-1: prismaClient is the first positional arg.
      const allowed = await canSealCycle(prisma, {
        role: ctx.role,
        userId: ctx.userId,
        cycleId,
        workspaceId: ctx.workspaceId,
      })
      if (!allowed) {
        return {
          success: false,
          error:
            "Endast revisionsledaren eller administratörer med behörighet 'audit:seal' kan fastställa kontrollen",
        }
      }

      if (existing.status !== ComplianceCycleStatus.AVSLUTAD) {
        return {
          success: false,
          error: 'Kontrollen kan bara fastställas från status Avslutad',
        }
      }

      // Defensive: AVSLUTAD with non-null sealed_at should be impossible
      // (sealed_at is only set by this action), but belt-and-braces matches
      // 21.6's revertCycleToPagaende guard style.
      if (existing.sealed_at !== null) {
        return {
          success: false,
          error: 'Kontrollen är redan fastställd',
        }
      }

      // -- Step 1: gather evidence refs (brief tx for a batched read) --
      const evidenceRefs = await prisma.$transaction(async (tx) => {
        return gatherSealEvidenceForCycle(cycleId, tx)
      })

      // -- Step 1b: integrity policy on linked styrdokument status.
      // v0.4 (INTEGRITY-001): hard-blocked if any DRAFT was linked.
      // v0.5 (PO softening): snapshot-and-accept-with-override — DRAFTs no
      // longer hard-block; instead they require an `overrideReason` (mirrors
      // the AVVIKELSE override pattern) and the acknowledged drafts are
      // locked into the canonical manifest + activity log so an external
      // auditor can later see "yes, these specific drafts were knowingly
      // included via override."
      //
      // Why DRAFT documents need acknowledgement: hashDocumentEvidence reads
      // `WorkspaceDocument.current_version`, which `autosaveDocument` mutates
      // IN-PLACE for DRAFT-state docs. So the seal-time hash will not match
      // the live content after any later edit. Override = "user has been told
      // about this fragility and accepts the consequence."
      const uniqueDocumentIds = Array.from(
        new Set(
          evidenceRefs
            .filter((r) => r.kind === 'DOCUMENT' && r.documentId !== null)
            .map((r) => r.documentId as string)
        )
      )
      let acknowledgedDraftDocs: { id: string; title: string }[] = []
      if (uniqueDocumentIds.length > 0) {
        const draftDocs = await prisma.workspaceDocument.findMany({
          where: {
            id: { in: uniqueDocumentIds },
            status: 'DRAFT',
          },
          select: { id: true, title: true },
        })
        if (draftDocs.length > 0 && overrideReason === undefined) {
          const titles = draftDocs.map((d) => d.title).join(', ')
          return {
            success: false,
            error: `Fastställande blockeras: ${draftDocs.length} styrdokument i utkast-status (${titles}). Ange en motivering för att fastställa trots utkast-styrdokument.`,
          }
        }
        // Override provided OR no drafts — capture acknowledged drafts for
        // the manifest + activity log (empty array when none).
        acknowledgedDraftDocs = draftDocs
      }

      // -- Step 2: pre-compute per-evidence SHA-256 OUTSIDE the seal tx --
      // Serial iteration respects the memory-ceiling (see evidence-hash.ts).
      const evidenceHashes = new Map<string, string>() // key: `${kind}:${evidenceId}`
      for (const ref of evidenceRefs) {
        const evidenceId = ref.kind === 'FILE' ? ref.fileId! : ref.documentId!
        const hashKey = `${ref.kind}:${evidenceId}`
        if (evidenceHashes.has(hashKey)) continue // already hashed this artifact
        try {
          const hash =
            ref.kind === 'FILE'
              ? await hashFileEvidence(evidenceId)
              : await hashDocumentEvidence(evidenceId)
          evidenceHashes.set(hashKey, hash)
        } catch {
          // AC 3 step 2: evidence lost between gather and hash → abort seal.
          return {
            success: false as const,
            error: 'Bevis har tagits bort under fastställandet. Försök igen.',
          }
        }
      }

      // -- Step 3: load full cycle metadata + items + findings for manifest --
      const [items, findings] = await Promise.all([
        prisma.complianceAuditItem.findMany({
          where: { cycle_id: cycleId },
          select: {
            id: true,
            law_list_item_id: true,
            efterlevnadsbedomning: true,
            motivering: true,
            reviewed_at: true,
            reviewed_by_user_id: true,
            signed_off_at: true,
            signed_off_by_user_id: true,
          },
        }),
        prisma.complianceFinding.findMany({
          where: { cycle_id: cycleId },
          select: {
            id: true,
            type: true,
            severity: true,
            title: true,
            description: true,
            root_cause: true,
            law_list_item_id: true,
            requirement_id: true,
            corrective_action_task_id: true,
            due_date: true,
            closed_at: true,
            closed_by_user_id: true,
          },
        }),
      ])

      // Open-AVVIKELSE gate (AC 6) — QA RACE-001 fix: derived from the findings
      // array we just loaded (same source of truth as what goes into the
      // manifest). Previously this used a separate count query that created a
      // narrow window where a newly-created AVVIKELSE could appear in the
      // manifest without triggering the override requirement.
      const openAvvikelsesCount = findings.filter(
        (f) => f.type === 'AVVIKELSE' && f.closed_at === null
      ).length
      if (openAvvikelsesCount > 0 && overrideReason === undefined) {
        return {
          success: false,
          error: `Fastställande blockeras: ${openAvvikelsesCount} öppna avvikelser. Ange en motivering för att fastställa trots öppna avvikelser.`,
        }
      }

      // -- Step 4: build manifest (hashes free-text fields for privacy/size) --
      const sealedAtInstant = new Date()
      const manifestItems: SealManifestItem[] = items.map((i) => ({
        id: i.id,
        lawListItemId: i.law_list_item_id,
        efterlevnadsbedomning: i.efterlevnadsbedomning ?? null,
        motiveringSha256: i.motivering
          ? createHash('sha256').update(i.motivering, 'utf8').digest('hex')
          : null,
        reviewedAt: i.reviewed_at?.toISOString() ?? null,
        reviewedByUserId: i.reviewed_by_user_id ?? null,
        signedOffAt: i.signed_off_at?.toISOString() ?? null,
        signedOffByUserId: i.signed_off_by_user_id ?? null,
      }))
      const manifestFindings: SealManifestFinding[] = findings.map((f) => ({
        id: f.id,
        type: f.type,
        severity: f.severity ?? null,
        title: f.title,
        descriptionSha256: createHash('sha256')
          .update(f.description, 'utf8')
          .digest('hex'),
        rootCauseSha256: f.root_cause
          ? createHash('sha256').update(f.root_cause, 'utf8').digest('hex')
          : null,
        lawListItemId: f.law_list_item_id ?? null,
        requirementId: f.requirement_id ?? null,
        correctiveActionTaskId: f.corrective_action_task_id ?? null,
        dueDate: f.due_date?.toISOString() ?? null,
        closedAt: f.closed_at?.toISOString() ?? null,
        closedByUserId: f.closed_by_user_id ?? null,
      }))
      const manifestEvidence: SealManifestEvidence[] = evidenceRefs.map(
        (r) => ({
          lawListItemId: r.lawListItemId,
          requirementId: r.requirementId,
          kind: r.kind,
          evidenceId: (r.fileId ?? r.documentId)!,
          sha256: evidenceHashes.get(`${r.kind}:${r.fileId ?? r.documentId}`)!,
        })
      )
      const manifestInput: SealManifestInput = {
        cycleId: existing.id,
        workspaceId: ctx.workspaceId,
        lawListId: existing.law_list_id,
        name: existing.name,
        auditType: existing.audit_type,
        scheduledStart: existing.scheduled_start.toISOString(),
        scheduledEnd: existing.scheduled_end.toISOString(),
        lawChangeCutoffDate: existing.law_change_cutoff_date.toISOString(),
        leadAuditorUserId: existing.lead_auditor_user_id,
        createdByUserId: existing.created_by_user_id,
        createdAt: existing.created_at.toISOString(),
        sealedAt: sealedAtInstant.toISOString(),
        sealedByUserId: ctx.userId,
        scopeDefinition:
          existing.scope_definition as unknown as ScopeDefinition,
        overrideReason: overrideReason ?? null,
        // v0.5: lock acknowledged DRAFT-styrdokument identities into the
        // canonical manifest. Always present (empty when no override or no
        // drafts) so the canonical hash shape stays stable across cycles.
        draftDocumentsAtSeal: acknowledgedDraftDocs.map((d) => ({
          id: d.id,
          title: d.title,
        })),
        items: manifestItems,
        findings: manifestFindings,
        evidence: manifestEvidence,
      }
      const sortedManifest = buildSealManifest(manifestInput)
      const { canonicalJson, hash } = computeSealHash(sortedManifest)

      // -- Step 5: seal transaction — status-scoped updateMany + snapshots + report --
      try {
        await prisma.$transaction(async (tx) => {
          // SF-2: status-scoped updateMany — race-safe without explicit locking.
          const updateResult = await tx.complianceAuditCycle.updateMany({
            where: { id: cycleId, status: ComplianceCycleStatus.AVSLUTAD },
            data: {
              status: ComplianceCycleStatus.SEALED,
              sealed_at: sealedAtInstant,
              sealed_by_user_id: ctx.userId,
              seal_hash: hash,
            },
          })
          if (updateResult.count !== 1) {
            throw new SealRaceError()
          }

          // Snapshot rows (SF-4: already deduped by gather-seal-evidence).
          if (evidenceRefs.length > 0) {
            await tx.complianceEvidenceSnapshot.createMany({
              data: evidenceRefs.map((r) => ({
                cycle_id: cycleId,
                law_list_item_id: r.lawListItemId,
                requirement_id: r.requirementId,
                evidence_kind: r.kind,
                evidence_file_id: r.fileId,
                evidence_document_id: r.documentId,
                evidence_sha256: evidenceHashes.get(
                  `${r.kind}:${r.fileId ?? r.documentId}`
                )!,
                captured_at: sealedAtInstant,
              })),
            })
          }

          // Report upsert — QA CONSTRAINT-001 fix: the `@@unique([cycle_id,
          // report_kind])` migration now enforces one-row-per-(cycle, kind) at
          // the DB level, so `upsert` is the idiomatic single-statement form.
          // SF-2's updateMany + count === 1 still serialises sealCycle, but
          // future multi-write callers (21.12 COMPLETE-kind regen) are now
          // safe here without extra schema churn.
          await tx.complianceAuditReport.upsert({
            where: {
              cycle_id_report_kind: {
                cycle_id: cycleId,
                report_kind: 'SEALED',
              },
            },
            create: {
              cycle_id: cycleId,
              report_kind: 'SEALED',
              generated_at: sealedAtInstant,
              manifest: canonicalJson as unknown as Prisma.InputJsonValue,
            },
            update: {
              generated_at: sealedAtInstant,
              manifest: canonicalJson as unknown as Prisma.InputJsonValue,
            },
          })

          // CONSIST-001 fix — write ActivityLog INSIDE the seal transaction
          // so the cycle_sealed audit-trail row is atomic with the cycle
          // status flip + snapshot rows + report row. Previously this was an
          // outside-transaction call that could leave a permanently-sealed
          // cycle with no activity log row if the log write failed post-commit
          // (the status guard prevents any retry).
          await tx.activityLog.create({
            data: {
              workspace_id: ctx.workspaceId,
              user_id: ctx.userId,
              entity_type: 'compliance_audit_cycle',
              entity_id: cycleId,
              action: 'cycle_sealed',
              old_value: { status: ComplianceCycleStatus.AVSLUTAD },
              // NH-1 privacy note: overrideReason is stored VERBATIM (not
              // hashed) in both new_value AND the seal manifest. External
              // certifieringsorgan must be able to read the rationale; do
              // NOT hash this field.
              new_value: {
                status: ComplianceCycleStatus.SEALED,
                sealHash: hash,
                sealedAt: sealedAtInstant.toISOString(),
                ...(overrideReason !== undefined
                  ? {
                      overrideReason,
                      openAvvikelsesAtSeal: openAvvikelsesCount,
                      // v0.5: list acknowledged DRAFT styrdokument so the
                      // activity-feed entry shows what was knowingly
                      // included via override (parallel to the manifest's
                      // draftDocumentsAtSeal lock-in).
                      ...(acknowledgedDraftDocs.length > 0
                        ? {
                            draftDocumentsAtSeal: acknowledgedDraftDocs.map(
                              (d) => ({ id: d.id, title: d.title })
                            ),
                          }
                        : {}),
                    }
                  : {}),
              },
            },
          })
        })
      } catch (txError) {
        if (txError instanceof SealRaceError) {
          return {
            success: false,
            error:
              'Kontrollens status ändrades under fastställandet. Försök igen.',
          }
        }
        throw txError
      }

      // (Step 6 ActivityLog was moved INSIDE the seal transaction above per
      // QA CONSIST-001 — the cycle_sealed audit-trail row is now atomic with
      // the status flip + snapshot + report writes.)

      revalidatePath('/laglistor/kontroller')
      revalidatePath(`/laglistor/kontroller/${cycleId}`)

      const cycle = await loadCycleDetailInline(cycleId, ctx.workspaceId)
      if (!cycle) {
        return {
          success: false,
          error: 'Kontrollen kunde inte hämtas efter fastställandet',
        }
      }

      // Story 21.12: eagerly render the sealed-kind PDF after the response
      // flushes. Non-fatal — the seal transaction is already committed; if
      // Puppeteer fails (cold-start timeout, transient Chromium crash), the
      // route handler's lazy-generation branch re-attempts on first download.
      // The dynamic import is necessary because `compliance-audit-report.ts`
      // imports from this file (createCycle/getCycleById), so a static import
      // here would create a cycle at module-load time.
      after(async () => {
        try {
          const { generateCycleReport } = await import(
            '@/app/actions/compliance-audit-report'
          )
          await generateCycleReport({ cycleId, kind: 'SEALED' })
        } catch (err) {
          console.error(
            '[sealCycle after] Eager PDF generation failed — lazy fallback armed:',
            err
          )
        }
      })

      return { success: true, data: { cycle } }
    }, 'tasks:edit')
  } catch (error) {
    console.error('sealCycle error:', error)
    return { success: false, error: 'Kunde inte fastställa kontrollen' }
  }
}

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
      // TODO(21.10): assertCycleEditable(tx, cycleId) — reject writes on SEALED/ARKIVERAD.

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
