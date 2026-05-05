/**
 * Story 5.12 — TierCard render tests.
 *
 * Locks in (a) display copy comes from getTierDisplay (single source of truth
 * with lib/usage/limits.ts), (b) `recommended` adds the "Rekommenderas för
 * dig" badge, (c) `selected` adds aria-pressed + sets the CTA variant,
 * (d) marketing CTA renders with ctaHref link, wizard CTA fires onSelect.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TierCard } from '@/components/features/billing/tier-card'

describe('TierCard', () => {
  it('renders Solo price + a feature derived from TIER_LIMITS', () => {
    render(
      <TierCard tier="SOLO" ctaLabel="Kom igång" ctaHref="/signup?plan=solo" />
    )
    expect(screen.getByText('Solo')).toBeInTheDocument()
    expect(screen.getByText('499')).toBeInTheDocument()
    expect(screen.getByText('SEK/mån')).toBeInTheDocument()
    // Feature derived from TIER_LIMITS.SOLO
    expect(screen.getByText('1 användare')).toBeInTheDocument()
  })

  it('renders Enterprise as "Anpassad" (null monthlyPriceSek)', () => {
    render(
      <TierCard
        tier="ENTERPRISE"
        ctaLabel="Kontakta oss"
        ctaHref="/signup?plan=enterprise"
      />
    )
    expect(screen.getByText('Anpassad')).toBeInTheDocument()
  })

  it('recommended=true renders the "Rekommenderas för dig" badge + reason', () => {
    render(
      <TierCard
        tier="TEAM"
        recommended
        recommendationReason="Du har 8 anställda och kollektivavtal — Team."
        onSelect={() => {}}
        ctaLabel="Välj Team"
      />
    )
    expect(screen.getByText('Rekommenderas för dig')).toBeInTheDocument()
    expect(
      screen.getByText(/Du har 8 anställda och kollektivavtal/)
    ).toBeInTheDocument()
  })

  it('popular=true renders the "Populärast" marketing badge', () => {
    render(
      <TierCard
        tier="TEAM"
        popular
        ctaLabel="Kom igång"
        ctaHref="/signup?plan=team"
      />
    )
    expect(screen.getByText('Populärast')).toBeInTheDocument()
  })

  it('wizard mode (onSelect) fires the callback on click + sets aria-pressed when selected', () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <TierCard tier="SOLO" onSelect={onSelect} ctaLabel="Välj Solo" />
    )
    const button = screen.getByRole('button', { name: /Välj Solo/i })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledTimes(1)

    rerender(
      <TierCard tier="SOLO" selected onSelect={onSelect} ctaLabel="Vald" />
    )
    expect(screen.getByRole('button', { name: /Vald/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('marketing mode (ctaHref) renders an anchor link, not a button-with-onClick', () => {
    render(
      <TierCard tier="SOLO" ctaLabel="Kom igång" ctaHref="/signup?plan=solo" />
    )
    const link = screen.getByRole('link', { name: /Kom igång/i })
    expect(link).toHaveAttribute('href', '/signup?plan=solo')
  })
})
