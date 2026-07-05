/**
 * Story 3.13: Tests for MobileSidebar component - Regelverk accordion
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import type { WorkspaceRole } from '@prisma/client'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
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

  // Passing `role` as a variable (not a string literal) avoids the
  // jsx-a11y/aria-role false positive on the component's `role` prop.
  function renderSidebar(role?: WorkspaceRole) {
    return render(
      <MobileSidebar open={true} onOpenChange={mockOnOpenChange} role={role} />
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Regelverk accordion', () => {
    it('renders Regelverk as accordion item', () => {
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByText('Regelverk')).toBeInTheDocument()
    })

    it('shows Regelverk subItems when accordion is expanded', async () => {
      const user = userEvent.setup()
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      // Click to expand Regelverk accordion
      const rattskallor = screen.getByText('Regelverk')
      await user.click(rattskallor)

      // Check all sub-items are visible
      expect(screen.getByText('Bläddra alla')).toBeInTheDocument()
      expect(screen.getByText('Svenska lagar')).toBeInTheDocument()
      expect(screen.getByText('Myndighetsföreskrifter')).toBeInTheDocument()
      expect(screen.getByText('EU-rätt')).toBeInTheDocument()
    })

    it('has correct hrefs for Regelverk subItems', async () => {
      const user = userEvent.setup()
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      // Expand accordion
      await user.click(screen.getByText('Regelverk'))

      // Check links
      expect(screen.getByText('Bläddra alla').closest('a')).toHaveAttribute(
        'href',
        '/browse/rattskallor'
      )
      expect(screen.getByText('Svenska lagar').closest('a')).toHaveAttribute(
        'href',
        '/browse/rattskallor?types=SFS_LAW'
      )
      expect(
        screen.getByText('Myndighetsföreskrifter').closest('a')
      ).toHaveAttribute('href', '/browse/rattskallor?types=AGENCY_REGULATION')
      expect(screen.getByText('EU-rätt').closest('a')).toHaveAttribute(
        'href',
        '/browse/rattskallor?types=EU_REGULATION,EU_DIRECTIVE'
      )
    })

    it('closes sidebar when subItem link is clicked', async () => {
      const user = userEvent.setup()
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      // Expand accordion and click a link
      await user.click(screen.getByText('Regelverk'))
      await user.click(screen.getByText('Svenska lagar'))

      // Should call onOpenChange(false) to close sidebar
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('Efterlevnad accordion', () => {
    it('renders Efterlevnad with Laglistor, Krav, Ändringar and Mallar subItems', async () => {
      const user = userEvent.setup()
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      // Expand Efterlevnad accordion
      await user.click(screen.getByText('Efterlevnad'))

      // Mobile parity with desktop sub-items
      expect(screen.getByText('Laglistor')).toBeInTheDocument()
      expect(screen.getByText('Krav')).toBeInTheDocument()
      expect(screen.getByText('Ändringar')).toBeInTheDocument()
      expect(screen.getByText('Mallar')).toBeInTheDocument()
    })
  })

  describe('Top-level workspace items synced from desktop', () => {
    it('renders Kontroller as a top-level link', () => {
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      const kontrollerLink = screen.getByText('Kontroller').closest('a')
      expect(kontrollerLink).toHaveAttribute('href', '/laglistor/kontroller')
    })

    it('renders Styrdokument and Aktivitetslogg under Arbetsyta', () => {
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByText('Arbetsyta')).toBeInTheDocument()
      expect(screen.getByText('Styrdokument').closest('a')).toHaveAttribute(
        'href',
        '/workspace/styrdokument'
      )
      expect(screen.getByText('Aktivitetslogg').closest('a')).toHaveAttribute(
        'href',
        '/workspace/activity'
      )
    })
  })

  describe('HR nav permission gating (Story 7.2b)', () => {
    it('mutes the HR item for a role without employees:view (MEMBER)', () => {
      renderSidebar('MEMBER')

      const hr = screen.getByText('HR')
      expect(hr.closest('a')).toBeNull()
      expect(hr.closest('span.cursor-not-allowed')).not.toBeNull()
    })

    it('mutes the HR item when no role is provided', () => {
      renderSidebar()

      expect(screen.getByText('HR').closest('a')).toBeNull()
    })

    it('renders HR as an active link for OWNER', () => {
      renderSidebar('OWNER')

      expect(screen.getByText('HR').closest('a')).toHaveAttribute(
        'href',
        '/personalregister'
      )
    })

    it('renders HR as an active link for HR_MANAGER', () => {
      renderSidebar('HR_MANAGER')

      expect(screen.getByText('HR').closest('a')).toHaveAttribute(
        'href',
        '/personalregister'
      )
    })
  })

  describe('touch-friendly accordion behavior', () => {
    it('uses larger touch targets for mobile (py-2.5 class)', () => {
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      const rattskallor = screen.getByText('Regelverk').closest('button')
      expect(rattskallor).toHaveClass('py-2.5')
    })

    it('uses larger icons for mobile (h-5 w-5)', () => {
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      const rattskallor = screen.getByText('Regelverk').closest('button')
      const icon = rattskallor?.querySelector('svg')
      expect(icon).toHaveClass('h-5', 'w-5')
    })
  })

  describe('sheet behavior', () => {
    it('renders content when open is true', () => {
      render(<MobileSidebar open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByAltText('Laglig.se')).toBeInTheDocument()
      expect(screen.getByText('Hem')).toBeInTheDocument()
    })
  })
})
