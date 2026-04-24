/** Story 21.11 — CycleRapportTab component tests (AC 16). */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from '@testing-library/react'
import { SWRConfig } from 'swr'
import { ComplianceCycleStatus } from '@prisma/client'
import { CycleRapportTab } from '@/components/features/compliance-audit/cycle-detail/cycle-rapport-tab'
import { getRevisionsrapportInput } from '@/app/actions/compliance-audit-report'

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/app/actions/compliance-audit-report', () => ({
  getRevisionsrapportInput: vi.fn(),
}))

const getInputMock = vi.mocked(getRevisionsrapportInput)

const CYCLE_ID = '11111111-1111-4111-8111-111111111111'

function renderTab(status: ComplianceCycleStatus) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <CycleRapportTab
        cycleId={CYCLE_ID}
        cycleStatus={status}
        cycleName="Test kontroll"
      />
    </SWRConfig>
  )
}

function makeSuccessResult(
  htmlOverride?: string
): Awaited<ReturnType<typeof getRevisionsrapportInput>> {
  return {
    success: true,
    data: {
      html:
        htmlOverride ??
        '<!DOCTYPE html><html><head><title>t</title></head><body><h1>Test kontroll</h1></body></html>',
      // The test only reads `html`; `input` shape is not asserted here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: {} as any,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

// ============================================================================
// Pre-complete statuses: no fetch
// ============================================================================

describe('CycleRapportTab — pre-complete statuses', () => {
  it('PAGAENDE renders the placeholder and does NOT call getRevisionsrapportInput', () => {
    renderTab(ComplianceCycleStatus.PAGAENDE)
    expect(
      screen.getByText(/Rapport blir tillgänglig när kontrollen slutförs/)
    ).toBeInTheDocument()
    expect(getInputMock).not.toHaveBeenCalled()
  })

  it('PLANERAD renders the placeholder and does NOT call the fetcher', () => {
    renderTab(ComplianceCycleStatus.PLANERAD)
    expect(
      screen.getByText(/Rapport blir tillgänglig när kontrollen slutförs/)
    ).toBeInTheDocument()
    expect(getInputMock).not.toHaveBeenCalled()
  })
})

// ============================================================================
// Post-complete statuses: fetch + render iframe
// ============================================================================

describe('CycleRapportTab — AVSLUTAD', () => {
  it('renders the iframe with the returned HTML and a functional PDF download link (Story 21.12)', async () => {
    getInputMock.mockResolvedValueOnce(makeSuccessResult())

    renderTab(ComplianceCycleStatus.AVSLUTAD)

    await waitFor(() => expect(getInputMock).toHaveBeenCalledTimes(1))

    const iframe = await screen.findByTitle(/^Revisionsrapport/)
    expect(iframe).toBeInTheDocument()
    // R1 fix — iframe title interpolates cycleName for screen-reader context.
    expect(iframe).toHaveAttribute('title', 'Revisionsrapport — Test kontroll')
    expect(iframe).toHaveAttribute(
      'srcdoc',
      expect.stringContaining('Test kontroll')
    )
    expect(iframe).toHaveAttribute('sandbox', '')

    // Story 21.12: functional download link with kind=complete for AVSLUTAD.
    const pdfLink = screen.getByRole('link', { name: 'Ladda ner PDF' })
    expect(pdfLink).toBeInTheDocument()
    expect(pdfLink).toHaveAttribute(
      'href',
      `/laglistor/kontroller/${CYCLE_ID}/rapport/pdf?kind=complete`
    )
    expect(pdfLink).toHaveAttribute('target', '_blank')
    expect(pdfLink).toHaveAttribute('rel', 'noopener noreferrer')

    // "Upp till 60 sekunder"-hint visible for AVSLUTAD only.
    expect(
      screen.getByText(/Första nedladdningen kan ta upp till 60 sekunder/)
    ).toBeInTheDocument()
  })
})

describe('CycleRapportTab — SEALED', () => {
  it('renders the info row above the iframe + PDF link uses kind=sealed (Story 21.12)', async () => {
    getInputMock.mockResolvedValueOnce(makeSuccessResult())

    renderTab(ComplianceCycleStatus.SEALED)

    await screen.findByTitle(/^Revisionsrapport/)
    expect(
      screen.getByText(
        'Fastställd kontroll — seal-hash visas på titelsidan och i sidfoten.'
      )
    ).toBeInTheDocument()

    const pdfLink = screen.getByRole('link', { name: 'Ladda ner PDF' })
    expect(pdfLink).toHaveAttribute(
      'href',
      `/laglistor/kontroller/${CYCLE_ID}/rapport/pdf?kind=sealed`
    )

    // "60 sekunder" hint is AVSLUTAD-only — not rendered for SEALED.
    expect(
      screen.queryByText(/Första nedladdningen kan ta upp till 60 sekunder/)
    ).not.toBeInTheDocument()
  })
})

describe('CycleRapportTab — ARKIVERAD', () => {
  it('renders the SEALED-equivalent info row + PDF link uses kind=sealed', async () => {
    getInputMock.mockResolvedValueOnce(makeSuccessResult())

    renderTab(ComplianceCycleStatus.ARKIVERAD)

    await screen.findByTitle(/^Revisionsrapport/)
    expect(
      screen.getByText(
        'Fastställd kontroll — seal-hash visas på titelsidan och i sidfoten.'
      )
    ).toBeInTheDocument()

    const pdfLink = screen.getByRole('link', { name: 'Ladda ner PDF' })
    expect(pdfLink).toHaveAttribute(
      'href',
      `/laglistor/kontroller/${CYCLE_ID}/rapport/pdf?kind=sealed`
    )
  })
})

// ============================================================================
// Loading state
// ============================================================================

describe('CycleRapportTab — loading state', () => {
  it('renders role="status" skeleton before fetch resolves', () => {
    // Never-resolving promise so the loading branch renders.
    getInputMock.mockReturnValueOnce(new Promise(() => {}))

    renderTab(ComplianceCycleStatus.AVSLUTAD)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Laddar revisionsrapport…')).toBeInTheDocument()
  })
})

// ============================================================================
// Error state + retry
// ============================================================================

describe('CycleRapportTab — error state', () => {
  it('shows error card and retry button; clicking retry triggers a second fetch', async () => {
    getInputMock.mockResolvedValueOnce({
      success: false,
      error: 'Kunde inte hämta revisionsrapport',
    })

    renderTab(ComplianceCycleStatus.AVSLUTAD)

    await screen.findByText(/Rapporten kunde inte genereras/)
    expect(
      screen.getByText(/Kunde inte hämta revisionsrapport/)
    ).toBeInTheDocument()

    // Second call resolves successfully.
    getInputMock.mockResolvedValueOnce(makeSuccessResult())
    fireEvent.click(screen.getByRole('button', { name: 'Försök igen' }))

    await waitFor(() => expect(getInputMock).toHaveBeenCalledTimes(2))
    await screen.findByTitle(/^Revisionsrapport/)
  })
})
