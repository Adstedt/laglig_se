/**
 * Story 7.6 (checkpoint round): Personalregister-toolbar dialog mount of the
 * shared KollektivavtalManager — trigger renders, list is fetched on open
 * (self-fetch, unlike the Settings prefetch), the REAL manager renders inside
 * the dialog with its row actions intact, fetch failure falls through to the
 * manager's own error copy, and closing refreshes the route so the register
 * island re-syncs.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KollektivavtalManagerDialog } from '@/components/features/kollektivavtal/kollektivavtal-manager-dialog'
import type { CollectiveAgreementListItem } from '@/app/actions/collective-agreements'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockList = vi.fn()
vi.mock('@/app/actions/collective-agreements', () => ({
  uploadCollectiveAgreement: vi.fn(),
  listCollectiveAgreements: (...args: unknown[]) => mockList(...args),
  updateCollectiveAgreement: vi.fn(),
  deleteCollectiveAgreement: vi.fn(),
  assignCollectiveAgreementBulk: vi.fn(),
  previewBulkAssignCount: vi.fn(),
}))

// The assign dialog (manager child) fetches groups lazily.
vi.mock('@/app/actions/employees', () => ({
  getEmployeeGroups: vi.fn().mockResolvedValue({ success: true, data: [] }),
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
  mockList.mockResolvedValue({ success: true, data: [makeItem()] })
})

describe('KollektivavtalManagerDialog', () => {
  test('renders the toolbar trigger; no fetch until opened', () => {
    render(<KollektivavtalManagerDialog canManage />)

    expect(
      screen.getByRole('button', { name: 'Kollektivavtal' })
    ).toBeInTheDocument()
    expect(mockList).not.toHaveBeenCalled()
  })

  test('opening fetches the list and renders the manager with row actions (Tilldela)', async () => {
    const user = userEvent.setup()
    render(<KollektivavtalManagerDialog canManage />)

    await user.click(screen.getByRole('button', { name: 'Kollektivavtal' }))

    expect(mockList).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Byggavtalet 2024')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tilldela' })).toBeInTheDocument()
    // Overflow menu (Redigera/Ta bort) is present per row.
    expect(
      screen.getByRole('button', {
        name: 'Fler åtgärder för Byggavtalet 2024',
      })
    ).toBeInTheDocument()
  })

  test('dialog chrome (user checkpoint): DialogHeader carries title/description; manager renders FLAT', async () => {
    const user = userEvent.setup()
    render(<KollektivavtalManagerDialog canManage />)

    await user.click(screen.getByRole('button', { name: 'Kollektivavtal' }))
    await screen.findByText('Byggavtalet 2024')

    const dialog = screen.getByRole('dialog')
    // The header owns the title (the ✕ no longer floats over content) and
    // the description the Settings card otherwise renders.
    expect(
      screen.getByRole('heading', { name: 'Kollektivavtal' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Uppladdade avtal blir valbara i personalregistret/)
    ).toBeInTheDocument()
    // Flat variant: no Card chrome inside the dialog (no frame-in-frame)…
    expect(dialog.querySelector('.bg-card')).toBeNull()
    // …the title appears exactly once (no duplicate from the manager card)…
    expect(within(dialog).getAllByText('Kollektivavtal')).toHaveLength(1)
    // …and the upload section keeps its own Safiro section label.
    const uploadLabel = screen.getByRole('heading', {
      name: 'Ladda upp kollektivavtal',
    })
    expect(uploadLabel).toHaveClass('font-safiro', 'font-medium')
  })

  test('view-only (canManage=false): list renders without Tilldela or upload', async () => {
    const user = userEvent.setup()
    render(<KollektivavtalManagerDialog canManage={false} />)

    await user.click(screen.getByRole('button', { name: 'Kollektivavtal' }))

    expect(await screen.findByText('Byggavtalet 2024')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tilldela' })).toBeNull()
    expect(screen.queryByText('Ladda upp kollektivavtal')).toBeNull()
  })

  test('fetch failure falls through to the manager error copy', async () => {
    mockList.mockResolvedValue({ success: false, error: 'Åtkomst nekad' })
    const user = userEvent.setup()
    render(<KollektivavtalManagerDialog canManage />)

    await user.click(screen.getByRole('button', { name: 'Kollektivavtal' }))

    expect(
      await screen.findByText('Kollektivavtal kunde inte laddas.')
    ).toBeInTheDocument()
  })

  test('closing the dialog calls router.refresh() so the register re-syncs', async () => {
    const user = userEvent.setup()
    render(<KollektivavtalManagerDialog canManage />)

    await user.click(screen.getByRole('button', { name: 'Kollektivavtal' }))
    await screen.findByText('Byggavtalet 2024')
    expect(mockRefresh).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1))
  })
})
