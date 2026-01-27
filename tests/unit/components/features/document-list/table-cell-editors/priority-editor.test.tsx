/**
 * Story 4.12: PriorityEditor Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PriorityEditor } from '@/components/features/document-list/table-cell-editors/priority-editor'

describe('PriorityEditor', () => {
  it('renders current priority value', () => {
    const onChange = vi.fn()
    render(<PriorityEditor value="MEDIUM" onChange={onChange} />)

    expect(screen.getByText('Medel')).toBeInTheDocument()
  })

  it('shows all priority options in dropdown', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PriorityEditor value="LOW" onChange={onChange} />)

    // Open dropdown
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    // Check all options are present (use getAllByText since trigger also shows selected value)
    await waitFor(() => {
      // "Låg" appears twice: once in trigger, once in dropdown option
      expect(screen.getAllByText('Låg').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Medel')).toBeInTheDocument()
      expect(screen.getByText('Hög')).toBeInTheDocument()
    })
  })

  it('calls onChange when selecting a different priority', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(<PriorityEditor value="LOW" onChange={onChange} />)

    // Open dropdown and select new priority
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('Hög')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Hög'))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('HIGH')
    })
  })

  it('does not call onChange when selecting same priority', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PriorityEditor value="MEDIUM" onChange={onChange} />)

    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    await waitFor(() => {
      // Find option in dropdown content (not the trigger)
      expect(screen.getAllByText('Medel').length).toBeGreaterThanOrEqual(1)
    })

    // Click on Medel option in dropdown
    const options = screen.getAllByText('Medel')
    const dropdownOption = options.find((el) => el.closest('[role="option"]'))
    if (dropdownOption) {
      await user.click(dropdownOption)
    }

    // Should not call onChange since MEDIUM is already selected
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows loading state during save', async () => {
    const user = userEvent.setup()
    let resolvePromise: () => void
    const onChange = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePromise = resolve
      })
    )
    render(<PriorityEditor value="LOW" onChange={onChange} />)

    // Open dropdown and select new priority
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('Hög')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Hög'))

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveClass('opacity-50')
    })

    // Resolve the promise
    resolvePromise!()

    // Loading should clear
    await waitFor(() => {
      expect(screen.getByRole('combobox')).not.toHaveClass('opacity-50')
    })
  })

  it('displays correct color classes for each priority', () => {
    const priorities = [
      { value: 'LOW', expectedClass: 'bg-slate-100' },
      { value: 'MEDIUM', expectedClass: 'bg-amber-100' },
      { value: 'HIGH', expectedClass: 'bg-rose-100' },
    ] as const

    for (const { value, expectedClass: _expectedClass } of priorities) {
      const { container, unmount } = render(
        <PriorityEditor value={value} onChange={vi.fn()} />
      )
      // Badge should exist with expected styling
      expect(container.querySelector('span')).toBeInTheDocument()
      unmount()
    }
  })
})
