/**
 * Pure Prisma query builders for kravpunkter aggregation.
 *
 * Lives outside `app/actions/*` for the same reason as
 * `lib/requirements/helpers.ts`: Next.js 16 Turbopack enforces that every
 * export from a `'use server'` file is an async function. Pure `where`
 * clause composition doesn't belong in a server-actions module.
 *
 * Consumed by:
 *   - `app/actions/workspace-requirements.ts` — Story 20.2 aggregation.
 *   - `tests/unit/app/actions/workspace-requirements.test.ts` — branch +
 *     parity tests against the resolver.
 */

import type { Prisma } from '@prisma/client'

export const REQUIREMENT_FILTER_VALUES = [
  'all',
  'gaps',
  'mine',
  'needs_evidence',
] as const

export type WorkspaceRequirementsFilter =
  (typeof REQUIREMENT_FILTER_VALUES)[number]

/**
 * Multi-select facet filters, AND-composed on top of the active preset +
 * search. Orthogonal to the presets: a `laglistaIds` facet narrows by which
 * law list a krav belongs to; `responsibleUserIds` narrows by the krav's
 * *effective* assignee (direct override, else inherited from the list item).
 */
export interface RequirementFacets {
  laglistaIds?: string[] | undefined
  responsibleUserIds?: string[] | undefined
}

/**
 * Build the Prisma `where` clause for a given filter preset (+ optional
 * search + facets). Both `getWorkspaceRequirements` and
 * `getWorkspaceRequirementCounts` consume this as the single source of truth.
 *
 * Invariant: when no search/facets are supplied the output is byte-identical
 * to the preset-only clause — empty facet arrays add no keys.
 */
export function buildRequirementWhere(
  ctx: { workspaceId: string; userId: string },
  filter: WorkspaceRequirementsFilter,
  search?: string,
  facets?: RequirementFacets
): Prisma.LawListItemRequirementWhereInput {
  const laglistaIds = (facets?.laglistaIds ?? []).filter(Boolean)
  const responsibleUserIds = (facets?.responsibleUserIds ?? []).filter(Boolean)

  const workspaceScope: Prisma.LawListItemWhereInput = {
    law_list: {
      workspace_id: ctx.workspaceId,
      ...(laglistaIds.length > 0 ? { id: { in: laglistaIds } } : {}),
    },
  }

  // Effective-assignee facet — mirrors the `mine` preset's resolution: a krav
  // matches if its direct override is in the set, OR (no override) its list
  // item's assignee is. Lives inside `AND` so it composes with the `mine`
  // preset's own top-level `OR` without colliding on the `OR` key.
  const andClauses: Prisma.LawListItemRequirementWhereInput[] = []
  if (responsibleUserIds.length > 0) {
    andClauses.push({
      OR: [
        { responsible_user_id: { in: responsibleUserIds } },
        {
          responsible_user_id: null,
          list_item: { responsible_user_id: { in: responsibleUserIds } },
        },
      ],
    })
  }

  const base: Prisma.LawListItemRequirementWhereInput = {
    list_item: workspaceScope,
    ...(search && search.trim().length > 0
      ? { text: { contains: search.trim(), mode: 'insensitive' as const } }
      : {}),
    ...(andClauses.length > 0 ? { AND: andClauses } : {}),
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
