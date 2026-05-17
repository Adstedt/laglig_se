/**
 * Story 25.0 / 25.1 (Epic 25): render coverage for the <FirstRunModal>
 * shell. Verifies:
 *  - the dialog renders the path-choice step + header copy
 *  - `modal_opened` telemetry fires exactly once (also under StrictMode)
 *  - the closed-modal state renders nothing
 *  - sub-step transitions swap the header copy (B.1 AC 14, 37)
 *
 * Story 25.4 (B.4) extensions:
 *  - tutorial → done-generate auto-transition on status='completed' / 'failed'
 *  - import-success → done-import (replaces 25.1's immediate route)
 *  - template-apply → done-template
 *  - done_shown StrictMode guard (one fire per step entry)
 */

import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockRecordEvent = vi.fn().mockResolvedValue({ ok: true })
const mockMinimise = vi.fn().mockResolvedValue({ ok: true })
const mockSkip = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/app/actions/onboarding-modal', () => ({
  recordOnboardingEvent: (...args: unknown[]) => mockRecordEvent(...args),
  minimiseFirstRunModal: () => mockMinimise(),
  skipLawListGeneration: () => mockSkip(),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}))

// Story 25.4: getImport drives the import-success → done-import transition.
const mockGetImport = vi.fn()
vi.mock('@/app/actions/law-list-import', () => ({
  getImport: (importId: string) => mockGetImport(importId),
}))

// Story 25.4: drive SWR responses from the test for the auto-transition
// assertions. Pattern copied from progress-strip.test.tsx:16-18.
import useSWR from 'swr'
vi.mock('swr', () => ({ default: vi.fn() }))
const mockUseSWR = vi.mocked(useSWR)

function setSwrData(data: unknown) {
  mockUseSWR.mockReturnValue({
    data,
    mutate: vi.fn(),
    isLoading: false,
    isValidating: false,
    error: undefined,
  } as ReturnType<typeof useSWR>)
}

// Stub the sub-step children so the shell test stays focused on the shell
// behaviour (header copy + sub-step transitions). Each stub exposes the
// callback props the shell wires in.
vi.mock('@/components/features/onboarding-modal/path-choice-step', () => ({
  PathChoiceStep: ({
    onClose,
    onPickTemplate,
    onPickImport,
    onPickGenerate,
  }: {
    onClose: () => void
    onPickTemplate: () => void
    onPickImport: () => void
    onPickGenerate: () => void
  }) => (
    <div data-testid="path-choice-step">
      <button onClick={onPickTemplate}>stub-pick-template</button>
      <button onClick={onPickImport}>stub-pick-import</button>
      <button onClick={onPickGenerate}>stub-pick-generate</button>
      <button onClick={onClose}>stub-close</button>
    </div>
  ),
}))

// Story 25.2: stub TutorialStep so the shell test stays focused on the
// shell behaviour (header copy + Minimera handoff).
vi.mock('@/components/features/onboarding-modal/tutorial-step', () => ({
  TutorialStep: ({
    onMinimise,
  }: {
    onMinimise: () => void | Promise<void>
  }) => (
    <div data-testid="tutorial-step">
      <button onClick={() => void onMinimise()}>stub-minimise</button>
    </div>
  ),
}))

// Story 25.4: stub TemplatePickStep with onTemplateApplied exposed.
vi.mock('@/components/features/onboarding-modal/template-pick-step', () => ({
  TemplatePickStep: ({
    onBack,
    onTemplateApplied,
  }: {
    onBack: () => void
    onTemplateApplied: (_result: {
      listId: string
      listName: string
      itemCount: number
    }) => void
  }) => (
    <div data-testid="template-pick-step">
      <button onClick={onBack}>stub-template-back</button>
      <button
        onClick={() =>
          onTemplateApplied({
            listId: 'list-test-123',
            listName: 'Test Template',
            itemCount: 5,
          })
        }
      >
        stub-template-apply
      </button>
    </div>
  ),
}))

// QA TEST-COV-001: expose onSuccess so handleImportSuccess (AC 23) can be
// exercised end-to-end from the shell test, not just by inspection.
vi.mock('@/components/features/onboarding-modal/import-upload-step', () => ({
  ImportUploadStep: ({
    onSuccess,
    hideHeader,
  }: {
    onSuccess?: (_importId: string) => void
    hideHeader?: boolean
  }) => (
    <div
      data-testid="import-upload-step"
      data-hide-header={String(!!hideHeader)}
    >
      <button onClick={() => onSuccess?.('import-test-123')}>
        stub-import-success
      </button>
    </div>
  ),
}))

// Story 25.4: stub the three done step components so the shell tests focus
// on transition logic, not done-step internals.
vi.mock('@/components/features/onboarding-modal/done-generate-step', () => ({
  DoneGenerateStep: ({
    mode,
    itemCount,
    onShowList,
    onRetry,
  }: {
    mode?: 'success' | 'failed'
    itemCount: number | null
    onShowList: () => void
    onRetry?: () => void
  }) => (
    <div data-testid="done-generate-step" data-mode={mode ?? 'success'}>
      <span data-testid="done-generate-count">{itemCount ?? ''}</span>
      <button onClick={onShowList}>stub-show-list</button>
      {mode === 'failed' && onRetry && (
        <button onClick={onRetry}>stub-retry</button>
      )}
    </div>
  ),
}))

vi.mock('@/components/features/onboarding-modal/done-import-step', () => ({
  DoneImportStep: ({
    counts,
    onGoToReview,
  }: {
    counts: { highCount: number; mediumCount: number; unmatchedCount: number }
    onGoToReview: () => void
  }) => (
    <div data-testid="done-import-step">
      <span data-testid="done-import-counts">
        {counts.highCount}/{counts.mediumCount}/{counts.unmatchedCount}
      </span>
      <button onClick={onGoToReview}>stub-go-to-review</button>
    </div>
  ),
}))

vi.mock('@/components/features/onboarding-modal/done-template-step', () => ({
  DoneTemplateStep: ({
    listName,
    itemCount,
    onShowList,
  }: {
    listName: string
    itemCount: number
    onShowList: () => void
  }) => (
    <div data-testid="done-template-step">
      <span>
        {listName} / {itemCount}
      </span>
      <button onClick={onShowList}>stub-show-template-list</button>
    </div>
  ),
}))

import { FirstRunModal } from '@/components/features/onboarding-modal/first-run-modal'

describe('<FirstRunModal>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default SWR returns null data (no generation in progress / completed).
    setSwrData(undefined)
    // Default getImport returns the success shape used by the import test.
    mockGetImport.mockResolvedValue({
      success: true,
      data: {
        counts: {
          matched_high: 12,
          matched_medium: 5,
          unmatched: 3,
        },
      },
    })
  })

  it('renders the dialog with the welcome header and mounts the path-choice step', () => {
    render(<FirstRunModal open={true} userFirstName="Alexander" />)

    expect(screen.getByText('Välkommen, Alexander')).toBeInTheDocument()
    expect(
      screen.getByText(/Vi sätter upp din första laglista/)
    ).toBeInTheDocument()
    expect(screen.getByText(/KOM IGÅNG · STEG 1 AV 2/)).toBeInTheDocument()
    expect(screen.getByTestId('path-choice-step')).toBeInTheDocument()
  })

  it('falls back to "Välkommen" when no userFirstName is provided', () => {
    render(<FirstRunModal open={true} />)
    expect(screen.getByText('Välkommen')).toBeInTheDocument()
  })

  it('fires modal_opened telemetry on mount', () => {
    render(<FirstRunModal open={true} />)

    expect(mockRecordEvent).toHaveBeenCalledWith('modal_opened', {
      trigger: 'first_run',
    })
  })

  it('fires modal_opened exactly once under StrictMode (ROBUST-002 guard)', () => {
    render(
      <StrictMode>
        <FirstRunModal open={true} />
      </StrictMode>
    )

    // StrictMode double-invokes mount effects in dev — the useRef guard must
    // keep the telemetry write to a single call.
    expect(mockRecordEvent).toHaveBeenCalledTimes(1)
  })

  it('does not render the dialog content when open is false', () => {
    render(<FirstRunModal open={false} />)

    expect(screen.queryByText('Välkommen')).not.toBeInTheDocument()
    expect(screen.queryByTestId('path-choice-step')).not.toBeInTheDocument()
  })

  it('clicking the Mall path transitions header copy to "Välj en mall"', () => {
    render(<FirstRunModal open={true} templates={[]} />)

    fireEvent.click(screen.getByText('stub-pick-template'))

    expect(screen.getByText('Välj en mall')).toBeInTheDocument()
    expect(
      screen.getByText('Välj en bransch-mall — listan skapas direkt.')
    ).toBeInTheDocument()
    expect(screen.getByTestId('template-pick-step')).toBeInTheDocument()
    expect(screen.queryByTestId('path-choice-step')).not.toBeInTheDocument()
  })

  it('clicking the Importera path transitions header copy to "Importera befintlig laglista"', () => {
    render(<FirstRunModal open={true} />)

    fireEvent.click(screen.getByText('stub-pick-import'))

    expect(screen.getByText('Importera befintlig laglista')).toBeInTheDocument()
    expect(
      screen.getByText('Ladda upp en .xlsx / .csv eller klistra in raderna.')
    ).toBeInTheDocument()
    expect(screen.getByTestId('import-upload-step')).toBeInTheDocument()
    expect(screen.queryByTestId('path-choice-step')).not.toBeInTheDocument()
  })

  it('Tillbaka from template-pick returns to the path-choice header', () => {
    render(
      <FirstRunModal open={true} templates={[]} userFirstName="Alexander" />
    )

    fireEvent.click(screen.getByText('stub-pick-template'))
    expect(screen.getByText('Välj en mall')).toBeInTheDocument()

    fireEvent.click(screen.getByText('stub-template-back'))
    expect(screen.getByText('Välkommen, Alexander')).toBeInTheDocument()
    expect(screen.getByTestId('path-choice-step')).toBeInTheDocument()
  })

  it('Tillbaka from import-upload returns to the path-choice header', () => {
    render(<FirstRunModal open={true} userFirstName="Alexander" />)

    fireEvent.click(screen.getByText('stub-pick-import'))
    expect(screen.getByText('Importera befintlig laglista')).toBeInTheDocument()

    // The import-upload sub-step is shell-rendered around <ImportUploadStep>;
    // the Tillbaka button lives in the shell, not the mocked child.
    fireEvent.click(screen.getByRole('button', { name: /Tillbaka/ }))
    expect(screen.getByText('Välkommen, Alexander')).toBeInTheDocument()
    expect(screen.getByTestId('path-choice-step')).toBeInTheDocument()
  })

  it('Hoppa över guiden footer button → calls skipLawListGeneration and closes', async () => {
    render(<FirstRunModal open={true} />)

    fireEvent.click(screen.getByRole('button', { name: /Hoppa över guiden/ }))

    await waitFor(() => {
      expect(mockSkip).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.queryByTestId('path-choice-step')).not.toBeInTheDocument()
    })
  })

  it('Hoppa över guiden → if skip fails, toasts and modal stays open (QA ROBUST-001)', async () => {
    const { toast } = await import('sonner')
    mockSkip.mockResolvedValueOnce({
      ok: false,
      error: 'Något gick fel.',
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<FirstRunModal open={true} />)

    fireEvent.click(screen.getByRole('button', { name: /Hoppa över guiden/ }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Något gick fel. Försök igen.')
    })
    expect(screen.getByTestId('path-choice-step')).toBeInTheDocument()

    errSpy.mockRestore()
  })

  it('Hoppa över guiden is NOT rendered on sub-steps', () => {
    render(<FirstRunModal open={true} templates={[]} />)
    fireEvent.click(screen.getByText('stub-pick-template'))
    expect(
      screen.queryByRole('button', { name: /Hoppa över guiden/ })
    ).not.toBeInTheDocument()
  })

  it('mounts <ImportUploadStep> with hideHeader=true to avoid duplicate h2 (QA UX-DUPL-001)', () => {
    render(<FirstRunModal open={true} />)

    fireEvent.click(screen.getByText('stub-pick-import'))
    const importStep = screen.getByTestId('import-upload-step')
    expect(importStep).toHaveAttribute('data-hide-header', 'true')
  })

  // ------------------------------------------------------------------
  // Story 25.2 (B.2): tutorial-step transition coverage
  // ------------------------------------------------------------------

  it('B.2: clicking Generera-success transitions header copy to "Vi skapar er personliga laglista"', () => {
    render(<FirstRunModal open={true} userFirstName="Alexander" />)
    expect(screen.getByText('Välkommen, Alexander')).toBeInTheDocument()

    fireEvent.click(screen.getByText('stub-pick-generate'))

    expect(
      screen.getByText('Vi skapar er personliga laglista')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Du kan stänga rutan — vi fortsätter i bakgrunden/)
    ).toBeInTheDocument()
  })

  it('B.2: tutorial step shows the "STEG 2 AV 2" progress indicator', () => {
    render(<FirstRunModal open={true} />)
    fireEvent.click(screen.getByText('stub-pick-generate'))

    expect(screen.getByText(/KOM IGÅNG · STEG 2 AV 2/)).toBeInTheDocument()
  })

  it('B.2: path-choice footer (Hoppa över guiden) is NOT rendered on the tutorial step', () => {
    render(<FirstRunModal open={true} />)
    fireEvent.click(screen.getByText('stub-pick-generate'))

    expect(
      screen.queryByRole('button', { name: /Hoppa över guiden/ })
    ).not.toBeInTheDocument()
  })

  it('B.2: tutorial step mounts <TutorialStep> and Minimera handoff calls minimise + close + route', async () => {
    render(<FirstRunModal open={true} />)
    fireEvent.click(screen.getByText('stub-pick-generate'))

    expect(screen.getByTestId('tutorial-step')).toBeInTheDocument()
    expect(screen.queryByTestId('path-choice-step')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('stub-minimise'))

    await waitFor(() => {
      expect(mockMinimise).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('B.2: Minimera from tutorial — if minimise fails, modal stays on the tutorial step (no route)', async () => {
    const { toast } = await import('sonner')
    mockMinimise.mockResolvedValueOnce({
      ok: false,
      error: 'Kunde inte stänga guiden.',
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<FirstRunModal open={true} />)
    fireEvent.click(screen.getByText('stub-pick-generate'))
    fireEvent.click(screen.getByText('stub-minimise'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Något gick fel. Försök igen.')
    })
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByTestId('tutorial-step')).toBeInTheDocument()

    errSpy.mockRestore()
  })

  // ------------------------------------------------------------------
  // Story 25.4 (B.4): done-state transition coverage
  // ------------------------------------------------------------------

  it("B.4: transitions tutorial → done-generate when SWR sees status='completed'", async () => {
    // First render — SWR returns in_progress so we sit in tutorial.
    setSwrData({ status: 'in_progress', error: null })
    const { rerender } = render(<FirstRunModal open={true} />)
    fireEvent.click(screen.getByText('stub-pick-generate'))
    expect(screen.getByTestId('tutorial-step')).toBeInTheDocument()

    // Now flip SWR to completed and re-render. The auto-transition effect
    // should swap step to done-generate.
    setSwrData({
      status: 'completed',
      itemCount: 42,
      groups: [
        { name: 'Miljö', count: 20 },
        { name: 'Arbetsmiljö', count: 22 },
      ],
      error: null,
    })
    rerender(<FirstRunModal open={true} />)

    await waitFor(() => {
      expect(screen.getByTestId('done-generate-step')).toBeInTheDocument()
    })
    expect(screen.getByTestId('done-generate-count').textContent).toBe('42')
    expect(screen.getByText('Er laglista är klar')).toBeInTheDocument()
  })

  it("B.4: transitions tutorial → done-generate failed-card when status='failed'", async () => {
    setSwrData({ status: 'in_progress', error: null })
    const { rerender } = render(<FirstRunModal open={true} />)
    fireEvent.click(screen.getByText('stub-pick-generate'))

    setSwrData({
      status: 'failed',
      error: 'LLM-fel: anslutningen bröts',
    })
    rerender(<FirstRunModal open={true} />)

    await waitFor(() => {
      const node = screen.getByTestId('done-generate-step')
      expect(node).toHaveAttribute('data-mode', 'failed')
    })
    expect(
      screen.getByRole('button', { name: 'stub-retry' })
    ).toBeInTheDocument()
  })

  it('B.4: import success transitions to done-import step (does NOT route immediately)', async () => {
    render(<FirstRunModal open={true} />)

    fireEvent.click(screen.getByText('stub-pick-import'))
    fireEvent.click(screen.getByText('stub-import-success'))

    // Path-chosen telemetry fires eagerly.
    await waitFor(() => {
      expect(mockRecordEvent).toHaveBeenCalledWith('path_chosen', {
        path: 'import',
        import_id: 'import-test-123',
      })
    })
    // getImport fetched the counts.
    await waitFor(() => {
      expect(mockGetImport).toHaveBeenCalledWith('import-test-123')
    })
    // Done-import step rendered with the counts from the mock.
    await waitFor(() => {
      expect(screen.getByTestId('done-import-step')).toBeInTheDocument()
    })
    expect(screen.getByTestId('done-import-counts').textContent).toBe('12/5/3')
    expect(screen.getByText('Matchningen är klar')).toBeInTheDocument()
    // No immediate route — the route fires when user clicks "Granska matchningar".
    expect(mockPush).not.toHaveBeenCalled()
    // Minimise NOT called either — that's deferred to the primary CTA.
    expect(mockMinimise).not.toHaveBeenCalled()
  })

  it('B.4: import success → Granska matchningar CTA minimises + closes + routes to /granska', async () => {
    render(<FirstRunModal open={true} />)
    fireEvent.click(screen.getByText('stub-pick-import'))
    fireEvent.click(screen.getByText('stub-import-success'))

    await waitFor(() => {
      expect(screen.getByTestId('done-import-step')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('stub-go-to-review'))

    await waitFor(() => {
      expect(mockMinimise).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        '/laglistor/skapa/import-test-123/granska'
      )
    })
    expect(mockRecordEvent).toHaveBeenCalledWith('done_cta_clicked', {
      path: 'import',
      cta: 'go_to_review',
    })
  })

  it('B.4: import success — if getImport fails, falls back to legacy route (no done-import)', async () => {
    mockGetImport.mockResolvedValueOnce({
      success: false,
      error: 'getImport failed',
    })
    render(<FirstRunModal open={true} />)

    fireEvent.click(screen.getByText('stub-pick-import'))
    fireEvent.click(screen.getByText('stub-import-success'))

    await waitFor(() => {
      expect(mockMinimise).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        '/laglistor/skapa/import-test-123/granska'
      )
    })
    // Done-import step does NOT render — we fell back to the 25.1 behaviour.
    expect(screen.queryByTestId('done-import-step')).not.toBeInTheDocument()
  })

  it('B.4: template apply transitions to done-template step', async () => {
    render(<FirstRunModal open={true} templates={[]} />)
    fireEvent.click(screen.getByText('stub-pick-template'))
    fireEvent.click(screen.getByText('stub-template-apply'))

    await waitFor(() => {
      expect(screen.getByTestId('done-template-step')).toBeInTheDocument()
    })
    expect(screen.getByText('Test Template / 5')).toBeInTheDocument()
    expect(screen.getByText('Mallen är aktiverad')).toBeInTheDocument()
  })

  it('B.4: template done → Visa min laglista CTA routes to /laglistor/{listId}', async () => {
    render(<FirstRunModal open={true} templates={[]} />)
    fireEvent.click(screen.getByText('stub-pick-template'))
    fireEvent.click(screen.getByText('stub-template-apply'))

    await waitFor(() => {
      expect(screen.getByTestId('done-template-step')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('stub-show-template-list'))

    await waitFor(() => {
      expect(mockMinimise).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/laglistor?list=list-test-123')
    })
    expect(mockRecordEvent).toHaveBeenCalledWith('done_cta_clicked', {
      path: 'template',
      cta: 'show_list',
    })
  })

  it('B.4: done_shown fires exactly once for done-template under StrictMode', async () => {
    render(
      <StrictMode>
        <FirstRunModal open={true} templates={[]} />
      </StrictMode>
    )
    fireEvent.click(screen.getByText('stub-pick-template'))
    fireEvent.click(screen.getByText('stub-template-apply'))

    await waitFor(() => {
      expect(screen.getByTestId('done-template-step')).toBeInTheDocument()
    })

    const calls = mockRecordEvent.mock.calls.filter(
      ([eventType, payload]) =>
        eventType === 'done_shown' &&
        (payload as { path?: string })?.path === 'template'
    )
    expect(calls).toHaveLength(1)
  })
})
