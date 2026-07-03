/**
 * Laglistor group-management popover (modal → popover presentation swap).
 * Proves every popover control invokes the exact Story 4.13 server action
 * the old GroupManager dialog called, with identical payloads.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ManageLawGroupsPopover } from '@/components/features/document-list/manage-law-groups-popover'
import {
  createListGroup,
  updateListGroup,
  deleteListGroup,
  getListGroups,
  reorderGroups,
} from '@/app/actions/document-list'

// Mock the Story 4.13 server actions (same module the old modal used)
vi.mock('@/app/actions/document-list', () => ({
  createListGroup: vi.fn(),
  updateListGroup: vi.fn(),
  deleteListGroup: vi.fn(),
  getListGroups: vi.fn(),
  reorderGroups: vi.fn(),
}))

const mockGroups = [
  {
    id: 'group-1',
    name: 'Arbetsmiljö',
    position: 0,
    itemCount: 12,
    createdAt: new Date('2026-01-01'),
  },
  {
    id: 'group-2',
    name: 'Miljö',
    position: 1,
    itemCount: 5,
    createdAt: new Date('2026-01-02'),
  },
]

const LIST_ID = 'list-1'

function renderPopover(overrides?: {
  open?: boolean
  onOpenChange?: (_open: boolean) => void
  onGroupsUpdated?: () => void
}) {
  const onGroupsUpdated = overrides?.onGroupsUpdated ?? vi.fn()
  const onOpenChange = overrides?.onOpenChange ?? vi.fn()
  render(
    <ManageLawGroupsPopover
      open={overrides?.open ?? true}
      onOpenChange={onOpenChange}
      listId={LIST_ID}
      onGroupsUpdated={onGroupsUpdated}
    />
  )
  return { onGroupsUpdated, onOpenChange }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getListGroups).mockResolvedValue({
    success: true,
    data: mockGroups,
  })
})

describe('ManageLawGroupsPopover', () => {
  it('renders the standalone "Hantera grupper" trigger and requests open on click', async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderPopover({ open: false })

    const trigger = screen.getByRole('button', { name: /Hantera grupper/ })
    expect(trigger).toBeInTheDocument()

    await user.click(trigger)
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('fetches groups on open and renders rows with document counts', async () => {
    renderPopover()

    await waitFor(() => {
      expect(getListGroups).toHaveBeenCalledWith(LIST_ID)
    })

    expect(await screen.findByText('Grupper')).toBeInTheDocument()
    expect(screen.getByText('Arbetsmiljö')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Miljö')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('does not fetch when closed', () => {
    renderPopover({ open: false })
    expect(getListGroups).not.toHaveBeenCalled()
  })

  it('creates a group via the inline input and calls onGroupsUpdated', async () => {
    const user = userEvent.setup()
    vi.mocked(createListGroup).mockResolvedValue({ success: true })
    const { onGroupsUpdated } = renderPopover()

    const input = await screen.findByLabelText('Namn på ny grupp')
    await user.type(input, '  Brandskydd ')
    await user.click(screen.getByRole('button', { name: /Skapa/ }))

    await waitFor(() => {
      expect(createListGroup).toHaveBeenCalledWith({
        listId: LIST_ID,
        name: 'Brandskydd',
      })
    })
    await waitFor(() => {
      expect(onGroupsUpdated).toHaveBeenCalled()
    })
    // Refetch after mutation (initial fetch + post-create fetch)
    expect(getListGroups).toHaveBeenCalledTimes(2)
  })

  it('renames a group through the inline edit row', async () => {
    const user = userEvent.setup()
    vi.mocked(updateListGroup).mockResolvedValue({ success: true })
    const { onGroupsUpdated } = renderPopover()

    await screen.findByText('Arbetsmiljö')
    const renameButtons = screen.getAllByRole('button', { name: 'Byt namn' })
    await user.click(renameButtons[0]!)

    const editInput = screen.getByLabelText('Nytt gruppnamn')
    await user.clear(editInput)
    await user.type(editInput, 'Arbetsmiljö & säkerhet{Enter}')

    await waitFor(() => {
      expect(updateListGroup).toHaveBeenCalledWith({
        groupId: 'group-1',
        name: 'Arbetsmiljö & säkerhet',
      })
    })
    await waitFor(() => {
      expect(onGroupsUpdated).toHaveBeenCalled()
    })
  })

  it('requires confirmation before deleting, then calls deleteListGroup', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteListGroup).mockResolvedValue({ success: true })
    const { onGroupsUpdated } = renderPopover()

    await screen.findByText('Arbetsmiljö')
    const deleteButtons = screen.getAllByRole('button', {
      name: 'Ta bort grupp',
    })
    await user.click(deleteButtons[0]!)

    // Confirmation dialog appears — no action call yet
    expect(await screen.findByText('Ta bort gruppen?')).toBeInTheDocument()
    expect(
      screen.getByText(/De 12 dokumenten i gruppen kommer att flyttas/)
    ).toBeInTheDocument()
    expect(deleteListGroup).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Ta bort' }))

    await waitFor(() => {
      expect(deleteListGroup).toHaveBeenCalledWith('group-1')
    })
    await waitFor(() => {
      expect(onGroupsUpdated).toHaveBeenCalled()
    })
  })

  it('cancelling the delete confirmation does not delete', async () => {
    const user = userEvent.setup()
    renderPopover()

    await screen.findByText('Arbetsmiljö')
    const deleteButtons = screen.getAllByRole('button', {
      name: 'Ta bort grupp',
    })
    await user.click(deleteButtons[0]!)

    await screen.findByText('Ta bort gruppen?')
    await user.click(screen.getByRole('button', { name: 'Avbryt' }))

    expect(deleteListGroup).not.toHaveBeenCalled()
  })

  it('reorders with the same integer-index payload the modal sent', async () => {
    const user = userEvent.setup()
    vi.mocked(reorderGroups).mockResolvedValue({ success: true })
    const { onGroupsUpdated } = renderPopover()

    await screen.findByText('Arbetsmiljö')
    const downButtons = screen.getAllByRole('button', { name: 'Flytta ned' })
    await user.click(downButtons[0]!)

    await waitFor(() => {
      expect(reorderGroups).toHaveBeenCalledWith({
        listId: LIST_ID,
        groups: [
          { id: 'group-2', position: 0 },
          { id: 'group-1', position: 1 },
        ],
      })
    })
    await waitFor(() => {
      expect(onGroupsUpdated).toHaveBeenCalled()
    })
  })

  it('disables the first row’s up arrow and the last row’s down arrow', async () => {
    renderPopover()

    await screen.findByText('Arbetsmiljö')
    const upButtons = screen.getAllByRole('button', { name: 'Flytta upp' })
    const downButtons = screen.getAllByRole('button', { name: 'Flytta ned' })

    expect(upButtons[0]).toBeDisabled()
    expect(upButtons[1]).not.toBeDisabled()
    expect(downButtons[0]).not.toBeDisabled()
    expect(downButtons[1]).toBeDisabled()
  })

  it('shows the fetch error state', async () => {
    vi.mocked(getListGroups).mockResolvedValue({
      success: false,
      error: 'Kunde inte hämta grupper',
    })
    renderPopover()

    expect(
      await screen.findByText('Kunde inte hämta grupper')
    ).toBeInTheDocument()
  })
})
