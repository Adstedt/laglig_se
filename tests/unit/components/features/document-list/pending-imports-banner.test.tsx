/**
 * <PendingImportsBanner> component tests.
 *
 * Renders the resume-pending-imports affordance on /laglistor +
 * exposes the discard-with-confirmation flow via the per-row ⋯ menu.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PendingImportsBanner } from '@/components/features/document-list/pending-imports-banner'
import {
  discardImport,
  type PendingImportSummary,
} from '@/app/actions/law-list-import'

vi.mock('@/app/actions/law-list-import', () => ({
  discardImport: vi.fn(),
}))

const mockRouterRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

const mockDiscardImport = vi.mocked(discardImport)

function makeImport(
  overrides: Partial<PendingImportSummary> = {}
): PendingImportSummary {
  return {
    id: 'imp-1',
    filename: 'laglista.xlsx',
    status: 'AWAITING_REVIEW',
    row_count: 4,
    created_at: new Date(Date.now() - 5 * 60_000),
    ...overrides,
  }
}

describe('<PendingImportsBanner>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDiscardImport.mockResolvedValue({
      success: true,
      data: { filename: 'laglista.xlsx' },
    })
  })

  it('returns null when imports array is empty', () => {
    const { container } = render(<PendingImportsBanner imports={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders singular Swedish copy when there is exactly 1 pending import', () => {
    render(<PendingImportsBanner imports={[makeImport()]} />)
    expect(screen.getByText('Du har 1 pågående import')).toBeInTheDocument()
  })

  it('renders plural Swedish copy when there are 2+ pending imports', () => {
    render(
      <PendingImportsBanner
        imports={[
          makeImport({ id: 'a', filename: 'a.xlsx' }),
          makeImport({ id: 'b', filename: 'b.xlsx' }),
          makeImport({ id: 'c', filename: 'c.xlsx' }),
        ]}
      />
    )
    expect(screen.getByText('Du har 3 pågående importer')).toBeInTheDocument()
  })

  it('renders filename + row count + relative timestamp + Återuppta link for AWAITING_REVIEW', () => {
    render(
      <PendingImportsBanner
        imports={[
          makeImport({
            id: 'imp-42',
            filename: 'min-lista.xlsx',
            row_count: 7,
          }),
        ]}
      />
    )
    expect(screen.getByText('min-lista.xlsx')).toBeInTheDocument()
    expect(screen.getByText(/7\s*rader/)).toBeInTheDocument()
    expect(screen.getByText(/uppladdad/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Återuppta import/i })
    expect(link).toHaveAttribute('href', '/laglistor/skapa/imp-42/granska')
  })

  it('shows "Matchar mot katalogen…" status pill (no link) for MATCHING rows', () => {
    render(
      <PendingImportsBanner
        imports={[
          makeImport({
            id: 'imp-matching',
            status: 'MATCHING',
          }),
        ]}
      />
    )
    expect(screen.getByText(/Matchar mot katalogen/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Återuppta import/i })
    ).not.toBeInTheDocument()
  })

  it('caps visible rows at 5 and shows "+N till" overflow indicator', () => {
    const imports = Array.from({ length: 8 }, (_, i) =>
      makeImport({ id: `imp-${i}`, filename: `file-${i}.xlsx` })
    )
    render(<PendingImportsBanner imports={imports} />)

    // First 5 rendered
    expect(screen.getByText('file-0.xlsx')).toBeInTheDocument()
    expect(screen.getByText('file-4.xlsx')).toBeInTheDocument()
    // 6th-8th hidden
    expect(screen.queryByText('file-5.xlsx')).not.toBeInTheDocument()
    // Overflow copy
    expect(screen.getByText(/\+3 till/)).toBeInTheDocument()
  })

  it('renders singular "rad" when row_count is 1', () => {
    render(<PendingImportsBanner imports={[makeImport({ row_count: 1 })]} />)
    expect(screen.getByText(/^1\s+rad\s+·/)).toBeInTheDocument()
  })

  // --- Discard-import flow ---

  it('opens overflow menu and shows "Avbryt import" item', async () => {
    const user = userEvent.setup()
    render(<PendingImportsBanner imports={[makeImport()]} />)

    await user.click(screen.getByRole('button', { name: /Fler åtgärder/ }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Avbryt import')).toBeInTheDocument()
  })

  it('clicking Avbryt opens AlertDialog with filename + row count', async () => {
    const user = userEvent.setup()
    render(
      <PendingImportsBanner
        imports={[makeImport({ filename: 'min-fil.xlsx', row_count: 7 })]}
      />
    )

    await user.click(screen.getByRole('button', { name: /Fler åtgärder/ }))
    await user.click(
      within(await screen.findByRole('menu')).getByText('Avbryt import')
    )

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Avbryt importen?')).toBeInTheDocument()
    expect(within(dialog).getByText('min-fil.xlsx')).toBeInTheDocument()
    expect(
      within(dialog).getByText(/7 matchningar tas bort/)
    ).toBeInTheDocument()
  })

  it('confirming discard calls discardImport + refreshes the page', async () => {
    const user = userEvent.setup()
    render(<PendingImportsBanner imports={[makeImport({ id: 'imp-42' })]} />)

    await user.click(screen.getByRole('button', { name: /Fler åtgärder/ }))
    await user.click(
      within(await screen.findByRole('menu')).getByText('Avbryt import')
    )
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Avbryt import',
      })
    )

    await waitFor(() => {
      expect(mockDiscardImport).toHaveBeenCalledWith('imp-42')
      expect(mockRouterRefresh).toHaveBeenCalled()
    })
  })

  it('cancelling the dialog (Behåll) does NOT call discardImport', async () => {
    const user = userEvent.setup()
    render(<PendingImportsBanner imports={[makeImport()]} />)

    await user.click(screen.getByRole('button', { name: /Fler åtgärder/ }))
    await user.click(
      within(await screen.findByRole('menu')).getByText('Avbryt import')
    )
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Behåll',
      })
    )

    expect(mockDiscardImport).not.toHaveBeenCalled()
    expect(mockRouterRefresh).not.toHaveBeenCalled()
  })
})
