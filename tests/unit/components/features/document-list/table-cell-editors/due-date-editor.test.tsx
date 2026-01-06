/**
 * Story 4.12: DueDateEditor Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DueDateEditor } from '@/components/features/document-list/table-cell-editors/due-date-editor'

describe('DueDateEditor', () => {
  beforeEach(() => {
    // Mock the current date for consistent testing
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders empty state when no date is set', () => {
    const onChange = vi.fn()
    render(<DueDateEditor value={null} onChange={onChange} />)

    // Should show placeholder dash
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders formatted date in Swedish locale', () => {
    const onChange = vi.fn()
    const testDate = new Date('2026-02-20')
    render(<DueDateEditor value={testDate} onChange={onChange} />)

    // Should show formatted date (Swedish format: "20 feb. 2026" with abbreviated month)
    expect(screen.getByText(/20 feb\.? 2026/i)).toBeInTheDocument()
  })

  it('shows overdue indicator for past dates', () => {
    const onChange = vi.fn()
    // Date in the past relative to mocked current date (2026-01-15)
    const pastDate = new Date('2026-01-10')
    const { container } = render(<DueDateEditor value={pastDate} onChange={onChange} />)

    // Should have destructive (red) text class
    const button = container.querySelector('button')
    expect(button).toHaveClass('text-destructive')
  })

  it('does not show overdue indicator for today', () => {
    const onChange = vi.fn()
    // Same as mocked current date
    const todayDate = new Date('2026-01-15')
    const { container } = render(<DueDateEditor value={todayDate} onChange={onChange} />)

    // Should not have destructive class
    const button = container.querySelector('button')
    expect(button).not.toHaveClass('text-destructive')
  })

  it('does not show overdue indicator for future dates', () => {
    const onChange = vi.fn()
    const futureDate = new Date('2026-02-01')
    const { container } = render(<DueDateEditor value={futureDate} onChange={onChange} />)

    // Should not have destructive class
    const button = container.querySelector('button')
    expect(button).not.toHaveClass('text-destructive')
  })

  it('opens calendar popover on click', async () => {
    vi.useRealTimers() // Use real timers for user interaction
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DueDateEditor value={null} onChange={onChange} />)

    // Click the trigger button
    const trigger = screen.getByRole('button')
    await user.click(trigger)

    // Calendar should be visible (check for calendar grid)
    await waitFor(() => {
      expect(screen.getByRole('grid')).toBeInTheDocument()
    })
  })

  it('calls onChange with null when clearing date', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    const onChange = vi.fn().mockResolvedValue(undefined)
    const testDate = new Date('2026-02-20')
    render(<DueDateEditor value={testDate} onChange={onChange} />)

    // Click the clear button (span with role="button")
    const clearButton = screen.getByRole('button', { name: 'Rensa deadline' })
    await user.click(clearButton)

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(null)
    })
  })

  it('shows loading state during save', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    let resolvePromise: () => void
    const onChange = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePromise = resolve
      })
    )
    const testDate = new Date('2026-02-20')
    render(<DueDateEditor value={testDate} onChange={onChange} />)

    // Click clear button (span with role="button") to trigger save
    const clearButton = screen.getByRole('button', { name: 'Rensa deadline' })
    await user.click(clearButton)

    // Should show loading spinner - the main trigger button should be disabled
    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      // The popover trigger button should be disabled during loading
      expect(buttons.some((b) => b.hasAttribute('disabled'))).toBe(true)
    })

    // Resolve the promise
    resolvePromise!()

    // Should return to normal state
    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      expect(buttons.every((b) => !b.hasAttribute('disabled'))).toBe(true)
    })
  })
})
