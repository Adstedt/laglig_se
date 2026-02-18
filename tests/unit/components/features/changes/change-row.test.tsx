/**
 * Story 8.1 Task 3: ChangeRow component tests
 * Tests the table-row-based change display component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangeRow } from '@/components/features/changes/change-row'
import type { UnacknowledgedChange } from '@/lib/changes/change-utils'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

// Mock date-fns for deterministic output
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 dagar sedan',
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
    amendmentSfs: 'SFS 2026:145',
    aiSummary: null,
    detectedAt: new Date('2026-02-15T08:00:00Z'),
    priority: 'MEDIUM',
    listId: 'list-1',
    listName: 'Arbetsmiljö',
    lawListItemId: 'lli-1',
    ...overrides,
  }
}

// Helper: ChangeRow renders <tr> which needs a <table> wrapper
function renderRow(props: { change: UnacknowledgedChange }) {
  return render(
    <table>
      <tbody>
        <ChangeRow {...props} />
      </tbody>
    </table>
  )
}

describe('ChangeRow (Story 8.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders change type badge with Swedish label for AMENDMENT', () => {
    renderRow({ change: makeChange({ changeType: 'AMENDMENT' }) })
    expect(screen.getByText('Ändring')).toBeInTheDocument()
  })

  it('renders change type badge for REPEAL', () => {
    renderRow({
      change: makeChange({ changeType: 'REPEAL', priority: 'HIGH' }),
    })
    expect(screen.getByText('Upphävande')).toBeInTheDocument()
  })

  it('renders change type badge for NEW_LAW', () => {
    renderRow({ change: makeChange({ changeType: 'NEW_LAW' }) })
    expect(screen.getByText('Ny lag')).toBeInTheDocument()
  })

  it('renders change type badge for METADATA_UPDATE', () => {
    renderRow({
      change: makeChange({
        changeType: 'METADATA_UPDATE',
        priority: 'LOW',
      }),
    })
    expect(screen.getByText('Metadata')).toBeInTheDocument()
  })

  it('displays law title and document number', () => {
    renderRow({ change: makeChange() })
    expect(screen.getByText('Arbetsmiljölagen')).toBeInTheDocument()
    expect(screen.getByText('SFS 1977:1160')).toBeInTheDocument()
  })

  it('shows detected date as relative Swedish time', () => {
    renderRow({ change: makeChange() })
    expect(screen.getByText('2 dagar sedan')).toBeInTheDocument()
  })

  it('shows "Ny" status indicator (hardcoded until Story 8.3)', () => {
    renderRow({ change: makeChange() })
    expect(screen.getByText('Ny')).toBeInTheDocument()
  })

  it('shows priority label — Hög for HIGH', () => {
    renderRow({
      change: makeChange({ changeType: 'REPEAL', priority: 'HIGH' }),
    })
    expect(screen.getByText('Hög')).toBeInTheDocument()
  })

  it('shows priority label — Medel for MEDIUM', () => {
    renderRow({ change: makeChange({ priority: 'MEDIUM' }) })
    expect(screen.getByText('Medel')).toBeInTheDocument()
  })

  it('shows priority label — Låg for LOW', () => {
    renderRow({ change: makeChange({ priority: 'LOW' }) })
    expect(screen.getByText('Låg')).toBeInTheDocument()
  })

  it('navigates to assessment flow with list context on click', async () => {
    const user = userEvent.setup()
    renderRow({
      change: makeChange({ id: 'ce-42', lawListItemId: 'lli-99' }),
    })

    const row = screen.getByRole('button')
    await user.click(row)

    expect(mockPush).toHaveBeenCalledWith(
      '/laglistor/andringar/ce-42?item=lli-99'
    )
  })

  it('has accessible aria-label', () => {
    renderRow({ change: makeChange() })
    const row = screen.getByRole('button')
    expect(row).toHaveAttribute(
      'aria-label',
      'Ändring: Arbetsmiljölagen (SFS 1977:1160)'
    )
  })

  it('displays list name', () => {
    renderRow({ change: makeChange({ listName: 'Brandskydd' }) })
    expect(screen.getByText('Brandskydd')).toBeInTheDocument()
  })

  it('navigates on Enter key press', async () => {
    const user = userEvent.setup()
    renderRow({
      change: makeChange({ id: 'ce-kb', lawListItemId: 'lli-kb' }),
    })

    const row = screen.getByRole('button')
    row.focus()
    await user.keyboard('{Enter}')

    expect(mockPush).toHaveBeenCalledWith(
      '/laglistor/andringar/ce-kb?item=lli-kb'
    )
  })

  it('navigates on Space key press', async () => {
    const user = userEvent.setup()
    renderRow({
      change: makeChange({ id: 'ce-sp', lawListItemId: 'lli-sp' }),
    })

    const row = screen.getByRole('button')
    row.focus()
    await user.keyboard(' ')

    expect(mockPush).toHaveBeenCalledWith(
      '/laglistor/andringar/ce-sp?item=lli-sp'
    )
  })
})
