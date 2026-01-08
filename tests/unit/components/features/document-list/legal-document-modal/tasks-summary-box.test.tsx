/**
 * Story 6.3: Tasks Summary Box Unit Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TasksSummaryBox } from '@/components/features/document-list/legal-document-modal/tasks-summary-box'
import type { TaskProgress } from '@/app/actions/legal-document-modal'

describe('TasksSummaryBox', () => {
  const defaultProps = {
    taskProgress: null as TaskProgress | null,
    listItemId: 'test-item-123',
    onTasksUpdate: vi.fn(),
  }

  it('renders empty state when taskProgress is null', () => {
    render(<TasksSummaryBox {...defaultProps} />)

    expect(screen.getByText('Uppgifter')).toBeInTheDocument()
    expect(screen.getByText('Inga uppgifter')).toBeInTheDocument()
  })

  it('renders empty state when taskProgress has zero tasks', () => {
    render(
      <TasksSummaryBox
        {...defaultProps}
        taskProgress={{
          completed: 0,
          total: 0,
          tasks: [],
        }}
      />
    )

    expect(screen.getByText('Inga uppgifter')).toBeInTheDocument()
  })

  it('displays task progress count', () => {
    render(
      <TasksSummaryBox
        {...defaultProps}
        taskProgress={{
          completed: 3,
          total: 5,
          tasks: [],
        }}
      />
    )

    expect(screen.getByText('3/5 klara')).toBeInTheDocument()
  })

  it('renders task list with titles', () => {
    render(
      <TasksSummaryBox
        {...defaultProps}
        taskProgress={{
          completed: 1,
          total: 3,
          tasks: [
            {
              id: '1',
              title: 'Review policy',
              columnName: 'To Do',
              columnColor: '#3b82f6',
              isDone: false,
              assignee: null,
            },
            {
              id: '2',
              title: 'Update documentation',
              columnName: 'Done',
              columnColor: '#22c55e',
              isDone: true,
              assignee: null,
            },
            {
              id: '3',
              title: 'Train employees',
              columnName: 'In Progress',
              columnColor: '#eab308',
              isDone: false,
              assignee: null,
            },
          ],
        }}
      />
    )

    expect(screen.getByText('Review policy')).toBeInTheDocument()
    expect(screen.getByText('Update documentation')).toBeInTheDocument()
    expect(screen.getByText('Train employees')).toBeInTheDocument()
  })

  it('shows strikethrough for completed tasks', () => {
    render(
      <TasksSummaryBox
        {...defaultProps}
        taskProgress={{
          completed: 1,
          total: 1,
          tasks: [
            {
              id: '1',
              title: 'Completed task',
              columnName: 'Done',
              columnColor: '#22c55e',
              isDone: true,
              assignee: null,
            },
          ],
        }}
      />
    )

    const taskTitle = screen.getByText('Completed task')
    expect(taskTitle).toHaveClass('line-through')
  })

  it('shows create task button when there are tasks', () => {
    render(
      <TasksSummaryBox
        {...defaultProps}
        taskProgress={{
          completed: 1,
          total: 2,
          tasks: [
            {
              id: '1',
              title: 'Test task',
              columnName: 'To Do',
              columnColor: null,
              isDone: false,
              assignee: null,
            },
          ],
        }}
      />
    )

    expect(
      screen.getByRole('button', { name: /skapa uppgift/i })
    ).toBeInTheDocument()
  })

  it('calculates progress percentage correctly', () => {
    const { container } = render(
      <TasksSummaryBox
        {...defaultProps}
        taskProgress={{
          completed: 2,
          total: 4,
          tasks: [],
        }}
      />
    )

    // Progress bar should be at 50%
    const progressBar = container.querySelector('.bg-primary')
    expect(progressBar).toHaveStyle({ width: '50%' })
  })
})
