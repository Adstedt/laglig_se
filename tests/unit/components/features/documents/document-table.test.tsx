import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Epic 28: the DataTable core's renderer switch is container-width-driven;
// happy-dom has no layout (width 0 → card view). Report a wide container so
// these tests exercise the TABLE renderer they pin.
vi.mock('@/components/ui/data-table/use-container-width', () => ({
  useContainerWidth: () => ({ ref: () => {}, width: 1400 }),
}))
import userEvent from '@testing-library/user-event'
import {
  DocumentTable,
  type DocumentItem,
} from '@/components/features/documents/document-table'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}))

const MOCK_DOCS: DocumentItem[] = [
  {
    id: 'doc-1',
    title: 'Arbetsmiljöpolicy',
    document_type: 'POLICY',
    status: 'APPROVED',
    document_number: 'POL-001',
    current_version_number: 3,
    review_date: new Date(Date.now() - 86400000).toISOString(), // overdue
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    creator: { id: 'u1', name: 'Anna', email: 'anna@test.se' },
  },
  {
    id: 'doc-2',
    title: 'Riskbedömning',
    document_type: 'RISK_ASSESSMENT',
    status: 'DRAFT',
    document_number: null,
    current_version_number: 1,
    review_date: new Date(Date.now() + 15 * 86400000).toISOString(), // upcoming
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    creator: { id: 'u1', name: 'Anna', email: 'anna@test.se' },
  },
]

describe('DocumentTable', () => {
  const defaultProps = {
    documents: MOCK_DOCS,
    sortBy: 'updated_at' as const,
    sortOrder: 'desc' as const,
    onSort: vi.fn(),
    onArchive: vi.fn(),
  }

  it('renders document titles', () => {
    render(<DocumentTable {...defaultProps} />)
    expect(screen.getByText('Arbetsmiljöpolicy')).toBeInTheDocument()
    // "Riskbedömning" appears as both title and type badge — check at least 2
    expect(screen.getAllByText('Riskbedömning').length).toBeGreaterThanOrEqual(
      1
    )
  })

  it('renders document numbers', () => {
    render(<DocumentTable {...defaultProps} />)
    expect(screen.getByText('POL-001')).toBeInTheDocument()
  })

  it('renders version numbers', () => {
    render(<DocumentTable {...defaultProps} />)
    expect(screen.getByText('v3')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
  })

  it('renders status badges', () => {
    render(<DocumentTable {...defaultProps} />)
    expect(screen.getByText('Godkänd')).toBeInTheDocument()
    expect(screen.getByText('Utkast')).toBeInTheDocument()
  })

  it('renders type badges', () => {
    render(<DocumentTable {...defaultProps} />)
    expect(screen.getByText('Policy')).toBeInTheDocument()
    // "Riskbedömning" as type badge — confirmed via getAllByText
    expect(screen.getAllByText('Riskbedömning').length).toBeGreaterThanOrEqual(
      2
    ) // title + badge
  })

  it('renders author names', () => {
    render(<DocumentTable {...defaultProps} />)
    expect(screen.getAllByText('Anna')).toHaveLength(2)
  })

  it('calls onSort when clicking sortable header', async () => {
    const user = userEvent.setup()
    render(<DocumentTable {...defaultProps} />)

    await user.click(screen.getByText('Titel'))
    expect(defaultProps.onSort).toHaveBeenCalledWith('title')
  })

  it('renders the empty state when no documents', () => {
    render(<DocumentTable {...defaultProps} documents={[]} />)
    // Epic 28: the core swaps a header-only table for an explicit empty
    // state at zero rows (intended change).
    expect(screen.getByText('Här är det tomt än så länge.')).toBeInTheDocument()
  })
})
