/**
 * Story 25.2 (Epic 25, B.2): component test for <TutorialStep>.
 * Story 25.5 (Epic 25, B.5): tab count bumped from 6 → 7 with the Feedback
 * tab added as the rightmost entry. Existing test expectations updated to
 * read "av 7" / "AI-agenten → Feedback" for arrow-key wrap-around / etc.
 *
 * Verifies the tab shell behaviour:
 *  - 7 tab buttons rendered with the correct labels (AC 16 + Story 25.5 AC 33)
 *  - default tab is active on mount, fires tab_viewed for the default tab (AC 18)
 *  - switching tabs updates active styling, counter, and fires tab_viewed (AC 18)
 *  - re-clicking the active tab does NOT re-fire tab_viewed (AC 18)
 *  - Minimera button calls the onMinimise callback prop (AC 19)
 *  - <ProgressStrip> is mounted inside the step body (AC 14)
 */

import { StrictMode } from 'react'
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

// Story 25.3 (B.3): stub the tab content components so this shell-level
// test stays focused on tab-switching behaviour, not on each tab's content.
vi.mock('@/components/features/onboarding-modal/tutorial-tabs', () => ({
  TUTORIAL_TAB_COMPONENTS: {
    laglista: () => <div data-testid="tab-stub-laglista" />,
    kravpunkter: () => <div data-testid="tab-stub-kravpunkter" />,
    uppgifter: () => <div data-testid="tab-stub-uppgifter" />,
    kontroller: () => <div data-testid="tab-stub-kontroller" />,
    lagandringar: () => <div data-testid="tab-stub-lagandringar" />,
    'ai-agent': () => <div data-testid="tab-stub-ai-agent" />,
    feedback: () => <div data-testid="tab-stub-feedback" />,
  },
}))

import { TutorialStep } from '@/components/features/onboarding-modal/tutorial-step'

describe('<TutorialStep>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 7 tab buttons with the correct labels (incl. Feedback per Story 25.5)', () => {
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
    expect(screen.getByRole('tab', { name: /Feedback/ })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(7)
  })

  it('first tab is active on mount and fires tab_viewed once for the default tab', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)

    const firstTab = screen.getByRole('tab', {
      name: /Vad är en laglista\?/,
    })
    expect(firstTab).toHaveAttribute('aria-selected', 'true')

    expect(mockRecordTabViewed).toHaveBeenCalledTimes(1)
    expect(mockRecordTabViewed).toHaveBeenCalledWith('laglista')

    // Counter shows "1 av 7" initially (post-Story-25.5)
    expect(screen.getByText(/1 av 7/i)).toBeInTheDocument()
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

    expect(screen.getByText(/3 av 7/i)).toBeInTheDocument()
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

  // Story 25.3 (B.3): tab body renders the active tab's component from
  // TUTORIAL_TAB_COMPONENTS — replaces the B.2 "Innehåll kommer snart"
  // placeholder.
  it('renders the active tab content component (laglista by default)', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)
    expect(screen.getByTestId('tab-stub-laglista')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-stub-uppgifter')).not.toBeInTheDocument()
  })

  it('swaps the rendered tab component when the active tab changes', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)
    expect(screen.getByTestId('tab-stub-laglista')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Uppgifter/ }))

    expect(screen.getByTestId('tab-stub-uppgifter')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-stub-laglista')).not.toBeInTheDocument()
  })

  // QA recommendation (post-25.3 review): lock in the no-double-fire invariant
  // for the active-tab swap under StrictMode. StrictMode double-invokes mount
  // effects in dev — the initial-mount tab_viewed useRef guard from Story 25.2
  // protects against duplicate fires; this test ensures that guard still works
  // after Story 25.3's swap to dynamic component rendering.
  it('fires tab_viewed exactly once under StrictMode (no double-fire from active-tab swap)', () => {
    render(
      <StrictMode>
        <TutorialStep onMinimise={vi.fn()} />
      </StrictMode>
    )
    // Initial mount fires once for the default tab (laglista). StrictMode's
    // double-invoke must NOT cause a second fire.
    expect(mockRecordTabViewed).toHaveBeenCalledTimes(1)
    expect(mockRecordTabViewed).toHaveBeenCalledWith('laglista')
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

  it('ArrowLeft wraps from the first tab to the last (Feedback per Story 25.5)', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)
    const firstTab = screen.getByRole('tab', { name: /Vad är en laglista\?/ })

    fireEvent.keyDown(firstTab, { key: 'ArrowLeft' })

    expect(screen.getByRole('tab', { name: /Feedback/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(mockRecordTabViewed).toHaveBeenLastCalledWith('feedback')
  })

  it('End moves selection to the last tab (Feedback); Home returns to the first', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)
    const firstTab = screen.getByRole('tab', { name: /Vad är en laglista\?/ })

    fireEvent.keyDown(firstTab, { key: 'End' })
    expect(screen.getByRole('tab', { name: /Feedback/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    const lastTab = screen.getByRole('tab', { name: /Feedback/ })
    fireEvent.keyDown(lastTab, { key: 'Home' })
    expect(
      screen.getByRole('tab', { name: /Vad är en laglista\?/ })
    ).toHaveAttribute('aria-selected', 'true')
  })

  // Story 25.6 (B.6) — mode + initialTab prop tests.
  it('mode="tutorial-only" hides the <ProgressStrip>', () => {
    render(<TutorialStep mode="tutorial-only" onMinimise={vi.fn()} />)

    expect(screen.queryByTestId('progress-strip-stub')).not.toBeInTheDocument()
  })

  it('default mode (no prop) still renders <ProgressStrip> — regression guard', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)

    expect(screen.getByTestId('progress-strip-stub')).toBeInTheDocument()
  })

  it('initialTab="ai-agent" mounts at the AI-agent tab + fires recordTabViewed("ai-agent")', () => {
    render(<TutorialStep initialTab="ai-agent" onMinimise={vi.fn()} />)

    expect(screen.getByRole('tab', { name: /AI-agenten/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(mockRecordTabViewed).toHaveBeenCalledTimes(1)
    expect(mockRecordTabViewed).toHaveBeenCalledWith('ai-agent')
  })

  // Story 25.5 (B.5) AC 33 — new test cases for the Feedback tab.
  it('Feedback tab is reachable as the 7th tab', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(7)
    expect(tabs[6]).toHaveTextContent('Feedback')
  })

  it('clicking the Feedback tab fires recordTabViewed("feedback")', () => {
    render(<TutorialStep onMinimise={vi.fn()} />)
    // initial mount fires once for the default (laglista)
    expect(mockRecordTabViewed).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('tab', { name: /Feedback/ }))

    expect(mockRecordTabViewed).toHaveBeenCalledTimes(2)
    expect(mockRecordTabViewed).toHaveBeenLastCalledWith('feedback')
  })
})
