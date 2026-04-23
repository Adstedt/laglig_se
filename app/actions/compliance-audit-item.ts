'use server'

/**
 * Story 21.5: Cycle item read + mutation server actions.
 * Pattern mirrors app/actions/compliance-audit-cycle.ts.
 *
 * Exposes:
 *  - getCycleItemsForCycle (read)
 *  - updateItemBedomning, updateItemMotivering, signOffItem, unsignOffItem (mutations)
 *
 * NOTE: Story 21.10 will replace the inline `assertCycleEditableUi` helper
 * with `lib/compliance-audit/cycle-guards.ts#assertCycleEditable(tx, cycleId)`.
 * Every mutation carries a TODO(21.10) marker at the callback entry.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { logActivity } from '@/lib/services/activity-logger'
import {
  ComplianceCycleStatus,
  ComplianceStatus,
  EfterlevnadsBedomning,
} from '@prisma/client'
import type { KravpunkterSnapshot } from './compliance-audit-cycle'

// ============================================================================
// Types
// ============================================================================

/**
 * Local ActionResult shape — mirrors the convention used across server-action
 * modules (compare `app/actions/compliance-audit-cycle.ts:37-47` +
 * `app/actions/law-list-item-requirements.ts:25-29`). Each server-action
 * module declares its own; never imported across modules.
 */
interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface CyclePartial {
  id: string
  status: ComplianceCycleStatus
  name: string
  sealHash: string | null
}

export interface CycleItemRow {
  id: string
  lawListItemId: string
  lawTitle: string
  lawDocumentNumber: string
  groupId: string | null
  groupName: string | null
  sourceComplianceStatus: ComplianceStatus
  sourceResponsibleUser: { id: string; name: string | null } | null
  efterlevnadsbedomning: EfterlevnadsBedomning | null
  motivering: string | null
  reviewedAt: Date | null
  reviewedBy: { id: string; name: string | null } | null
  signedOffAt: Date | null
  signedOffBy: { id: string; name: string | null } | null
  kravpunkterSnapshot: KravpunkterSnapshot | null
  /**
   * Story 21.16 follow-up: live business-context from the source LawListItem
   * ("Hur påverkar detta oss?"). Surfaced read-only in the cycle-item modal
   * as audit context; edits continue to happen via the law-list-item modal
   * on /laglistor. Intentionally LIVE (not snapshot) so org-level context
   * updates reach the auditor mid-cycle.
   */
  businessContext: string | null
}

export interface GetCycleItemsResult {
  items: CycleItemRow[]
  cycle: CyclePartial
}

// ============================================================================
// Zod schemas
// ============================================================================

const GetCycleItemsSchema = z.object({ cycleId: z.string().uuid() })
const ItemIdOnlySchema = z.object({ itemId: z.string().uuid() })

const UpdateItemBedomningSchema = z.object({
  itemId: z.string().uuid(),
  efterlevnadsbedomning: z.nativeEnum(EfterlevnadsBedomning).nullable(),
})

const UpdateItemMotiveringSchema = z.object({
  itemId: z.string().uuid(),
  motivering: z.string().max(5000, 'Max 5000 tecken').nullable(),
})

// ============================================================================
// Module-private helpers
// ============================================================================

/**
 * Shared Prisma include for loading a ComplianceAuditItem with all relations
 * needed to build a CycleItemRow. Hoisted so both `getCycleItemsForCycle`
 * and every mutation-return-row path share the same shape.
 */
const CYCLE_ITEM_INCLUDE = {
  law_list_item: {
    // Story 21.16 follow-up: shift from `include` to `include + select` hybrid
    // by adding the `business_context` scalar. Prisma requires an explicit
    // select tree when we want scalars alongside relations; keep `include` on
    // the nested relations so their shapes stay identical to before.
    select: {
      id: true,
      compliance_status: true,
      group_id: true,
      business_context: true,
      document: { select: { title: true, document_number: true } },
      group: { select: { id: true, name: true, position: true } },
      responsible_user: { select: { id: true, name: true } },
    },
  },
  reviewed_by: { select: { id: true, name: true } },
  signed_off_by: { select: { id: true, name: true } },
} as const

type LoadedItem = {
  id: string
  cycle_id: string
  law_list_item_id: string
  efterlevnadsbedomning: EfterlevnadsBedomning | null
  motivering: string | null
  reviewed_at: Date | null
  reviewed_by_user_id: string | null
  signed_off_at: Date | null
  signed_off_by_user_id: string | null
  kravpunkter_snapshot: unknown
  law_list_item: {
    id: string
    compliance_status: ComplianceStatus
    group_id: string | null
    business_context: string | null
    document: { title: string; document_number: string }
    group: { id: string; name: string; position: number } | null
    responsible_user: { id: string; name: string | null } | null
  }
  reviewed_by: { id: string; name: string | null } | null
  signed_off_by: { id: string; name: string | null } | null
}

function mapRowToCycleItemRow(row: LoadedItem): CycleItemRow {
  return {
    id: row.id,
    lawListItemId: row.law_list_item_id,
    lawTitle: row.law_list_item.document.title,
    lawDocumentNumber: row.law_list_item.document.document_number,
    groupId: row.law_list_item.group?.id ?? null,
    groupName: row.law_list_item.group?.name ?? null,
    sourceComplianceStatus: row.law_list_item.compliance_status,
    sourceResponsibleUser: row.law_list_item.responsible_user
      ? {
          id: row.law_list_item.responsible_user.id,
          name: row.law_list_item.responsible_user.name,
        }
      : null,
    efterlevnadsbedomning: row.efterlevnadsbedomning,
    motivering: row.motivering,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by
      ? { id: row.reviewed_by.id, name: row.reviewed_by.name }
      : null,
    signedOffAt: row.signed_off_at,
    signedOffBy: row.signed_off_by
      ? { id: row.signed_off_by.id, name: row.signed_off_by.name }
      : null,
    kravpunkterSnapshot:
      (row.kravpunkter_snapshot as KravpunkterSnapshot | null) ?? null,
    businessContext: row.law_list_item.business_context,
  }
}

/**
 * Tenant-isolation helper. Mirrors `loadCycleScopedToWorkspace` in
 * compliance-audit-cycle.ts:178-185 but scoped to items via the cycle join.
 * Returns null on not-found OR cross-workspace — caller maps to the generic
 * Swedish error to avoid existence leakage.
 */
async function loadItemScopedToWorkspace(
  itemId: string,
  workspaceId: string
): Promise<
  (LoadedItem & { cycle: { id: string; status: ComplianceCycleStatus } }) | null
> {
  return prisma.complianceAuditItem.findFirst({
    where: { id: itemId, cycle: { workspace_id: workspaceId } },
    include: {
      ...CYCLE_ITEM_INCLUDE,
      cycle: { select: { id: true, status: true } },
    },
  }) as Promise<
    | (LoadedItem & { cycle: { id: string; status: ComplianceCycleStatus } })
    | null
  >
}

type EditableCheck = { ok: true } | { ok: false; error: string }

/**
 * TODO(21.10): replace with lib/compliance-audit/cycle-guards.ts#assertCycleEditable
 * once Story 21.10 ships. For now this inline check returns a structured ok/err
 * object (no throws across the server-action boundary).
 */
function assertCycleEditableUi(status: ComplianceCycleStatus): EditableCheck {
  if (
    status === ComplianceCycleStatus.SEALED ||
    status === ComplianceCycleStatus.ARKIVERAD
  ) {
    return {
      ok: false,
      error:
        'Kontrollen är fastställd eller arkiverad — ändringar är inte tillåtna.',
    }
  }
  return { ok: true }
}

// ============================================================================
// getCycleItemsForCycle (Story 21.5 AC 4)
// ============================================================================

export async function getCycleItemsForCycle(
  cycleId: string
): Promise<ActionResult<GetCycleItemsResult>> {
  const parsed = GetCycleItemsSchema.safeParse({ cycleId })
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
        select: { id: true, status: true, name: true, seal_hash: true },
      })
      if (!cycle) {
        return { success: false, error: 'Kontrollen hittades inte' }
      }

      const rows = (await prisma.complianceAuditItem.findMany({
        where: { cycle_id: cycle.id },
        include: CYCLE_ITEM_INCLUDE,
      })) as unknown as LoadedItem[]

      // Prisma's nested-relation orderBy on Json + nullable-FK combinations is
      // awkward; sort in memory: (group.position asc NULLS LAST, item.position asc, id asc).
      // LawListItem.position is intentionally included in the relation.
      const rowsWithPosition = rows as unknown as (LoadedItem & {
        law_list_item: LoadedItem['law_list_item'] & { position: number }
      })[]
      rowsWithPosition.sort((a, b) => {
        const aGroupPos =
          a.law_list_item.group?.position ?? Number.POSITIVE_INFINITY
        const bGroupPos =
          b.law_list_item.group?.position ?? Number.POSITIVE_INFINITY
        if (aGroupPos !== bGroupPos) return aGroupPos - bGroupPos
        const aItemPos = a.law_list_item.position ?? 0
        const bItemPos = b.law_list_item.position ?? 0
        if (aItemPos !== bItemPos) return aItemPos - bItemPos
        return a.id.localeCompare(b.id)
      })

      const items = rowsWithPosition.map((r) => mapRowToCycleItemRow(r))

      return {
        success: true,
        data: {
          items,
          cycle: {
            id: cycle.id,
            status: cycle.status,
            name: cycle.name,
            sealHash: cycle.seal_hash,
          },
        },
      }
    }, 'read')
  } catch (error) {
    console.error('getCycleItemsForCycle error:', error)
    return { success: false, error: 'Kunde inte hämta kontrolldokument' }
  }
}

// ============================================================================
// updateItemBedomning (Story 21.5 AC 6, 8, 10, 11)
// ============================================================================

export async function updateItemBedomning(input: {
  itemId: string
  efterlevnadsbedomning: EfterlevnadsBedomning | null
}): Promise<ActionResult<{ item: CycleItemRow }>> {
  const parsed = UpdateItemBedomningSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): assertCycleEditable(tx, cycleId) — transaction-participating guard.

      const existing = await loadItemScopedToWorkspace(
        parsed.data.itemId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Kontrollposten hittades inte' }
      }

      const guard = assertCycleEditableUi(existing.cycle.status)
      if (!guard.ok) {
        return { success: false, error: guard.error }
      }

      const previous = existing.efterlevnadsbedomning
      const next = parsed.data.efterlevnadsbedomning

      // Idempotent shortcut: no-op when value is unchanged. We still touch
      // `reviewed_at` conceptually (a review occurred) but writing on a no-op
      // would produce a useless activity-log row.
      if (previous === next) {
        return {
          success: true,
          data: { item: mapRowToCycleItemRow(existing) },
        }
      }

      // DEBT-001 fix: single-call update+include returns the refreshed row,
      // replacing the prior update→findFirst two-call pattern.
      const refreshed = (await prisma.complianceAuditItem.update({
        where: { id: parsed.data.itemId },
        data: {
          efterlevnadsbedomning: next,
          reviewed_at: new Date(),
          reviewed_by_user_id: ctx.userId,
        },
        include: CYCLE_ITEM_INCLUDE,
      })) as unknown as LoadedItem

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_audit_item',
        parsed.data.itemId,
        'cycle_item_bedomning_updated',
        { efterlevnadsbedomning: previous },
        { efterlevnadsbedomning: next }
      )

      revalidatePath(`/laglistor/kontroller/${existing.cycle.id}`)
      return { success: true, data: { item: mapRowToCycleItemRow(refreshed) } }
    }, 'tasks:edit')
  } catch (error) {
    console.error('updateItemBedomning error:', error)
    return { success: false, error: 'Kunde inte uppdatera bedömning' }
  }
}

// ============================================================================
// updateItemMotivering (Story 21.5 AC 6, 8, 10, 11)
// ============================================================================

export async function updateItemMotivering(input: {
  itemId: string
  motivering: string | null
}): Promise<ActionResult<{ item: CycleItemRow }>> {
  const parsed = UpdateItemMotiveringSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): assertCycleEditable(tx, cycleId) — transaction-participating guard.

      const existing = await loadItemScopedToWorkspace(
        parsed.data.itemId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Kontrollposten hittades inte' }
      }

      const guard = assertCycleEditableUi(existing.cycle.status)
      if (!guard.ok) {
        return { success: false, error: guard.error }
      }

      const previousLength = existing.motivering?.length ?? 0
      const nextLength = parsed.data.motivering?.length ?? 0

      // Idempotent shortcut: unchanged text is a no-op (no activity row).
      if ((existing.motivering ?? null) === (parsed.data.motivering ?? null)) {
        return {
          success: true,
          data: { item: mapRowToCycleItemRow(existing) },
        }
      }

      // DEBT-001 fix: single-call update+include.
      const refreshed = (await prisma.complianceAuditItem.update({
        where: { id: parsed.data.itemId },
        data: {
          motivering: parsed.data.motivering,
          reviewed_at: new Date(),
          reviewed_by_user_id: ctx.userId,
        },
        include: CYCLE_ITEM_INCLUDE,
      })) as unknown as LoadedItem

      // AC 11: log length only, never the raw text.
      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_audit_item',
        parsed.data.itemId,
        'cycle_item_motivering_updated',
        { old_length: previousLength },
        { new_length: nextLength }
      )

      revalidatePath(`/laglistor/kontroller/${existing.cycle.id}`)
      return { success: true, data: { item: mapRowToCycleItemRow(refreshed) } }
    }, 'tasks:edit')
  } catch (error) {
    console.error('updateItemMotivering error:', error)
    return { success: false, error: 'Kunde inte uppdatera motivering' }
  }
}

// ============================================================================
// signOffItem (Story 21.5 AC 6, 8, 10, 11)
// ============================================================================

export async function signOffItem(
  itemId: string
): Promise<ActionResult<{ item: CycleItemRow }>> {
  const parsed = ItemIdOnlySchema.safeParse({ itemId })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): assertCycleEditable(tx, cycleId) — transaction-participating guard.

      const existing = await loadItemScopedToWorkspace(
        parsed.data.itemId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Kontrollposten hittades inte' }
      }

      const guard = assertCycleEditableUi(existing.cycle.status)
      if (!guard.ok) {
        return { success: false, error: guard.error }
      }

      // Idempotent: already signed → no-op, return current row.
      if (existing.signed_off_at !== null) {
        return {
          success: true,
          data: { item: mapRowToCycleItemRow(existing) },
        }
      }

      // Business rule: bedömning required before sign-off.
      if (existing.efterlevnadsbedomning === null) {
        return {
          success: false,
          error: 'Ange bedömning innan signering',
        }
      }

      // DEBT-001 fix: single-call update+include.
      const now = new Date()
      const refreshed = (await prisma.complianceAuditItem.update({
        where: { id: parsed.data.itemId },
        data: {
          signed_off_at: now,
          signed_off_by_user_id: ctx.userId,
        },
        include: CYCLE_ITEM_INCLUDE,
      })) as unknown as LoadedItem

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_audit_item',
        parsed.data.itemId,
        'cycle_item_signed_off',
        null,
        { signedAt: now.toISOString(), signedByUserId: ctx.userId }
      )

      revalidatePath(`/laglistor/kontroller/${existing.cycle.id}`)
      return { success: true, data: { item: mapRowToCycleItemRow(refreshed) } }
    }, 'tasks:edit')
  } catch (error) {
    console.error('signOffItem error:', error)
    return { success: false, error: 'Kunde inte signera kontrollposten' }
  }
}

// ============================================================================
// unsignOffItem (Story 21.5 AC 6, 8, 10, 11)
// ============================================================================

export async function unsignOffItem(
  itemId: string
): Promise<ActionResult<{ item: CycleItemRow }>> {
  const parsed = ItemIdOnlySchema.safeParse({ itemId })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      // TODO(21.10): assertCycleEditable(tx, cycleId) — transaction-participating guard.

      const existing = await loadItemScopedToWorkspace(
        parsed.data.itemId,
        ctx.workspaceId
      )
      if (!existing) {
        return { success: false, error: 'Kontrollposten hittades inte' }
      }

      const guard = assertCycleEditableUi(existing.cycle.status)
      if (!guard.ok) {
        return { success: false, error: guard.error }
      }

      // Idempotent: already unsigned → no-op.
      if (existing.signed_off_at === null) {
        return {
          success: true,
          data: { item: mapRowToCycleItemRow(existing) },
        }
      }

      const previousSignedAt = existing.signed_off_at
      const previousSignedBy = existing.signed_off_by_user_id

      // DEBT-001 fix: single-call update+include.
      const refreshed = (await prisma.complianceAuditItem.update({
        where: { id: parsed.data.itemId },
        data: {
          signed_off_at: null,
          signed_off_by_user_id: null,
        },
        include: CYCLE_ITEM_INCLUDE,
      })) as unknown as LoadedItem

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_audit_item',
        parsed.data.itemId,
        'cycle_item_unsigned',
        {
          signedAt: previousSignedAt?.toISOString() ?? null,
          signedByUserId: previousSignedBy,
        },
        null
      )

      revalidatePath(`/laglistor/kontroller/${existing.cycle.id}`)
      return { success: true, data: { item: mapRowToCycleItemRow(refreshed) } }
    }, 'tasks:edit')
  } catch (error) {
    console.error('unsignOffItem error:', error)
    return { success: false, error: 'Kunde inte ångra signering' }
  }
}
