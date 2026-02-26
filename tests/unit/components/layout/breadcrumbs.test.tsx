/**
 * Story 3.13: Tests for Breadcrumbs component - new route mappings
 */

import { render, screen } from '@testing-library/react'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'

// Track the current path for testing
let mockPathname = '/dashboard'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}))

// Mock useWorkspace hook
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    workspaceName: 'Test Workspace',
  }),
}))

describe('Breadcrumbs', () => {
  beforeEach(() => {
    mockPathname = '/dashboard'
  })

  describe('legal source route labels', () => {
    it('displays correct label for /browse/rattskallor', () => {
      mockPathname = '/browse/rattskallor'
      render(<Breadcrumbs />)

      expect(screen.getByText('Bläddra')).toBeInTheDocument()
    })

    it('displays correct label for /browse/lagar', () => {
      mockPathname = '/browse/lagar'
      render(<Breadcrumbs />)

      expect(screen.getByText('Lagar')).toBeInTheDocument()
    })

    it('displays correct label for /browse/rattsfall', () => {
      mockPathname = '/browse/rattsfall'
      render(<Breadcrumbs />)

      expect(screen.getByText('Rättsfall')).toBeInTheDocument()
    })

    it('displays correct label for /browse/eu', () => {
      mockPathname = '/browse/eu'
      render(<Breadcrumbs />)

      expect(screen.getByText('EU-rätt')).toBeInTheDocument()
    })
  })

  describe('breadcrumb structure', () => {
    it('shows workspace name as root breadcrumb', () => {
      mockPathname = '/browse/rattskallor'
      render(<Breadcrumbs />)

      expect(screen.getByText('Test Workspace')).toBeInTheDocument()
    })

    it('shows link to dashboard from workspace name when not on dashboard', () => {
      mockPathname = '/browse/rattskallor'
      render(<Breadcrumbs />)

      const workspaceLink = screen.getByText('Test Workspace').closest('a')
      expect(workspaceLink).toHaveAttribute('href', '/dashboard')
    })

    it('renders nothing on dashboard (Hem page)', () => {
      mockPathname = '/dashboard'
      const { container } = render(<Breadcrumbs />)

      expect(container.innerHTML).toBe('')
    })
  })
})
