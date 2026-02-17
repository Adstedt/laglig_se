import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationBell } from '@/components/features/notifications/notification-bell'

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

// Mock useWorkspace
vi.mock('@/lib/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    workspaceId: 'ws-1',
    workspaceName: 'Test Workspace',
    workspaceSlug: 'test',
    workspaceStatus: 'ACTIVE',
    role: 'MEMBER',
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

// Mock fetch
const mockFetch = vi.fn()

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders bell icon', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 0 }),
    })

    render(<NotificationBell userId="user-1" />)

    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows badge with unread count > 0', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 3 }),
    })

    render(<NotificationBell userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('hides badge when count = 0', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 0 }),
    })

    render(<NotificationBell userId="user-1" />)

    await waitFor(() => {
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })
  })

  it('shows 99+ for counts over 99', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 150 }),
    })

    render(<NotificationBell userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('99+')).toBeInTheDocument()
    })
  })

  it('has correct aria-label with unread count', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 5 }),
    })

    render(<NotificationBell userId="user-1" />)

    await waitFor(() => {
      expect(
        screen.getByLabelText('5 olästa notifieringar')
      ).toBeInTheDocument()
    })
  })

  it('has correct aria-label with no unread notifications', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 0 }),
    })

    render(<NotificationBell userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByLabelText('Notifieringar')).toBeInTheDocument()
    })
  })

  it('opens popover and shows notifications on click', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    // First call = unread count, subsequent = notifications list
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'n-1',
              type: 'AMENDMENT_DETECTED',
              title: 'Arbetsmiljölagen uppdaterad',
              body: 'SFS 2026:145',
              entity_type: 'change_event',
              entity_id: 'ce-1',
              created_at: new Date().toISOString(),
              link_url: '/dokument/sfs-1977-1160',
            },
          ]),
      })

    render(<NotificationBell userId="user-1" />)

    // Wait for initial count fetch
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    // Click the bell
    await user.click(screen.getByRole('button', { name: /notifieringar/i }))

    // Popover should show the notification
    await waitFor(() => {
      expect(
        screen.getByText('Arbetsmiljölagen uppdaterad')
      ).toBeInTheDocument()
    })
  })

  it('shows empty state when no notifications', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })

    render(<NotificationBell userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByLabelText('Notifieringar')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /notifieringar/i }))

    await waitFor(() => {
      expect(screen.getByText('Inga nya notifieringar')).toBeInTheDocument()
    })
  })

  it('calls mark-all-read API and clears badge', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 2 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'n-1',
              type: 'AMENDMENT_DETECTED',
              title: 'Lag 1',
              body: null,
              entity_type: null,
              entity_id: null,
              created_at: new Date().toISOString(),
              link_url: null,
            },
          ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, updated: 2 }),
      })

    render(<NotificationBell userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /notifieringar/i }))

    await waitFor(() => {
      expect(screen.getByText('Markera alla som lästa')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Markera alla som lästa'))

    await waitFor(() => {
      expect(screen.getByText('Inga nya notifieringar')).toBeInTheDocument()
    })
  })

  it('polls for updates on interval', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 0 }),
    })

    render(<NotificationBell userId="user-1" />)

    // Initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    // Advance 5 minutes
    vi.advanceTimersByTime(5 * 60 * 1000)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  it('does not fetch when userId is undefined', async () => {
    render(<NotificationBell userId={undefined} />)

    // Should not fetch at all
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
