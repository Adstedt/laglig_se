/**
 * Story 7.5: shared KollektivavtalManager (list + upload) and the HR-area
 * dialog mount — both surfaces render the SAME upload form component.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KollektivavtalManager } from '@/components/features/kollektivavtal/kollektivavtal-manager'
import { KollektivavtalUploadDialog } from '@/components/features/kollektivavtal/kollektivavtal-upload-dialog'
import type { CollectiveAgreementListItem } from '@/app/actions/collective-agreements'

const mockUpload = vi.fn()
const mockList = vi.fn()
vi.mock('@/app/actions/collective-agreements', () => ({
  uploadCollectiveAgreement: (...args: unknown[]) => mockUpload(...args),
  listCollectiveAgreements: (...args: unknown[]) => mockList(...args),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function makeItem(
  overrides: Partial<CollectiveAgreementListItem> = {}
): CollectiveAgreementListItem {
  return {
    id: 'agr-1',
    name: 'Byggavtalet 2024',
    personel_type: 'ARB',
    status: 'READY',
    effective_from: '2024-04-01',
    effective_to: '2025-03-31',
    uploaded_by: 'user-1',
    created_at: '2026-07-01T08:00:00.000Z',
    assignedEmployeeCount: 3,
    ...overrides,
  } as CollectiveAgreementListItem
}

beforeEach(() => {
  vi.clearAllMocks()
  mockList.mockResolvedValue({ success: true, data: [] })
  mockUpload.mockResolvedValue({ success: true, data: makeItem() })
})

describe('KollektivavtalManager — list', () => {
  test('renders agreements with typ, period, assigned count and status badge', () => {
    render(<KollektivavtalManager initialAgreements={[makeItem()]} canManage />)

    expect(screen.getByText('Byggavtalet 2024')).toBeInTheDocument()
    expect(
      screen.getByText(/Arbetare · Giltighetsperiod: 2024-04-01 – 2025-03-31/)
    ).toBeInTheDocument()
    expect(screen.getByText(/3 anställda kopplade/)).toBeInTheDocument()
    expect(screen.getByText('Klart')).toBeInTheDocument()
  })

  test('missing period shows "Ej ifylld" (empty-state label, not omitted)', () => {
    render(
      <KollektivavtalManager
        initialAgreements={[
          makeItem({
            effective_from: null,
            effective_to: null,
            personel_type: null,
            status: 'PENDING',
            assignedEmployeeCount: 1,
          }),
        ]}
        canManage
      />
    )

    expect(
      screen.getByText(/Övrigt · Giltighetsperiod: Ej ifylld/)
    ).toBeInTheDocument()
    expect(screen.getByText(/1 anställd kopplad/)).toBeInTheDocument()
    expect(screen.getByText('Väntar')).toBeInTheDocument()
  })

  test('empty list → empty state; null (failed fetch) → muted error, never empty-state', () => {
    // Two fresh mounts (list state is initialized from the prop once —
    // a rerender with a new prop would not reset it by design).
    const { unmount } = render(
      <KollektivavtalManager initialAgreements={[]} canManage />
    )
    expect(
      screen.getByText('Inga kollektivavtal har laddats upp än.')
    ).toBeInTheDocument()
    unmount()

    render(<KollektivavtalManager initialAgreements={null} canManage />)
    expect(
      screen.getByText('Kollektivavtal kunde inte laddas.')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Inga kollektivavtal har laddats upp än.')
    ).toBeNull()
  })

  test('canManage=false hides the upload form (server actions remain the boundary)', () => {
    render(<KollektivavtalManager initialAgreements={[]} canManage={false} />)
    expect(screen.queryByLabelText(/PDF-fil/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Ladda upp/ })).toBeNull()
  })
})

describe('KollektivavtalManager — upload flow', () => {
  test('successful upload appends the new agreement and refreshes from the server', async () => {
    const user = userEvent.setup()
    mockList.mockResolvedValue({
      success: true,
      data: [makeItem({ status: 'PROCESSING' })],
    })
    render(<KollektivavtalManager initialAgreements={[]} canManage />)

    await user.type(screen.getByLabelText(/Namn/), 'Byggavtalet 2024')
    await user.upload(
      screen.getByLabelText(/PDF-fil/),
      new File(['%PDF-1.4'], 'byggavtalet.pdf', { type: 'application/pdf' })
    )
    await user.click(screen.getByRole('button', { name: /Ladda upp$/ }))

    // Optimistic append lands first; the refresh then brings the server truth
    // (status already advanced to Bearbetas).
    expect(await screen.findByText('Byggavtalet 2024')).toBeInTheDocument()
    await waitFor(() => expect(mockList).toHaveBeenCalled())
    expect(await screen.findByText('Bearbetas')).toBeInTheDocument()
  })
})

describe('KollektivavtalUploadDialog — HR mount renders the SAME form', () => {
  test('dialog wraps the shared upload form (same fields as the Settings mount)', () => {
    render(
      <KollektivavtalUploadDialog
        open
        onOpenChange={vi.fn()}
        onUploaded={vi.fn()}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Ladda upp kollektivavtal' })
    ).toBeInTheDocument()
    // The shared form's fields — identical to the manager mount.
    expect(screen.getByLabelText(/Namn/)).toBeInTheDocument()
    expect(screen.getByLabelText('Typ')).toBeInTheDocument()
    expect(screen.getByLabelText(/PDF-fil/)).toBeInTheDocument()
    expect(screen.getByText(/Giltighetsperiod/)).toBeInTheDocument()
  })

  test('upload closes the dialog and lifts the agreement', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onUploaded = vi.fn()
    render(
      <KollektivavtalUploadDialog
        open
        onOpenChange={onOpenChange}
        onUploaded={onUploaded}
      />
    )

    await user.type(screen.getByLabelText(/Namn/), 'Byggavtalet 2024')
    await user.upload(
      screen.getByLabelText(/PDF-fil/),
      new File(['%PDF-1.4'], 'byggavtalet.pdf', { type: 'application/pdf' })
    )
    await user.click(screen.getByRole('button', { name: /Ladda upp$/ }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalled())
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  test('Avbryt closes without uploading', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <KollektivavtalUploadDialog
        open
        onOpenChange={onOpenChange}
        onUploaded={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Avbryt' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockUpload).not.toHaveBeenCalled()
  })
})
