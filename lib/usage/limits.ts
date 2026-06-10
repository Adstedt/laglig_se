/**
 * Story 5.5 — single source of truth for per-tier usage limits.
 *
 * Calibrated v1 limits per docs/stories/5.5.usage-limits-per-tier.md (parent
 * spec, v3.1) and project_tier_pricing_v1.md (memory). Margin reality check:
 * at 100% utilisation Solo runs at 82% margin, Team at 79%, add-on seat at
 * 85% — all above the 75% target. At the 2× hard cap (option B for v1) the
 * margin drops to 63-70%, accepted as runaway protection until 5.5d ships
 * Stripe metered overage.
 *
 * NO hardcoded limit values anywhere else in the codebase — every dimension
 * goes through getEffectiveLimits().
 */

import type { SubscriptionTier, Workspace } from '@prisma/client'

export interface UsageLimits {
  /** Workspace seats. null = unlimited (Enterprise). */
  users: number | null
  /**
   * Employees in the HR module.
   * DEFINED but NOT ENFORCED in v1 — HR module isn't built yet (Story 5.5a
   * AC 8). Limit values live here so the enforcement plumbing slots in
   * automatically when the module ships.
   */
  employees: number | null
  /** AI tokens included per billing period. null = unlimited (Enterprise). */
  aiTokensPerMonth: number | null
  /** Storage in GiB. */
  storageGB: number | null
}

// Calibrated v1 — see Story 5.5 parent spec for empirical basis.
//
// TRIAL falls through to Solo limits as a defensive default when a workspace
// has no `trial_picked_tier` set (older trials, or signup flows that haven't
// yet been updated to write the column). getEffectiveLimits() prefers
// trial_picked_tier when present, so this row only fires for the rare
// no-picked-tier case.
export const TIER_LIMITS: Record<SubscriptionTier, UsageLimits> = {
  TRIAL: {
    users: 1,
    employees: 5,
    aiTokensPerMonth: 3_000_000,
    storageGB: 1,
  },
  SOLO: {
    users: 1,
    employees: 5,
    aiTokensPerMonth: 3_000_000,
    storageGB: 1,
  },
  TEAM: {
    users: 3,
    employees: 20,
    aiTokensPerMonth: 9_000_000,
    storageGB: 5,
  },
  ENTERPRISE: {
    users: null,
    employees: null,
    aiTokensPerMonth: null,
    storageGB: 100,
  },
}

/**
 * Per-add-on-seat contribution beyond the Team base. Story 5.6 (Add-On
 * Purchase System, backlog) formalises the model; for v1 each add-on
 * SubscriptionItem on the Stripe subscription with a non-base Price ID counts
 * as one seat and adds these deltas. See lib/usage/seats.ts →
 * countActiveAddonSeats().
 */
export const TEAM_ADDON_PER_SEAT = {
  users: 1,
  aiTokensPerMonth: 1_500_000,
} as const

/** Workspace fields needed for limit resolution. */
export type LimitsWorkspace = Pick<
  Workspace,
  'subscription_tier' | 'trial_picked_tier'
>

/**
 * Resolve effective limits for a workspace.
 *
 * Resolution order:
 *   1. If `trial_picked_tier` is set, use that tier's limits (the workspace
 *      is trialing with the picked tier's caps until conversion).
 *   2. Otherwise use `subscription_tier`.
 *   3. For TEAM, add `addonSeatCount × TEAM_ADDON_PER_SEAT` to the relevant
 *      dimensions. Add-ons don't apply to Solo or Enterprise.
 */
export function getEffectiveLimits(
  workspace: LimitsWorkspace,
  addonSeatCount: number = 0
): UsageLimits {
  const effectiveTier =
    workspace.trial_picked_tier ?? workspace.subscription_tier
  const base = TIER_LIMITS[effectiveTier]

  if (effectiveTier !== 'TEAM' || addonSeatCount === 0) return base

  return {
    users:
      base.users === null
        ? null
        : base.users + addonSeatCount * TEAM_ADDON_PER_SEAT.users,
    employees: base.employees,
    aiTokensPerMonth:
      base.aiTokensPerMonth === null
        ? null
        : base.aiTokensPerMonth +
          addonSeatCount * TEAM_ADDON_PER_SEAT.aiTokensPerMonth,
    storageGB: base.storageGB,
  }
}

export function isUnlimited(limit: number | null): limit is null {
  return limit === null
}

// ----------------------------------------------------------------------------
// AI quota helpers — used by Story 5.5c (lib/usage/check.ts).
// Land here in 5.5a so the file isn't half-built across two stories.
// ----------------------------------------------------------------------------

/** Soft warning threshold — fraction of included quota. */
export const AI_SOFT_WARN_THRESHOLD = 0.8

/**
 * Hard cap multiplier — 2× included quota for v1 (option B).
 * Replaced by Stripe metered overage in Story 5.5d once telemetry calibrates
 * the per-token price.
 */
export const AI_HARD_CAP_MULTIPLIER = 2.0

export function tokensSoftWarn(limit: number | null): number | null {
  return isUnlimited(limit) ? null : Math.floor(limit * AI_SOFT_WARN_THRESHOLD)
}

export function tokensHardCap(limit: number | null): number | null {
  return isUnlimited(limit) ? null : Math.floor(limit * AI_HARD_CAP_MULTIPLIER)
}

/**
 * Display helper: convert a token count to an "≈ X AI-frågor" estimate.
 *
 * Counter formula (chat route 2026-05-05, fixed 2026-06-10): quota counts only
 * fresh input + output — cache_read and cache_write (subsets of Anthropic's
 * total inputTokens) are excluded as Story 14.26 infrastructure optimization,
 * not user-visible work. The original 30K divisor came from the Almåsa session
 * 2026-05-05, measured while the counter still included cached tokens; under
 * the corrected formula, June 2026 production data shows ~15K (fresh input +
 * output) per turn across mixed Sonnet 4.6 contexts including multi-step tool
 * use, so 15K is the fair proxy for "how many turns can a Solo workspace
 * afford within their 3M cap."
 */
export function tokensToApproxQueries(tokens: number): number {
  return Math.round(tokens / 15_000)
}
