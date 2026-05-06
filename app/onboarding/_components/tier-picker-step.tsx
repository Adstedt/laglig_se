'use client'

/**
 * Story 5.12: tier-picker step in onboarding wizard.
 *
 * Step 3 of 4 (between Verksamhet and Bekräfta). User picks Solo / Team /
 * Enterprise — pick is written to Workspace.trial_picked_tier (or for
 * Enterprise, trial_picked_tier='TEAM' + enterprise_inquiry_at = NOW()
 * in createWorkspace).
 *
 * Renders three TierCard tiles with a data-driven recommendation badge,
 * a trial callout above, and an Enterprise side-banner when employee count
 * suggests larger-org needs.
 */
import * as React from 'react'
import { Info, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TierCard } from '@/components/features/billing/tier-card'
import {
  recommendTier,
  type RecommendedTier,
} from '@/lib/onboarding/tier-recommendation'
import type { ActivityFlags } from './activity-questions-step'

const TIER_ORDER_DEFAULT: ReadonlyArray<RecommendedTier> = [
  'SOLO',
  'TEAM',
  'ENTERPRISE',
]

const CTA_LABELS: Record<RecommendedTier, string> = {
  SOLO: 'Välj Solo',
  TEAM: 'Välj Team',
  ENTERPRISE: 'Välj Enterprise',
}

const PRE_PICK_LABELS: Record<RecommendedTier, string> = {
  SOLO: 'Solo',
  TEAM: 'Team',
  ENTERPRISE: 'Enterprise',
}

export interface TierPickerStepProps {
  /** Pre-selected tier (e.g. from `?plan=team` URL via OnboardingStore). */
  defaultTier?: RecommendedTier
  /** Company context used to drive the recommendation badge. */
  companyContext: {
    employeeCount?: number
    activityFlags: ActivityFlags
    hasCollectiveAgreement?: boolean
  }
  onNext: (_tier: RecommendedTier) => void
  onBack: () => void
}

export function TierPickerStep({
  defaultTier,
  companyContext,
  onNext,
  onBack,
}: TierPickerStepProps) {
  const recommendation = React.useMemo(
    () => recommendTier(companyContext),
    [companyContext]
  )

  const [selectedTier, setSelectedTier] = React.useState<RecommendedTier>(
    () => defaultTier ?? recommendation.tier
  )

  // Recommended tier renders first so the data-driven match is the user's
  // first read; the others follow in default price-ascending order.
  const tierOrder = React.useMemo<ReadonlyArray<RecommendedTier>>(
    () => [
      recommendation.tier,
      ...TIER_ORDER_DEFAULT.filter((t) => t !== recommendation.tier),
    ],
    [recommendation.tier]
  )

  const handleNext = () => onNext(selectedTier)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-safiro text-2xl font-medium tracking-tight">
          Välj nivå för provperioden
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Välj nivån som matchar er verksamhet bäst — du kan ändra senare.
        </p>
      </div>

      {/* Trial callout */}
      <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Du provar gratis i 15 dagar med full åtkomst till den nivå du väljer.
          Ingen betalning krävs nu — du kan ändra eller säga upp när som helst
          innan provperioden slutar.
        </p>
      </div>

      {/* Pre-pick note (only when defaultTier was set from URL) */}
      {defaultTier && (
        <p className="text-sm text-muted-foreground">
          Ditt val från startsidan:{' '}
          <span className="font-medium text-foreground">
            {PRE_PICK_LABELS[defaultTier]}
          </span>
          . Vill du ändra?
        </p>
      )}

      {/* Tier tiles — stacked vertically because the onboarding wizard's
          parent layout is constrained to max-w-md (448px); 3 columns would
          collapse text mid-word. Marketing pricing-section keeps its grid
          layout via the same shared <TierCard>. Recommended tier renders
          first via the dynamic tierOrder above. */}
      <div className="space-y-4">
        {tierOrder.map((tier) => {
          const isSelected = selectedTier === tier
          const isRecommended = recommendation.tier === tier
          return (
            <TierCard
              key={tier}
              tier={tier}
              selected={isSelected}
              recommended={isRecommended}
              {...(isRecommended
                ? { recommendationReason: recommendation.reason }
                : {})}
              onSelect={() => setSelectedTier(tier)}
              ctaLabel={isSelected ? 'Vald' : CTA_LABELS[tier]}
              dimmed={!isSelected}
            />
          )
        })}
      </div>

      {/* Enterprise hint side-banner */}
      {recommendation.enterpriseHint && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Större organisation?</p>
            <p className="mt-1">
              Vi anpassar Enterprise efter er — välj Enterprise nedan så hör vi
              av oss inom 24 timmar för att stämma av era behov.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1"
        >
          Tillbaka
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          className="flex-1 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
        >
          Nästa
        </Button>
      </div>
    </div>
  )
}
