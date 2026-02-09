/**
 * Story 3.13: Tests for LeftSidebar component - Rättskällor accordion
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import { LeftSidebar } from '@/components/layout/left-sidebar'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Mock layout store
vi.mock('@/lib/stores/layout-store', () => ({
  useLayoutStore: () => ({
    toggleRightSidebar: vi.fn(),
  }),
}))

// Mock permissions hook
vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    can: { viewEmployees: false },
    isLoading: false,
  }),
}))

// Mock child components to isolate sidebar tests
vi.mock('@/components/layout/workspace-switcher', () => ({
  WorkspaceSwitcher: () => (
    <div data-testid="workspace-switcher">Workspace</div>
  ),
}))

vi.mock('@/components/layout/trial-status-widget', () => ({
  TrialStatusWidget: () => <div data-testid="trial-status">Trial</div>,
}))

describe('LeftSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rättskällor accordion', () => {
    it('renders Rättskällor as accordion item', () => {
      render(<LeftSidebar />)

      expect(screen.getByText('Rättskällor')).toBeInTheDocument()
    })

    it('shows Rättskällor subItems when accordion is expanded', async () => {
      const user = userEvent.setup()
      render(<LeftSidebar />)

      // Click to expand Rättskällor accordion
      const rattskallor = screen.getByText('Rättskällor')
      await user.click(rattskallor)

      // Check all sub-items are visible
      expect(screen.getByText('Bläddra alla')).toBeInTheDocument()
      expect(screen.getByText('Svenska lagar')).toBeInTheDocument()
      expect(screen.getByText('Rättsfall')).toBeInTheDocument()
      expect(screen.getByText('EU-rätt')).toBeInTheDocument()
    })

    it('has correct hrefs for Rättskällor subItems', async () => {
      const user = userEvent.setup()
      render(<LeftSidebar />)

      // Expand accordion
      await user.click(screen.getByText('Rättskällor'))

      // Check links
      expect(screen.getByText('Bläddra alla').closest('a')).toHaveAttribute(
        'href',
        '/browse/rattskallor'
      )
      expect(screen.getByText('Svenska lagar').closest('a')).toHaveAttribute(
        'href',
        '/browse/lagar'
      )
      expect(screen.getByText('Rättsfall').closest('a')).toHaveAttribute(
        'href',
        '/browse/rattsfall'
      )
      expect(screen.getByText('EU-rätt').closest('a')).toHaveAttribute(
        'href',
        '/browse/eu'
      )
    })

    it('hides subItems when accordion is collapsed', async () => {
      const user = userEvent.setup()
      render(<LeftSidebar />)

      // Expand accordion
      await user.click(screen.getByText('Rättskällor'))
      expect(screen.getByText('Bläddra alla')).toBeInTheDocument()

      // Collapse accordion
      await user.click(screen.getByText('Rättskällor'))
      expect(screen.queryByText('Bläddra alla')).not.toBeInTheDocument()
    })
  })

  describe('Laglistor accordion', () => {
    it('renders Laglistor with Mina laglistor and Mallar subItems', async () => {
      const user = userEvent.setup()
      render(<LeftSidebar />)

      // Expand Laglistor accordion
      await user.click(screen.getByText('Laglistor'))

      // Should have both sub-items
      expect(screen.getByText('Mina laglistor')).toBeInTheDocument()
      expect(screen.getByText('Mallar')).toBeInTheDocument()
    })

    it('has correct href for Mina laglistor', async () => {
      const user = userEvent.setup()
      render(<LeftSidebar />)

      await user.click(screen.getByText('Laglistor'))

      expect(screen.getByText('Mina laglistor').closest('a')).toHaveAttribute(
        'href',
        '/laglistor'
      )
    })
  })

  describe('accordion expand/collapse behavior', () => {
    it('toggles chevron rotation when accordion expands', async () => {
      const user = userEvent.setup()
      render(<LeftSidebar />)

      const rattskallor = screen.getByText('Rättskällor')
      const chevron = rattskallor.parentElement?.querySelector('svg:last-child')

      // Initially not rotated
      expect(chevron).not.toHaveClass('rotate-90')

      // Click to expand
      await user.click(rattskallor)

      // Should be rotated
      expect(chevron).toHaveClass('rotate-90')
    })

    it('allows multiple accordions to be open simultaneously', async () => {
      const user = userEvent.setup()
      render(<LeftSidebar />)

      // Expand both accordions
      await user.click(screen.getByText('Laglistor'))
      await user.click(screen.getByText('Rättskällor'))

      // Both should be open
      expect(screen.getByText('Mina laglistor')).toBeInTheDocument()
      expect(screen.getByText('Bläddra alla')).toBeInTheDocument()
    })
  })

  describe('navigation items', () => {
    it('renders Dashboard link', () => {
      render(<LeftSidebar />)

      const dashboardLink = screen.getByText('Dashboard').closest('a')
      expect(dashboardLink).toHaveAttribute('href', '/dashboard')
    })

    it('renders Settings link', () => {
      render(<LeftSidebar />)

      const settingsLink = screen.getByText('Inställningar').closest('a')
      expect(settingsLink).toHaveAttribute('href', '/settings')
    })

    it('renders AI Chat as toggle button', () => {
      render(<LeftSidebar />)

      const aiChatButton = screen.getByText('AI Chat')
      expect(aiChatButton.closest('button')).toBeInTheDocument()
    })
  })
})
