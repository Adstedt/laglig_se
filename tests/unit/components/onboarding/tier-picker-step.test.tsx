/**
 * Story 5.12 — TierPickerStep behavior tests.
 *
 * Covers AC 1, 4, 5, 7, 8, 10:
 *   - Pre-selection from defaultTier
 *   - Recommendation badge appears on the data-driven match per companyContext
 *   - Pre-pick banner ("Ditt val från startsidan") rendered only when
 *     defaultTier is set
 *   - Tillbaka / Nästa wired correctly
 *   - Enterprise selection enables Nästa (no booking blocker)
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TierPickerStep } from '@/app/onboarding/_components/tier-picker-step'

describe('TierPickerStep', () => {
  it('pre-selects the tile matching defaultTier', () => {
    render(
      <TierPickerStep
        defaultTier="TEAM"
        companyContext={{ activityFlags: {} }}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    // The Team tile button switches CTA label to "Vald" when selected.
    expect(screen.getByRole('button', { name: /^Vald$/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('shows the "Ditt val från startsidan" banner only when defaultTier is set', () => {
    const { rerender } = render(
      <TierPickerStep
        defaultTier="SOLO"
        companyContext={{ activityFlags: {} }}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    expect(screen.getByText(/Ditt val från startsidan/)).toBeInTheDocument()

    rerender(
      <TierPickerStep
        companyContext={{ activityFlags: {} }}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    expect(
      screen.queryByText(/Ditt val från startsidan/)
    ).not.toBeInTheDocument()
  })

  it('shows recommendation badge on Team when companyContext implies Team-fit', () => {
    render(
      <TierPickerStep
        companyContext={{
          employeeCount: 8,
          activityFlags: { has_collective_agreement: true },
        }}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    // Badge renders globally; the recommendation reason is what's tier-anchored.
    expect(screen.getByText('Rekommenderas för dig')).toBeInTheDocument()
    expect(screen.getByText(/8 anställda/)).toBeInTheDocument()
    expect(screen.getByText(/kollektivavtal/)).toBeInTheDocument()
  })

  it('shows the Enterprise side-banner when employeeCount > 20', () => {
    render(
      <TierPickerStep
        companyContext={{
          employeeCount: 25,
          activityFlags: {},
        }}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )
    expect(screen.getByText('Större organisation?')).toBeInTheDocument()
  })

  it('Tillbaka calls onBack; Nästa calls onNext with the selected tier', () => {
    const onBack = vi.fn()
    const onNext = vi.fn()
    render(
      <TierPickerStep
        defaultTier="SOLO"
        companyContext={{ activityFlags: {} }}
        onNext={onNext}
        onBack={onBack}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Tillbaka/i }))
    expect(onBack).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /^Nästa$/i }))
    expect(onNext).toHaveBeenCalledWith('SOLO')
  })

  it('clicking Enterprise tile selects it; Nästa fires with ENTERPRISE (no booking blocker)', () => {
    const onNext = vi.fn()
    render(
      <TierPickerStep
        companyContext={{ activityFlags: {} }}
        onNext={onNext}
        onBack={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Välj Enterprise/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Nästa$/i }))
    expect(onNext).toHaveBeenCalledWith('ENTERPRISE')
  })
})
