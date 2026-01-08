/**
 * Story 6.1: Tests for ListOverview component
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ListOverview } from '@/components/features/dashboard/ListOverview'

describe('ListOverview', () => {
  describe('with list data', () => {
    const mockLists = [
      { id: '1', name: 'Arbetsmiljö', compliantCount: 30, totalCount: 45 },
      { id: '2', name: 'GDPR', compliantCount: 18, totalCount: 20 },
      { id: '3', name: 'Miljö', compliantCount: 0, totalCount: 10 },
    ]

    it('displays list names', () => {
      render(<ListOverview lists={mockLists} />)

      expect(screen.getByText('Arbetsmiljö')).toBeInTheDocument()
      expect(screen.getByText('GDPR')).toBeInTheDocument()
      expect(screen.getByText('Miljö')).toBeInTheDocument()
    })

    it('calculates and displays correct percentages', () => {
      render(<ListOverview lists={mockLists} />)

      // Arbetsmiljö: 30/45 = 67%
      expect(screen.getByText('67%')).toBeInTheDocument()
      // GDPR: 18/20 = 90%
      expect(screen.getByText('90%')).toBeInTheDocument()
      // Miljö: 0/10 = 0%
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('renders links to individual lists', () => {
      render(<ListOverview lists={mockLists} />)

      const links = screen.getAllByRole('link')
      // 3 list links + 1 "Visa alla" link = 4 total
      expect(links.length).toBe(4)

      expect(links[0]).toHaveAttribute('href', '/lists')
      expect(links[1]).toHaveAttribute('href', '/lists/1')
      expect(links[2]).toHaveAttribute('href', '/lists/2')
      expect(links[3]).toHaveAttribute('href', '/lists/3')
    })

    it('shows "Visa alla" button', () => {
      render(<ListOverview lists={mockLists} />)

      const viewAllButton = screen.getByRole('link', { name: 'Visa alla' })
      expect(viewAllButton).toHaveAttribute('href', '/lists')
    })
  })

  describe('empty state', () => {
    it('shows empty state when lists array is empty', () => {
      render(<ListOverview lists={[]} />)

      expect(screen.getByText('Inga listor att visa')).toBeInTheDocument()
      expect(
        screen.getByText('Dina senaste listor visas här')
      ).toBeInTheDocument()
    })

    it('shows explore lists button in empty state', () => {
      render(<ListOverview lists={[]} />)

      const button = screen.getByRole('link', { name: 'Utforska listor' })
      expect(button).toHaveAttribute('href', '/lists')
    })
  })

  describe('edge cases', () => {
    it('handles list with 0 total items', () => {
      const listsWithZero = [
        { id: '1', name: 'Tom lista', compliantCount: 0, totalCount: 0 },
      ]
      render(<ListOverview lists={listsWithZero} />)

      expect(screen.getByText('Tom lista')).toBeInTheDocument()
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('handles 100% compliance', () => {
      const fullCompliance = [
        { id: '1', name: 'Perfekt', compliantCount: 50, totalCount: 50 },
      ]
      render(<ListOverview lists={fullCompliance} />)

      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('truncates long list names', () => {
      const longNameList = [
        {
          id: '1',
          name: 'Detta är ett väldigt långt namn på en lista som borde trunkeras',
          compliantCount: 5,
          totalCount: 10,
        },
      ]
      const { container } = render(<ListOverview lists={longNameList} />)

      // The span should have truncate class
      const nameElement = container.querySelector('.truncate')
      expect(nameElement).toBeInTheDocument()
    })
  })

  describe('card header', () => {
    it('displays the correct title', () => {
      render(<ListOverview lists={[]} />)

      expect(screen.getByText('Mina listor')).toBeInTheDocument()
    })
  })
})
