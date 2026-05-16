/**
 * Story 25.0 / 25.1 (Epic 25): render coverage for the <FirstRunModal>
 * shell. Verifies:
 *  - the dialog renders the path-choice step + header copy
 *  - `modal_opened` telemetry fires exactly once (also under StrictMode)
 *  - the closed-modal state renders nothing
 *  - sub-step transitions swap the header copy (B.1 AC 14, 37)
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

// Stub the sub-step children so the shell test stays focused on the shell
// behaviour (header copy + sub-step transitions). Each stub exposes the
// callback props the shell wires in.
vi.mock('@/components/features/onboarding-modal/path-choice-step', () => ({
  PathChoiceStep: ({
    onClose,
    onPickTemplate,
    onPickImport,
  }: {
    onClose: () => void
    onPickTemplate: () => void
    onPickImport: () => void
  }) => (
    <div data-testid="path-choice-step">
      <button onClick={onPickTemplate}>stub-pick-template</button>
      <button onClick={onPickImport}>stub-pick-import</button>
      <button onClick={onClose}>stub-close</button>
    </div>
  ),
}))

vi.mock('@/components/features/onboarding-modal/template-pick-step', () => ({
  TemplatePickStep: ({ onBack }: { onBack: () => void }) => (
    <div data-testid="template-pick-step">
      <button onClick={onBack}>stub-template-back</button>
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

import { FirstRunModal } from '@/components/features/onboarding-modal/first-run-modal'

describe('<FirstRunModal>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('onSuccess from <ImportUploadStep> records path_chosen with import_id, minimises, closes, routes (AC 23 / QA TEST-COV-001)', async () => {
    render(<FirstRunModal open={true} />)

    fireEvent.click(screen.getByText('stub-pick-import'))
    fireEvent.click(screen.getByText('stub-import-success'))

    await waitFor(() => {
      expect(mockRecordEvent).toHaveBeenCalledWith('path_chosen', {
        path: 'import',
        import_id: 'import-test-123',
      })
    })
    await waitFor(() => {
      expect(mockMinimise).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        '/laglistor/skapa/import-test-123/granska'
      )
    })
  })

  it('onSuccess from <ImportUploadStep>: if minimise fails, stays open and does NOT route (QA ROBUST-001)', async () => {
    const { toast } = await import('sonner')
    mockMinimise.mockResolvedValueOnce({
      ok: false,
      error: 'Kunde inte stänga guiden.',
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<FirstRunModal open={true} />)

    fireEvent.click(screen.getByText('stub-pick-import'))
    fireEvent.click(screen.getByText('stub-import-success'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Något gick fel. Försök igen.')
    })
    // Did NOT route — user kept on the import sub-step (modal still open)
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByTestId('import-upload-step')).toBeInTheDocument()

    errSpy.mockRestore()
  })
})
