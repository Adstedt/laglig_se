/**
 * Story 5.10 — Unit-economics cost constants and currency conversion.
 *
 * Reporting currency is **SEK** (founder accounting currency; tier prices are
 * native SEK). AI cost is stored in USD on ChatUsageEvent.cost_usd_estimate, so
 * it is converted to SEK here via the single `USD_TO_SEK` constant. All margin
 * math operates in SEK — never mix USD cost with SEK revenue.
 *
 * The PROVISIONAL values below let the rollup ship and read pessimistically
 * (margins won't falsely flash >80%). Replace each with the real figure from the
 * first post-launch Supabase/Vercel invoice; the report footer flags estimates.
 */

import type { SubscriptionTier } from '@prisma/client'

/** USD→SEK FX rate. PROVISIONAL — verify FX periodically. */
export const USD_TO_SEK = 10.5

/**
 * Storage cost per GB-month, SEK. PROVISIONAL — confirm vs the Supabase invoice
 * (≈ $0.021/GB·mo × FX).
 */
export const STORAGE_COST_SEK_PER_GB_MONTH = 0.22

/**
 * Flat per-active-workspace monthly allocation for DB / pgvector / compute, SEK.
 * PROVISIONAL — confirm against the blended Supabase + Vercel monthly bill ÷
 * active workspaces. We do NOT price pgvector per query (it is not separately
 * metered); NFR18 "vector query costs" is satisfied by this flat allocation.
 */
export const INFRA_FLAT_SEK_PER_WORKSPACE_MONTH = 5

/** Bytes per GB (binary) for storage-cost math. */
const BYTES_PER_GB = 1024 * 1024 * 1024

/** Convert a USD amount to SEK using the single documented FX constant. */
export function usdToSek(usd: number): number {
  return usd * USD_TO_SEK
}

/** Storage cost in SEK for a given byte count over one month. */
export function storageCostSek(storageBytes: bigint | number): number {
  const gb = Number(storageBytes) / BYTES_PER_GB
  return gb * STORAGE_COST_SEK_PER_GB_MONTH
}

/**
 * Monthly subscription revenue per tier, in SEK.
 * - TRIAL: 0 (no revenue → margin is N/A).
 * - SOLO / TEAM: fixed list price (Story 5.5z Phase 1).
 * - ENTERPRISE: `null` — sales-led / per-contract; never auto-priced. Callers
 *   must treat null as "manual revenue entry required" and exclude from
 *   auto-margin.
 */
export function tierMonthlyRevenueSek(tier: SubscriptionTier): number | null {
  switch (tier) {
    case 'TRIAL':
      return 0
    case 'SOLO':
      return 499
    case 'TEAM':
      return 1299
    case 'ENTERPRISE':
      return null
  }
}

/**
 * Gross margin % = (revenue − cost) / revenue × 100. Returns null when revenue
 * is 0/absent (TRIAL or Enterprise-without-manual-entry) to avoid a meaningless
 * or divide-by-zero result.
 */
export function grossMarginPct(
  revenueSek: number | null,
  totalCostSek: number
): number | null {
  if (revenueSek == null || revenueSek <= 0) return null
  return ((revenueSek - totalCostSek) / revenueSek) * 100
}

/** Margin below this % flags a workspace for review in the weekly report. */
export const MARGIN_ALERT_FLOOR_PCT = 60
/** Target gross margin (NFR18). */
export const MARGIN_TARGET_PCT = 80
