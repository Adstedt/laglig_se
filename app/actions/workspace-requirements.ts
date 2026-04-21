'use server'

/**
 * Story 20.2 — workspace-scoped krav aggregation.
 * See docs/stories/20.2.workspace-krav-aggregation-action.md.
 *
 * Provides:
 *   - getWorkspaceRequirements({ filter, search?, sort?, cursor?, limit? })
 *       Paged cursor-based read of every kravpunkt in the active workspace,
 *       with four filter presets (`all` / `gaps` / `mine` / `needs_evidence`).
 *   - getWorkspaceRequirementCounts()
 *       Sibling action returning { all, gaps, mine, needs_evidence } counts
 *       for filter-chip badges — powered by the same buildRequirementWhere
 *       helper so the two actions stay in sync.
 *
 * Consumed by Story 20.3 (`/krav` route + table UI).
 *
 * Effective-assignee resolution uses `resolveEffectiveAssignee` from
 * Story 20.1 on every row — the single source of truth shared with the
 * legal-document-modal's kravpunkter checklist. The `mine` SQL filter and
 * the resolver stay in parity via a dedicated unit test.
 *
 * Usage example for Story 20.3's SWR fetcher:
 *   const result = await getWorkspaceRequirements({
 *     filter: 'gaps',
 *     sort: { field: 'updated_at', direction: 'desc' },
 *     limit: 50,
 *   })
 *   if (result.success) { const { items, nextCursor } = result.data }
 */

import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import {
  resolveEffectiveAssignee,
  type EffectiveAssignee,
} from '@/lib/requirements/helpers'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

const FILTER_VALUES = ['all', 'gaps', 'mine', 'needs_evidence'] as const
export type WorkspaceRequirementsFilter = (typeof FILTER_VALUES)[number]

const SORT_FIELDS = [
  'updated_at',
  'law_name',
  'laglista_name',
  'is_fulfilled',
] as const
export type WorkspaceRequirementsSortField = (typeof SORT_FIELDS)[number]

const SORT_DIRECTIONS = ['asc', 'desc'] as const
export type WorkspaceRequirementsSortDirection =
  (typeof SORT_DIRECTIONS)[number]

export interface GetWorkspaceRequirementsInput {
  filter: WorkspaceRequirementsFilter
  search?: string
  sort?: {
    field: WorkspaceRequirementsSortField
    direction: WorkspaceRequirementsSortDirection
  }
  cursor?: string
  limit?: number
}

export interface WorkspaceRequirementRow {
  id: string
  text: string
  comment: string | null
  isFulfilled: boolean
  bevisRequired: boolean
  responsibleUserId: string | null
  effectiveAssignee: EffectiveAssignee
  evidenceCount: number
  lawItemId: string
  lawId: string
  lawName: string
  laglistaId: string
  laglistaName: string
  updatedAt: Date
}

export type GetWorkspaceRequirementsResult = ActionResult<{
  items: WorkspaceRequirementRow[]
  nextCursor: string | null
}>

export type GetWorkspaceRequirementCountsResult = ActionResult<{
  all: number
  gaps: number
  mine: number
  needs_evidence: number
}>

// ============================================================================
// Zod schema
// ============================================================================

const DEFAULT_LIMIT = 50

const GetWorkspaceRequirementsSchema = z.object({
  filter: z.enum(FILTER_VALUES),
  search: z.string().max(200).optional(),
  sort: z
    .object({
      field: z.enum(SORT_FIELDS),
      direction: z.enum(SORT_DIRECTIONS),
    })
    .optional(),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).optional(),
})

// ============================================================================
// Shared helpers
// ============================================================================

/**
 * Build the Prisma `where` clause for a given filter preset.
 * Exported so Story 20.3 can mirror it client-side if it ever needs to
 * (e.g., to display a filter-description string). Both actions in this
 * file consume it as the single source of truth.
 */
export function buildRequirementWhere(
  ctx: { workspaceId: string; userId: string },
  filter: WorkspaceRequirementsFilter,
  search?: string
): Prisma.LawListItemRequirementWhereInput {
  const workspaceScope: Prisma.LawListItemWhereInput = {
    law_list: { workspace_id: ctx.workspaceId },
  }

  const base: Prisma.LawListItemRequirementWhereInput = {
    list_item: workspaceScope,
    ...(search && search.trim().length > 0
      ? { text: { contains: search.trim(), mode: 'insensitive' as const } }
      : {}),
  }

  switch (filter) {
    case 'all':
      return base
    case 'gaps':
      return { ...base, is_fulfilled: false }
    case 'mine':
      return {
        ...base,
        OR: [
          { responsible_user_id: ctx.userId },
          {
            responsible_user_id: null,
            list_item: {
              ...workspaceScope,
              responsible_user_id: ctx.userId,
            },
          },
        ],
      }
    case 'needs_evidence':
      return {
        ...base,
        bevis_required: true,
        evidence_links: { none: {} },
      }
  }
}

type OrderByEntry = Prisma.LawListItemRequirementOrderByWithRelationInput

function buildOrderBy(
  sort: GetWorkspaceRequirementsInput['sort']
): OrderByEntry[] {
  const field = sort?.field ?? 'updated_at'
  const direction = sort?.direction ?? 'desc'

  switch (field) {
    case 'updated_at':
      return [{ updated_at: direction }, { id: 'asc' }]
    case 'is_fulfilled':
      return [{ is_fulfilled: direction }, { id: 'asc' }]
    case 'law_name':
      return [{ list_item: { document: { title: direction } } }, { id: 'asc' }]
    case 'laglista_name':
      return [{ list_item: { law_list: { name: direction } } }, { id: 'asc' }]
  }
}

// ============================================================================
// getWorkspaceRequirements
// ============================================================================

export async function getWorkspaceRequirements(
  input: GetWorkspaceRequirementsInput
): Promise<GetWorkspaceRequirementsResult> {
  const parsed = GetWorkspaceRequirementsSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const take = parsed.data.limit ?? DEFAULT_LIMIT
      const where = buildRequirementWhere(
        ctx,
        parsed.data.filter,
        parsed.data.search
      )
      const orderBy = buildOrderBy(parsed.data.sort)

      const rows = await prisma.lawListItemRequirement.findMany({
        where,
        include: {
          list_item: {
            select: {
              id: true,
              responsible_user_id: true,
              document: { select: { id: true, title: true } },
              law_list: { select: { id: true, name: true } },
            },
          },
          _count: { select: { evidence_links: true } },
        },
        orderBy,
        take: take + 1,
        ...(parsed.data.cursor
          ? { cursor: { id: parsed.data.cursor }, skip: 1 }
          : {}),
      })

      const hasMore = rows.length > take
      const page = hasMore ? rows.slice(0, take) : rows
      const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null

      const items: WorkspaceRequirementRow[] = page.map((r) => ({
        id: r.id,
        text: r.text,
        comment: r.comment,
        isFulfilled: r.is_fulfilled,
        bevisRequired: r.bevis_required,
        responsibleUserId: r.responsible_user_id,
        effectiveAssignee: resolveEffectiveAssignee(
          { responsibleUserId: r.responsible_user_id },
          { responsibleUserId: r.list_item.responsible_user_id }
        ),
        evidenceCount: r._count.evidence_links,
        lawItemId: r.list_item.id,
        lawId: r.list_item.document.id,
        lawName: r.list_item.document.title,
        laglistaId: r.list_item.law_list.id,
        laglistaName: r.list_item.law_list.name,
        updatedAt: r.updated_at,
      }))

      return { success: true, data: { items, nextCursor } }
    }, 'read')
  } catch (error) {
    console.error('getWorkspaceRequirements error:', error)
    return { success: false, error: 'Kunde inte hämta kravpunkter' }
  }
}

// ============================================================================
// getWorkspaceRequirementCounts (sibling, powers Story 20.3 chip badges)
// ============================================================================

export async function getWorkspaceRequirementCounts(): Promise<GetWorkspaceRequirementCountsResult> {
  try {
    return await withWorkspace(async (ctx) => {
      const [all, gaps, mine, needs_evidence] = await Promise.all([
        prisma.lawListItemRequirement.count({
          where: buildRequirementWhere(ctx, 'all'),
        }),
        prisma.lawListItemRequirement.count({
          where: buildRequirementWhere(ctx, 'gaps'),
        }),
        prisma.lawListItemRequirement.count({
          where: buildRequirementWhere(ctx, 'mine'),
        }),
        prisma.lawListItemRequirement.count({
          where: buildRequirementWhere(ctx, 'needs_evidence'),
        }),
      ])

      return { success: true, data: { all, gaps, mine, needs_evidence } }
    }, 'read')
  } catch (error) {
    console.error('getWorkspaceRequirementCounts error:', error)
    return { success: false, error: 'Kunde inte hämta kravräkningar' }
  }
}
