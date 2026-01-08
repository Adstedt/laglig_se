/**
 * Story 6.1: Tests for TaskSummaryCards component
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TaskSummaryCards } from '@/components/features/dashboard/TaskSummaryCards'

describe('TaskSummaryCards', () => {
  describe('with task data', () => {
    const mockCounts = {
      overdue: 3,
      thisWeek: 8,
      myTasks: 5,
    }

    it('displays overdue tasks count', () => {
      render(<TaskSummaryCards counts={mockCounts} />)

      expect(screen.getByText('Förfallna uppgifter')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('displays this week tasks count', () => {
      render(<TaskSummaryCards counts={mockCounts} />)

      expect(screen.getByText('Uppgifter denna vecka')).toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument()
    })

    it('displays my tasks count', () => {
      render(<TaskSummaryCards counts={mockCounts} />)

      expect(screen.getByText('Mina tilldelade uppgifter')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('displays zero counts correctly', () => {
      const zeroCounts = { overdue: 0, thisWeek: 0, myTasks: 0 }
      render(<TaskSummaryCards counts={zeroCounts} />)

      // All three cards should show 0
      const zeros = screen.getAllByText('0')
      expect(zeros.length).toBe(3)
    })

    it('shows appropriate description for overdue tasks', () => {
      render(<TaskSummaryCards counts={mockCounts} />)

      expect(screen.getByText('Kräver uppmärksamhet')).toBeInTheDocument()
    })

    it('shows appropriate description when no overdue tasks', () => {
      const noOverdue = { ...mockCounts, overdue: 0 }
      render(<TaskSummaryCards counts={noOverdue} />)

      expect(screen.getByText('Inga förfallna')).toBeInTheDocument()
    })

    it('renders links to kanban with filters', () => {
      render(<TaskSummaryCards counts={mockCounts} />)

      const links = screen.getAllByRole('link')
      expect(links.length).toBe(3)

      expect(links[0]).toHaveAttribute('href', '/kanban?filter=overdue')
      expect(links[1]).toHaveAttribute('href', '/kanban?filter=this-week')
      expect(links[2]).toHaveAttribute('href', '/kanban?filter=my-tasks')
    })
  })

  describe('placeholder state', () => {
    it('shows placeholder when counts is null', () => {
      render(<TaskSummaryCards counts={null} />)

      // Should show 3 placeholder cards
      const comingSoon = screen.getAllByText('Kommer snart')
      expect(comingSoon.length).toBe(3)
    })

    it('shows Uppgifter label in placeholder cards', () => {
      render(<TaskSummaryCards counts={null} />)

      const labels = screen.getAllByText('Uppgifter')
      expect(labels.length).toBe(3)
    })
  })
})
