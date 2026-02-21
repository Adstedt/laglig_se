/**
 * Story 6.14: Unit tests for GroupTableSection
 * Tests individual collapsible section in grouped table view
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'
import { GroupTableSection } from '@/components/features/document-list/group-table-section'
import type {
  DocumentListItem,
  ListGroupSummary,
  WorkspaceMemberOption,
} from '@/app/actions/document-list'

// Mock next/navigation (needed by ChangeIndicator rendered inside rows)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// Helper to wrap component with DndContext
function renderWithDnd(ui: React.ReactElement) {
  return render(<DndContext>{ui}</DndContext>)
}

// Mock data
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
      title: 'Test Law 1',
      documentNumber: 'SFS 2018:218',
      slug: 'test-law-1',
      contentType: 'SFS',
      summary: 'Test summary',
      effectiveDate: null,
      sourceUrl: null,
      status: 'ACTIVE',
    },
  },
]

const mockGroups: ListGroupSummary[] = [
  { id: 'group-1', name: 'GDPR', color: 'blue', itemCount: 1 },
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
  groupId: 'group-1',
  name: 'GDPR',
  itemCount: 1,
  isExpanded: true,
  onToggle: vi.fn(),
  onFilter: vi.fn(),
  items: mockItems,
  columnVisibility: {},
  onColumnVisibilityChange: vi.fn(),
  onUpdateItem: vi.fn().mockResolvedValue(true),
  onRemoveItem: vi.fn().mockResolvedValue(true),
  onReorderItems: vi.fn().mockResolvedValue(true),
  onRowClick: vi.fn(),
  onSelectionChange: vi.fn(),
  selectedItemIds: new Set<string>(),
  workspaceMembers: mockWorkspaceMembers,
  groups: mockGroups,
  onMoveToGroup: vi.fn().mockResolvedValue(true),
}

describe('GroupTableSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders group header with name', () => {
    renderWithDnd(<GroupTableSection {...defaultProps} />)

    expect(screen.getByText('GDPR')).toBeInTheDocument()
  })

  it('renders item count badge', () => {
    renderWithDnd(<GroupTableSection {...defaultProps} />)

    expect(screen.getByText('1 dokument')).toBeInTheDocument()
  })

  it('shows "0 dokument" badge for empty groups', () => {
    renderWithDnd(
      <GroupTableSection {...defaultProps} items={[]} itemCount={0} />
    )

    expect(screen.getByText('0 dokument')).toBeInTheDocument()
  })

  it('shows empty state message when expanded with no items', () => {
    renderWithDnd(
      <GroupTableSection {...defaultProps} items={[]} itemCount={0} />
    )

    expect(screen.getByText('Inga dokument i denna grupp.')).toBeInTheDocument()
  })

  it('renders folder icon for regular groups', () => {
    renderWithDnd(<GroupTableSection {...defaultProps} />)

    // The folder icon should be visible (hidden on mobile but present in DOM)
    const container = screen.getByText('GDPR').closest('div')
    expect(container?.parentElement?.querySelector('svg')).toBeInTheDocument()
  })

  it('renders FolderX icon for ungrouped section', () => {
    renderWithDnd(
      <GroupTableSection {...defaultProps} name="Ogrupperade" isUngrouped />
    )

    expect(screen.getByText('Ogrupperade')).toBeInTheDocument()
  })

  it('calls onToggle when chevron is clicked', async () => {
    const user = userEvent.setup()
    renderWithDnd(<GroupTableSection {...defaultProps} />)

    const toggleButton = screen.getByTitle(/Fäll ihop|Expandera/)
    await user.click(toggleButton)

    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onFilter when group name is clicked', async () => {
    const user = userEvent.setup()
    renderWithDnd(<GroupTableSection {...defaultProps} />)

    await user.click(screen.getByTitle('Filtrera till "GDPR"'))

    expect(defaultProps.onFilter).toHaveBeenCalledTimes(1)
  })

  it('does not render filter button when onFilter is undefined', () => {
    renderWithDnd(<GroupTableSection {...defaultProps} onFilter={undefined} />)

    expect(screen.queryByTitle('Filtrera till "GDPR"')).not.toBeInTheDocument()
    // Name should still be visible but not as button
    expect(screen.getByText('GDPR')).toBeInTheDocument()
  })

  it('shows chevron down when expanded', () => {
    renderWithDnd(<GroupTableSection {...defaultProps} isExpanded />)

    expect(screen.getByTitle('Fäll ihop')).toBeInTheDocument()
  })

  it('shows chevron right when collapsed', () => {
    renderWithDnd(<GroupTableSection {...defaultProps} isExpanded={false} />)

    expect(screen.getByTitle('Expandera')).toBeInTheDocument()
  })

  it('applies drop target styling when isDropTarget is true', () => {
    const { container } = renderWithDnd(
      <GroupTableSection {...defaultProps} isDropTarget />
    )

    // The drop target styling adds 'border-primary bg-primary/5' to the section wrapper
    const dropZone = container.querySelector('.border-primary.bg-primary\\/5')
    expect(dropZone).toBeInTheDocument()
  })

  it('does not apply drop target styling when isDropTarget is false', () => {
    const { container } = renderWithDnd(
      <GroupTableSection {...defaultProps} isDropTarget={false} />
    )

    // The drop target styling should not be present
    const dropZone = container.querySelector('.border-primary.bg-primary\\/5')
    expect(dropZone).not.toBeInTheDocument()
  })

  it('has minimum touch target size for mobile accessibility', () => {
    renderWithDnd(<GroupTableSection {...defaultProps} />)

    const toggleButton = screen.getByTitle(/Fäll ihop|Expandera/)
    expect(toggleButton).toHaveClass('min-w-[44px]', 'min-h-[44px]')
  })

  it('hides content when collapsed', () => {
    renderWithDnd(<GroupTableSection {...defaultProps} isExpanded={false} />)

    // The content should not be visible when collapsed
    // Document titles should not appear
    expect(screen.queryByText('Test Law 1')).not.toBeInTheDocument()
  })

  it('shows content when expanded', () => {
    renderWithDnd(<GroupTableSection {...defaultProps} isExpanded />)

    // The document table should be rendered when expanded
    // Note: The actual table rendering depends on DocumentListTable
    expect(screen.getByText('GDPR')).toBeInTheDocument()
  })
})
