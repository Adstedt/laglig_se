/**
 * Story 6.2: LastActivityCell Component Tests
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  LastActivityCell,
  LastActivityCellSkeleton,
} from '@/components/features/document-list/table-cells/last-activity-cell'
import { TooltipProvider } from '@/components/ui/tooltip'

// Wrapper component for tooltip
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}

describe('LastActivityCell', () => {
  // Mock the current date for consistent tests
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('renders relative time for recent activity', () => {
    const activity = {
      action: 'update',
      timestamp: new Date('2024-06-15T10:00:00Z'), // 2 hours ago
      userName: 'Test User',
    }

    render(
      <TestWrapper>
        <LastActivityCell activity={activity} />
      </TestWrapper>
    )

    // Should show relative time (approximately 2 hours ago in Swedish)
    expect(screen.getByText(/timm/i)).toBeInTheDocument()
  })

  it('shows dash when activity is null', () => {
    render(
      <TestWrapper>
        <LastActivityCell activity={null} />
      </TestWrapper>
    )

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows skeleton when loading', () => {
    const { container } = render(
      <TestWrapper>
        <LastActivityCell activity={null} isLoading />
      </TestWrapper>
    )

    // Should show skeleton element
    const skeleton = container.querySelector('[class*="animate-pulse"]')
    expect(skeleton).toBeInTheDocument()
  })

  it('renders activity without user name', () => {
    const activity = {
      action: 'create',
      timestamp: new Date('2024-06-15T11:00:00Z'),
      userName: null,
    }

    render(
      <TestWrapper>
        <LastActivityCell activity={activity} />
      </TestWrapper>
    )

    // Should still show the time
    expect(screen.getByText(/timm/i)).toBeInTheDocument()
  })
})

describe('LastActivityCellSkeleton', () => {
  it('renders skeleton element', () => {
    const { container } = render(<LastActivityCellSkeleton />)

    const skeleton = container.querySelector('[class*="animate-pulse"]')
    expect(skeleton).toBeInTheDocument()
  })
})
