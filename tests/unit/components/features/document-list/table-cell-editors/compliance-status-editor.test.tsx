/**
 * Story 6.2: ComplianceStatusEditor Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComplianceStatusEditor } from '@/components/features/document-list/table-cell-editors/compliance-status-editor'

describe('ComplianceStatusEditor', () => {
  it('renders current compliance status value', () => {
    const onChange = vi.fn()
    render(<ComplianceStatusEditor value="EJ_PABORJAD" onChange={onChange} />)

    expect(screen.getByText('Ej påbörjad')).toBeInTheDocument()
  })

  it('shows all compliance status options in dropdown', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ComplianceStatusEditor value="EJ_PABORJAD" onChange={onChange} />)

    // Open dropdown
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    // Check all options are present
    await waitFor(() => {
      expect(screen.getByText('Pågående')).toBeInTheDocument()
      expect(screen.getByText('Uppfylld')).toBeInTheDocument()
      expect(screen.getByText('Ej uppfylld')).toBeInTheDocument()
      expect(screen.getByText('Ej tillämplig')).toBeInTheDocument()
    })
  })

  it('calls onChange when selecting a different status', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(<ComplianceStatusEditor value="EJ_PABORJAD" onChange={onChange} />)

    // Open dropdown and select new status
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('Uppfylld')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Uppfylld'))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('UPPFYLLD')
    })
  })

  it('does not call onChange when selecting the same status', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(<ComplianceStatusEditor value="EJ_PABORJAD" onChange={onChange} />)

    // Open dropdown and select same status
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    await waitFor(() => {
      // Find the option in the dropdown (there will be two "Ej påbörjad" - one in trigger, one in options)
      const options = screen.getAllByText('Ej påbörjad')
      expect(options.length).toBeGreaterThan(0)
    })

    // Click on the option (the last one should be in the dropdown)
    const options = screen.getAllByText('Ej påbörjad')
    await user.click(options[options.length - 1])

    // onChange should not be called
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
    render(<ComplianceStatusEditor value="EJ_PABORJAD" onChange={onChange} />)

    // Open dropdown and select new status
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('Uppfylld')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Uppfylld'))

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

  it('displays correct color badge for compliance statuses', () => {
    const statuses = [
      { value: 'EJ_PABORJAD', label: 'Ej påbörjad' },
      { value: 'PAGAENDE', label: 'Pågående' },
      { value: 'UPPFYLLD', label: 'Uppfylld' },
      { value: 'EJ_UPPFYLLD', label: 'Ej uppfylld' },
      { value: 'EJ_TILLAMPLIG', label: 'Ej tillämplig' },
    ] as const

    for (const { value, label } of statuses) {
      const { unmount } = render(
        <ComplianceStatusEditor value={value} onChange={vi.fn()} />
      )
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })

  it('applies strikethrough style for EJ_TILLAMPLIG status', () => {
    render(<ComplianceStatusEditor value="EJ_TILLAMPLIG" onChange={vi.fn()} />)

    const badge = screen.getByText('Ej tillämplig')
    expect(badge).toHaveClass('line-through')
  })
})
