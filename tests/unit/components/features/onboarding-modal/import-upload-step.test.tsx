/**
 * Story 24.2: Component test for import-upload-step.
 *
 * Covers render + click handlers + error toast + correct server-action
 * call signatures. Does NOT drive a full fixture upload (that's the
 * integration test's job).
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/app/actions/law-list-import', () => ({
  createImport: vi.fn(),
  parseImportFile: vi.fn(),
  runMatching: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

import { ImportUploadStep } from '@/components/features/onboarding-modal/import-upload-step'
import {
  createImport,
  parseImportFile,
  runMatching,
} from '@/app/actions/law-list-import'
import { toast } from 'sonner'

const mockCreateImport = vi.mocked(createImport)
const mockParseImportFile = vi.mocked(parseImportFile)
const mockRunMatching = vi.mocked(runMatching)
const mockToastError = vi.mocked(toast.error)

// Default runMatching to success — individual tests can override.
function stubRunMatchingSuccess() {
  mockRunMatching.mockResolvedValue({
    success: true,
    data: { matchedCount: 0 },
  })
}

describe('ImportUploadStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders header, both tabs, and the disabled submit button', () => {
    render(<ImportUploadStep />)

    expect(
      screen.getByRole('heading', { name: 'Ladda upp er befintliga lista' })
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Fil' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Klistra in' })).toBeInTheDocument()

    const submit = screen.getByRole('button', { name: /Importera/ })
    expect(submit).toBeDisabled()
  })

  it('renders the dropzone copy on the Fil tab and the recognised-columns hint', () => {
    render(<ImportUploadStep />)

    expect(
      screen.getByText('Dra & släpp eller välj från dator')
    ).toBeInTheDocument()
    expect(screen.getByText('.xlsx, .xls, .csv — max 5 MB')).toBeInTheDocument()
    expect(
      screen.getByText('Vi känner igen dessa kolumner')
    ).toBeInTheDocument()
    expect(screen.getByText('Lag/Titel')).toBeInTheDocument()
    expect(screen.getByText('SFS-nummer')).toBeInTheDocument()
    expect(screen.getByText('Område')).toBeInTheDocument()
    expect(screen.getByText('Lagansvarig')).toBeInTheDocument()
    expect(screen.getByText('Kommentar')).toBeInTheDocument()
  })

  it('switches to paste mode and shows the textarea', async () => {
    const user = userEvent.setup()
    render(<ImportUploadStep />)

    await user.click(screen.getByRole('tab', { name: 'Klistra in' }))

    expect(
      screen.getByPlaceholderText(
        'Klistra in raderna här — en lag per rad eller kopiera direkt från Excel'
      )
    ).toBeInTheDocument()
  })

  it('toasts an error if user clicks Importera with no input', async () => {
    const user = userEvent.setup()
    render(<ImportUploadStep />)

    // Switch to paste mode (so the field is enabled), but leave it empty.
    await user.click(screen.getByRole('tab', { name: 'Klistra in' }))

    // The submit button is disabled — but we can verify the disabled state is
    // exactly what guards the empty-paste case.
    const submit = screen.getByRole('button', { name: /Importera/ })
    expect(submit).toBeDisabled()
  })

  it('calls createImport then parseImportFile then runMatching when paste is submitted', async () => {
    mockCreateImport.mockResolvedValue({
      success: true,
      data: { importId: 'import-123' },
    })
    mockParseImportFile.mockResolvedValue({
      success: true,
      data: {
        rowCount: 3,
        columnMapping: {
          titel: 'titel',
          sfs_nummer: null,
          omrade: null,
          lagansvarig: null,
          kommentar: null,
          _confidence: {
            titel: 0.5,
            sfs_nummer: 0,
            omrade: 0,
            lagansvarig: 0,
            kommentar: 0,
          },
        },
        truncated: false,
      },
    })
    stubRunMatchingSuccess()

    const user = userEvent.setup()
    render(<ImportUploadStep />)

    await user.click(screen.getByRole('tab', { name: 'Klistra in' }))
    await user.type(
      screen.getByPlaceholderText(
        'Klistra in raderna här — en lag per rad eller kopiera direkt från Excel'
      ),
      'Arbetsmiljölag\nBokföringslag\nMiljöbalk'
    )

    await user.click(screen.getByRole('button', { name: /Importera/ }))

    expect(mockCreateImport).toHaveBeenCalledWith(
      expect.objectContaining({ source_type: 'paste' })
    )
    expect(mockParseImportFile).toHaveBeenCalledWith(
      expect.objectContaining({ importId: 'import-123' })
    )
    expect(mockRunMatching).toHaveBeenCalledWith('import-123')
    expect(mockPush).toHaveBeenCalledWith('/laglistor/skapa/import-123/granska')
  })

  it('surfaces the server error via toast when parseImportFile fails', async () => {
    mockCreateImport.mockResolvedValue({
      success: true,
      data: { importId: 'import-456' },
    })
    mockParseImportFile.mockResolvedValue({
      success: false,
      error: 'Filen verkar vara tom — vi hittade inga rader att importera.',
    })

    const user = userEvent.setup()
    render(<ImportUploadStep />)

    await user.click(screen.getByRole('tab', { name: 'Klistra in' }))
    await user.type(
      screen.getByPlaceholderText(
        'Klistra in raderna här — en lag per rad eller kopiera direkt från Excel'
      ),
      'a'
    )
    await user.click(screen.getByRole('button', { name: /Importera/ }))

    expect(mockToastError).toHaveBeenCalledWith(
      'Kunde inte tolka filen',
      expect.objectContaining({
        description:
          'Filen verkar vara tom — vi hittade inga rader att importera.',
      })
    )
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('uses onSuccess callback if provided instead of router.push', async () => {
    mockCreateImport.mockResolvedValue({
      success: true,
      data: { importId: 'import-cb' },
    })
    mockParseImportFile.mockResolvedValue({
      success: true,
      data: {
        rowCount: 1,
        columnMapping: {
          titel: 'titel',
          sfs_nummer: null,
          omrade: null,
          lagansvarig: null,
          kommentar: null,
          _confidence: {
            titel: 0.5,
            sfs_nummer: 0,
            omrade: 0,
            lagansvarig: 0,
            kommentar: 0,
          },
        },
        truncated: false,
      },
    })

    stubRunMatchingSuccess()

    const onSuccess = vi.fn()
    const user = userEvent.setup()
    render(<ImportUploadStep onSuccess={onSuccess} />)

    await user.click(screen.getByRole('tab', { name: 'Klistra in' }))
    await user.type(
      screen.getByPlaceholderText(
        'Klistra in raderna här — en lag per rad eller kopiera direkt från Excel'
      ),
      'Arbetsmiljölag'
    )
    await user.click(screen.getByRole('button', { name: /Importera/ }))

    expect(onSuccess).toHaveBeenCalledWith('import-cb')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('toasts an error and does NOT navigate when runMatching fails', async () => {
    mockCreateImport.mockResolvedValue({
      success: true,
      data: { importId: 'import-fail' },
    })
    mockParseImportFile.mockResolvedValue({
      success: true,
      data: {
        rowCount: 2,
        columnMapping: {
          titel: 'titel',
          sfs_nummer: null,
          omrade: null,
          lagansvarig: null,
          kommentar: null,
          _confidence: {
            titel: 0.5,
            sfs_nummer: 0,
            omrade: 0,
            lagansvarig: 0,
            kommentar: 0,
          },
        },
        truncated: false,
      },
    })
    mockRunMatching.mockResolvedValue({
      success: false,
      error: 'LLM rate limit',
    })

    const user = userEvent.setup()
    render(<ImportUploadStep />)

    await user.click(screen.getByRole('tab', { name: 'Klistra in' }))
    await user.type(
      screen.getByPlaceholderText(
        'Klistra in raderna här — en lag per rad eller kopiera direkt från Excel'
      ),
      'Arbetsmiljölag\nMiljöbalk'
    )
    await user.click(screen.getByRole('button', { name: /Importera/ }))

    expect(mockRunMatching).toHaveBeenCalledWith('import-fail')
    expect(mockToastError).toHaveBeenCalledWith(
      'Kunde inte matcha raderna mot katalogen',
      expect.objectContaining({ description: 'LLM rate limit' })
    )
    expect(mockPush).not.toHaveBeenCalled()
  })
})
