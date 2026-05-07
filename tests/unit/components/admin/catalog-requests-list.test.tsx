/**
 * Story 24.5 AC 16: component tests for `<CatalogRequestsList>`.
 * Covers SLA-tier dot rendering, filter chips, detail panel expand/collapse,
 * fulfilment modal validation flow.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/app/actions/catalog-ingest-request', () => ({
  fulfillCatalogRequest: vi.fn(),
  rejectCatalogRequest: vi.fn(),
}))

vi.mock('@/app/actions/admin-document-lookup', () => ({
  lookupLegalDocument: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { CatalogRequestsList } from '@/components/admin/catalog-requests-list'
import {
  fulfillCatalogRequest,
  rejectCatalogRequest,
  type CatalogRequestRow,
} from '@/app/actions/catalog-ingest-request'
import { lookupLegalDocument } from '@/app/actions/admin-document-lookup'

const mockFulfill = vi.mocked(fulfillCatalogRequest)
const mockReject = vi.mocked(rejectCatalogRequest)
const mockLookup = vi.mocked(lookupLegalDocument)

function makeRequest(
  overrides: Partial<CatalogRequestRow> = {}
): CatalogRequestRow {
  return {
    id: 'req-1',
    status: 'PENDING',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h old (green)
    fulfilled_at: null,
    rejected_at: null,
    admin_note: null,
    workspace: { id: 'ws-1', name: 'Acme Workspace' },
    requested_by: {
      id: 'user-1',
      name: 'Anna Andersson',
      email: 'anna@acme.se',
    },
    handler: null,
    import_row: {
      id: 'row-1',
      source_titel: 'AFS 2024:1 Kemiska arbetsmiljörisker',
      source_sfs_nummer: 'AFS 2024:1',
      source_omrade: 'Arbetsmiljö',
      source_lagansvarig: 'Anna Andersson',
      source_kommentar: 'Behöver prioriteras',
    },
    import: {
      id: 'imp-1',
      filename: 'notisum-2026.xlsx',
      created_at: new Date(),
    },
    fulfilled_with_document: null,
    ...overrides,
  }
}

const baseCounts = {
  pending: 1,
  fulfilled: 0,
  rejected: 0,
  breached: 0,
  total: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFulfill.mockResolvedValue({ success: true })
  mockReject.mockResolvedValue({ success: true })
})

describe('<CatalogRequestsList> — SLA-tier dot colours (AC 5)', () => {
  it('renders green-tone dot for age < 12h', () => {
    render(
      <CatalogRequestsList
        initialRequests={[makeRequest()]} // 2h old
        counts={baseCounts}
        currentStatus="pending"
        currentRangeDays={30}
      />
    )
    const dot = screen.getByLabelText('Inom budget')
    expect(dot).toBeInTheDocument()
    expect(dot.className).toContain('bg-emerald-500')
  })

  it('renders amber-tone dot for age 12–24h', () => {
    render(
      <CatalogRequestsList
        initialRequests={[
          makeRequest({
            created_at: new Date(Date.now() - 18 * 60 * 60 * 1000),
          }),
        ]}
        counts={baseCounts}
        currentStatus="pending"
        currentRangeDays={30}
      />
    )
    const dot = screen.getByLabelText('Närmar sig deadline')
    expect(dot.className).toContain('bg-amber-500')
  })

  it('renders red-tone dot for age > 24h (SLA-brytt)', () => {
    render(
      <CatalogRequestsList
        initialRequests={[
          makeRequest({
            created_at: new Date(Date.now() - 30 * 60 * 60 * 1000),
          }),
        ]}
        counts={{ ...baseCounts, breached: 1 }}
        currentStatus="pending"
        currentRangeDays={30}
      />
    )
    const dot = screen.getByLabelText('SLA-brytt')
    expect(dot.className).toContain('bg-rose-500')
  })

  it('breach count rendered in red when > 0', () => {
    render(
      <CatalogRequestsList
        initialRequests={[]}
        counts={{ ...baseCounts, breached: 3 }}
        currentStatus="pending"
        currentRangeDays={30}
      />
    )
    const meta = screen.getByText(/SLA bryts om/)
    expect(meta.textContent).toContain('3')
  })
})

describe('<CatalogRequestsList> — filter chips', () => {
  it('renders all 4 status filter chips with counts', () => {
    render(
      <CatalogRequestsList
        initialRequests={[]}
        counts={{
          pending: 5,
          fulfilled: 12,
          rejected: 3,
          breached: 1,
          total: 20,
        }}
        currentStatus="pending"
        currentRangeDays={30}
      />
    )
    expect(screen.getByRole('button', { name: 'Väntande' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Hanterade' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avvisade' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alla' })).toBeInTheDocument()
  })

  it('marks the current status filter as pressed', () => {
    render(
      <CatalogRequestsList
        initialRequests={[]}
        counts={baseCounts}
        currentStatus="rejected"
        currentRangeDays={30}
      />
    )
    expect(screen.getByRole('button', { name: 'Avvisade' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Väntande' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('clicking a chip pushes the URL with the new status', async () => {
    const user = userEvent.setup()
    render(
      <CatalogRequestsList
        initialRequests={[]}
        counts={baseCounts}
        currentStatus="pending"
        currentRangeDays={30}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Hanterade' }))
    expect(mockPush).toHaveBeenCalledWith(
      '/admin/catalog-requests?status=fulfilled'
    )
  })
})

describe('<CatalogRequestsList> — detail panel expand/collapse', () => {
  it('clicking a row toggles the inline detail panel', async () => {
    const user = userEvent.setup()
    render(
      <CatalogRequestsList
        initialRequests={[makeRequest()]}
        counts={baseCounts}
        currentStatus="pending"
        currentRangeDays={30}
      />
    )

    // Detail not visible initially
    expect(screen.queryByText('Behöver prioriteras')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('catalog-request-row-req-1'))
    expect(screen.getByText('Behöver prioriteras')).toBeInTheDocument()

    // Toggle off
    await user.click(screen.getByTestId('catalog-request-row-req-1'))
    expect(screen.queryByText('Behöver prioriteras')).not.toBeInTheDocument()
  })

  it('shows action buttons in the detail panel for PENDING requests', async () => {
    const user = userEvent.setup()
    render(
      <CatalogRequestsList
        initialRequests={[makeRequest()]}
        counts={baseCounts}
        currentStatus="pending"
        currentRangeDays={30}
      />
    )
    await user.click(screen.getByTestId('catalog-request-row-req-1'))
    expect(
      screen.getByRole('button', { name: /Markera hanterad/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Avvisa som dubblett/ })
    ).toBeInTheDocument()
  })

  it('hides action buttons when status is FULFILLED', async () => {
    const user = userEvent.setup()
    render(
      <CatalogRequestsList
        initialRequests={[
          makeRequest({
            status: 'FULFILLED',
            fulfilled_at: new Date(),
            handler: { id: 'h-1', name: 'Ops Person', email: 'ops@laglig.se' },
            fulfilled_with_document: {
              id: 'doc-1',
              title: 'AFS 2024:1',
              document_number: 'AFS 2024:1',
            },
          }),
        ]}
        counts={baseCounts}
        currentStatus="fulfilled"
        currentRangeDays={30}
      />
    )
    await user.click(screen.getByTestId('catalog-request-row-req-1'))
    expect(
      screen.queryByRole('button', { name: /Markera hanterad/ })
    ).not.toBeInTheDocument()
  })
})

describe('<CatalogRequestsList> — fulfilment modal', () => {
  it('Validera button is disabled when input is empty', async () => {
    const user = userEvent.setup()
    render(
      <CatalogRequestsList
        initialRequests={[makeRequest()]}
        counts={baseCounts}
        currentStatus="pending"
        currentRangeDays={30}
      />
    )

    await user.click(screen.getByTestId('catalog-request-row-req-1'))
    await user.click(screen.getByRole('button', { name: /Markera hanterad/ }))

    // Input is empty initially → Validera button disabled (defensive UX
    // gate; the action's toast.error is the secondary defence).
    const validateBtn = await screen.findByRole('button', { name: 'Validera' })
    expect(validateBtn).toBeDisabled()
  })

  it('shows error inline when LegalDocument id does not resolve', async () => {
    mockLookup.mockResolvedValue({
      success: false,
      error: 'Inget dokument med det id:t hittades',
    })
    const user = userEvent.setup()
    render(
      <CatalogRequestsList
        initialRequests={[makeRequest()]}
        counts={baseCounts}
        currentStatus="pending"
        currentRangeDays={30}
      />
    )

    await user.click(screen.getByTestId('catalog-request-row-req-1'))
    await user.click(screen.getByRole('button', { name: /Markera hanterad/ }))

    const input = await screen.findByLabelText('LegalDocument ID')
    await user.type(input, 'bogus-id')
    await user.click(screen.getByRole('button', { name: 'Validera' }))

    expect(
      await screen.findByText('Inget dokument med det id:t hittades')
    ).toBeInTheDocument()
  })

  it('Bekräfta is disabled until validated AND checkbox ticked', async () => {
    mockLookup.mockResolvedValue({
      success: true,
      data: {
        id: 'doc-real',
        title: 'AFS 2024:1 Kemiska arbetsmiljörisker',
        document_number: 'AFS 2024:1',
        content_type: 'AGENCY_REGULATION',
      },
    })
    const user = userEvent.setup()
    render(
      <CatalogRequestsList
        initialRequests={[makeRequest()]}
        counts={baseCounts}
        currentStatus="pending"
        currentRangeDays={30}
      />
    )

    await user.click(screen.getByTestId('catalog-request-row-req-1'))
    await user.click(screen.getByRole('button', { name: /Markera hanterad/ }))

    const input = await screen.findByLabelText('LegalDocument ID')
    const submit = screen.getByRole('button', { name: 'Bekräfta' })

    expect(submit).toBeDisabled()

    // Validate doc
    await user.type(input, 'doc-real')
    await user.click(screen.getByRole('button', { name: 'Validera' }))
    // The validated-doc confirmation banner has its own colour (emerald-50
    // bg) — find by its scoped DOM context (the dialog) rather than by
    // global text query (the doc title also appears in the table row).
    const dialog = screen.getByRole('dialog')
    expect(
      await within(dialog).findByText(/AFS 2024:1 Kemiska arbetsmiljörisker/)
    ).toBeInTheDocument()
    expect(submit).toBeDisabled() // checkbox still unchecked

    // Tick checkbox
    await user.click(screen.getByRole('checkbox'))
    expect(submit).toBeEnabled()

    // Submit dispatches the action
    await user.click(submit)
    expect(mockFulfill).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-1',
        fulfilledWithDocumentId: 'doc-real',
      })
    )
  })
})

describe('<CatalogRequestsList> — rejection dialog', () => {
  it('opens dialog and dispatches rejectCatalogRequest with optional reason', async () => {
    const user = userEvent.setup()
    render(
      <CatalogRequestsList
        initialRequests={[makeRequest()]}
        counts={baseCounts}
        currentStatus="pending"
        currentRangeDays={30}
      />
    )

    await user.click(screen.getByTestId('catalog-request-row-req-1'))
    await user.click(
      screen.getByRole('button', { name: /Avvisa som dubblett/ })
    )

    const reasonField = await screen.findByLabelText('Anledning (valfri)')
    await user.type(reasonField, 'Dubblett av #abc')

    // Find the destructive submit (the Avvisa inside the dialog footer).
    const dialog = screen.getByRole('dialog')
    const submit = within(dialog).getByRole('button', { name: 'Avvisa' })
    await user.click(submit)

    expect(mockReject).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-1',
        adminNote: 'Dubblett av #abc',
      })
    )
  })
})
