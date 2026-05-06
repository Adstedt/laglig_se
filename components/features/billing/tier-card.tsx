'use client'

/**
 * Story 5.12: shared TierCard atom.
 *
 * Renders a single tier tile (Solo / Team / Enterprise). Consumed by:
 *   - Marketing landing pricing-section (link CTA → /signup?plan=...)
 *   - Onboarding tier-picker step (onSelect → wizard state)
 *
 * Single source of truth for per-tier price + feature copy. Drives off
 * lib/billing/tier-display.ts which itself reads lib/usage/limits.ts so
 * display + enforcement cannot drift.
 *
 * Monthly-only in v1 — no isYearly prop. When yearly Stripe Prices ship,
 * restore the toggle here and in `lib/billing/tier-display.ts`.
 */
import Link from 'next/link'
import { ArrowRight, Check, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  formatMonthlyPrice,
  getTierDisplay,
  type DisplayTier,
} from '@/lib/billing/tier-display'

export interface TierCardProps {
  tier: DisplayTier
  /** Selected = wizard mode; renders ring + aria-pressed. */
  selected?: boolean
  /** Recommended = data-driven match; renders Sparkles badge. */
  recommended?: boolean
  /** Reasoning sentence rendered under the recommended badge. */
  recommendationReason?: string
  /** When provided, the tile becomes a button (wizard mode). */
  onSelect?: () => void
  /** Label for the CTA button (or tile-as-button text). */
  ctaLabel: string
  /**
   * Marketing-mode CTA link (e.g. /signup?plan=team). Ignored when onSelect
   * is set (wizard mode).
   */
  ctaHref?: string
  /**
   * Marketing-mode "Populärast" badge — separate from `recommended` so the
   * landing surface can keep its existing visual treatment.
   */
  popular?: boolean
  /**
   * When any sibling tile is selected (wizard mode), non-selected tiles dim
   * to opacity-70 to focus attention. Caller computes this — undefined or
   * false leaves the tile at full opacity.
   */
  dimmed?: boolean
}

export function TierCard({
  tier,
  selected,
  recommended,
  recommendationReason,
  onSelect,
  ctaLabel,
  ctaHref,
  popular,
  dimmed,
}: TierCardProps) {
  const display = getTierDisplay(tier)
  const isWizardMode = onSelect !== undefined
  const showRing = popular === true || recommended === true || selected === true

  const tileBody = (
    <div className="flex flex-1 flex-col p-6">
      {/* Tier header — Safiro must always pair with font-medium (only weight 500
          is registered in the project; font-bold/font-semibold falls back to
          system-ui per project memory). */}
      <div className="mb-4">
        <h3 className="font-safiro text-2xl font-medium tracking-tight">
          {display.name}
        </h3>
        <p className="text-sm text-muted-foreground">{display.description}</p>
      </div>

      {/* Price — Safiro on the digit (display lift). Unit stays in body sans
          for typographic contrast. Safiro must pair with font-medium only.
          Force NBSP for the thousands separator so "1 299" never wraps mid-
          number on narrow viewports (toLocaleString returns a regular space
          in some ICU builds). */}
      <div className="mb-6">
        {display.monthlyPriceSek !== null ? (
          <div className="flex items-baseline">
            <span
              className="font-safiro text-5xl font-medium tracking-tight"
              style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
            >
              {display.monthlyPriceSek
                .toLocaleString('sv-SE')
                .replace(/\s/g, ' ')}
            </span>
            <span className="ml-1.5 text-muted-foreground">SEK/mån</span>
          </div>
        ) : (
          <span
            className="font-safiro text-5xl font-medium tracking-tight"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            {formatMonthlyPrice(display.monthlyPriceSek)}
          </span>
        )}
      </div>

      {/* Features */}
      <ul className="mb-6 flex-1 space-y-3">
        {display.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span className="text-sm text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isWizardMode ? (
        <Button
          type="button"
          className="w-full"
          size="lg"
          variant={selected ? 'default' : 'outline'}
          onClick={onSelect}
          aria-pressed={selected ?? false}
        >
          {ctaLabel}
          {!selected && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      ) : (
        <Button
          className="w-full"
          size="lg"
          variant={popular ? 'default' : 'outline'}
          asChild
        >
          <Link href={ctaHref ?? '#'}>
            {ctaLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  )

  return (
    <div
      className={cn(
        'card-hover relative flex flex-col rounded-2xl border bg-card transition-all',
        showRing &&
          popular === true &&
          'border-primary shadow-lg shadow-primary/10 ring-1 ring-primary',
        showRing &&
          recommended === true &&
          popular !== true &&
          'border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500',
        showRing &&
          selected === true &&
          popular !== true &&
          recommended !== true &&
          'border-primary shadow-md ring-1 ring-primary',
        dimmed === true && 'opacity-70'
      )}
    >
      {/* Marketing "Populärast" badge */}
      {popular === true && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            Populärast
          </span>
        </div>
      )}

      {/* Wizard "Rekommenderas för dig" badge */}
      {recommended === true && popular !== true && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-white">
            <Sparkles className="h-3 w-3" />
            Rekommenderas för dig
          </span>
        </div>
      )}

      {tileBody}

      {/* Recommendation reason — rendered below the tile body so it's visible
          even if the user is scanning prices first. */}
      {recommended === true && recommendationReason && (
        <div className="border-t border-emerald-100 bg-emerald-50/50 px-6 py-3 text-xs text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-200">
          {recommendationReason}
        </div>
      )}
    </div>
  )
}
