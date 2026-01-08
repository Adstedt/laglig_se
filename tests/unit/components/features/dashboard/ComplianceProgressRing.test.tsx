/**
 * Story 6.1: Tests for ComplianceProgressRing component
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ComplianceProgressRing } from '@/components/features/dashboard/ComplianceProgressRing'

describe('ComplianceProgressRing', () => {
  describe('percentage calculation', () => {
    it('displays correct percentage for partial compliance', () => {
      render(<ComplianceProgressRing compliant={30} total={100} />)

      expect(screen.getByText('30%')).toBeInTheDocument()
      expect(screen.getByText('30 av 100 uppfyllda')).toBeInTheDocument()
    })

    it('displays 100% for full compliance', () => {
      render(<ComplianceProgressRing compliant={50} total={50} />)

      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(screen.getByText('50 av 50 uppfyllda')).toBeInTheDocument()
    })

    it('displays 0% when no items are compliant', () => {
      render(<ComplianceProgressRing compliant={0} total={100} />)

      expect(screen.getByText('0%')).toBeInTheDocument()
      expect(screen.getByText('0 av 100 uppfyllda')).toBeInTheDocument()
    })

    it('rounds percentage correctly', () => {
      render(<ComplianceProgressRing compliant={33} total={100} />)

      expect(screen.getByText('33%')).toBeInTheDocument()
    })

    it('rounds up from .5', () => {
      render(<ComplianceProgressRing compliant={1} total={3} />)

      // 1/3 = 33.33...% rounds to 33%
      expect(screen.getByText('33%')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows empty state when total is 0', () => {
      render(<ComplianceProgressRing compliant={0} total={0} />)

      expect(screen.getByText('Inga listor ännu')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Skapa din första lista för att börja spåra efterlevnad'
        )
      ).toBeInTheDocument()
    })

    it('shows create list button in empty state', () => {
      render(<ComplianceProgressRing compliant={0} total={0} />)

      const button = screen.getByRole('link', { name: 'Skapa lista' })
      expect(button).toHaveAttribute('href', '/lists')
    })
  })

  describe('SVG rendering', () => {
    it('renders SVG progress ring', () => {
      const { container } = render(
        <ComplianceProgressRing compliant={50} total={100} />
      )

      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()

      // Should have two circles - background and progress
      const circles = container.querySelectorAll('circle')
      expect(circles.length).toBe(2)
    })
  })
})
