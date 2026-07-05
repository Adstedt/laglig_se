/**
 * Story 3.13: Tests for LeftSidebar component - Regelverk accordion
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import type { WorkspaceRole } from '@prisma/client'
import { LeftSidebar } from '@/components/layout/left-sidebar'

// Passing `role` as a variable (not a string literal) avoids the
// jsx-a11y/aria-role false positive on the component's `role` prop.
function renderSidebar(role?: WorkspaceRole) {
  return render(<LeftSidebar role={role} />)
}

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

  describe('Regelverk accordion', () => {
    it('renders Regelverk as accordion item', () => {
      render(<LeftSidebar />)

      expect(screen.getByText('Regelverk')).toBeInTheDocument()
    })

    it('shows Regelverk subItems when accordion is expanded', async () => {
      const user = userEvent.setup()
      render(<LeftSidebar />)

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
      render(<LeftSidebar />)

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

    it('hides subItems when accordion is collapsed', async () => {
      const user = userEvent.setup()
      render(<LeftSidebar />)

      // Expand accordion
      await user.click(screen.getByText('Regelverk'))
      expect(screen.getByText('Bläddra alla')).toBeInTheDocument()

      // Collapse accordion
      await user.click(screen.getByText('Regelverk'))
      expect(screen.queryByText('Bläddra alla')).not.toBeInTheDocument()
    })
  })

  describe('Efterlevnad accordion', () => {
    it('renders Efterlevnad with Laglistor and Mallar subItems', async () => {
      const user = userEvent.setup()
      render(<LeftSidebar />)

      // Expand Efterlevnad accordion
      await user.click(screen.getByText('Efterlevnad'))

      // Should have both sub-items
      expect(screen.getByText('Laglistor')).toBeInTheDocument()
      expect(screen.getByText('Mallar')).toBeInTheDocument()
    })

    it('has correct href for Laglistor', async () => {
      const user = userEvent.setup()
      render(<LeftSidebar />)

      await user.click(screen.getByText('Efterlevnad'))

      expect(screen.getByText('Laglistor').closest('a')).toHaveAttribute(
        'href',
        '/laglistor'
      )
    })

    it('does not render Kontroller as a sub-item of Efterlevnad', async () => {
      // Kontroller was promoted to a top-level entry — must no longer
      // appear inside the Efterlevnad accordion.
      const user = userEvent.setup()
      render(<LeftSidebar />)

      await user.click(screen.getByText('Efterlevnad'))

      const kontrollerLink = screen.getByText('Kontroller').closest('a')
      // Kontroller's link exists at top level (not inside the accordion's
      // border-l container that holds sub-items).
      expect(
        kontrollerLink?.parentElement?.classList.contains('border-l')
      ).toBe(false)
    })
  })

  describe('Kontroller top-level entry', () => {
    it('renders Kontroller as a top-level link with the cycle list href', () => {
      render(<LeftSidebar />)

      const kontrollerLink = screen.getByText('Kontroller').closest('a')
      expect(kontrollerLink).toHaveAttribute('href', '/laglistor/kontroller')
    })
  })

  describe('Arbetsyta section', () => {
    it('renders the Arbetsyta section header (renamed from Arbete)', () => {
      render(<LeftSidebar />)

      expect(screen.getByText('Arbetsyta')).toBeInTheDocument()
    })
  })

  describe('accordion expand/collapse behavior', () => {
    it('toggles chevron rotation when accordion expands', async () => {
      const user = userEvent.setup()
      render(<LeftSidebar />)

      const rattskallor = screen.getByText('Regelverk')
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
      await user.click(screen.getByText('Efterlevnad'))
      await user.click(screen.getByText('Regelverk'))

      // Both should be open
      expect(screen.getByText('Laglistor')).toBeInTheDocument()
      expect(screen.getByText('Bläddra alla')).toBeInTheDocument()
    })
  })

  describe('HR nav permission gating (Story 7.2b)', () => {
    it('mutes the HR item for a role without employees:view (MEMBER)', () => {
      renderSidebar('MEMBER')

      const hr = screen.getByText('HR')
      // Muted item renders a non-navigable <span>, not a link.
      expect(hr.closest('a')).toBeNull()
      // Reuses the existing disabled styling.
      expect(hr.closest('span.cursor-not-allowed')).not.toBeNull()
    })

    it('mutes the HR item for ADMIN (lacks employees:view)', () => {
      renderSidebar('ADMIN')

      expect(screen.getByText('HR').closest('a')).toBeNull()
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

  describe('navigation items', () => {
    it('renders Hem link', () => {
      render(<LeftSidebar />)

      const hemLink = screen.getByText('Hem').closest('a')
      expect(hemLink).toHaveAttribute('href', '/dashboard')
    })

    it('renders Settings link', () => {
      render(<LeftSidebar />)

      const settingsLink = screen.getByText('Inställningar').closest('a')
      expect(settingsLink).toHaveAttribute('href', '/settings')
    })

    it('hides AI Chat toggle on /dashboard (Hem is the chat)', () => {
      // usePathname returns '/dashboard' in mock
      render(<LeftSidebar />)

      expect(screen.queryByText('AI Chat')).not.toBeInTheDocument()
    })
  })
})
