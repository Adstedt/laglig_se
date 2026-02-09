/**
 * Story 3.13: Tests for MobileSidebar component - Rättskällor accordion
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'

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

// Mock useWorkspace hook
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    workspaceId: 'ws_1',
    workspaceName: 'Test Workspace',
    workspaceSlug: 'test-workspace',
    workspaceStatus: 'ACTIVE',
    role: 'OWNER',
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

// Mock fetch for workspace switcher
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ workspaces: [] }),
})

describe('MobileSidebar', () => {
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rättskällor accordion', () => {
    it('renders Rättskällor as accordion item', () => {
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByText('Rättskällor')).toBeInTheDocument()
    })

    it('shows Rättskällor subItems when accordion is expanded', async () => {
      const user = userEvent.setup()
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

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
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

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

    it('closes sidebar when subItem link is clicked', async () => {
      const user = userEvent.setup()
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      // Expand accordion and click a link
      await user.click(screen.getByText('Rättskällor'))
      await user.click(screen.getByText('Svenska lagar'))

      // Should call onOpenChange(false) to close sidebar
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('Laglistor accordion', () => {
    it('renders Laglistor with Mina laglistor and Mallar subItems', async () => {
      const user = userEvent.setup()
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      // Expand Laglistor accordion
      await user.click(screen.getByText('Laglistor'))

      // Should have both sub-items
      expect(screen.getByText('Mina laglistor')).toBeInTheDocument()
      expect(screen.getByText('Mallar')).toBeInTheDocument()
    })
  })

  describe('touch-friendly accordion behavior', () => {
    it('uses larger touch targets for mobile (py-2.5 class)', () => {
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      const rattskallor = screen.getByText('Rättskällor').closest('button')
      expect(rattskallor).toHaveClass('py-2.5')
    })

    it('uses larger icons for mobile (h-5 w-5)', () => {
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      const rattskallor = screen.getByText('Rättskällor').closest('button')
      const icon = rattskallor?.querySelector('svg')
      expect(icon).toHaveClass('h-5', 'w-5')
    })
  })

  describe('sheet behavior', () => {
    it('renders content when open is true', () => {
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByText('Laglig.se')).toBeInTheDocument()
      expect(screen.getByText('Plattform')).toBeInTheDocument()
    })
  })
})
