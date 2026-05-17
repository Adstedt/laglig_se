/**
 * Story 25.2 (Epic 25, B.2): component test for <TutorialStep>.
 *
 * Verifies the tab shell behaviour:
 *  - 6 tab buttons rendered with the correct labels (AC 16)
 *  - default tab is active on mount, fires tab_viewed for the default tab (AC 18)
 *  - switching tabs updates active styling, counter, and fires tab_viewed (AC 18)
 *  - re-clicking the active tab does NOT re-fire tab_viewed (AC 18)
 *  - Minimera button calls the onMinimise callback prop (AC 19)
 *  - <ProgressStrip> is mounted inside the step body (AC 14)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockRecordTabViewed = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/app/actions/onboarding-modal', () => ({
  recordTabViewed: (...args: unknown[]) => mockRecordTabViewed(...args),
}))

// Stub <ProgressStrip> so this test does not need to wire up SWR.
vi.mock('@/components/features/onboarding-modal/progress-strip', () => ({
  ProgressStrip: () => <div data-testid="progress-strip-stub" />,
}))

import { TutorialStep } from '@/components/features/onboarding-modal/tutorial-step'

describe('<TutorialStep>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 6 tab buttons with the correct labels', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)

    expect(
      screen.getByRole('tab', { name: /Vad är en laglista\?/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /Kravpunkter & bevis/ })
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Uppgifter/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Kontroller/ })).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /Lagändringar/ })
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /AI-agenten/ })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(6)
  })

  it('first tab is active on mount and fires tab_viewed once for the default tab', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)

    const firstTab = screen.getByRole('tab', {
      name: /Vad är en laglista\?/,
    })
    expect(firstTab).toHaveAttribute('aria-selected', 'true')

    expect(mockRecordTabViewed).toHaveBeenCalledTimes(1)
    expect(mockRecordTabViewed).toHaveBeenCalledWith('laglista')

    // Counter shows "1 av 6" initially
    expect(screen.getByText(/1 av 6/i)).toBeInTheDocument()
  })

  it('clicking a different tab updates active styling, fires tab_viewed, and updates the counter', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)

    fireEvent.click(screen.getByRole('tab', { name: /Uppgifter/ }))

    expect(screen.getByRole('tab', { name: /Uppgifter/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(
      screen.getByRole('tab', { name: /Vad är en laglista\?/ })
    ).toHaveAttribute('aria-selected', 'false')

    // Initial mount + click = 2 calls; second arg is the new tab id
    expect(mockRecordTabViewed).toHaveBeenCalledTimes(2)
    expect(mockRecordTabViewed).toHaveBeenLastCalledWith('uppgifter')

    expect(screen.getByText(/3 av 6/i)).toBeInTheDocument()
  })

  it('clicking the already-active tab does NOT re-fire tab_viewed (debounce)', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)
    expect(mockRecordTabViewed).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('tab', { name: /Vad är en laglista\?/ }))

    // Still 1 — clicking the active tab is a no-op.
    expect(mockRecordTabViewed).toHaveBeenCalledTimes(1)
  })

  it('Minimera button calls the onMinimise callback prop', () => {
    const onMinimise = vi.fn()
    render(<TutorialStep onMinimise={onMinimise} />)

    fireEvent.click(screen.getByRole('button', { name: /Minimera/ }))

    expect(onMinimise).toHaveBeenCalledTimes(1)
  })

  it('<ProgressStrip> renders inside the step body', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)
    expect(screen.getByTestId('progress-strip-stub')).toBeInTheDocument()
  })

  // QA-A11Y-001: ARIA tabs roving tabindex requires arrow-key handling so
  // keyboard users can reach inactive tabs (AC 26 minimum: "Tab key navigates
  // between tabs"). Without arrow keys, tabIndex={-1} on inactive tabs would
  // trap keyboard users on tab 1.
  it('ArrowRight moves selection to the next tab and fires tab_viewed', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)
    const firstTab = screen.getByRole('tab', { name: /Vad är en laglista\?/ })

    fireEvent.keyDown(firstTab, { key: 'ArrowRight' })

    expect(
      screen.getByRole('tab', { name: /Kravpunkter & bevis/ })
    ).toHaveAttribute('aria-selected', 'true')
    expect(mockRecordTabViewed).toHaveBeenLastCalledWith('kravpunkter')
  })

  it('ArrowLeft wraps from the first tab to the last (AI-agenten)', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)
    const firstTab = screen.getByRole('tab', { name: /Vad är en laglista\?/ })

    fireEvent.keyDown(firstTab, { key: 'ArrowLeft' })

    expect(screen.getByRole('tab', { name: /AI-agenten/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(mockRecordTabViewed).toHaveBeenLastCalledWith('ai-agent')
  })

  it('End moves selection to the last tab; Home returns to the first', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)
    const firstTab = screen.getByRole('tab', { name: /Vad är en laglista\?/ })

    fireEvent.keyDown(firstTab, { key: 'End' })
    expect(screen.getByRole('tab', { name: /AI-agenten/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    const lastTab = screen.getByRole('tab', { name: /AI-agenten/ })
    fireEvent.keyDown(lastTab, { key: 'Home' })
    expect(
      screen.getByRole('tab', { name: /Vad är en laglista\?/ })
    ).toHaveAttribute('aria-selected', 'true')
  })
})
