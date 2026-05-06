/**
 * Story 5.12: tier recommendation logic.
 *
 * Given the company info captured in onboarding (employee count + activity
 * flags + kollektivavtal), suggests the tier that best matches the workspace's
 * needs. Drives the "Rekommenderas för dig" badge on the tier-picker step.
 *
 * This is guidance, not a gate — users can override. The badge stays visible
 * even when the user's pre-selected tier (from `?plan=` URL) disagrees with
 * the recommendation.
 */
import type { ActivityFlags } from '@/app/onboarding/_components/activity-questions-step'

export type RecommendedTier = 'SOLO' | 'TEAM' | 'ENTERPRISE'

export interface RecommendationInput {
  /** Employee count from CompanyInfoStep. Undefined when user skipped. */
  employeeCount?: number
  /** Activity flags from ActivityQuestionsStep. */
  activityFlags: ActivityFlags
  /**
   * Kollektivavtal flag. In the wizard, `has_collective_agreement` lives
   * inside `activityFlags` until OnboardingWizard splits it out at submit.
   * Accept it from either surface to keep the call sites simple.
   */
  hasCollectiveAgreement?: boolean
}

export interface Recommendation {
  tier: RecommendedTier
  /** Swedish reason rendered under the matched tile. */
  reason: string
  /**
   * When true, the picker surface should show an "Större organisation? Prata
   * med oss om Enterprise" side-banner alongside the Team tile.
   */
  enterpriseHint: boolean
}

/**
 * Activity flags that strongly suggest Team-tier needs. These are the keys
 * exposed by lib/onboarding/question-selector.ts QUESTION_POOL — verified
 * against the v1 set 2026-05-05.
 *
 * `personalData` is excluded — it's `alwaysAsk: true` and almost universally
 * answered "yes", so it carries no tier signal.
 */
const TEAM_TRIGGER_FLAGS: ReadonlyArray<keyof ActivityFlags> = [
  'has_collective_agreement',
  'construction',
  'food',
  'chemicals',
  'publicSector',
  'minorEmployees',
  'heavyMachinery',
] as const

/** Human-readable Swedish names for the trigger flags, for the reason copy. */
const TRIGGER_FLAG_LABELS: Record<string, string> = {
  has_collective_agreement: 'kollektivavtal',
  construction: 'bygg- eller anläggningsverksamhet',
  food: 'livsmedelshantering',
  chemicals: 'kemikaliehantering',
  publicSector: 'myndighetsverksamhet',
  minorEmployees: 'minderåriga anställda',
  heavyMachinery: 'tunga maskiner',
}

function pickTriggeredFlag(
  flags: ActivityFlags,
  hasCollectiveAgreement?: boolean
): string | null {
  // hasCollectiveAgreement may live outside the activity-flags map (split out
  // by OnboardingWizard before submit). Check both surfaces.
  if (hasCollectiveAgreement === true) return 'has_collective_agreement'
  for (const key of TEAM_TRIGGER_FLAGS) {
    if (flags[key] === true) return String(key)
  }
  return null
}

export function recommendTier(input: RecommendationInput): Recommendation {
  const { employeeCount, activityFlags, hasCollectiveAgreement } = input
  const triggeredFlag = pickTriggeredFlag(activityFlags, hasCollectiveAgreement)

  // Larger organisations get the Enterprise hint regardless of flag triggers
  // (the picker surface renders this as a side-banner next to Team, not a
  // tier swap).
  const isLargeOrg = typeof employeeCount === 'number' && employeeCount > 20
  const enterpriseHint = isLargeOrg

  // Solo path: no employee data + no relevant flags. Defensive default.
  if (
    (employeeCount === undefined || employeeCount < 5) &&
    triggeredFlag === null
  ) {
    return {
      tier: 'SOLO',
      reason:
        'Solo räcker för enskilda firmor utan anställda eller särskilda riskmoment.',
      enterpriseHint: false,
    }
  }

  // Team path: 5-20 employees OR any trigger flag OR > 20 employees.
  // Build the reason using whichever signal(s) we have.
  const reasonParts: string[] = []
  if (typeof employeeCount === 'number' && employeeCount >= 5) {
    reasonParts.push(`du har ${employeeCount} anställda`)
  }
  if (triggeredFlag) {
    const label = TRIGGER_FLAG_LABELS[triggeredFlag] ?? triggeredFlag
    reasonParts.push(`verksamheten innefattar ${label}`)
  }

  let reason: string
  if (reasonParts.length === 0) {
    // Fallback (shouldn't fire given the conditions above, but guard anyway).
    reason =
      'Team passar växande verksamheter med flera användare och behov av samarbete.'
  } else {
    const head = reasonParts.join(' och ')
    reason = `${head.charAt(0).toUpperCase() + head.slice(1)} — Team inkluderar fler AI-frågor och samarbete för flera användare.`
  }

  return {
    tier: 'TEAM',
    reason,
    enterpriseHint,
  }
}
