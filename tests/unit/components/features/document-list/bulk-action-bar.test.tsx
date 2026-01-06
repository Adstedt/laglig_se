/**
 * Story 4.12: BulkActionBar Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulkActionBar } from '@/components/features/document-list/bulk-action-bar'

describe('BulkActionBar', () => {
  it('displays selected count correctly for single item', () => {
    render(
      <BulkActionBar
        selectedCount={1}
        onClearSelection={vi.fn()}
        onBulkUpdate={vi.fn()}
      />
    )

    expect(screen.getByText('1 vald')).toBeInTheDocument()
  })

  it('displays selected count correctly for multiple items', () => {
    render(
      <BulkActionBar
        selectedCount={5}
        onClearSelection={vi.fn()}
        onBulkUpdate={vi.fn()}
      />
    )

    expect(screen.getByText('5 valda')).toBeInTheDocument()
  })

  it('calls onClearSelection when clicking clear button', async () => {
    const user = userEvent.setup()
    const onClearSelection = vi.fn()
    render(
      <BulkActionBar
        selectedCount={3}
        onClearSelection={onClearSelection}
        onBulkUpdate={vi.fn()}
      />
    )

    const clearButton = screen.getByRole('button', { name: /rensa markering/i })
    await user.click(clearButton)

    expect(onClearSelection).toHaveBeenCalledTimes(1)
  })

  it('calls onBulkUpdate with status when selecting status option', async () => {
    const user = userEvent.setup()
    const onBulkUpdate = vi.fn().mockResolvedValue(undefined)
    render(
      <BulkActionBar
        selectedCount={2}
        onClearSelection={vi.fn()}
        onBulkUpdate={onBulkUpdate}
      />
    )

    // Find and click the status dropdown
    const statusTrigger = screen.getAllByRole('combobox')[0]
    await user.click(statusTrigger)

    // Select "Pågår" (IN_PROGRESS)
    await waitFor(() => {
      expect(screen.getByText('Pågår')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Pågår'))

    await waitFor(() => {
      expect(onBulkUpdate).toHaveBeenCalledWith({ status: 'IN_PROGRESS' })
    })
  })

  it('calls onBulkUpdate with priority when selecting priority option', async () => {
    const user = userEvent.setup()
    const onBulkUpdate = vi.fn().mockResolvedValue(undefined)
    render(
      <BulkActionBar
        selectedCount={2}
        onClearSelection={vi.fn()}
        onBulkUpdate={onBulkUpdate}
      />
    )

    // Find and click the priority dropdown (second combobox)
    const priorityTrigger = screen.getAllByRole('combobox')[1]
    await user.click(priorityTrigger)

    // Select "Hög" (HIGH)
    await waitFor(() => {
      expect(screen.getByText('Hög')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Hög'))

    await waitFor(() => {
      expect(onBulkUpdate).toHaveBeenCalledWith({ priority: 'HIGH' })
    })
  })

  it('shows loading indicator during bulk update', async () => {
    const user = userEvent.setup()
    let resolvePromise: () => void
    const onBulkUpdate = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePromise = resolve
      })
    )
    render(
      <BulkActionBar
        selectedCount={2}
        onClearSelection={vi.fn()}
        onBulkUpdate={onBulkUpdate}
      />
    )

    // Trigger a status change
    const statusTrigger = screen.getAllByRole('combobox')[0]
    await user.click(statusTrigger)

    await waitFor(() => {
      expect(screen.getByText('Blockerad')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Blockerad'))

    // Should show loading spinner (Loader2 component)
    await waitFor(() => {
      const loader = document.querySelector('.animate-spin')
      expect(loader).toBeInTheDocument()
    })

    // Resolve the promise
    resolvePromise!()

    // Loading should clear
    await waitFor(() => {
      const loader = document.querySelector('.animate-spin')
      expect(loader).not.toBeInTheDocument()
    })
  })

  it('disables dropdowns during loading', async () => {
    const user = userEvent.setup()
    let resolvePromise: () => void
    const onBulkUpdate = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePromise = resolve
      })
    )
    render(
      <BulkActionBar
        selectedCount={2}
        onClearSelection={vi.fn()}
        onBulkUpdate={onBulkUpdate}
      />
    )

    // Trigger a status change
    const statusTrigger = screen.getAllByRole('combobox')[0]
    await user.click(statusTrigger)

    await waitFor(() => {
      expect(screen.getByText('Uppfylld')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Uppfylld'))

    // Dropdowns should be disabled
    await waitFor(() => {
      const comboboxes = screen.getAllByRole('combobox')
      comboboxes.forEach((combobox) => {
        expect(combobox).toBeDisabled()
      })
    })

    resolvePromise!()
  })

  it('has proper accessibility attributes', () => {
    render(
      <BulkActionBar
        selectedCount={3}
        onClearSelection={vi.fn()}
        onBulkUpdate={vi.fn()}
      />
    )

    // Should have toolbar role
    expect(screen.getByRole('toolbar')).toBeInTheDocument()
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', 'Massåtgärder')
  })

  it('shows all status options in dropdown', async () => {
    const user = userEvent.setup()
    render(
      <BulkActionBar
        selectedCount={1}
        onClearSelection={vi.fn()}
        onBulkUpdate={vi.fn()}
      />
    )

    const statusTrigger = screen.getAllByRole('combobox')[0]
    await user.click(statusTrigger)

    await waitFor(() => {
      expect(screen.getByText('Ej påbörjad')).toBeInTheDocument()
      expect(screen.getByText('Pågår')).toBeInTheDocument()
      expect(screen.getByText('Blockerad')).toBeInTheDocument()
      expect(screen.getByText('Granskning')).toBeInTheDocument()
      expect(screen.getByText('Uppfylld')).toBeInTheDocument()
    })
  })

  it('shows all priority options in dropdown', async () => {
    const user = userEvent.setup()
    render(
      <BulkActionBar
        selectedCount={1}
        onClearSelection={vi.fn()}
        onBulkUpdate={vi.fn()}
      />
    )

    const priorityTrigger = screen.getAllByRole('combobox')[1]
    await user.click(priorityTrigger)

    await waitFor(() => {
      expect(screen.getByText('Låg')).toBeInTheDocument()
      expect(screen.getByText('Medel')).toBeInTheDocument()
      expect(screen.getByText('Hög')).toBeInTheDocument()
    })
  })
})
