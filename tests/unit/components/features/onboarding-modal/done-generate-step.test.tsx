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
  it('renders itemCount subheadline + group chips in success mode (heading owned by DialogTitle, not body)', () => {
    renderStep()

    // Heading is owned by <DialogTitle> in <FirstRunModal>; the body itself
    // does NOT render an h3 (post-cleanup copy-pass — see story 25.4 polish).
    expect(
      screen.queryByRole('heading', { name: 'Er laglista är klar' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/42 regelverk har lagts till\./)
    ).toBeInTheDocument()
    expect(screen.getByText(/20 Miljö/)).toBeInTheDocument()
    expect(screen.getByText(/22 Arbetsmiljö/)).toBeInTheDocument()
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

  it("renders '—' fallback when itemCount is null", () => {
    renderStep({ itemCount: null })

    expect(screen.getByText(/— regelverk har lagts till\./)).toBeInTheDocument()
  })

  it('renders no group-chip row when groups is null or empty', () => {
    const { rerender } = render(
      <DoneGenerateStep
        itemCount={42}
        groups={null}
        startedAt={null}
        onShowList={vi.fn()}
        onKeepExploring={vi.fn()}
      />
    )
    // No group chips appear when groups is null.
    expect(screen.queryByText(/Miljö/)).not.toBeInTheDocument()

    rerender(
      <DoneGenerateStep
        itemCount={42}
        groups={[]}
        startedAt={null}
        onShowList={vi.fn()}
        onKeepExploring={vi.fn()}
      />
    )
    expect(screen.queryByText(/Miljö/)).not.toBeInTheDocument()
  })

  it("renders 'Klart på Xm Ys' duration line when startedAt is non-null", () => {
    const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000).toISOString()
    renderStep({ startedAt: fourMinutesAgo })

    expect(screen.getByText(/Klart på 4 min/i)).toBeInTheDocument()
  })

  it('omits duration line when startedAt is null', () => {
    renderStep({ startedAt: null })

    expect(screen.queryByText(/Klart på/i)).not.toBeInTheDocument()
  })
})
