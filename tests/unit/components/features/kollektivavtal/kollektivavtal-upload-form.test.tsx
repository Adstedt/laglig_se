/**
 * Story 7.5: shared upload form — validation states + submit wiring to the
 * `uploadCollectiveAgreement` server action (mocked; the action's own
 * contract is covered in tests/unit/app/actions/collective-agreements.test.ts).
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KollektivavtalUploadForm } from '@/components/features/kollektivavtal/kollektivavtal-upload-form'

const mockUpload = vi.fn()
const mockList = vi.fn()
vi.mock('@/app/actions/collective-agreements', () => ({
  uploadCollectiveAgreement: (...args: unknown[]) => mockUpload(...args),
  listCollectiveAgreements: (...args: unknown[]) => mockList(...args),
}))

const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

const UPLOADED = {
  id: 'agr-1',
  name: 'Byggavtalet 2024',
  personel_type: 'ARB',
  status: 'PENDING',
  effective_from: null,
  effective_to: null,
  uploaded_by: 'user-1',
  created_at: '2026-07-03T10:00:00.000Z',
  assignedEmployeeCount: 0,
}

function makePdf(name = 'byggavtalet.pdf'): File {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUpload.mockResolvedValue({ success: true, data: UPLOADED })
})

describe('KollektivavtalUploadForm — validation states', () => {
  test('empty submit → Namn + fil errors, no action call', async () => {
    const user = userEvent.setup()
    render(<KollektivavtalUploadForm onUploaded={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Ladda upp/ }))

    expect(await screen.findByText('Namn krävs.')).toBeInTheDocument()
    expect(screen.getByText('Välj en PDF-fil.')).toBeInTheDocument()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  test('non-PDF file → PDF-only error', async () => {
    // applyAccept:false — the input's accept="application/pdf" would otherwise
    // block the selection client-side; the component's own validation is under test.
    const user = userEvent.setup({ applyAccept: false })
    render(<KollektivavtalUploadForm onUploaded={vi.fn()} />)

    await user.type(screen.getByLabelText(/Namn/), 'Byggavtalet 2024')
    const txt = new File(['hej'], 'avtal.txt', { type: 'text/plain' })
    await user.upload(screen.getByLabelText(/PDF-fil/), txt)
    await user.click(screen.getByRole('button', { name: /Ladda upp/ }))

    expect(
      await screen.findByText('Endast PDF-filer kan laddas upp.')
    ).toBeInTheDocument()
    expect(mockUpload).not.toHaveBeenCalled()
  })
})

describe('KollektivavtalUploadForm — submit', () => {
  test('happy path: posts FormData (name, typ, file) and lifts the created agreement', async () => {
    const user = userEvent.setup()
    const onUploaded = vi.fn()
    render(<KollektivavtalUploadForm onUploaded={onUploaded} />)

    await user.type(screen.getByLabelText(/Namn/), 'Byggavtalet 2024')
    await user.upload(screen.getByLabelText(/PDF-fil/), makePdf())
    await user.click(screen.getByRole('button', { name: /Ladda upp/ }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(UPLOADED))

    const formData = mockUpload.mock.calls[0]![0] as FormData
    expect(formData.get('name')).toBe('Byggavtalet 2024')
    // Default typ is Övrigt → empty personel_type on the wire (null server-side).
    expect(formData.get('personel_type')).toBe('')
    expect((formData.get('file') as File).name).toBe('byggavtalet.pdf')
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  test('server error → toast, no onUploaded', async () => {
    mockUpload.mockResolvedValue({
      success: false,
      error: 'En fil med samma namn finns redan i Filer.',
    })
    const user = userEvent.setup()
    const onUploaded = vi.fn()
    render(<KollektivavtalUploadForm onUploaded={onUploaded} />)

    await user.type(screen.getByLabelText(/Namn/), 'Byggavtalet 2024')
    await user.upload(screen.getByLabelText(/PDF-fil/), makePdf())
    await user.click(screen.getByRole('button', { name: /Ladda upp/ }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'En fil med samma namn finns redan i Filer.'
      )
    )
    expect(onUploaded).not.toHaveBeenCalled()
  })
})
