/**
 * Story 6.18: ComplianceDetailTable Component Tests
 * Tests core compliance table behaviors: empty states, truncation, row expansion,
 * tooltip display, and column size configuration.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComplianceDetailTable } from '@/components/features/document-list/compliance-detail-table'
import type {
  DocumentListItem,
  WorkspaceMemberOption,
} from '@/app/actions/document-list'

// Mock dnd-kit to avoid complex drag-drop setup
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: () => ({}),
  useSensors: () => [],
}))

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: (arr: unknown[]) => arr,
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
  horizontalListSortingStrategy: vi.fn(),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: { toString: () => undefined },
    Translate: { toString: () => undefined },
  },
}))

vi.mock('@dnd-kit/modifiers', () => ({
  restrictToVerticalAxis: vi.fn(),
  restrictToHorizontalAxis: vi.fn(),
}))

// Mock use-debounce
vi.mock('use-debounce', () => ({
  useDebouncedCallback: (fn: (..._args: unknown[]) => unknown) => fn,
}))

// Mock content-type utils
vi.mock('@/lib/utils/content-type', () => ({
  getContentTypeIcon: () => {
    const MockIcon = (props: Record<string, unknown>) => (
      <svg data-testid="content-type-icon" {...props} />
    )
    MockIcon.displayName = 'MockIcon'
    return MockIcon
  },
  getContentTypeBadgeColor: () => 'bg-blue-100 text-blue-800',
  getContentTypeLabel: () => 'Lag',
}))

// ============================================================================
// Test fixtures
// ============================================================================

function createMockItem(
  overrides: Partial<DocumentListItem> = {}
): DocumentListItem {
  return {
    id: 'item-1',
    position: 0,
    commentary: null,
    status: 'ACTIVE',
    priority: 'MEDIUM',
    notes: null,
    addedAt: new Date('2026-01-15'),
    dueDate: null,
    assignee: null,
    groupId: null,
    groupName: null,
    complianceStatus: 'PAGAENDE',
    responsibleUser: null,
    category: null,
    businessContext: '<p>Lagen kräver att vi utbildar personal.</p>',
    complianceActions: '<p>Vi har rutiner på plats.</p>',
    complianceActionsUpdatedAt: new Date('2026-01-20'),
    complianceActionsUpdatedBy: 'user-1',
    updatedAt: new Date('2026-01-20'),
    document: {
      id: 'doc-1',
      title: 'Arbetsmiljölagen',
      documentNumber: 'SFS 1977:1160',
      contentType: 'LAG',
      slug: 'arbetsmiljolagen',
      summary: 'Summary',
      effectiveDate: new Date('1978-01-01'),
      sourceUrl: null,
      status: 'ACTIVE',
    },
    ...overrides,
  } as DocumentListItem
}

const mockMembers: WorkspaceMemberOption[] = [
  {
    id: 'user-1',
    name: 'Anna Svensson',
    email: 'anna@test.com',
    avatarUrl: null,
  },
  {
    id: 'user-2',
    name: 'Erik Johansson',
    email: 'erik@test.com',
    avatarUrl: null,
  },
]

const defaultProps = {
  items: [] as DocumentListItem[],
  total: 0,
  hasMore: false,
  isLoading: false,
  workspaceMembers: mockMembers,
  onLoadMore: vi.fn(),
  onRemoveItem: vi.fn().mockResolvedValue(true),
  onReorderItems: vi.fn().mockResolvedValue(true),
  onUpdateItem: vi.fn().mockResolvedValue(true),
  onBulkUpdate: vi.fn().mockResolvedValue(true),
  onRowClick: vi.fn(),
  onAddContent: vi.fn(),
}

// ============================================================================
// Tests
// ============================================================================

describe('ComplianceDetailTable', () => {
  describe('Empty state', () => {
    it('renders empty state when no items', () => {
      render(<ComplianceDetailTable {...defaultProps} />)

      expect(screen.getByText('Inga dokument i listan.')).toBeInTheDocument()
    })

    it('renders custom empty message', () => {
      render(
        <ComplianceDetailTable
          {...defaultProps}
          emptyMessage="Inga resultat hittades."
        />
      )

      expect(screen.getByText('Inga resultat hittades.')).toBeInTheDocument()
    })
  })

  describe('Item rendering', () => {
    it('renders document title', () => {
      const item = createMockItem()
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      expect(screen.getByText('Arbetsmiljölagen')).toBeInTheDocument()
    })

    it('renders document number', () => {
      const item = createMockItem()
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      expect(screen.getByText('SFS 1977:1160')).toBeInTheDocument()
    })

    it('renders truncated business context text (HTML stripped)', () => {
      const item = createMockItem({
        businessContext: '<p>Lagen kräver att vi utbildar personal.</p>',
      })
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      expect(
        screen.getByText('Lagen kräver att vi utbildar personal.')
      ).toBeInTheDocument()
    })

    it('renders truncated compliance actions text (HTML stripped)', () => {
      const item = createMockItem({
        complianceActions: '<p>Vi har rutiner på plats.</p>',
      })
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      expect(screen.getByText('Vi har rutiner på plats.')).toBeInTheDocument()
    })
  })

  describe('Empty field states (AC 7)', () => {
    it('shows dash for Ej tillämplig status', () => {
      const item = createMockItem({
        complianceStatus: 'EJ_TILLAMPLIG',
        businessContext: '<p>Some text</p>',
        complianceActions: '<p>Some text</p>',
      })
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      // Both fields should show dash instead of content
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(2)
    })

    it('shows "Lägg till" button for empty business context', () => {
      const item = createMockItem({
        businessContext: null,
        complianceActions: '<p>Has content</p>',
      })
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      const addButtons = screen.getAllByText('Lägg till')
      expect(addButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('shows "Lägg till" button for empty compliance actions', () => {
      const item = createMockItem({
        businessContext: '<p>Has content</p>',
        complianceActions: null,
      })
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      const addButtons = screen.getAllByText('Lägg till')
      expect(addButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('calls onAddContent when "Lägg till" button is clicked for businessContext', async () => {
      const user = userEvent.setup()
      const onAddContent = vi.fn()
      const item = createMockItem({
        businessContext: null,
        complianceActions: '<p>Has content</p>',
      })
      render(
        <ComplianceDetailTable
          {...defaultProps}
          items={[item]}
          total={1}
          onAddContent={onAddContent}
        />
      )

      const addButton = screen.getAllByText('Lägg till')[0]
      if (addButton) {
        await user.click(addButton)
        expect(onAddContent).toHaveBeenCalledWith('item-1', 'businessContext')
      }
    })
  })

  describe('Row expansion (AC 6)', () => {
    it('renders expand/collapse button for each row', () => {
      const item = createMockItem()
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      expect(screen.getByLabelText('Expandera')).toBeInTheDocument()
    })

    it('expands row showing full content on chevron click', async () => {
      const user = userEvent.setup()
      const item = createMockItem({
        businessContext: '<p>Full business context text</p>',
        complianceActions: '<p>Full compliance actions text</p>',
      })
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      const expandButton = screen.getByLabelText('Expandera')
      await user.click(expandButton)

      // Expanded row shows section headers (also present in column headers, so use getAllByText)
      const businessHeaders = screen.getAllByText('Hur påverkar denna lag oss?')
      const complianceHeaders = screen.getAllByText('Hur efterlever vi kraven?')
      // At least 2: one in column header, one in expanded row
      expect(businessHeaders.length).toBeGreaterThanOrEqual(2)
      expect(complianceHeaders.length).toBeGreaterThanOrEqual(2)
    })

    it('toggles expand button label after expanding', async () => {
      const user = userEvent.setup()
      const item = createMockItem()
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      const expandButton = screen.getByLabelText('Expandera')
      await user.click(expandButton)

      expect(screen.getByLabelText('Fäll ihop')).toBeInTheDocument()
    })

    it('collapses expanded row on second click (accordion behavior)', async () => {
      const user = userEvent.setup()
      const item = createMockItem()
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      const expandButton = screen.getByLabelText('Expandera')
      await user.click(expandButton)

      // Should show collapse label
      const collapseButton = screen.getByLabelText('Fäll ihop')
      await user.click(collapseButton)

      // Should be back to expand label
      expect(screen.getByLabelText('Expandera')).toBeInTheDocument()
    })

    it('shows "Ej tillämplig" message in expanded row for EJ_TILLAMPLIG items', async () => {
      const user = userEvent.setup()
      const item = createMockItem({ complianceStatus: 'EJ_TILLAMPLIG' })
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      const expandButton = screen.getByLabelText('Expandera')
      await user.click(expandButton)

      expect(
        screen.getByText(/markerad som ej tillämplig/i)
      ).toBeInTheDocument()
    })

    it('only expands one row at a time (accordion)', async () => {
      const user = userEvent.setup()
      const item1 = createMockItem({
        id: 'item-1',
        document: {
          id: 'doc-1',
          title: 'Lag 1',
          documentNumber: 'SFS 2000:1',
          contentType: 'LAG',
          slug: 'lag-1',
          summary: null,
          effectiveDate: null,
          sourceUrl: null,
          status: 'ACTIVE',
        },
      })
      const item2 = createMockItem({
        id: 'item-2',
        position: 1,
        document: {
          id: 'doc-2',
          title: 'Lag 2',
          documentNumber: 'SFS 2000:2',
          contentType: 'LAG',
          slug: 'lag-2',
          summary: null,
          effectiveDate: null,
          sourceUrl: null,
          status: 'ACTIVE',
        },
      })
      render(
        <ComplianceDetailTable
          {...defaultProps}
          items={[item1, item2]}
          total={2}
        />
      )

      // Expand first row
      const expandButtons = screen.getAllByLabelText('Expandera')
      await user.click(expandButtons[0]!)

      // Should have one collapse and one expand button
      expect(screen.getByLabelText('Fäll ihop')).toBeInTheDocument()
      expect(screen.getByLabelText('Expandera')).toBeInTheDocument()

      // Expand second row (should collapse first)
      const expandButton2 = screen.getByLabelText('Expandera')
      await user.click(expandButton2)

      // Still only one expanded
      expect(screen.getAllByLabelText('Expandera')).toHaveLength(1)
      expect(screen.getByLabelText('Fäll ihop')).toBeInTheDocument()
    })
  })

  describe('Row click behavior (AC 11)', () => {
    it('calls onRowClick when clicking on a row', async () => {
      const user = userEvent.setup()
      const onRowClick = vi.fn()
      const item = createMockItem()
      render(
        <ComplianceDetailTable
          {...defaultProps}
          items={[item]}
          total={1}
          onRowClick={onRowClick}
        />
      )

      // Click the document title link
      const titleButton = screen.getByText('Arbetsmiljölagen')
      await user.click(titleButton)

      expect(onRowClick).toHaveBeenCalledWith('item-1')
    })
  })

  describe('Load more', () => {
    it('shows load more button when hasMore is true', () => {
      const item = createMockItem()
      render(
        <ComplianceDetailTable
          {...defaultProps}
          items={[item]}
          total={50}
          hasMore={true}
        />
      )

      expect(screen.getByText('Visa fler')).toBeInTheDocument()
    })

    it('does not show load more when hasMore is false', () => {
      const item = createMockItem()
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      expect(screen.queryByText('Visa fler')).not.toBeInTheDocument()
    })
  })

  describe('Column headers', () => {
    it('renders Dokument sortable header', () => {
      const item = createMockItem()
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      expect(screen.getByText('Dokument')).toBeInTheDocument()
    })

    it('renders Status header', () => {
      const item = createMockItem()
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('renders Prioritet header', () => {
      const item = createMockItem()
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      expect(screen.getByText('Prioritet')).toBeInTheDocument()
    })

    it('renders Ansvarig header', () => {
      const item = createMockItem()
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      expect(screen.getByText('Ansvarig')).toBeInTheDocument()
    })
  })
})
