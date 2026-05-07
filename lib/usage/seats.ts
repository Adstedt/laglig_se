/**
 * Story 5.5a — seat enforcement helpers.
 *
 * The chat hot path doesn't call into here (token quotas live in
 * lib/usage/check.ts, Story 5.5c). Seat checks fire on much rarer events —
 * invite-create + invite-accept — so a Stripe API call per check is fine.
 *
 * Story 5.6 (backlog) will formalise the add-on subscription shape. v1
 * counts SubscriptionItems whose Price ID isn't the base Team price as
 * add-on seats. If 5.6 picks a different shape, update
 * countActiveAddonSeats() and 5.5c's cache wrapper inherits the change.
 */

import { prisma } from '@/lib/prisma'
import { getEffectiveLimits, isUnlimited } from './limits'

/** Thrown when a seat-consuming operation would exceed the workspace's cap. */
export class SeatLimitExceededError extends Error {
  constructor(
    public currentSeats: number,
    public limit: number,
    public tier: string
  ) {
    super(`Seat limit reached: ${currentSeats}/${limit} (tier: ${tier})`)
    this.name = 'SeatLimitExceededError'
  }
}

/**
 * Thrown when Stripe is unreachable during a seat-related lookup.
 *
 * Story 5.5a: chose fail-closed for v1 — block the operation with a clean
 * retry-able error rather than allowing an over-cap write. Callers (the
 * route + acceptInvitation) map this to HTTP 503 / structured action error
 * with code STRIPE_UNAVAILABLE so the client can show a "try again" toast.
 */
export class StripeUnavailableError extends Error {
  constructor(public cause: unknown) {
    super('Stripe API unavailable during seat lookup', { cause })
    this.name = 'StripeUnavailableError'
  }
}

/**
 * Add-on seat count for a workspace. Currently always 0 — restore live
 * Stripe lookup when Story 5.6 (Add-On Purchase System) ships.
 */
export async function countActiveAddonSeats(
  _workspaceId: string
): Promise<number> {
  // Story 5.6 (Add-On Purchase System) is in backlog — there is no purchase
  // flow yet, so no workspace can have add-on seats. Short-circuit to 0 to
  // avoid a Stripe round-trip on every chat turn, which was a single point
  // of failure: any stale/test-mode stripe_subscription_id took down chat
  // for the whole workspace (TreDoffice AB, Sentry JAVASCRIPT-NEXTJS-3X).
  // Restore the live Stripe lookup when 5.6 ships.
  return 0
}

/**
 * Result shape of a seat-availability check. `pendingSeats` includes
 * non-expired PENDING invitations alongside current members so concurrent
 * invite-creates can't break the cap.
 */
export interface SeatUsage {
  used: number
  limit: number | null
  tier: string
  addonSeatCount: number
}

/**
 * Compute the current seat usage for a workspace.
 *
 * Used by:
 *   - assertSeatAvailable() — the gate
 *   - app/actions/seats.ts → getSeatUsage() — the team-tab UI counter
 */
export async function computeSeatUsage(
  workspaceId: string
): Promise<SeatUsage> {
  const [workspace, memberCount, pendingCount, addonSeatCount] =
    await Promise.all([
      prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { subscription_tier: true, trial_picked_tier: true },
      }),
      prisma.workspaceMember.count({
        where: { workspace_id: workspaceId },
      }),
      prisma.workspaceInvitation.count({
        where: { workspace_id: workspaceId, status: 'PENDING' },
      }),
      countActiveAddonSeats(workspaceId),
    ])

  const limits = getEffectiveLimits(workspace, addonSeatCount)
  const effectiveTier =
    workspace.trial_picked_tier ?? workspace.subscription_tier

  return {
    used: memberCount + pendingCount,
    limit: limits.users,
    tier: effectiveTier,
    addonSeatCount,
  }
}

/**
 * Throw if adding `additionalSeats` would push the workspace over its cap.
 *
 * Pending invitations count toward `used` so a workspace can't fire 10
 * invites in parallel and break the cap on accept. The accept path also
 * re-checks via this same helper for race protection (Story 5.5a AC 4).
 */
export async function assertSeatAvailable(
  workspaceId: string,
  additionalSeats: number = 1
): Promise<SeatUsage> {
  const usage = await computeSeatUsage(workspaceId)
  if (isUnlimited(usage.limit)) return usage

  if (usage.used + additionalSeats > usage.limit) {
    throw new SeatLimitExceededError(usage.used, usage.limit, usage.tier)
  }

  return usage
}
