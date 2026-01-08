/**
 * Story 6.1: Tests for RecentActivityFeed component
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RecentActivityFeed } from '@/components/features/dashboard/RecentActivityFeed'

describe('RecentActivityFeed', () => {
  beforeEach(() => {
    // Mock the current date for consistent timestamp testing
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-08T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('with activity data', () => {
    const mockActivities = [
      {
        id: '1',
        user: { name: 'Anna Andersson', avatar_url: null },
        action: 'status_changed',
        entity_type: 'list_item',
        created_at: new Date('2026-01-08T10:00:00Z'), // 2 hours ago
      },
      {
        id: '2',
        user: {
          name: 'Erik Eriksson',
          avatar_url: 'https://example.com/avatar.jpg',
        },
        action: 'created',
        entity_type: 'task',
        created_at: new Date('2026-01-07T12:00:00Z'), // 1 day ago
      },
    ]

    it('displays activity items', () => {
      render(<RecentActivityFeed activities={mockActivities} />)

      expect(screen.getByText('Anna Andersson')).toBeInTheDocument()
      expect(screen.getByText('Erik Eriksson')).toBeInTheDocument()
    })

    it('formats action text correctly for status_changed', () => {
      render(<RecentActivityFeed activities={mockActivities} />)

      expect(screen.getByText('ändrade status')).toBeInTheDocument()
    })

    it('formats action text correctly for created task', () => {
      render(<RecentActivityFeed activities={mockActivities} />)

      expect(screen.getByText('skapade en uppgift')).toBeInTheDocument()
    })

    it('displays relative timestamps', () => {
      render(<RecentActivityFeed activities={mockActivities} />)

      // date-fns Swedish locale outputs "ungefär två timmar sedan" or "en dag sedan"
      const timestamps = screen.getAllByText(/sedan/)
      expect(timestamps.length).toBeGreaterThan(0)
    })

    it('renders user initials as fallback when no avatar', () => {
      render(<RecentActivityFeed activities={mockActivities} />)

      // Anna Andersson should show "AA"
      expect(screen.getByText('AA')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows empty state when activities array is empty', () => {
      render(<RecentActivityFeed activities={[]} />)

      expect(screen.getByText('Ingen aktivitet ännu')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Aktiviteter visas här när du och ditt team arbetar med efterlevnad'
        )
      ).toBeInTheDocument()
    })
  })

  describe('placeholder state', () => {
    it('shows placeholder when activities is null', () => {
      render(<RecentActivityFeed activities={null} />)

      expect(screen.getByText('Kommer snart')).toBeInTheDocument()
    })
  })

  describe('card header', () => {
    it('displays the correct title', () => {
      render(<RecentActivityFeed activities={[]} />)

      expect(screen.getByText('Senaste aktivitet')).toBeInTheDocument()
    })
  })
})
