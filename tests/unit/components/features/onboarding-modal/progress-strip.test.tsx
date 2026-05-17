/**
 * Story 25.2 (Epic 25, B.2): component test for <ProgressStrip>.
 *
 * Verifies the two-line "agent activity stream" layout:
 *  - FOCAL line: three bouncing dots + active step label OR rotating
 *    thinking phrase, with "N steg klara · M rader" counter on the right
 *  - CONTEXT line: muted "✓ last done step label" (omitted if no done step)
 *  - hides on completed/failed/null status (AC 13)
 *  - uses the same SWR key as <LawListGenerationProgress>
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import useSWR from 'swr'

vi.mock('swr', () => ({ default: vi.fn() }))

const mockUseSWR = vi.mocked(useSWR)

import { ProgressStrip } from '@/components/features/onboarding-modal/progress-strip'

function setSWRResponse(data: unknown) {
  mockUseSWR.mockReturnValue({
    data,
    mutate: vi.fn(),
    isLoading: false,
    isValidating: false,
    error: undefined,
  } as unknown as ReturnType<typeof useSWR>)
}

// Story 25.3 polish: startedAt added to all mocks so the new
// asymptotic-% logic computes a deterministic value. 60s ago = ~28%
// per the curve `1 - e^(-elapsed/180000)`. Tests that don't care
// about the exact % can ignore it; tests that DO care override
// startedAt explicitly via setSWRResponse({ ..., startedAt: ... }).
const STARTED_60S_AGO = new Date(Date.now() - 60_000).toISOString()

const inProgressWithActive = {
  status: 'in_progress',
  progress: [
    { label: 'Profil', status: 'done' },
    { label: 'Område-mapping', status: 'done' },
    { label: 'Matchar mot SFS-katalog', status: 'active' },
    { label: 'Kravpunkter', status: 'pending' },
    { label: 'Slutför', status: 'pending' },
  ],
  itemCount: 47,
  error: null,
  startedAt: STARTED_60S_AGO,
}

const inProgressAllDone = {
  status: 'in_progress',
  progress: [
    { label: 'Profil', status: 'done' },
    { label: 'Område-mapping', status: 'done' },
    { label: 'Kontrollerar regelområde', status: 'done' },
  ],
  itemCount: undefined,
  error: null,
  startedAt: STARTED_60S_AGO,
}

describe('<ProgressStrip>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSWRResponse(inProgressWithActive)
  })

  // Focal line removed (post-25.4 polish, 2026-05-17) — the asymptotic %
  // bar from 25.3 v0.5 already carries the "we're working" signal that the
  // bouncing-dots + Tänker/Söker ticker used to carry, so it became visual
  // noise. The 4 prior focal-line tests were dropped along with the row.

  it('does NOT render the focal "Tänker / Söker / Analyserar" ticker (dropped post-25.4)', () => {
    setSWRResponse(inProgressAllDone)
    render(<ProgressStrip />)
    expect(screen.queryByTestId('strip-focal')).not.toBeInTheDocument()
    expect(screen.queryByTestId('thinking-ticker')).not.toBeInTheDocument()
    expect(screen.queryByText(/Tänker/)).not.toBeInTheDocument()
  })

  it('does NOT render the three CSS-drawn bouncing dots (dropped with focal row)', () => {
    const { container } = render(<ProgressStrip />)
    expect(container.querySelectorAll('.thinking-dot')).toHaveLength(0)
  })

  // CONTEXT line --------------------------------------------------------

  it('context line shows the most recent done step label when one exists', () => {
    setSWRResponse(inProgressAllDone)
    render(<ProgressStrip />)
    const context = screen.getByTestId('strip-context')
    expect(context).toHaveTextContent('Kontrollerar regelområde')
  })

  it('context line is omitted when no done steps yet', () => {
    setSWRResponse({
      ...inProgressAllDone,
      progress: [{ label: 'Profil', status: 'active' }],
    })
    render(<ProgressStrip />)
    expect(screen.queryByTestId('strip-context')).not.toBeInTheDocument()
  })

  it('context line shows the latest done step even when an active step exists', () => {
    render(<ProgressStrip />) // has both active + done steps
    // Latest done step (last 'done' in array order) is Område-mapping;
    // active-step label no longer surfaces anywhere (focal row dropped).
    expect(screen.getByTestId('strip-context')).toHaveTextContent(
      'Område-mapping'
    )
    expect(
      screen.queryByText('Matchar mot SFS-katalog')
    ).not.toBeInTheDocument()
  })

  // Counter -------------------------------------------------------------

  // Story 25.3 polish: the "N steg klara" / "1 steg klart" counter was
  // dropped — "step" was implementation jargon without meaning to the user,
  // and its jump-y count between polls undermined trust. The counter row
  // now shows just `{percent}%` (+ optional `· N rader`).
  it('does NOT render the "N steg klara" / "1 steg klart" counter (dropped post-polish)', () => {
    render(<ProgressStrip />)
    expect(screen.queryByText(/steg klara/)).not.toBeInTheDocument()
    expect(screen.queryByText(/steg klart/)).not.toBeInTheDocument()
  })

  it('appends "· N rader" when itemCount is a number', () => {
    render(<ProgressStrip />)
    expect(screen.getByText(/47 rader/)).toBeInTheDocument()
  })

  it('omits the rader part entirely when itemCount is undefined', () => {
    setSWRResponse(inProgressAllDone)
    render(<ProgressStrip />)
    expect(screen.queryByText(/rader/)).not.toBeInTheDocument()
  })

  // Negative assertions on prior-version artifacts ----------------------

  it('does NOT render the chevron-separated trail (replaced by two-line layout)', () => {
    const { container } = render(<ProgressStrip />)
    expect(
      container.querySelectorAll('[data-lucide="chevron-right"]')
    ).toHaveLength(0)
  })

  it('does NOT render the title or subhead (DialogHeader owns those)', () => {
    render(<ProgressStrip />)
    expect(
      screen.queryByText('Vi skapar er personliga laglista')
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Du kan stänga rutan/)).not.toBeInTheDocument()
  })

  it('does NOT render the misleading "Steg N av Y" counter', () => {
    render(<ProgressStrip />)
    expect(screen.queryByText(/Steg \d+ av \d+/)).not.toBeInTheDocument()
  })

  // A11y + plumbing -----------------------------------------------------

  it('renders aria-live="polite" on the wrapper for screen reader updates', () => {
    const { container } = render(<ProgressStrip />)
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull()
  })

  it('returns null when status is "completed"', () => {
    setSWRResponse({ ...inProgressWithActive, status: 'completed' })
    const { container } = render(<ProgressStrip />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when status is "failed"', () => {
    setSWRResponse({ ...inProgressWithActive, status: 'failed' })
    const { container } = render(<ProgressStrip />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when SWR returns no data and no initialStatus given', () => {
    setSWRResponse(undefined)
    const { container } = render(<ProgressStrip />)
    expect(container.firstChild).toBeNull()
  })

  it('uses the same SWR key as <LawListGenerationProgress>', () => {
    render(<ProgressStrip />)
    expect(mockUseSWR).toHaveBeenCalled()
    const firstCall = mockUseSWR.mock.calls[0]
    expect(firstCall?.[0]).toBe('/api/workspace/generation-status')
  })

  it('renders the determinate progress bar even when SWR returns no progress data but initialStatus="in_progress"', () => {
    setSWRResponse(undefined)
    const { container } = render(<ProgressStrip initialStatus="in_progress" />)
    expect(container.firstChild).not.toBeNull()
    // Story 25.3 polish: replaced indeterminate shimmer with a determinate
    // bar marked role=progressbar.
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  // ---------------------------------------------------------------------
  // Story 25.3 polish: asymptotic % progress
  // ---------------------------------------------------------------------

  it('shows 0% when startedAt is null', () => {
    setSWRResponse({ ...inProgressAllDone, startedAt: null })
    render(<ProgressStrip />)
    expect(screen.getByText(/0%/)).toBeInTheDocument()
  })

  it('shows ~28% when startedAt is 60s ago (asymptotic curve, tau=180s)', () => {
    setSWRResponse({
      ...inProgressAllDone,
      startedAt: new Date(Date.now() - 60_000).toISOString(),
    })
    const { container } = render(<ProgressStrip />)
    // Curve: 1 - e^(-60/180) ≈ 0.2835 → 28%. Allow ±2 to absorb sub-ms drift.
    const progressbar = container.querySelector('[role="progressbar"]')
    const aria = Number(progressbar?.getAttribute('aria-valuenow') ?? -1)
    expect(aria).toBeGreaterThanOrEqual(26)
    expect(aria).toBeLessThanOrEqual(30)
  })

  it('caps at 99% even when startedAt is 1 hour ago', () => {
    setSWRResponse({
      ...inProgressAllDone,
      startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    })
    const { container } = render(<ProgressStrip />)
    const progressbar = container.querySelector('[role="progressbar"]')
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('99')
  })

  it('progress bar inner div width matches the computed percent', () => {
    setSWRResponse({
      ...inProgressAllDone,
      startedAt: new Date(Date.now() - 60_000).toISOString(),
    })
    const { container } = render(<ProgressStrip />)
    const progressbar = container.querySelector('[role="progressbar"]')
    const aria = progressbar?.getAttribute('aria-valuenow')
    const inner = progressbar?.querySelector('div')
    expect(inner?.style.width).toBe(`${aria}%`)
  })
})
