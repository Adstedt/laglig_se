/**
 * Story 6.14: Unit tests for GroupedDocumentListTable
 * Tests grouped accordion table view functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GroupedDocumentListTable } from '@/components/features/document-list/grouped-document-list-table'
import type {
  DocumentListItem,
  ListGroupSummary,
  WorkspaceMemberOption,
} from '@/app/actions/document-list'

// Mock data
const mockGroups: ListGroupSummary[] = [
  { id: 'group-1', name: 'GDPR', color: 'blue', itemCount: 2 },
  { id: 'group-2', name: 'Arbetsmiljö', color: 'green', itemCount: 1 },
]

const mockItems: DocumentListItem[] = [
  {
    id: 'item-1',
    position: 0,
    notes: null,
    dueDate: null,
    addedAt: new Date('2024-01-15'),
    priority: 'MEDIUM',
    status: 'NOT_STARTED',
    complianceStatus: 'NOT_ASSESSED',
    category: 'GDPR',
    groupId: 'group-1',
    groupName: 'GDPR',
    assignee: null,
    responsibleUser: null,
    document: {
      id: 'doc-1',
      title: 'GDPR Law 1',
      documentNumber: 'SFS 2018:218',
      slug: 'gdpr-law-1',
      contentType: 'SFS',
      summary: 'Test summary',
      effectiveDate: null,
      sourceUrl: null,
      status: 'ACTIVE',
    },
  },
  {
    id: 'item-2',
    position: 1,
    notes: null,
    dueDate: null,
    addedAt: new Date('2024-01-16'),
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    complianceStatus: 'COMPLIANT',
    category: 'GDPR',
    groupId: 'group-1',
    groupName: 'GDPR',
    assignee: null,
    responsibleUser: null,
    document: {
      id: 'doc-2',
      title: 'GDPR Law 2',
      documentNumber: 'SFS 2018:219',
      slug: 'gdpr-law-2',
      contentType: 'SFS',
      summary: 'Another test',
      effectiveDate: null,
      sourceUrl: null,
      status: 'ACTIVE',
    },
  },
  {
    id: 'item-3',
    position: 2,
    notes: null,
    dueDate: null,
    addedAt: new Date('2024-01-17'),
    priority: 'LOW',
    status: 'NOT_STARTED',
    complianceStatus: 'NOT_COMPLIANT',
    category: 'Arbetsmiljö',
    groupId: 'group-2',
    groupName: 'Arbetsmiljö',
    assignee: null,
    responsibleUser: null,
    document: {
      id: 'doc-3',
      title: 'Work Environment Law',
      documentNumber: 'SFS 1977:1160',
      slug: 'work-environment',
      contentType: 'SFS',
      summary: 'Work environment',
      effectiveDate: null,
      sourceUrl: null,
      status: 'ACTIVE',
    },
  },
  {
    id: 'item-4',
    position: 3,
    notes: null,
    dueDate: null,
    addedAt: new Date('2024-01-18'),
    priority: 'MEDIUM',
    status: 'NOT_STARTED',
    complianceStatus: 'NOT_ASSESSED',
    category: null,
    groupId: null,
    groupName: null,
    assignee: null,
    responsibleUser: null,
    document: {
      id: 'doc-4',
      title: 'Ungrouped Law',
      documentNumber: 'SFS 2000:1',
      slug: 'ungrouped-law',
      contentType: 'SFS',
      summary: 'Ungrouped',
      effectiveDate: null,
      sourceUrl: null,
      status: 'ACTIVE',
    },
  },
]

const mockWorkspaceMembers: WorkspaceMemberOption[] = [
  {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    avatarUrl: null,
  },
]

const defaultProps = {
  items: mockItems,
  groups: mockGroups,
  expandedGroups: { 'group-1': true, 'group-2': true, __ungrouped__: true },
  total: 4,
  hasMore: false,
  isLoading: false,
  columnVisibility: {},
  onColumnVisibilityChange: vi.fn(),
  onLoadMore: vi.fn(),
  onRemoveItem: vi.fn().mockResolvedValue(true),
  onReorderItems: vi.fn().mockResolvedValue(true),
  onUpdateItem: vi.fn().mockResolvedValue(true),
  onBulkUpdate: vi.fn().mockResolvedValue(true),
  onMoveToGroup: vi.fn().mockResolvedValue(true),
  onToggleGroup: vi.fn(),
  onExpandAll: vi.fn(),
  onCollapseAll: vi.fn(),
  onFilterByGroup: vi.fn(),
  onRowClick: vi.fn(),
  workspaceMembers: mockWorkspaceMembers,
}

describe('GroupedDocumentListTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders group sections for each group', () => {
    render(<GroupedDocumentListTable {...defaultProps} />)

    expect(screen.getByText('GDPR')).toBeInTheDocument()
    expect(screen.getByText('Arbetsmiljö')).toBeInTheDocument()
  })

  it('renders ungrouped section', () => {
    render(<GroupedDocumentListTable {...defaultProps} />)

    expect(screen.getByText('Ogrupperade')).toBeInTheDocument()
  })

  it('shows item count badges with correct counts', () => {
    render(<GroupedDocumentListTable {...defaultProps} />)

    // GDPR has 2 items
    expect(screen.getByText('2 dokument')).toBeInTheDocument()
    // Arbetsmiljö and Ungrouped both have 1 item each
    const oneDocumentBadges = screen.getAllByText('1 dokument')
    expect(oneDocumentBadges.length).toBe(2) // Arbetsmiljö + Ungrouped
  })

  it('renders empty groups with 0 dokument badge', () => {
    const emptyGroup: ListGroupSummary = {
      id: 'empty-group',
      name: 'Empty Group',
      color: 'gray',
      itemCount: 0,
    }
    render(
      <GroupedDocumentListTable
        {...defaultProps}
        groups={[...mockGroups, emptyGroup]}
        expandedGroups={{ ...defaultProps.expandedGroups, 'empty-group': true }}
      />
    )

    expect(screen.getByText('Empty Group')).toBeInTheDocument()
    expect(screen.getByText('0 dokument')).toBeInTheDocument()
  })

  it('shows expand all and collapse all buttons when groups exist', () => {
    render(<GroupedDocumentListTable {...defaultProps} />)

    expect(screen.getByTitle('Visa alla grupper')).toBeInTheDocument()
    expect(screen.getByTitle('Dölj alla grupper')).toBeInTheDocument()
  })

  it('calls onExpandAll when "Visa alla" is clicked', async () => {
    const user = userEvent.setup()
    render(<GroupedDocumentListTable {...defaultProps} />)

    await user.click(screen.getByTitle('Visa alla grupper'))

    expect(defaultProps.onExpandAll).toHaveBeenCalledTimes(1)
  })

  it('calls onCollapseAll when "Dölj alla" is clicked', async () => {
    const user = userEvent.setup()
    render(<GroupedDocumentListTable {...defaultProps} />)

    await user.click(screen.getByTitle('Dölj alla grupper'))

    expect(defaultProps.onCollapseAll).toHaveBeenCalledTimes(1)
  })

  it('calls onToggleGroup when chevron is clicked', async () => {
    const user = userEvent.setup()
    render(<GroupedDocumentListTable {...defaultProps} />)

    // Find GDPR section and click its expand/collapse button
    const chevrons = screen.getAllByTitle(/Fäll ihop|Expandera/)
    await user.click(chevrons[0])

    expect(defaultProps.onToggleGroup).toHaveBeenCalled()
  })

  it('calls onFilterByGroup when group name is clicked', async () => {
    const user = userEvent.setup()
    render(<GroupedDocumentListTable {...defaultProps} />)

    await user.click(screen.getByTitle('Filtrera till "GDPR"'))

    expect(defaultProps.onFilterByGroup).toHaveBeenCalledWith('group-1')
  })

  it('shows empty state when no items', () => {
    render(<GroupedDocumentListTable {...defaultProps} items={[]} />)

    expect(screen.getByText('Inga dokument i listan.')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<GroupedDocumentListTable {...defaultProps} items={[]} isLoading />)

    // Should show skeleton or loading indicator
    expect(
      screen.queryByText('Inga dokument i listan.')
    ).not.toBeInTheDocument()
  })

  it('shows load more button when hasMore is true', () => {
    render(<GroupedDocumentListTable {...defaultProps} hasMore />)

    expect(
      screen.getByRole('button', { name: 'Visa fler' })
    ).toBeInTheDocument()
  })

  it('hides load more button when hasMore is false', () => {
    render(<GroupedDocumentListTable {...defaultProps} hasMore={false} />)

    expect(
      screen.queryByRole('button', { name: 'Visa fler' })
    ).not.toBeInTheDocument()
  })

  it('does not show expand/collapse buttons when no groups', () => {
    render(<GroupedDocumentListTable {...defaultProps} groups={[]} />)

    expect(screen.queryByTitle('Visa alla grupper')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Dölj alla grupper')).not.toBeInTheDocument()
  })

  it('displays document count info', () => {
    render(<GroupedDocumentListTable {...defaultProps} />)

    expect(screen.getByText(/Visar 4 av 4 dokument/)).toBeInTheDocument()
  })
})
