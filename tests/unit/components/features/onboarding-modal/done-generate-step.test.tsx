/**
 * Story 25.4 (Epic 25, B.4): component test for <DoneGenerateStep>.
 *
 * v0.6 (2026-05-18): rewired for the side-by-side layout. The success-mode
 * body is now a 5-col grid with LEFT col explainer/CTAs and RIGHT col
 * mounting <LawListPreview> which self-fetches via SWR. The child SWR
 * is mocked here so the parent tests stay focused on the LEFT col copy +
 * callback contract.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Story 25.4 v0.6: <LawListPreview> child uses SWR. Mock returns no data
// so the preview renders its loading skeleton (out of scope for these
// tests). The dedicated law-list-preview.test.tsx covers the preview's
// own behaviour.
vi.mock('swr', () => ({ default: vi.fn(() => ({ isLoading: true })) }))

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
  it('renders LEFT col with eyebrow, hero, 3 sage-icon benefits, hedging + preview placeholder on RIGHT', () => {
    renderStep()

    // Heading owned by <DialogTitle>; body has no h3.
    expect(
      screen.queryByRole('heading', { name: 'Er laglista är klar' })
    ).not.toBeInTheDocument()
    // Eyebrow framing on LEFT col.
    expect(screen.getByText('Översikt')).toBeInTheDocument()
    // Hero: number + unit label paired.
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('regelverk')).toBeInTheDocument()
    // Explainer paragraph anchors what we did.
    expect(
      screen.getByText(/Vi har gått igenom Sveriges och EU:s lagstiftning/)
    ).toBeInTheDocument()
    // Three benefit items (sage-icon containers — same pattern as
    // tab-laglista.tsx). Benefit-focused (not process-focused like the
    // previous "Detta gjorde vi / Detta händer nu" pair).
    expect(screen.getByText('Skräddarsytt urval')).toBeInTheDocument()
    expect(
      screen.getByText('Ansvar och bevis per regelverk')
    ).toBeInTheDocument()
    expect(screen.getByText('AI bevakar lagändringar')).toBeInTheDocument()
    // Hedging note (legal cover, framed as invitation).
    expect(
      screen.getByText(/Bedöms vara relevanta utifrån er företagsprofil/)
    ).toBeInTheDocument()
    // RIGHT col: preview eyebrow + LawListPreview mounted.
    expect(
      screen.getByText(/Förhandsvisning · \/laglistor/)
    ).toBeInTheDocument()
    // SWR mock returns isLoading=true so preview shows skeleton (covered
    // dedicated in law-list-preview.test.tsx).
    expect(screen.getByTestId('law-list-preview-skeleton')).toBeInTheDocument()
    // Previous "Detta gjorde vi / Detta händer nu" structure is gone.
    expect(screen.queryByText('Detta gjorde vi')).not.toBeInTheDocument()
    expect(screen.queryByText('Detta händer nu')).not.toBeInTheDocument()
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
    // Failed mode does NOT mount the preview (the side-by-side layout is
    // success-mode only).
    expect(screen.queryByText(/Förhandsvisning/)).not.toBeInTheDocument()
  })

  it('calls onShowList when primary CTA clicked (success mode)', () => {
    const onShowList = vi.fn()
    renderStep({ onShowList })

    fireEvent.click(screen.getByRole('button', { name: /Visa min laglista/ }))
    expect(onShowList).toHaveBeenCalledTimes(1)
  })

  // Story 25.6 (B.6) — "Fortsätt utforska" is now enabled and calls
  // onKeepExploring on click (was disabled-with-tooltip in B.4).
  it('Fortsätt utforska fires onKeepExploring on click', () => {
    const onKeepExploring = vi.fn()
    renderStep({ onKeepExploring })

    fireEvent.click(screen.getByRole('button', { name: /Fortsätt utforska/i }))

    expect(onKeepExploring).toHaveBeenCalledTimes(1)
  })

  it("renders '—' hero fallback when itemCount is null", () => {
    renderStep({ itemCount: null })

    // Hero shows em-dash; unit + benefits + hedging still render.
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('regelverk')).toBeInTheDocument()
    expect(screen.getByText('Skräddarsytt urval')).toBeInTheDocument()
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

  // Story 25.6 v1.1 — onShown callback drives the FAB celebrate-variant
  // demotion via a per-workspace localStorage flag set in <HemPage>.
  it('fires onShown once on mount in success mode', () => {
    const onShown = vi.fn()
    renderStep({ onShown })

    expect(onShown).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire onShown in failed mode (failure is not a celebration)', () => {
    const onShown = vi.fn()
    renderStep({ mode: 'failed', errorMessage: 'boom', onShown })

    expect(onShown).not.toHaveBeenCalled()
  })
})
