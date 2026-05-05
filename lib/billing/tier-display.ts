/**
 * Story 5.12: tier display layer.
 *
 * Translates the raw enforcement limits in lib/usage/limits.ts into
 * marketing/onboarding display copy: tier name, description, monthly price,
 * feature bullets, AI-query estimate. Both surfaces (landing pricing-section
 * and the onboarding tier-picker step) consume getTierDisplay() so display +
 * enforcement cannot drift.
 *
 * v1 is monthly-only — no yearly Stripe Prices are wired today (Story 5.4
 * created STRIPE_SOLO_PRICE_ID / STRIPE_TEAM_PRICE_ID as monthly EUR/SEK
 * Prices). When yearly Prices ship, restore yearlyPriceSek + the toggle.
 *
 * TODO(yearly): restore yearlyPriceSek when annual Stripe Prices ship.
 */
import type { SubscriptionTier } from '@prisma/client'
import {
  TEAM_ADDON_PER_SEAT,
  TIER_LIMITS,
  tokensToApproxQueries,
} from '@/lib/usage/limits'

export type DisplayTier = Exclude<SubscriptionTier, 'TRIAL'>

export interface TierDisplay {
  /** Tier label as shown to users. */
  name: string
  /** One-line tagline for the tile header. */
  description: string
  /**
   * Monthly price in SEK (ex moms). null = "Anpassad" / sales-led tier.
   */
  monthlyPriceSek: number | null
  /** Bullet list rendered under the price. Order matters. */
  features: string[]
  /**
   * Short AI-query equivalent shown next to the AI-tokens bullet. Empty
   * string for tiers without a token cap (Enterprise).
   */
  aiQueriesEstimate: string
}

/**
 * Monthly SEK price constants. Source of truth = project_tier_pricing_v1.md
 * (memory, decided 2026-04-27). Mirrors Story 5.4's BillingDashboard tile
 * copy verbatim ("499 SEK / mån (ex moms)" → "499 SEK/mån" condensed here).
 */
const MONTHLY_PRICE_SEK: Record<DisplayTier, number | null> = {
  SOLO: 499,
  TEAM: 1299,
  ENTERPRISE: null,
}

const TIER_NAMES: Record<DisplayTier, string> = {
  SOLO: 'Solo',
  TEAM: 'Team',
  ENTERPRISE: 'Enterprise',
}

const TIER_DESCRIPTIONS: Record<DisplayTier, string> = {
  SOLO: 'För egenföretagare',
  TEAM: 'För växande team',
  ENTERPRISE: 'För större organisationer',
}

function formatGb(storageGB: number | null): string {
  if (storageGB === null) return 'Obegränsad lagring'
  return `${storageGB} GB lagring`
}

function formatUsers(users: number | null, tier: DisplayTier): string {
  if (users === null) return 'Obegränsat antal användare'
  if (tier === 'TEAM') {
    return `${users} användare ingår, +${MONTHLY_PRICE_SEK_ADDON_SEAT} SEK/extra plats`
  }
  return users === 1 ? '1 användare' : `${users} användare`
}

/**
 * Per-add-on-seat SEK price (Team only). Hardcoded display constant — there's
 * no Stripe Price wired for the add-on seat in v1, so this number is purely
 * informational on the landing/onboarding tiles. Source: project_tier_pricing_v1.md.
 */
const MONTHLY_PRICE_SEK_ADDON_SEAT = 300

function formatAiTokens(aiTokensPerMonth: number | null): string {
  if (aiTokensPerMonth === null) return 'Obegränsade AI-frågor'
  const queries = tokensToApproxQueries(aiTokensPerMonth)
  const tokensInM = aiTokensPerMonth / 1_000_000
  return `≈ ${queries} AI-frågor (${tokensInM}M tokens)`
}

function aiQueriesEstimate(aiTokensPerMonth: number | null): string {
  if (aiTokensPerMonth === null) return ''
  const queries = tokensToApproxQueries(aiTokensPerMonth)
  return `≈ ${queries} AI-frågor`
}

/**
 * Solo-only feature bullets — calibrated to v1 limits, sourced from
 * lib/usage/limits.ts where applicable.
 *
 * Marketing positioning: Solo is the entry tier — get the laglista, AI
 * assistant, change tracking, and basic task/document management. Compliance
 * audit workflow + version control unlock at Team.
 */
function buildSoloFeatures(): string[] {
  const limits = TIER_LIMITS.SOLO
  return [
    formatUsers(limits.users, 'SOLO'),
    'Personlig laglista (genererad)',
    formatAiTokens(limits.aiTokensPerMonth),
    // Differentiator: not a generic RSS feed of SFS amendments — Laglig
    // cross-references each change against the workspace's SNI + activity
    // flags + employee count to surface only the changes that actually
    // affect this company's compliance posture.
    'Lagändringar analyserade för er verksamhet',
    'Uppgifter & styrdokument',
    formatGb(limits.storageGB),
    'E-postsupport',
  ]
}

/**
 * Team adds the workflow surfaces that turn the laglista into an active
 * compliance system: lagefterlevnadskontroller (Epic 21), anmärkningar &
 * åtgärdsplaner (audit findings), and versioned styrdokument (Epic 17).
 *
 * NOTE (2026-05-05): "HR-modul" was previously listed here but the HR module
 * isn't built yet (per Story 5.5 parent spec — limits live in TIER_LIMITS but
 * enforcement is no-op'd). Removed from marketing copy until the module ships.
 */
function buildTeamFeatures(): string[] {
  const limits = TIER_LIMITS.TEAM
  return [
    formatUsers(limits.users, 'TEAM'),
    'Allt i Solo',
    'Lagefterlevnadskontroller',
    'Anmärkningar & åtgärdsplaner',
    'Styrdokument med versionshantering',
    formatAiTokens(limits.aiTokensPerMonth),
    formatGb(limits.storageGB),
    'Export (PDF, Excel)',
  ]
}

function buildEnterpriseFeatures(): string[] {
  const limits = TIER_LIMITS.ENTERPRISE
  return [
    formatUsers(limits.users, 'ENTERPRISE'),
    'Allt i Team',
    'API-integration & SSO',
    'Anpassade rapporter',
    formatAiTokens(limits.aiTokensPerMonth),
    formatGb(limits.storageGB),
    'SLA 99.9% & dedikerad kontaktperson',
  ]
}

const FEATURE_BUILDERS: Record<DisplayTier, () => string[]> = {
  SOLO: buildSoloFeatures,
  TEAM: buildTeamFeatures,
  ENTERPRISE: buildEnterpriseFeatures,
}

export function getTierDisplay(tier: DisplayTier): TierDisplay {
  const limits = TIER_LIMITS[tier]
  return {
    name: TIER_NAMES[tier],
    description: TIER_DESCRIPTIONS[tier],
    monthlyPriceSek: MONTHLY_PRICE_SEK[tier],
    features: FEATURE_BUILDERS[tier](),
    aiQueriesEstimate: aiQueriesEstimate(limits.aiTokensPerMonth),
  }
}

/**
 * Format a tier's monthly price for display. Returns "Anpassad" for the
 * sales-led Enterprise tier where monthlyPriceSek === null.
 */
export function formatMonthlyPrice(monthlyPriceSek: number | null): string {
  if (monthlyPriceSek === null) return 'Anpassad'
  return `${monthlyPriceSek.toLocaleString('sv-SE')} SEK/mån`
}

/** Add-on seat SEK price exposed for tooltip/footer copy. */
export const ADDON_SEAT_MONTHLY_SEK = MONTHLY_PRICE_SEK_ADDON_SEAT

/** Re-export TEAM_ADDON_PER_SEAT for surfaces that show the limit deltas. */
export { TEAM_ADDON_PER_SEAT }
