/**
 * Story 25.6 (Epic 25, B.6): component test for <OnboardingFab>.
 *
 * Covers the three visual states (working / done / idle), main-click vs
 * X-click behaviour with event-propagation, the runDismissAction wrapper
 * usage, and per-state aria-label.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockDismiss = vi.fn()
vi.mock('@/app/actions/onboarding-modal', () => ({
  dismissOnboardingFab: () => mockDismiss(),
}))

const mockRunDismissAction = vi.fn()
vi.mock('@/components/features/onboarding-modal/run-dismiss-action', () => ({
  runDismissAction: (action: () => unknown, label: string) =>
    mockRunDismissAction(action, label),
}))

import { OnboardingFab } from '@/components/features/onboarding-modal/onboarding-fab'

describe('<OnboardingFab>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: dismissal succeeds.
    mockRunDismissAction.mockResolvedValue(true)
    mockDismiss.mockResolvedValue({ ok: true })
  })

  it('renders working state with spinner + "Genererar laglista..." + aria-label', () => {
    render(<OnboardingFab fabState="working" onOpen={vi.fn()} />)

    expect(screen.getByText('Genererar laglista...')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Genererar laglista — öppna guiden' })
    ).toBeInTheDocument()
  })

  it('renders done state as circular lightbulb with "Öppna tutorial" aria-label', () => {
    render(<OnboardingFab fabState="done" onOpen={vi.fn()} />)

    // No "Genererar..." text in done mode
    expect(screen.queryByText('Genererar laglista...')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Öppna tutorial' })
    ).toBeInTheDocument()
  })

  it('renders idle state identically to done (same lightbulb + aria-label)', () => {
    render(<OnboardingFab fabState="idle" onOpen={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: 'Öppna tutorial' })
    ).toBeInTheDocument()
  })

  it('main click fires onOpen callback', () => {
    const onOpen = vi.fn()
    render(<OnboardingFab fabState="done" onOpen={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Öppna tutorial' }))

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('X-click does NOT fire onOpen AND calls runDismissAction with dismissOnboardingFab', async () => {
    const onOpen = vi.fn()
    const onDismissed = vi.fn()
    render(
      <OnboardingFab
        fabState="done"
        onOpen={onOpen}
        onDismissed={onDismissed}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dölj guide-knappen' }))

    await waitFor(() => {
      expect(mockRunDismissAction).toHaveBeenCalledWith(
        expect.any(Function),
        'dismissOnboardingFab'
      )
    })

    // event.stopPropagation prevents the parent button's onClick from firing
    expect(onOpen).not.toHaveBeenCalled()
    // onDismissed fires after successful runDismissAction
    expect(onDismissed).toHaveBeenCalledTimes(1)
  })

  it('onDismissed is NOT called when runDismissAction returns false', async () => {
    mockRunDismissAction.mockResolvedValueOnce(false)
    const onDismissed = vi.fn()
    render(
      <OnboardingFab
        fabState="working"
        onOpen={vi.fn()}
        onDismissed={onDismissed}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dölj guide-knappen' }))

    await waitFor(() => {
      expect(mockRunDismissAction).toHaveBeenCalled()
    })
    expect(onDismissed).not.toHaveBeenCalled()
  })

  // Story 25.6 v1.1 — celebrate variant.
  it('celebrate=true renders the Sparkles + "Er laglista är klar!" aria-label (instead of plain lightbulb)', () => {
    render(<OnboardingFab fabState="done" onOpen={vi.fn()} celebrate={true} />)

    expect(
      screen.getByRole('button', { name: 'Er laglista är klar — öppna guiden' })
    ).toBeInTheDocument()
    // Plain done aria-label should NOT be present
    expect(
      screen.queryByRole('button', { name: 'Öppna tutorial' })
    ).not.toBeInTheDocument()
  })

  it('celebrate=false (default) renders the existing lightbulb + "Öppna tutorial" aria-label', () => {
    render(<OnboardingFab fabState="done" onOpen={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: 'Öppna tutorial' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Er laglista är klar — öppna guiden',
      })
    ).not.toBeInTheDocument()
  })

  it('celebrate=true + fabState=working — working wins (no celebrate variant overlay)', () => {
    render(
      <OnboardingFab fabState="working" onOpen={vi.fn()} celebrate={true} />
    )

    // Working pill takes precedence over celebrate; aria-label is the working one.
    expect(
      screen.getByRole('button', { name: 'Genererar laglista — öppna guiden' })
    ).toBeInTheDocument()
  })

  it('aria-label changes between working ("Genererar laglista — öppna guiden") and done ("Öppna tutorial")', () => {
    const { rerender } = render(
      <OnboardingFab fabState="working" onOpen={vi.fn()} />
    )

    expect(
      screen.getByRole('button', { name: 'Genererar laglista — öppna guiden' })
    ).toBeInTheDocument()

    rerender(<OnboardingFab fabState="done" onOpen={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: 'Öppna tutorial' })
    ).toBeInTheDocument()
  })
})
