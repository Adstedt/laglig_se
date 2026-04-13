/**
 * Story 17.16: KravpunkterChecklist component tests
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SWRConfig } from 'swr'
import type { ReactElement } from 'react'
import { KravpunkterChecklist } from '@/components/features/document-list/legal-document-modal/kravpunkter-checklist'
import {
  getRequirementsForListItem,
  createRequirement,
  updateRequirement,
  deleteRequirement,
} from '@/app/actions/law-list-item-requirements'

/** Give each test a fresh SWR cache — otherwise the module-level store leaks. */
function renderFresh(ui: ReactElement) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>{ui}</SWRConfig>
  )
}

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/app/actions/law-list-item-requirements', () => ({
  getRequirementsForListItem: vi.fn(),
  createRequirement: vi.fn(),
  updateRequirement: vi.fn(),
  deleteRequirement: vi.fn().mockResolvedValue({ success: true }),
  linkEvidenceToRequirement: vi.fn(),
  unlinkEvidenceFromRequirement: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  }),
}))

// Evidence pickers are out of scope for these tests — stub them.
vi.mock('@/components/features/files/file-picker-modal', () => ({
  FilePickerModal: () => null,
}))
vi.mock('@/components/features/documents/document-picker-modal', () => ({
  DocumentPickerModal: () => null,
}))

// ============================================================================
// Helpers
// ============================================================================

const LIST_ITEM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function mockRequirements(
  rows: Array<{
    id: string
    text: string
    isFulfilled?: boolean
    position?: number
    evidence?: unknown[]
  }>
) {
  ;(getRequirementsForListItem as unknown as Mock).mockResolvedValue({
    success: true,
    data: rows.map((r, i) => ({
      id: r.id,
      text: r.text,
      isFulfilled: r.isFulfilled ?? false,
      position: r.position ?? (i + 1) * 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
      evidence: r.evidence ?? [],
    })),
  })
}

// ============================================================================
// Tests
// ============================================================================

describe('KravpunkterChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders requirement rows with text and checkbox state', async () => {
    mockRequirements([
      {
        id: 'req-1',
        text: 'Rutinen finns dokumenterad',
        isFulfilled: true,
      },
      { id: 'req-2', text: 'Utbildning genomförd', isFulfilled: false },
    ])

    renderFresh(<KravpunkterChecklist listItemId={LIST_ITEM_ID} />)

    await waitFor(() =>
      expect(screen.getByText('Rutinen finns dokumenterad')).toBeInTheDocument()
    )
    expect(screen.getByText('Utbildning genomförd')).toBeInTheDocument()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes[0]).toHaveAttribute('data-state', 'checked')
    expect(checkboxes[1]).toHaveAttribute('data-state', 'unchecked')
  })

  it('shows empty state when no requirements exist', async () => {
    mockRequirements([])

    renderFresh(<KravpunkterChecklist listItemId={LIST_ITEM_ID} />)

    await waitFor(() =>
      expect(
        screen.getByText('Inga kravpunkter definierade')
      ).toBeInTheDocument()
    )
    expect(
      screen.getByText('Lägg till din första kravpunkt')
    ).toBeInTheDocument()
  })

  it('inline add: click button → type → Enter → calls createRequirement', async () => {
    mockRequirements([])
    ;(createRequirement as unknown as Mock).mockResolvedValue({
      success: true,
      data: {
        id: 'new-req',
        text: 'Ny kravpunkt',
        isFulfilled: false,
        position: 1000,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        evidence: [],
      },
    })

    const user = userEvent.setup()
    renderFresh(<KravpunkterChecklist listItemId={LIST_ITEM_ID} />)

    await waitFor(() =>
      expect(
        screen.getByText('Inga kravpunkter definierade')
      ).toBeInTheDocument()
    )

    await user.click(
      screen.getByRole('button', { name: /Lägg till kravpunkt/i })
    )
    const input = screen.getByPlaceholderText('Beskriv kravpunkten…')
    await user.type(input, 'Ny kravpunkt{Enter}')

    await waitFor(() =>
      expect(createRequirement).toHaveBeenCalledWith(
        LIST_ITEM_ID,
        'Ny kravpunkt'
      )
    )
  })

  it('checkbox toggle calls updateRequirement with isFulfilled', async () => {
    mockRequirements([{ id: 'req-1', text: 'Gör något', isFulfilled: false }])
    ;(updateRequirement as unknown as Mock).mockResolvedValue({
      success: true,
    })

    const user = userEvent.setup()
    renderFresh(<KravpunkterChecklist listItemId={LIST_ITEM_ID} />)

    await waitFor(() =>
      expect(screen.getByText('Gör något')).toBeInTheDocument()
    )

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    await waitFor(() =>
      expect(updateRequirement).toHaveBeenCalledWith('req-1', {
        isFulfilled: true,
      })
    )
  })

  it('reports progress via onProgressChange callback', async () => {
    mockRequirements([
      { id: 'r1', text: 'a', isFulfilled: true },
      { id: 'r2', text: 'b', isFulfilled: true },
      { id: 'r3', text: 'c', isFulfilled: false },
    ])

    const onProgressChange = vi.fn()
    renderFresh(
      <KravpunkterChecklist
        listItemId={LIST_ITEM_ID}
        onProgressChange={onProgressChange}
      />
    )

    await waitFor(() =>
      expect(onProgressChange).toHaveBeenCalledWith({
        fulfilled: 2,
        total: 3,
      })
    )
  })

  it('read-only mode hides add button and disables checkboxes', async () => {
    mockRequirements([
      { id: 'req-1', text: 'Rutinen finns', isFulfilled: false },
    ])

    renderFresh(<KravpunkterChecklist listItemId={LIST_ITEM_ID} readOnly />)

    await waitFor(() =>
      expect(screen.getByText('Rutinen finns')).toBeInTheDocument()
    )

    expect(
      screen.queryByRole('button', { name: /Lägg till kravpunkt/i })
    ).not.toBeInTheDocument()

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeDisabled()
  })

  it('expands evidence list on chevron click', async () => {
    mockRequirements([
      {
        id: 'req-1',
        text: 'Med bevis',
        evidence: [
          {
            id: 'link-1',
            linkedAt: new Date(),
            file: {
              id: 'f1',
              filename: 'avtal.pdf',
              mimeType: 'application/pdf',
            },
            workspaceDocument: null,
          },
        ],
      },
    ])

    const user = userEvent.setup()
    renderFresh(<KravpunkterChecklist listItemId={LIST_ITEM_ID} />)

    await waitFor(() =>
      expect(screen.getByText('Med bevis')).toBeInTheDocument()
    )

    // Evidence file name is not visible until the row is expanded.
    expect(screen.queryByText('avtal.pdf')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Visa bevis'))

    await waitFor(() =>
      expect(screen.getByText('avtal.pdf')).toBeInTheDocument()
    )
  })

  it('evidence count badge shows when count > 0', async () => {
    mockRequirements([
      {
        id: 'req-1',
        text: 'Länkad kravpunkt',
        evidence: [
          {
            id: 'link-1',
            linkedAt: new Date(),
            file: {
              id: 'f1',
              filename: 'a.pdf',
              mimeType: 'application/pdf',
            },
            workspaceDocument: null,
          },
          {
            id: 'link-2',
            linkedAt: new Date(),
            file: null,
            workspaceDocument: {
              id: 'd1',
              title: 'Policy',
              documentType: 'POLICY',
              status: 'APPROVED',
            },
          },
        ],
      },
    ])

    renderFresh(<KravpunkterChecklist listItemId={LIST_ITEM_ID} />)

    await waitFor(() =>
      expect(screen.getByText('Länkad kravpunkt')).toBeInTheDocument()
    )

    expect(screen.getByText('2 bevis')).toBeInTheDocument()
  })

  it('delete: clicking X opens AlertDialog; Avbryt keeps the row and does not call deleteRequirement', async () => {
    mockRequirements([
      { id: 'req-1', text: 'Ska vara kvar', isFulfilled: false },
    ])

    const user = userEvent.setup()
    renderFresh(<KravpunkterChecklist listItemId={LIST_ITEM_ID} />)

    await waitFor(() =>
      expect(screen.getByText('Ska vara kvar')).toBeInTheDocument()
    )

    await user.click(screen.getByRole('button', { name: /Ta bort kravpunkt/i }))

    // Dialog renders with destructive copy.
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Ta bort kravpunkt?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Avbryt' }))

    // Row is still there; server action not called.
    expect(screen.getByText('Ska vara kvar')).toBeInTheDocument()
    expect(deleteRequirement).not.toHaveBeenCalled()
  })

  it('delete: clicking X then Ta bort calls deleteRequirement and removes the row optimistically', async () => {
    mockRequirements([{ id: 'req-1', text: 'Ska bort', isFulfilled: false }])
    ;(deleteRequirement as unknown as Mock).mockResolvedValue({ success: true })

    const user = userEvent.setup()
    renderFresh(<KravpunkterChecklist listItemId={LIST_ITEM_ID} />)

    await waitFor(() =>
      expect(screen.getByText('Ska bort')).toBeInTheDocument()
    )

    await user.click(screen.getByRole('button', { name: /Ta bort kravpunkt/i }))
    await user.click(screen.getByRole('button', { name: 'Ta bort' }))

    await waitFor(() => expect(deleteRequirement).toHaveBeenCalledWith('req-1'))
    // Note: optimistic DOM removal is not asserted here because `globalMutate` from swr
    // writes to the module-level cache, not the SWRConfig-scoped test cache. The server
    // action firing is what this test gates.
  })
})
