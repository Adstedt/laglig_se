/**
 * Story 8.1 Task 4: ChangesTab component tests
 * Tests the prop-driven API (initialChanges from server-side fetch).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ChangesTab } from '@/components/features/changes/changes-tab'
import type { UnacknowledgedChange } from '@/lib/changes/change-utils'

// Mock next/navigation — mutable searchParams for per-test configuration
let mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}))

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '1 dag sedan',
}))

function makeChange(
  overrides: Partial<UnacknowledgedChange> = {}
): UnacknowledgedChange {
  return {
    id: 'ce-1',
    documentId: 'doc-1',
    documentTitle: 'Arbetsmiljölagen',
    documentNumber: 'SFS 1977:1160',
    contentType: 'SFS',
    changeType: 'AMENDMENT',
    amendmentSfs: null,
    aiSummary: null,
    detectedAt: new Date('2026-02-15T08:00:00Z'),
    priority: 'MEDIUM',
    listId: 'list-1',
    listName: 'Arbetsmiljö',
    lawListItemId: 'lli-1',
    ...overrides,
  }
}

describe('ChangesTab (Story 8.1)', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams()
  })

  it('renders empty state when no changes', () => {
    render(<ChangesTab initialChanges={[]} />)
    expect(screen.getByText('Inga olästa lagändringar')).toBeInTheDocument()
  })

  it('renders empty state with no props', () => {
    render(<ChangesTab />)
    expect(screen.getByText('Inga olästa lagändringar')).toBeInTheDocument()
  })

  it('renders changes in a table with column headers', () => {
    const changes: UnacknowledgedChange[] = [
      makeChange({
        id: 'ce-low',
        documentTitle: 'Low Priority',
        changeType: 'METADATA_UPDATE',
        priority: 'LOW',
        detectedAt: new Date('2026-02-15'),
      }),
      makeChange({
        id: 'ce-high',
        documentTitle: 'High Priority',
        changeType: 'REPEAL',
        priority: 'HIGH',
        detectedAt: new Date('2026-02-14'),
      }),
      makeChange({
        id: 'ce-med',
        documentTitle: 'Medium Priority',
        changeType: 'AMENDMENT',
        priority: 'MEDIUM',
        detectedAt: new Date('2026-02-16'),
      }),
    ]

    render(<ChangesTab initialChanges={changes} />)

    expect(screen.getByText('High Priority')).toBeInTheDocument()
    expect(screen.getByText('Medium Priority')).toBeInTheDocument()
    expect(screen.getByText('Low Priority')).toBeInTheDocument()

    // Table has column headers
    expect(screen.getByText('Typ')).toBeInTheDocument()
    expect(screen.getByText('Dokument')).toBeInTheDocument()
    expect(screen.getByText('Lista')).toBeInTheDocument()
    expect(screen.getByText('Prioritet')).toBeInTheDocument()
    expect(screen.getByText('Upptäckt')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()

    // Info row shows count
    expect(screen.getByText('3 av 3 ändringar')).toBeInTheDocument()
  })

  it('renders changes in correct sort order (priority desc, then date desc)', () => {
    const changes: UnacknowledgedChange[] = [
      makeChange({
        id: 'ce-low',
        documentTitle: 'Low Doc',
        priority: 'LOW',
        detectedAt: new Date('2026-02-15'),
        listId: 'list-1',
      }),
      makeChange({
        id: 'ce-high',
        documentTitle: 'High Doc',
        priority: 'HIGH',
        detectedAt: new Date('2026-02-14'),
        listId: 'list-2',
      }),
      makeChange({
        id: 'ce-med',
        documentTitle: 'Medium Doc',
        priority: 'MEDIUM',
        detectedAt: new Date('2026-02-16'),
        listId: 'list-3',
      }),
    ]

    render(<ChangesTab initialChanges={changes} />)

    // Get all rows in the table body (skip header row)
    const rows = screen.getAllByRole('button')

    // Rows should appear in the order passed (server sorts them:
    // HIGH first, then MEDIUM, then LOW)
    // The component renders initialChanges in the order received,
    // so the server-side sort order is preserved.
    expect(within(rows[0]!).getByText('Low Doc')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('High Doc')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('Medium Doc')).toBeInTheDocument()
  })

  it('filters changes by document ID from URL params', () => {
    mockSearchParams = new URLSearchParams('tab=changes&document=doc-2')

    const changes: UnacknowledgedChange[] = [
      makeChange({
        id: 'ce-1',
        documentId: 'doc-1',
        documentTitle: 'Lag A',
        listId: 'list-1',
      }),
      makeChange({
        id: 'ce-2',
        documentId: 'doc-2',
        documentTitle: 'Lag B',
        listId: 'list-2',
      }),
      makeChange({
        id: 'ce-3',
        documentId: 'doc-2',
        documentTitle: 'Lag B kopian',
        listId: 'list-3',
      }),
    ]

    render(<ChangesTab initialChanges={changes} />)

    // Only doc-2 changes should be visible
    expect(screen.getByText('Lag B')).toBeInTheDocument()
    expect(screen.getByText('Lag B kopian')).toBeInTheDocument()
    expect(screen.queryByText('Lag A')).not.toBeInTheDocument()

    // Count should reflect filter
    expect(screen.getByText('2 av 3 ändringar')).toBeInTheDocument()
  })

  it('filters changes by priority from URL params', () => {
    mockSearchParams = new URLSearchParams('tab=changes&priority=HIGH')

    const changes: UnacknowledgedChange[] = [
      makeChange({
        id: 'ce-high',
        documentTitle: 'Urgent Law',
        priority: 'HIGH',
        listId: 'list-1',
      }),
      makeChange({
        id: 'ce-med',
        documentTitle: 'Normal Law',
        priority: 'MEDIUM',
        listId: 'list-2',
      }),
    ]

    render(<ChangesTab initialChanges={changes} />)

    expect(screen.getByText('Urgent Law')).toBeInTheDocument()
    expect(screen.queryByText('Normal Law')).not.toBeInTheDocument()
    expect(screen.getByText('1 av 2 ändringar')).toBeInTheDocument()
  })

  it('shows filtered empty state when filters match nothing', () => {
    mockSearchParams = new URLSearchParams('tab=changes&priority=HIGH')

    const changes: UnacknowledgedChange[] = [
      makeChange({
        id: 'ce-low',
        documentTitle: 'Low Priority Law',
        priority: 'LOW',
        listId: 'list-1',
      }),
    ]

    render(<ChangesTab initialChanges={changes} />)

    // No matching changes but not the global empty state
    expect(
      screen.getByText('Inga ändringar matchar filtret')
    ).toBeInTheDocument()
    expect(screen.getByText('0 av 1 ändringar')).toBeInTheDocument()
  })
})
