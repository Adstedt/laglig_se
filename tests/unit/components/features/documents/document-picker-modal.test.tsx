import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentPickerModal } from '@/components/features/documents/document-picker-modal'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetWorkspaceDocuments = vi.fn()

vi.mock('@/app/actions/documents', () => ({
  getWorkspaceDocuments: (...args: unknown[]) =>
    mockGetWorkspaceDocuments(...args),
  getDocumentTemplates: vi.fn().mockResolvedValue({ success: true, data: [] }),
}))

const MOCK_DOCUMENTS = [
  {
    id: 'doc-1',
    title: 'Arbetsmiljöpolicy',
    document_type: 'POLICY',
    status: 'APPROVED',
    current_version_number: 2,
  },
  {
    id: 'doc-2',
    title: 'Riskbedömning kontor',
    document_type: 'RISK_ASSESSMENT',
    status: 'DRAFT',
    current_version_number: 1,
  },
  {
    id: 'doc-3',
    title: 'Handlingsplan brand',
    document_type: 'ACTION_PLAN',
    status: 'IN_REVIEW',
    current_version_number: 3,
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockGetWorkspaceDocuments.mockResolvedValue({
    success: true,
    data: { items: MOCK_DOCUMENTS, hasMore: false },
  })
})

describe('DocumentPickerModal', () => {
  it('renders search input and documents when open', async () => {
    render(
      <DocumentPickerModal
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Arbetsmiljöpolicy')).toBeInTheDocument()
    })

    expect(screen.getByText('Riskbedömning kontor')).toBeInTheDocument()
    expect(screen.getByText('Handlingsplan brand')).toBeInTheDocument()
  })

  it('shows empty state when no documents found', async () => {
    mockGetWorkspaceDocuments.mockResolvedValue({
      success: true,
      data: { items: [], hasMore: false },
    })

    render(
      <DocumentPickerModal
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Inga dokument hittades')).toBeInTheDocument()
    })
  })

  it('calls onSelect with selected document IDs on confirm', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <DocumentPickerModal
        open={true}
        onOpenChange={vi.fn()}
        onSelect={onSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Arbetsmiljöpolicy')).toBeInTheDocument()
    })

    // Click to select the first document
    await user.click(screen.getByText('Arbetsmiljöpolicy'))

    // Confirm button should be enabled
    const confirmButton = screen.getByRole('button', { name: 'Länka' })
    await user.click(confirmButton)

    expect(onSelect).toHaveBeenCalledWith(['doc-1'])
  })

  it('shows already linked documents as disabled', async () => {
    render(
      <DocumentPickerModal
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
        excludeIds={['doc-1']}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Redan länkade')).toBeInTheDocument()
    })

    expect(screen.getByText('Tillgängliga dokument')).toBeInTheDocument()
  })

  it('disables confirm button when nothing selected', async () => {
    render(
      <DocumentPickerModal
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Arbetsmiljöpolicy')).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole('button', { name: 'Länka' })
    expect(confirmButton).toBeDisabled()
  })

  it('shows document type and status badges', async () => {
    render(
      <DocumentPickerModal
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Arbetsmiljöpolicy')).toBeInTheDocument()
    })

    // Type badges
    expect(screen.getByText('Policy')).toBeInTheDocument()
    expect(screen.getByText('Riskbedömning')).toBeInTheDocument()

    // Status badges
    expect(screen.getByText('Godkänd')).toBeInTheDocument()
    expect(screen.getByText('Utkast')).toBeInTheDocument()
  })

  it('shows version numbers', async () => {
    render(
      <DocumentPickerModal
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('v2')).toBeInTheDocument()
    })
    expect(screen.getByText('v1')).toBeInTheDocument()
    expect(screen.getByText('v3')).toBeInTheDocument()
  })
})
