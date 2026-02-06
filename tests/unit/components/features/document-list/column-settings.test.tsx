/**
 * Story 4.12: ColumnSettings Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ColumnSettings,
  DEFAULT_COLUMN_VISIBILITY,
} from '@/components/features/document-list/column-settings'

describe('ColumnSettings', () => {
  it('renders column settings button', () => {
    render(
      <ColumnSettings
        columnVisibility={DEFAULT_COLUMN_VISIBILITY}
        onColumnVisibilityChange={vi.fn()}
      />
    )

    expect(
      screen.getByRole('button', { name: /kolumner/i })
    ).toBeInTheDocument()
  })

  it('opens dropdown when clicking button', async () => {
    const user = userEvent.setup()
    render(
      <ColumnSettings
        columnVisibility={DEFAULT_COLUMN_VISIBILITY}
        onColumnVisibilityChange={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /kolumner/i }))

    await waitFor(() => {
      expect(screen.getByText('Visa kolumner')).toBeInTheDocument()
    })
  })

  it('displays all column options', async () => {
    const user = userEvent.setup()
    render(
      <ColumnSettings
        columnVisibility={DEFAULT_COLUMN_VISIBILITY}
        onColumnVisibilityChange={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /kolumner/i }))

    await waitFor(() => {
      expect(screen.getByText('Typ')).toBeInTheDocument()
      expect(screen.getByText('Dokument')).toBeInTheDocument()
      expect(screen.getByText('Efterlevnad')).toBeInTheDocument()
      expect(screen.getByText('Prioritet')).toBeInTheDocument()
      expect(screen.getByText('Deadline')).toBeInTheDocument()
      expect(screen.getByText('Tilldelad')).toBeInTheDocument()
      expect(screen.getByText('Ansvarig')).toBeInTheDocument()
      expect(screen.getByText('Uppgifter')).toBeInTheDocument()
      expect(screen.getByText('Aktivitet')).toBeInTheDocument()
      expect(screen.getByText('Anteckningar')).toBeInTheDocument()
      expect(screen.getByText('Grupp')).toBeInTheDocument()
      expect(screen.getByText('Tillagd')).toBeInTheDocument()
    })
  })

  it('calls onColumnVisibilityChange when toggling a column', async () => {
    const user = userEvent.setup()
    const onColumnVisibilityChange = vi.fn()
    render(
      <ColumnSettings
        columnVisibility={DEFAULT_COLUMN_VISIBILITY}
        onColumnVisibilityChange={onColumnVisibilityChange}
      />
    )

    await user.click(screen.getByRole('button', { name: /kolumner/i }))

    await waitFor(() => {
      expect(screen.getByText('Tilldelad')).toBeInTheDocument()
    })

    // Toggle "Tilldelad" (assignee) column which is hidden by default
    await user.click(screen.getByText('Tilldelad'))

    expect(onColumnVisibilityChange).toHaveBeenCalledWith({
      ...DEFAULT_COLUMN_VISIBILITY,
      assignee: true,
    })
  })

  it('shows reset button and resets to defaults', async () => {
    const user = userEvent.setup()
    const onColumnVisibilityChange = vi.fn()
    const customVisibility = {
      type: false,
      title: true,
      complianceStatus: false,
      priority: true,
      dueDate: true,
      assignee: true,
      responsiblePerson: false,
      taskProgress: false,
      lastActivity: false,
      notes: true,
      group: false,
      addedAt: true,
    }
    render(
      <ColumnSettings
        columnVisibility={customVisibility}
        onColumnVisibilityChange={onColumnVisibilityChange}
      />
    )

    await user.click(screen.getByRole('button', { name: /kolumner/i }))

    await waitFor(() => {
      expect(screen.getByText('Återställ standard')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Återställ standard'))

    expect(onColumnVisibilityChange).toHaveBeenCalledWith(
      DEFAULT_COLUMN_VISIBILITY
    )
  })

  it('reflects current visibility state in checkboxes', async () => {
    const user = userEvent.setup()
    const customVisibility = {
      ...DEFAULT_COLUMN_VISIBILITY,
      type: false, // Hide type column
      assignee: true, // Show assignee column
    }
    render(
      <ColumnSettings
        columnVisibility={customVisibility}
        onColumnVisibilityChange={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /kolumner/i }))

    await waitFor(() => {
      // Find menu items by their text content
      const typItem = screen.getByText('Typ')
      const assigneeItem = screen.getByText('Tilldelad')

      // Check the parent menu item's data-state attribute
      const typMenuItem = typItem.closest('[role="menuitemcheckbox"]')
      const assigneeMenuItem = assigneeItem.closest('[role="menuitemcheckbox"]')

      expect(typMenuItem).toHaveAttribute('data-state', 'unchecked')
      expect(assigneeMenuItem).toHaveAttribute('data-state', 'checked')
    })
  })

  it('DEFAULT_COLUMN_VISIBILITY has correct defaults', () => {
    // Verify default visibility matches story requirements
    expect(DEFAULT_COLUMN_VISIBILITY).toEqual({
      type: true,
      title: true,
      complianceStatus: true,
      priority: true,
      dueDate: true,
      assignee: false,
      responsiblePerson: false,
      taskProgress: false,
      lastActivity: false,
      notes: false,
      group: false,
      addedAt: false,
    })
  })
})
