'use server'

/**
 * Story 5.5b + 5.5c — workspace usage server actions.
 *
 * Thin wrappers around lib/usage/* helpers that bind workspace scope via
 * getWorkspaceContext(). UI code (Epic 17 file browser, 5.5c billing
 * dashboard widget) imports from here so the workspace-context permission
 * boundary is enforced at the action boundary.
 */

import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { prisma } from '@/lib/prisma'
import {
  getEffectiveLimits,
  isUnlimited,
  tokensToApproxQueries,
} from '@/lib/usage/limits'
import { getCachedAddonSeatCount } from '@/lib/usage/seat-cache'
import {
  getStorageUsage as computeStorageUsage,
  type StorageUsage,
} from '@/lib/usage/storage'

/**
 * Snapshot of the current workspace's storage usage.
 * Returns 0% for Enterprise — caller decides how to render that case.
 */
export async function getWorkspaceStorageUsage(): Promise<StorageUsage> {
  const context = await getWorkspaceContext()
  return computeStorageUsage(context.workspaceId)
}

// ----------------------------------------------------------------------------
// Story 5.5c — combined usage summary for the billing-dashboard widget.
// ----------------------------------------------------------------------------

export interface WorkspaceUsageSummary {
  tokens: {
    used: number
    limit: number | null
    percentUsed: number
    approxQueriesRemaining: number | null
  }
  storage: StorageUsage
  seats: {
    used: number
    limit: number | null
  }
  /** Date the current period ends — caller renders the next-reset hint from this. */
  periodEnd: Date | null
}

/**
 * One-shot snapshot of the current workspace's usage across all three
 * dimensions (tokens, storage, seats). Used by the billing-dashboard
 * usage widget. Runs five reads in parallel — the Stripe call is cached
 * via Redis (5-min TTL) so warm requests take < 30ms.
 */
export async function getWorkspaceUsageSummary(): Promise<WorkspaceUsageSummary> {
  const context = await getWorkspaceContext()
  const workspaceId = context.workspaceId

  // Seat math must match lib/usage/seats.ts → computeSeatUsage exactly so
  // the dashboard widget shows the same "X / N" the gate enforces. That
  // means counting non-accepted PENDING invitations on top of joined
  // members — otherwise the widget reports 1/3 while the gate refuses at
  // 3/3. We mirror the math inline rather than calling computeSeatUsage
  // directly to avoid a duplicate workspace fetch + an uncached Stripe
  // call (we already have the Redis-cached add-on count below).
  const [workspace, usage, addonSeats, members, pendingInvites, storage] =
    await Promise.all([
      prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: {
          subscription_tier: true,
          trial_picked_tier: true,
          current_period_end: true,
        },
      }),
      prisma.workspaceUsage.findUnique({
        where: { workspace_id: workspaceId },
      }),
      getCachedAddonSeatCount(workspaceId),
      prisma.workspaceMember.count({ where: { workspace_id: workspaceId } }),
      prisma.workspaceInvitation.count({
        where: { workspace_id: workspaceId, status: 'PENDING' },
      }),
      computeStorageUsage(workspaceId),
    ])

  const limits = getEffectiveLimits(workspace, addonSeats)
  const tokensUsed = Number(usage?.tokens_used_this_period ?? BigInt(0))
  const tokenLimit = limits.aiTokensPerMonth

  return {
    tokens: {
      used: tokensUsed,
      limit: tokenLimit,
      percentUsed: isUnlimited(tokenLimit) ? 0 : tokensUsed / tokenLimit,
      approxQueriesRemaining: isUnlimited(tokenLimit)
        ? null
        : Math.max(0, tokensToApproxQueries(tokenLimit - tokensUsed)),
    },
    storage,
    seats: {
      used: members + pendingInvites,
      limit: limits.users,
    },
    periodEnd: workspace.current_period_end,
  }
}
