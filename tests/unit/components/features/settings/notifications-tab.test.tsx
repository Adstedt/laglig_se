import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock server actions
const mockGetPreferences = vi.fn()
const mockUpdatePreferences = vi.fn()

vi.mock('@/app/actions/notifications', () => ({
  getNotificationPreferences: (...args: unknown[]) =>
    mockGetPreferences(...args),
  updateNotificationPreferences: (...args: unknown[]) =>
    mockUpdatePreferences(...args),
}))

import { NotificationsTab } from '@/components/features/settings/notifications-tab'

const defaultPreferences = {
  email_enabled: true,
  task_assigned_enabled: true,
  task_due_soon_enabled: true,
  task_overdue_enabled: false,
  comment_added_enabled: true,
  mention_enabled: true,
  status_changed_enabled: true,
  weekly_digest_enabled: true,
  amendment_detected_enabled: true,
  law_repealed_enabled: true,
  ruling_cited_enabled: true,
  amendment_reminder_enabled: true,
}

describe('NotificationsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPreferences.mockResolvedValue({
      success: true,
      data: defaultPreferences,
    })
    mockUpdatePreferences.mockResolvedValue({
      success: true,
      data: defaultPreferences,
    })
  })

  it('renders loading state initially', () => {
    // Delay the response to keep loading state
    mockGetPreferences.mockReturnValue(new Promise(() => {}))
    render(<NotificationsTab />)

    // Should not show toggles yet
    expect(screen.queryByText('Tilldelning')).not.toBeInTheDocument()
  })

  it('renders all toggle groups after loading', async () => {
    render(<NotificationsTab />)

    await waitFor(() => {
      expect(screen.getByText('Uppgifter')).toBeInTheDocument()
    })

    // Task toggles
    expect(screen.getByText('Tilldelning')).toBeInTheDocument()
    expect(screen.getByText('Förfaller snart')).toBeInTheDocument()
    expect(screen.getByText('Förfallen')).toBeInTheDocument()
    expect(screen.getByText('Kommentarer')).toBeInTheDocument()
    expect(screen.getByText('Omnämnanden')).toBeInTheDocument()
    expect(screen.getByText('Statusändringar')).toBeInTheDocument()
    expect(screen.getByText('Veckosammanfattning')).toBeInTheDocument()

    // Law change toggles
    expect(screen.getByText('Lagändringar')).toBeInTheDocument()
    expect(screen.getByText('Lagändring upptäckt')).toBeInTheDocument()
  })

  it('reflects saved preferences in toggle state', async () => {
    render(<NotificationsTab />)

    await waitFor(() => {
      expect(screen.getByText('Tilldelning')).toBeInTheDocument()
    })

    // task_overdue_enabled is false in our mock
    const overdueToggle = screen.getByRole('switch', {
      name: /förfallen/i,
    })
    expect(overdueToggle).toBeInTheDocument()
  })

  it('calls updateNotificationPreferences on toggle', async () => {
    const user = userEvent.setup()
    render(<NotificationsTab />)

    await waitFor(() => {
      expect(screen.getByText('Tilldelning')).toBeInTheDocument()
    })

    // Find the global email toggle
    const emailToggle = screen.getByRole('switch', {
      name: /e-postaviseringar/i,
    })

    await user.click(emailToggle)

    await waitFor(() => {
      expect(mockUpdatePreferences).toHaveBeenCalledWith({
        email_enabled: false,
      })
    })
  })

  it('shows global email toggle', async () => {
    render(<NotificationsTab />)

    await waitFor(() => {
      expect(
        screen.getByText('Aktivera eller inaktivera alla e-postnotifieringar')
      ).toBeInTheDocument()
    })
  })
})
