/**
 * Story 7.5: shared KollektivavtalManager (list + upload) and the HR-area
 * dialog mount — both surfaces render the SAME upload form component.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KollektivavtalManager } from '@/components/features/kollektivavtal/kollektivavtal-manager'
import { KollektivavtalUploadDialog } from '@/components/features/kollektivavtal/kollektivavtal-upload-dialog'
import type { CollectiveAgreementListItem } from '@/app/actions/collective-agreements'

const mockUpload = vi.fn()
const mockList = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockAssign = vi.fn()
const mockPreview = vi.fn()
vi.mock('@/app/actions/collective-agreements', () => ({
  uploadCollectiveAgreement: (...args: unknown[]) => mockUpload(...args),
  listCollectiveAgreements: (...args: unknown[]) => mockList(...args),
  updateCollectiveAgreement: (...args: unknown[]) => mockUpdate(...args),
  deleteCollectiveAgreement: (...args: unknown[]) => mockDelete(...args),
  assignCollectiveAgreementBulk: (...args: unknown[]) => mockAssign(...args),
  previewBulkAssignCount: (...args: unknown[]) => mockPreview(...args),
}))

// Story 7.6: the assign dialog fetches groups lazily.
const mockGetGroups = vi.fn()
vi.mock('@/app/actions/employees', () => ({
  getEmployeeGroups: (...args: unknown[]) => mockGetGroups(...args),
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
  mockUpdate.mockResolvedValue({ success: true, data: makeItem() })
  mockDelete.mockResolvedValue({ success: true })
  mockAssign.mockResolvedValue({ success: true, data: { assigned: 3 } })
  mockPreview.mockResolvedValue({ success: true, data: { count: 3 } })
  mockGetGroups.mockResolvedValue({ success: true, data: [] })
})

describe('KollektivavtalManager — list (structured table, checkpoint round 2)', () => {
  test('renders a table with Namn/Typ/Giltighetsperiod/Uppladdad/Kopplade/Status columns', () => {
    render(<KollektivavtalManager initialAgreements={[makeItem()]} canManage />)

    const table = screen.getByRole('table')
    for (const label of [
      'Namn',
      'Typ',
      'Giltighetsperiod',
      'Uppladdad',
      'Kopplade',
      'Status',
    ]) {
      expect(
        within(table).getByRole('columnheader', { name: label })
      ).toBeInTheDocument()
    }
    // Row values live in their own cells — no meta run-on line.
    expect(within(table).getByText('Byggavtalet 2024')).toBeInTheDocument()
    expect(within(table).getByText('Arbetare')).toBeInTheDocument()
    expect(
      within(table).getByText('2024-04-01 – 2025-03-31')
    ).toBeInTheDocument()
    expect(within(table).getByText('2026-07-01')).toBeInTheDocument()
    expect(within(table).getByText('3 anställda')).toBeInTheDocument()
    expect(within(table).getByText('Klart')).toBeInTheDocument()
  })

  test('missing period shows "Ej ifylld" (empty-state label, not omitted); 0 kopplade shows "0"', () => {
    render(
      <KollektivavtalManager
        initialAgreements={[
          makeItem({
            effective_from: null,
            effective_to: null,
            personel_type: null,
            status: 'PENDING',
            assignedEmployeeCount: 0,
          }),
        ]}
        canManage
      />
    )

    const table = screen.getByRole('table')
    expect(within(table).getByText('Övrigt')).toBeInTheDocument()
    expect(within(table).getByText('Ej ifylld')).toBeInTheDocument()
    expect(within(table).getByText('0')).toBeInTheDocument()
    expect(within(table).getByText('Väntar')).toBeInTheDocument()
  })

  test('kopplade count uses natural Swedish singular ("1 anställd")', () => {
    render(
      <KollektivavtalManager
        initialAgreements={[makeItem({ assignedEmployeeCount: 1 })]}
        canManage
      />
    )
    expect(
      within(screen.getByRole('table')).getByText('1 anställd')
    ).toBeInTheDocument()
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

  test("variant='dialog' renders flat: no Card chrome, no own title; 'page' default keeps the cards", () => {
    // Dialog chrome (checkpoint round): the mounting dialog's header carries
    // the title/description, so the manager must not duplicate them or wrap
    // sections in bordered cards (frame-in-frame).
    const { container, unmount } = render(
      <KollektivavtalManager
        initialAgreements={[makeItem()]}
        canManage
        variant="dialog"
      />
    )
    expect(container.querySelector('.bg-card')).toBeNull()
    expect(screen.queryByText('Kollektivavtal')).toBeNull()
    expect(screen.queryByText(/Uppladdade avtal blir valbara/)).toBeNull()
    // Checkpoint round 2: the agreements table gets its own Safiro section
    // label in the dialog chrome (the page card's header covers this on
    // the Settings mount).
    const listLabel = screen.getByRole('heading', { name: 'Uppladdade avtal' })
    expect(listLabel).toHaveClass('font-safiro', 'font-medium')
    // Upload section keeps its own Safiro section label + the form.
    const uploadLabel = screen.getByRole('heading', {
      name: 'Ladda upp kollektivavtal',
    })
    expect(uploadLabel).toHaveClass('font-safiro', 'font-medium')
    expect(screen.getByText('Byggavtalet 2024')).toBeInTheDocument()
    unmount()

    // Settings mount unchanged: card chrome + own title/description.
    const { container: pageContainer } = render(
      <KollektivavtalManager initialAgreements={[makeItem()]} canManage />
    )
    expect(pageContainer.querySelector('.bg-card')).not.toBeNull()
    expect(screen.getByText('Kollektivavtal')).toBeInTheDocument()
    expect(
      screen.getByText(/Uppladdade avtal blir valbara/)
    ).toBeInTheDocument()
    // The dialog-only section label does not leak into the page chrome
    // (the card header already frames the list there).
    expect(
      screen.queryByRole('heading', { name: 'Uppladdade avtal' })
    ).toBeNull()
  })
})

describe('KollektivavtalManager — row actions (Story 7.6)', () => {
  test('shows Uppladdad as its own column (AC 1)', () => {
    render(<KollektivavtalManager initialAgreements={[makeItem()]} canManage />)
    const table = screen.getByRole('table')
    expect(
      within(table).getByRole('columnheader', { name: 'Uppladdad' })
    ).toBeInTheDocument()
    expect(within(table).getByText('2026-07-01')).toBeInTheDocument()
  })

  test('canManage renders a first-class Tilldela button + Redigera/Ta bort in the overflow menu', async () => {
    const user = userEvent.setup()
    render(<KollektivavtalManager initialAgreements={[makeItem()]} canManage />)

    expect(screen.getByRole('button', { name: /Tilldela/ })).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: 'Fler åtgärder för Byggavtalet 2024',
      })
    )
    expect(
      await screen.findByRole('menuitem', { name: /Redigera/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /Ta bort/ })
    ).toBeInTheDocument()
  })

  test('canManage=false hides every action affordance (server actions remain the boundary)', () => {
    render(
      <KollektivavtalManager
        initialAgreements={[makeItem()]}
        canManage={false}
      />
    )
    expect(screen.queryByRole('button', { name: /Tilldela/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Fler åtgärder/ })).toBeNull()
  })

  test('Ta bort → confirmation with consequence copy → delete removes the row', async () => {
    const user = userEvent.setup()
    render(
      <KollektivavtalManager
        initialAgreements={[makeItem({ assignedEmployeeCount: 3 })]}
        canManage
      />
    )

    await user.click(
      screen.getByRole('button', { name: 'Fler åtgärder för Byggavtalet 2024' })
    )
    await user.click(await screen.findByRole('menuitem', { name: /Ta bort/ }))

    // Consequence dialog (AC 3) before anything happens.
    expect(
      await screen.findByText('3 anställda kommer att avtilldelas.')
    ).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Ta bort' }))

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('agr-1'))
    // Optimistic removal + server refresh.
    await waitFor(() =>
      expect(screen.queryByText('Byggavtalet 2024')).toBeNull()
    )
    expect(mockList).toHaveBeenCalled()
  })

  test('Redigera opens the edit dialog prefilled; saving updates the row', async () => {
    const user = userEvent.setup()
    mockUpdate.mockResolvedValue({
      success: true,
      data: makeItem({ name: 'Byggavtalet 2025' }),
    })
    mockList.mockResolvedValue({
      success: true,
      data: [makeItem({ name: 'Byggavtalet 2025' })],
    })
    render(<KollektivavtalManager initialAgreements={[makeItem()]} canManage />)

    await user.click(
      screen.getByRole('button', { name: 'Fler åtgärder för Byggavtalet 2024' })
    )
    await user.click(await screen.findByRole('menuitem', { name: /Redigera/ }))

    // Scope to the edit dialog — the upload form behind it has its own Namn.
    const dialog = await screen.findByRole('dialog')
    const nameInput = within(dialog).getByLabelText(/Namn/)
    expect(nameInput).toHaveValue('Byggavtalet 2024')

    await user.clear(nameInput)
    await user.type(nameInput, 'Byggavtalet 2025')
    await user.click(screen.getByRole('button', { name: 'Spara' }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        'agr-1',
        expect.objectContaining({ name: 'Byggavtalet 2025' })
      )
    )
    expect(await screen.findByText('Byggavtalet 2025')).toBeInTheDocument()
  })

  test('Tilldela opens the bulk-assign dialog with the preview count; confirm refreshes the list', async () => {
    const user = userEvent.setup()
    render(<KollektivavtalManager initialAgreements={[makeItem()]} canManage />)

    await user.click(screen.getByRole('button', { name: /Tilldela/ }))

    // Live preview (agreement typ ARB is the default target).
    expect(
      await screen.findByText('Tilldelar 3 anställda.')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tilldela' }))

    await waitFor(() =>
      expect(mockAssign).toHaveBeenCalledWith('agr-1', {
        kind: 'personel_type',
        value: 'ARB',
      })
    )
    await waitFor(() => expect(mockList).toHaveBeenCalled())
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
