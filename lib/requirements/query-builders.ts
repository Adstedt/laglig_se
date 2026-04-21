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
 * Build the Prisma `where` clause for a given filter preset.
 * Both `getWorkspaceRequirements` and `getWorkspaceRequirementCounts`
 * consume this as the single source of truth.
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
