/**
 * Story 6.18: ComplianceDetailTable Component Tests
 * Tests core compliance table behaviors: empty states, truncation, row expansion,
 * tooltip display, and column size configuration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Epic 28: the DataTable core's renderer switch is container-width-driven;
// happy-dom has no layout (width 0 → card view). Report a wide container so
// these tests exercise the TABLE renderer they pin.
vi.mock('@/components/ui/data-table/use-container-width', () => ({
  useContainerWidth: () => ({ ref: () => {}, width: 1600 }),
}))

import { ComplianceDetailTable } from '@/components/features/document-list/compliance-detail-table'
import type {
  DocumentListItem,
  WorkspaceMemberOption,
} from '@/app/actions/document-list'
import type { RequirementWithEvidence } from '@/app/actions/law-list-item-requirements'

// Story 17.18: SWR mock state for KravpunkterCountCell — tests set this before
// rendering. Key is `list-item-requirements:${listItemId}`.
const mockSwrData = new Map<string, RequirementWithEvidence[]>()

vi.mock('swr', () => ({
  default: (key: string | null) => {
    if (!key || typeof key !== 'string') {
      return { data: undefined, isLoading: false, error: null, mutate: vi.fn() }
    }
    const data = mockSwrData.get(key)
    return {
      data,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    }
  },
  mutate: vi.fn(),
}))

// Mock RichTextDisplay used by the expansion's Kommentar subsection (Story 17.18)
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextDisplay: ({ content }: { content: string }) => (
    <div data-testid="rich-text-display">{content}</div>
  ),
}))

// Stub the server action (SWR mock short-circuits it, but import must resolve)
vi.mock('@/app/actions/law-list-item-requirements', () => ({
  getRequirementsForListItem: vi.fn(),
}))

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

// Story 17.17 + 17.18: stub the kravpunkter editor to a div that surfaces its
// props via data-* attributes and invokes onProgressChange on mount from a
// test-controlled variable (default fulfilled=0 / total=0, i.e. no kravpunkter).
let mockKravpunkterProgress = { fulfilled: 0, total: 0 }
vi.mock(
  '@/components/features/document-list/legal-document-modal/kravpunkter-checklist',
  () => ({
    KravpunkterChecklist: ({
      listItemId,
      readOnly,
      onProgressChange,
    }: {
      listItemId: string
      readOnly?: boolean
      onProgressChange?: (_progress: {
        fulfilled: number
        total: number
      }) => void
    }) => {
      React.useEffect(() => {
        onProgressChange?.(mockKravpunkterProgress)
      }, [onProgressChange])
      return (
        <div
          data-testid="kravpunkter-stub"
          data-list-item-id={listItemId}
          data-read-only={readOnly ?? false}
        />
      )
    },
  })
)

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
    complianceNarrative: '<p>Vi har rutiner på plats.</p>',
    complianceNarrativeUpdatedAt: new Date('2026-01-20'),
    complianceNarrativeUpdatedBy: 'user-1',
    updatedAt: new Date('2026-01-20'),
    pendingChangeCount: 0,
    requirementTotal: 0,
    requirementFulfilled: 0,
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

    // Story 17.18 + 21.22: complianceNarrative no longer shown in the
    // Kravpunkter column cell. It is surfaced as "Hur efterlever vi kraven?"
    // in the row expansion (tested under expansion tests).
  })

  describe('Empty field states (AC 7)', () => {
    it('shows dash for Ej tillämplig status', () => {
      const item = createMockItem({
        complianceStatus: 'EJ_TILLAMPLIG',
        businessContext: '<p>Some text</p>',
        complianceNarrative: '<p>Some text</p>',
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
        complianceNarrative: '<p>Has content</p>',
      })
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      const addButtons = screen.getAllByText('Lägg till')
      expect(addButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('shows "Lägg till" button in the Kravpunkter column when no requirements exist', () => {
      // Story 17.18: KravpunkterCountCell falls back to "+ Lägg till" when the
      // SWR cache resolves with zero requirements for the row.
      const item = createMockItem({
        businessContext: '<p>Has content</p>',
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
        complianceNarrative: '<p>Has content</p>',
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
        complianceNarrative: '<p>Full compliance narrative text</p>',
      })
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      const expandButton = screen.getByLabelText('Expandera')
      await user.click(expandButton)

      // Story 17.18 + 21.22: "Hur påverkar detta oss?" appears in BOTH the
      // column header and the expansion's business-context subsection.
      // "Kravpunkter" appears in BOTH the column header and the expansion's
      // right section. "Hur efterlever vi kraven?" appears in the expansion's
      // narrative subsection (Story 21.22 restored it as a first-class field).
      expect(
        screen.getAllByText('Hur påverkar detta oss?').length
      ).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText('Kravpunkter').length).toBeGreaterThanOrEqual(
        2
      )
      expect(
        screen.getAllByText('Hur efterlever vi kraven?').length
      ).toBeGreaterThanOrEqual(1)
      // Business context text appears in the expansion.
      expect(
        screen.getAllByText('Full business context text').length
      ).toBeGreaterThanOrEqual(1)
      expect(screen.getByTestId('kravpunkter-stub')).toBeInTheDocument()
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

    it('allows multiple rows to be expanded simultaneously', async () => {
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

      // Expand first row → 1 collapse button, 1 expand button
      const expandButtons = screen.getAllByLabelText('Expandera')
      await user.click(expandButtons[0]!)
      expect(screen.getAllByLabelText('Fäll ihop')).toHaveLength(1)
      expect(screen.getAllByLabelText('Expandera')).toHaveLength(1)

      // Expand second row → both now expanded (no collapse of first)
      await user.click(screen.getByLabelText('Expandera'))
      expect(screen.getAllByLabelText('Fäll ihop')).toHaveLength(2)
      expect(screen.queryAllByLabelText('Expandera')).toHaveLength(0)

      // Collapse first row → second still expanded
      const collapseButtons = screen.getAllByLabelText('Fäll ihop')
      await user.click(collapseButtons[0]!)
      expect(screen.getAllByLabelText('Fäll ihop')).toHaveLength(1)
      expect(screen.getAllByLabelText('Expandera')).toHaveLength(1)
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

  // Story 17.17 + 17.18: inline kravpunkter editor mounted in row expansion
  describe('Inline kravpunkter editor (Story 17.17)', () => {
    beforeEach(() => {
      mockSwrData.clear()
      mockKravpunkterProgress = { fulfilled: 0, total: 0 }
    })

    it('renders <KravpunkterChecklist> with correct listItemId when row is expanded', async () => {
      const user = userEvent.setup()
      const item = createMockItem({ id: 'li-42', complianceNarrative: null })
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      await user.click(screen.getByLabelText('Expandera'))

      const stub = screen.getByTestId('kravpunkter-stub')
      expect(stub).toBeInTheDocument()
      expect(stub).toHaveAttribute('data-list-item-id', 'li-42')
      expect(stub).toHaveAttribute('data-read-only', 'false')
    })

    it('passes readOnly=true to KravpunkterChecklist when complianceReadOnly is set', async () => {
      const user = userEvent.setup()
      const item = createMockItem({ complianceNarrative: null })
      render(
        <ComplianceDetailTable
          {...defaultProps}
          items={[item]}
          total={1}
          complianceReadOnly
        />
      )

      await user.click(screen.getByLabelText('Expandera'))

      expect(screen.getByTestId('kravpunkter-stub')).toHaveAttribute(
        'data-read-only',
        'true'
      )
    })
  })

  // Story 21.22: Hur efterlever vi kraven? subsection (renamed from Kommentar)
  describe('Hur efterlever vi kraven? subsection (Story 21.22)', () => {
    it('renders narrative subsection with RichTextDisplay when complianceNarrative is set', async () => {
      const user = userEvent.setup()
      const item = createMockItem({
        complianceNarrative: '<p>Vi har rutiner på plats.</p>',
      })
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      await user.click(screen.getByLabelText('Expandera'))

      expect(
        screen.getAllByText('Hur efterlever vi kraven?').length
      ).toBeGreaterThan(0)
      const display = screen.getByTestId('rich-text-display')
      expect(display).toBeInTheDocument()
      expect(display.textContent).toContain('Vi har rutiner på plats.')
    })

    it('shows "Ingen beskrivning tillagd." when complianceNarrative is empty', async () => {
      const user = userEvent.setup()
      const item = createMockItem({ complianceNarrative: null })
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      await user.click(screen.getByLabelText('Expandera'))

      expect(
        screen.getAllByText('Hur efterlever vi kraven?').length
      ).toBeGreaterThan(0)
      expect(
        screen.getAllByText('Ingen beskrivning tillagd.').length
      ).toBeGreaterThan(0)
      expect(screen.queryByTestId('rich-text-display')).not.toBeInTheDocument()
    })
  })

  // Story 17.18: column header rename + new count cell
  describe('Kravpunkter column (Story 17.18)', () => {
    beforeEach(() => {
      mockSwrData.clear()
    })

    it('renders column header as "Kravpunkter" (not the old label)', () => {
      const item = createMockItem()
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      expect(screen.getByText('Kravpunkter')).toBeInTheDocument()
      expect(
        screen.queryByText('Hur efterlever vi kraven?')
      ).not.toBeInTheDocument()
    })

    it('renders "+ Lägg till" in the cell when no requirements exist', async () => {
      const user = userEvent.setup()
      const onAddContent = vi.fn()
      const item = createMockItem({ id: 'li-99' })
      mockSwrData.set('list-item-requirements:li-99', [])

      render(
        <ComplianceDetailTable
          {...defaultProps}
          items={[item]}
          total={1}
          onAddContent={onAddContent}
        />
      )

      const addButtons = screen.getAllByText('Lägg till')
      expect(addButtons.length).toBeGreaterThanOrEqual(1)

      // Find and click the Kravpunkter-column "Lägg till" (last one — BusinessContext
      // column has its own). The cell wires click to onAddContent with 'kravpunkter'.
      const kravpunkterAddButton = addButtons[addButtons.length - 1]
      if (kravpunkterAddButton) {
        await user.click(kravpunkterAddButton)
        expect(onAddContent).toHaveBeenCalledWith('li-99', 'kravpunkter')
      }
    })

    it('renders "N/M uppfyllda" count pill when requirements exist', async () => {
      const user = userEvent.setup()
      const onAddContent = vi.fn()
      const item = createMockItem({ id: 'li-100' })
      mockSwrData.set('list-item-requirements:li-100', [
        {
          id: 'r1',
          text: 'Krav 1',
          isFulfilled: true,
          position: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          evidence: [],
        },
        {
          id: 'r2',
          text: 'Krav 2',
          isFulfilled: true,
          position: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          evidence: [],
        },
        {
          id: 'r3',
          text: 'Krav 3',
          isFulfilled: false,
          position: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          evidence: [],
        },
      ] as RequirementWithEvidence[])

      render(
        <ComplianceDetailTable
          {...defaultProps}
          items={[item]}
          total={1}
          onAddContent={onAddContent}
        />
      )

      expect(screen.getByText('2/3 uppfyllda')).toBeInTheDocument()

      await user.click(screen.getByText('2/3 uppfyllda'))
      expect(onAddContent).toHaveBeenCalledWith('li-100', 'kravpunkter')
    })

    it('renders count pill as non-interactive when complianceReadOnly is set', () => {
      const onAddContent = vi.fn()
      const item = createMockItem({ id: 'li-ro' })
      mockSwrData.set('list-item-requirements:li-ro', [
        {
          id: 'r1',
          text: 'Krav 1',
          isFulfilled: true,
          position: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          evidence: [],
        },
      ] as RequirementWithEvidence[])

      render(
        <ComplianceDetailTable
          {...defaultProps}
          items={[item]}
          total={1}
          onAddContent={onAddContent}
          complianceReadOnly
        />
      )

      const pill = screen.getByText('1/1 uppfyllda')
      expect(pill).toBeInTheDocument()
      // Not wrapped in a button — parent is plain div
      expect(pill.closest('button')).toBeNull()
    })

    it('shows dash in the Kravpunkter cell when status is EJ_TILLAMPLIG', () => {
      const item = createMockItem({ complianceStatus: 'EJ_TILLAMPLIG' })
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      // Both businessContext + kravpunkter cells render "—"
      expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    })
  })

  // Story 17.18: progress tracker in expansion header
  describe('Expansion progress tracker (Story 17.18)', () => {
    beforeEach(() => {
      mockKravpunkterProgress = { fulfilled: 0, total: 0 }
    })

    it('renders N/M uppfyllda in expansion header when kravpunkter exist', async () => {
      const user = userEvent.setup()
      mockKravpunkterProgress = { fulfilled: 2, total: 3 }
      const item = createMockItem()
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      await user.click(screen.getByLabelText('Expandera'))

      expect(screen.getByText('2/3 uppfyllda')).toBeInTheDocument()
    })

    it('hides progress tracker in expansion when no kravpunkter exist', async () => {
      const user = userEvent.setup()
      mockKravpunkterProgress = { fulfilled: 0, total: 0 }
      const item = createMockItem()
      render(
        <ComplianceDetailTable {...defaultProps} items={[item]} total={1} />
      )

      await user.click(screen.getByLabelText('Expandera'))

      expect(screen.queryByText(/uppfyllda/)).not.toBeInTheDocument()
    })
  })
})
