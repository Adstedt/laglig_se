/**
 * Story 6.2: TaskProgressCell Component Tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  TaskProgressCell,
  TaskProgressCellSkeleton,
} from '@/components/features/document-list/table-cells/task-progress-cell'

describe('TaskProgressCell', () => {
  it('renders progress when data is available', () => {
    render(<TaskProgressCell completed={3} total={5} />)

    expect(screen.getByText('3/5 klara')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows "Inga uppgifter" when total is 0', () => {
    render(<TaskProgressCell completed={0} total={0} />)

    expect(screen.getByText('Inga uppgifter')).toBeInTheDocument()
  })

  it('shows dash when data is null (unavailable)', () => {
    render(<TaskProgressCell completed={null} total={null} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows skeleton when loading', () => {
    const { container } = render(
      <TaskProgressCell completed={null} total={null} isLoading />
    )

    // Should show skeleton elements
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows green color when 100% complete', () => {
    render(<TaskProgressCell completed={5} total={5} />)

    const text = screen.getByText('5/5 klara')
    expect(text).toHaveClass('text-green-600')
  })

  it('shows muted color when not 100% complete', () => {
    render(<TaskProgressCell completed={3} total={5} />)

    const text = screen.getByText('3/5 klara')
    expect(text).toHaveClass('text-muted-foreground')
  })

  it('calculates correct progress bar width', () => {
    const { container } = render(<TaskProgressCell completed={2} total={4} />)

    const progressBar = container.querySelector('[role="progressbar"]')
    expect(progressBar).toHaveAttribute('aria-valuenow', '50')
    expect(progressBar).toHaveAttribute('aria-valuemin', '0')
    expect(progressBar).toHaveAttribute('aria-valuemax', '100')
  })

  it('has accessible label for progress bar', () => {
    render(<TaskProgressCell completed={3} total={5} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-label', '3 av 5 uppgifter klara')
  })
})

describe('TaskProgressCellSkeleton', () => {
  it('renders skeleton elements', () => {
    const { container } = render(<TaskProgressCellSkeleton />)

    // Should have skeleton divs
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})
