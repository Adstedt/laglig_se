/**
 * Story 5.12 — ConfirmStep tier-aware copy + Enterprise branch tests.
 *
 * Closes a coverage gap flagged in QA review: AC 8 + AC 10 changed the
 * ConfirmStep contract (new pickedTier + onChangeTier props; Enterprise
 * branch with cal.com booking link) but no direct test exercised them.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ConfirmStep } from '@/app/onboarding/_components/confirm-step'
import type { WorkspaceOnboardingData } from '@/lib/validation/workspace'

const baseData: WorkspaceOnboardingData = {
  companyName: 'Acme AB',
  orgNumber: '556677-1234',
}

const baseProps = {
  data: baseData,
  onBack: vi.fn(),
  onSubmit: vi.fn(),
  isSubmitting: false,
  submitError: null,
  onGoBackToEdit: vi.fn(),
  onChangeTier: vi.fn(),
}

describe('ConfirmStep — tier-aware copy', () => {
  it('SOLO pick → renders "Provperiod: Solo" + 15-day callout, no Enterprise branch', () => {
    render(<ConfirmStep {...baseProps} pickedTier="SOLO" />)
    expect(
      screen.getByText(/Provperiod: Solo · 15 dagar gratis/)
    ).toBeInTheDocument()
    // Enterprise-only copy must not be present
    expect(
      screen.queryByText(/Vi har bett om kontakt om Enterprise/)
    ).not.toBeInTheDocument()
    // Booking link must not appear for Solo
    expect(screen.queryByRole('link', { name: /Boka samtal/ })).toBeNull()
  })

  it('TEAM pick → renders "Provperiod: Team" copy', () => {
    render(<ConfirmStep {...baseProps} pickedTier="TEAM" />)
    expect(
      screen.getByText(/Provperiod: Team · 15 dagar gratis/)
    ).toBeInTheDocument()
  })

  it('ENTERPRISE pick → renders the wait-for-sales copy + cal.com booking link', () => {
    render(<ConfirmStep {...baseProps} pickedTier="ENTERPRISE" />)
    expect(
      screen.getByText(/Vi har bett om kontakt om Enterprise/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Team-funktionalitet i 15 dagar/)
    ).toBeInTheDocument()
    const bookingLink = screen.getByRole('link', { name: /Boka samtal/ })
    expect(bookingLink).toHaveAttribute('href', 'https://cal.com/laglig/sales')
    expect(bookingLink).toHaveAttribute('target', '_blank')
    expect(bookingLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('"Ändra plan" link calls onChangeTier (Solo branch)', () => {
    const onChangeTier = vi.fn()
    render(
      <ConfirmStep
        {...baseProps}
        pickedTier="SOLO"
        onChangeTier={onChangeTier}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Ändra nivå/ }))
    expect(onChangeTier).toHaveBeenCalledTimes(1)
  })

  it('"Ändra plan" link calls onChangeTier (Enterprise branch)', () => {
    const onChangeTier = vi.fn()
    render(
      <ConfirmStep
        {...baseProps}
        pickedTier="ENTERPRISE"
        onChangeTier={onChangeTier}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Ändra nivå/ }))
    expect(onChangeTier).toHaveBeenCalledTimes(1)
  })

  it('Skapa workspace button label is unchanged for all tiers', () => {
    const { rerender } = render(
      <ConfirmStep {...baseProps} pickedTier="SOLO" />
    )
    expect(
      screen.getByRole('button', { name: /Skapa workspace/ })
    ).toBeInTheDocument()

    rerender(<ConfirmStep {...baseProps} pickedTier="ENTERPRISE" />)
    expect(
      screen.getByRole('button', { name: /Skapa workspace/ })
    ).toBeInTheDocument()
  })
})
