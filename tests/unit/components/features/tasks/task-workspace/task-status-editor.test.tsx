/**
 * Story 6.19: Unit Tests for TaskStatusEditor
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskStatusEditor } from '@/components/features/tasks/task-workspace/task-status-editor'

const mockColumns = [
  { id: 'col-1', name: 'Att göra', color: '#6b7280' },
  { id: 'col-2', name: 'Pågående', color: '#3b82f6' },
  { id: 'col-3', name: 'Klar', color: '#22c55e' },
]

describe('TaskStatusEditor', () => {
  it('should render current status', () => {
    render(
      <TaskStatusEditor
        value="col-1"
        columns={mockColumns}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('Att göra')).toBeInTheDocument()
  })

  it('should render as a select trigger', () => {
    render(
      <TaskStatusEditor
        value="col-2"
        columns={mockColumns}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('Pågående')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('should show all column options when opened', async () => {
    const user = userEvent.setup()

    render(
      <TaskStatusEditor
        value="col-1"
        columns={mockColumns}
        onChange={vi.fn()}
      />
    )

    await user.click(screen.getByRole('combobox'))

    // All options should be visible
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
  })

  it('should call onChange with new column id when selected', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <TaskStatusEditor
        value="col-1"
        columns={mockColumns}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('combobox'))

    // Find and click "Pågående" option
    const options = screen.getAllByRole('option')
    const pagaendeOption = options.find((opt) =>
      opt.textContent?.includes('Pågående')
    )
    if (pagaendeOption) {
      await user.click(pagaendeOption)
    }

    expect(onChange).toHaveBeenCalledWith('col-2')
  })

  it('should not call onChange when same value selected', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <TaskStatusEditor
        value="col-1"
        columns={mockColumns}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('combobox'))

    // Click the already-selected option
    const options = screen.getAllByRole('option')
    const attGoraOption = options.find((opt) =>
      opt.textContent?.includes('Att göra')
    )
    if (attGoraOption) {
      await user.click(attGoraOption)
    }

    expect(onChange).not.toHaveBeenCalled()
  })
})
