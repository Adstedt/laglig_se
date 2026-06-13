/**
 * Story 5.10 — Unit-economics monthly rollup compute.
 *
 * Pure functions (no DB) so the margin math is unit-testable. The cron route
 * (app/api/cron/aggregate-costs) supplies the per-workspace inputs and persists
 * the result. All money is SEK.
 */

import type { SubscriptionTier } from '@prisma/client'
import {
  INFRA_FLAT_SEK_PER_WORKSPACE_MONTH,
  grossMarginPct,
  storageCostSek,
  tierMonthlyRevenueSek,
  usdToSek,
} from './constants'

export interface WorkspaceRollupInput {
  tier: SubscriptionTier
  /** Sum of ChatUsageEvent.cost_usd_estimate for the month (USD). */
  aiCostUsd: number
  /** Workspace storage at rollup time (bytes). */
  storageBytes: bigint | number
}

export interface WorkspaceRollup {
  aiCostSek: number
  infraCostSek: number
  totalCostSek: number
  /** null for ENTERPRISE (sales-led — manual revenue entry required). */
  revenueSek: number | null
  /** null when revenue is 0/absent (TRIAL or Enterprise-without-entry). */
  grossMarginPct: number | null
}

/**
 * Compute one workspace's monthly unit economics in SEK.
 *
 * - AI cost: USD → SEK via the documented FX constant.
 * - Infra cost: storage (bytes → GB × rate) + flat per-workspace allocation.
 * - Revenue: tier list price (Enterprise → null).
 * - Margin: (revenue − total_cost) / revenue, null when revenue is 0/absent.
 */
export function computeWorkspaceRollup(
  input: WorkspaceRollupInput
): WorkspaceRollup {
  const aiCostSek = usdToSek(input.aiCostUsd)
  const infraCostSek =
    storageCostSek(input.storageBytes) + INFRA_FLAT_SEK_PER_WORKSPACE_MONTH
  const totalCostSek = aiCostSek + infraCostSek
  const revenueSek = tierMonthlyRevenueSek(input.tier)
  return {
    aiCostSek,
    infraCostSek,
    totalCostSek,
    revenueSek,
    grossMarginPct: grossMarginPct(revenueSek, totalCostSek),
  }
}

/**
 * UTC month window for the month *before* `now` — [start, end).
 * `start` is the first instant of the prior month; `end` is the first instant
 * of the current month. Used both as the aggregation filter and as the
 * `WorkspaceCost.month` key (= `start`).
 */
export function priorMonthWindowUtc(now: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  )
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return { start, end }
}
