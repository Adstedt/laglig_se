/**
 * Story 25.4 (Epic 25, B.4): component test for <DoneImportStep>.
 *
 * Static presentation component — pure render + callback assertions.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DoneImportStep } from '@/components/features/onboarding-modal/done-import-step'

function renderStep(
  overrides: Partial<React.ComponentProps<typeof DoneImportStep>> = {}
) {
  const props = {
    counts: { highCount: 17, mediumCount: 8, unmatchedCount: 3 },
    importId: 'import-abc',
    onGoToReview: vi.fn(),
    onKeepExploring: vi.fn(),
    ...overrides,
  } as React.ComponentProps<typeof DoneImportStep>
  render(<DoneImportStep {...props} />)
  return props
}

describe('<DoneImportStep>', () => {
  it('renders confidence breakdown card with all three count tiles (heading owned by DialogTitle)', () => {
    renderStep()

    // Heading owned by <DialogTitle> in parent; body does NOT render an h3.
    expect(
      screen.queryByRole('heading', { name: 'Matchningen är klar' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText('Hög')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('Behöver bekräftelse')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Saknas')).toBeInTheDocument()
    expect(screen.getByText('Acceptera')).toBeInTheDocument()
    expect(screen.getByText('Välj kandidat')).toBeInTheDocument()
    expect(screen.getByText('Begär tillägg')).toBeInTheDocument()
  })

  it('calls onGoToReview when primary CTA clicked', () => {
    const onGoToReview = vi.fn()
    renderStep({ onGoToReview })

    fireEvent.click(screen.getByRole('button', { name: /Granska matchningar/ }))
    expect(onGoToReview).toHaveBeenCalledTimes(1)
  })

  it('Fortsätt utforska button is disabled in B.4', () => {
    renderStep()

    const button = screen.getByRole('button', { name: /Fortsätt utforska/i })
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  it('renders failure card in failed mode with support-ticket CTA (heading owned by DialogTitle)', () => {
    const onCreateSupportTicket = vi.fn()
    renderStep({
      mode: 'failed',
      onCreateSupportTicket,
      onCloseFailure: vi.fn(),
    })

    // No body h3 in failed mode — DialogTitle owns the heading.
    expect(
      screen.queryByRole('heading', { name: 'Matchningen misslyckades' })
    ).not.toBeInTheDocument()
    const supportButton = screen.getByRole('button', {
      name: /Skapa supportärende/,
    })
    expect(supportButton).toBeInTheDocument()
    fireEvent.click(supportButton)
    expect(onCreateSupportTicket).toHaveBeenCalledTimes(1)
  })
})
