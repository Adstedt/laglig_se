/**
 * Story 25.4 (Epic 25, B.4): component test for <DoneGenerateStep>.
 *
 * Static presentation component with no external dependencies (no SWR, no
 * server actions, no router) — tests are pure render + callback assertions.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DoneGenerateStep } from '@/components/features/onboarding-modal/done-generate-step'

function renderStep(
  overrides: Partial<React.ComponentProps<typeof DoneGenerateStep>> = {}
) {
  const props = {
    itemCount: 42,
    groups: [
      { name: 'Miljö', count: 20 },
      { name: 'Arbetsmiljö', count: 22 },
    ],
    startedAt: null,
    onShowList: vi.fn(),
    onKeepExploring: vi.fn(),
    ...overrides,
  } as React.ComponentProps<typeof DoneGenerateStep>
  render(<DoneGenerateStep {...props} />)
  return props
}

describe('<DoneGenerateStep>', () => {
  it('renders hero + 2-column trust card + hedging note in success mode', () => {
    renderStep()

    // Heading owned by <DialogTitle>; body has no h3.
    expect(
      screen.queryByRole('heading', { name: 'Er laglista är klar' })
    ).not.toBeInTheDocument()
    // Hero: number + unit label baseline-aligned.
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('regelverk')).toBeInTheDocument()
    // 2-column trust card: methodology (left) + next steps (right).
    expect(screen.getByText('Detta gjorde vi')).toBeInTheDocument()
    expect(screen.getByText('Detta händer nu')).toBeInTheDocument()
    expect(screen.getByText('Läste er företagsprofil')).toBeInTheDocument()
    // SFS = svensk författningssamling, AFS = AV's föreskrifter. Including
    // EU-direktiv explicitly because the catalog covers EU docs too.
    expect(
      screen.getByText(/Sökte mot SFS, AFS, EU-direktiv och andra föreskrifter/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Skrev kort affärskontext per regelverk/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Granska listan och justera vid behov/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Vi håller koll på lagändringar åt er/)
    ).toBeInTheDocument()
    // Hedging note (demoted but still present for legal cover).
    expect(
      screen.getByText(/Bedöms vara relevanta utifrån er företagsprofil/)
    ).toBeInTheDocument()
    // Områden breakdown was removed post-smoke (redundant with /laglistor +
    // surfaced the LLM-grouping bug). Verify it's gone.
    expect(screen.queryByText('Områden:')).not.toBeInTheDocument()
    expect(screen.queryByText(/20 Miljö/)).not.toBeInTheDocument()
  })

  it('renders error message + retry CTA in failed mode (heading is owned by DialogTitle)', () => {
    const onRetry = vi.fn()
    renderStep({
      mode: 'failed',
      errorMessage: 'Något bröts vid genereringen',
      onRetry,
      onCloseFailure: vi.fn(),
    })

    // Body does NOT render an h3 in failed mode either — DialogTitle owns it.
    expect(
      screen.queryByRole('heading', { name: 'Något gick fel' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Något bröts vid genereringen')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Försök igen/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Stäng guiden/ })
    ).toBeInTheDocument()
  })

  it('calls onShowList when primary CTA clicked (success mode)', () => {
    const onShowList = vi.fn()
    renderStep({ onShowList })

    fireEvent.click(screen.getByRole('button', { name: /Visa min laglista/ }))
    expect(onShowList).toHaveBeenCalledTimes(1)
  })

  it('Fortsätt utforska button is disabled in B.4', () => {
    renderStep()

    const button = screen.getByRole('button', { name: /Fortsätt utforska/i })
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  it("renders '—' hero fallback when itemCount is null", () => {
    renderStep({ itemCount: null })

    // Hero shows em-dash; unit + trust card + hedging still render.
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('regelverk')).toBeInTheDocument()
    expect(screen.getByText('Detta gjorde vi')).toBeInTheDocument()
    expect(screen.getByText(/Bedöms vara relevanta/)).toBeInTheDocument()
  })

  it("renders 'identifierade på Xm Ys' duration line when startedAt is non-null", () => {
    const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000).toISOString()
    renderStep({ startedAt: fourMinutesAgo })

    expect(screen.getByText(/identifierade på 4 min/i)).toBeInTheDocument()
  })

  it('omits duration line when startedAt is null', () => {
    renderStep({ startedAt: null })

    expect(screen.queryByText(/identifierade på/i)).not.toBeInTheDocument()
  })
})
