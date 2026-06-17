'use client'

/**
 * Story 5.12: refreshed pricing section.
 *
 * Consumes the shared <TierCard> + lib/billing/tier-display.ts so prices and
 * feature copy are calibrated to v1 limits and stay in sync with onboarding.
 *
 * v1 is monthly-only — yearly Stripe Prices aren't wired (Story 5.4 only set
 * up monthly Prices). The yearly toggle is removed; restore it when annual
 * Prices ship.
 */
import { Check } from 'lucide-react'

import { TierCard } from '@/components/features/billing/tier-card'
import type { DisplayTier } from '@/lib/billing/tier-display'

interface MarketingTier {
  tier: DisplayTier
  popular?: boolean
  cta: string
  ctaHref: string
}

const TIERS: MarketingTier[] = [
  {
    tier: 'SOLO',
    cta: 'Kom igång',
    ctaHref: '/signup?plan=solo',
  },
  {
    tier: 'TEAM',
    popular: true,
    cta: 'Kom igång',
    ctaHref: '/signup?plan=team',
  },
  {
    tier: 'ENTERPRISE',
    cta: 'Kontakta oss',
    ctaHref: '/signup?plan=enterprise',
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="bg-section-cream py-12 md:py-20">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2
            className="font-safiro mb-4 text-3xl font-medium tracking-tight sm:text-4xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Enkla, transparenta priser
          </h2>
          <p className="text-lg text-muted-foreground">
            15 dagars gratis provperiod. Inget betalkort krävs.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 lg:grid-cols-3">
            {TIERS.map((entry) => (
              <TierCard
                key={entry.tier}
                tier={entry.tier}
                {...(entry.popular ? { popular: true } : {})}
                ctaLabel={entry.cta}
                ctaHref={entry.ctaHref}
              />
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <span>Ingen bindningstid</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <span>Följer GDPR</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <span>Data lagras i EU</span>
          </div>
        </div>
      </div>
    </section>
  )
}
