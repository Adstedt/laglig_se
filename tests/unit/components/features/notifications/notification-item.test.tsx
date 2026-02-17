import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  NotificationItem,
  type NotificationItemData,
} from '@/components/features/notifications/notification-item'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

function makeNotification(
  overrides: Partial<NotificationItemData> = {}
): NotificationItemData {
  return {
    id: 'n-1',
    type: 'AMENDMENT_DETECTED',
    title: 'Arbetsmiljölagen uppdaterad',
    body: 'SFS 2026:145 har publicerats',
    entity_type: 'change_event',
    entity_id: 'ce-1',
    created_at: new Date('2026-02-17T10:00:00Z').toISOString(),
    link_url: '/dokument/sfs-1977-1160',
    ...overrides,
  }
}

describe('NotificationItem', () => {
  const mockOnMarkRead = vi.fn().mockResolvedValue(undefined)
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title and body', () => {
    render(
      <NotificationItem
        notification={makeNotification()}
        onMarkRead={mockOnMarkRead}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Arbetsmiljölagen uppdaterad')).toBeInTheDocument()
    expect(screen.getByText('SFS 2026:145 har publicerats')).toBeInTheDocument()
  })

  it('truncates title longer than 50 chars', () => {
    const longTitle =
      'En väldigt lång titel för en svensk lagändring som överstiger femtio tecken'
    render(
      <NotificationItem
        notification={makeNotification({ title: longTitle })}
        onMarkRead={mockOnMarkRead}
        onClose={mockOnClose}
      />
    )

    const titleEl = screen.getByTitle(longTitle)
    expect(titleEl.textContent).toHaveLength(51) // 50 chars + ellipsis
    expect(titleEl.textContent).toContain('…')
  })

  it('shows full title attribute on hover', () => {
    const longTitle =
      'En väldigt lång titel för en svensk lagändring som överstiger femtio tecken'
    render(
      <NotificationItem
        notification={makeNotification({ title: longTitle })}
        onMarkRead={mockOnMarkRead}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByTitle(longTitle)).toBeInTheDocument()
  })

  it('shows relative time in Swedish', () => {
    render(
      <NotificationItem
        notification={makeNotification()}
        onMarkRead={mockOnMarkRead}
        onClose={mockOnClose}
      />
    )

    // The relative time will be something like "X dagar sedan" or similar
    // We just check that some text is present in the time area
    const timeElements = screen.getAllByText(/sedan|sekund|minut|timm/i)
    expect(timeElements.length).toBeGreaterThan(0)
  })

  it('calls onMarkRead and navigates on click', async () => {
    const user = userEvent.setup()

    render(
      <NotificationItem
        notification={makeNotification()}
        onMarkRead={mockOnMarkRead}
        onClose={mockOnClose}
      />
    )

    await user.click(screen.getByRole('button'))

    expect(mockOnMarkRead).toHaveBeenCalledWith('n-1')
    expect(mockOnClose).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/dokument/sfs-1977-1160')
  })

  it('does not navigate when link_url is null', async () => {
    const user = userEvent.setup()

    render(
      <NotificationItem
        notification={makeNotification({ link_url: null })}
        onMarkRead={mockOnMarkRead}
        onClose={mockOnClose}
      />
    )

    await user.click(screen.getByRole('button'))

    expect(mockOnMarkRead).toHaveBeenCalledWith('n-1')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('renders correct icon for each notification type', () => {
    const { rerender } = render(
      <NotificationItem
        notification={makeNotification({ type: 'AMENDMENT_DETECTED' })}
        onMarkRead={mockOnMarkRead}
        onClose={mockOnClose}
      />
    )
    // FileEdit icon should be present (SVG)
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument()

    rerender(
      <NotificationItem
        notification={makeNotification({ type: 'LAW_REPEALED' })}
        onMarkRead={mockOnMarkRead}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument()
  })
})
