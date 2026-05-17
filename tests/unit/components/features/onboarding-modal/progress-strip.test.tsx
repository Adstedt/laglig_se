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
}

describe('<ProgressStrip>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSWRResponse(inProgressWithActive)
  })

  // FOCAL line ----------------------------------------------------------

  it('focal line shows the active step label when one is active', () => {
    render(<ProgressStrip />)
    const focal = screen.getByTestId('strip-focal')
    expect(focal).toHaveTextContent('Matchar mot SFS-katalog')
    // Ticker hidden when there's a real active step
    expect(screen.queryByTestId('thinking-ticker')).not.toBeInTheDocument()
  })

  it('focal line shows the rotating thinking phrase when no step is active', () => {
    setSWRResponse(inProgressAllDone)
    render(<ProgressStrip />)
    const ticker = screen.getByTestId('thinking-ticker')
    expect(ticker).toBeInTheDocument()
    expect(ticker.textContent).toMatch(/Tänker/)
  })

  it('focal line shows the thinking phrase even before any done steps', () => {
    setSWRResponse({
      ...inProgressAllDone,
      progress: [],
    })
    render(<ProgressStrip />)
    expect(screen.getByTestId('thinking-ticker')).toBeInTheDocument()
  })

  it('focal line renders three CSS-drawn bouncing dots (not text dots)', () => {
    const { container } = render(<ProgressStrip />)
    const dots = container.querySelectorAll('.thinking-dot')
    expect(dots).toHaveLength(3)
    // Should be empty spans (CSS handles the visual), not text dots
    for (const dot of dots) {
      expect(dot.textContent).toBe('')
    }
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

  it('context line shows the latest done step even when focal shows the active step', () => {
    render(<ProgressStrip />) // has both active + done steps
    expect(screen.getByTestId('strip-focal')).toHaveTextContent(
      'Matchar mot SFS-katalog'
    )
    // Latest done step (last 'done' in array order) is Område-mapping
    expect(screen.getByTestId('strip-context')).toHaveTextContent(
      'Område-mapping'
    )
  })

  // Counter -------------------------------------------------------------

  it('shows "N steg klara" (plural) when more than 1 step done', () => {
    render(<ProgressStrip />)
    // 2 done in inProgressWithActive
    expect(screen.getByText(/2 steg klara/)).toBeInTheDocument()
  })

  it('shows "1 steg klart" (Swedish neutrum singular) when exactly 1 step done', () => {
    setSWRResponse({
      ...inProgressAllDone,
      progress: [{ label: 'Profil', status: 'done' }],
    })
    render(<ProgressStrip />)
    expect(screen.getByText(/1 steg klart/)).toBeInTheDocument()
  })

  it('shows nothing in the counter when 0 steps done', () => {
    setSWRResponse({
      ...inProgressAllDone,
      progress: [{ label: 'Profil', status: 'active' }],
    })
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

  it('renders the shimmer bar even when SWR returns no progress data but initialStatus="in_progress"', () => {
    setSWRResponse(undefined)
    const { container } = render(<ProgressStrip initialStatus="in_progress" />)
    expect(container.firstChild).not.toBeNull()
    expect(container.querySelector('.shimmer-track')).not.toBeNull()
  })
})
