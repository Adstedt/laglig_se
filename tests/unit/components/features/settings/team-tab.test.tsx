/**
 * Story 5.7: Tests for TeamTab component
 */

import { render, screen } from '@testing-library/react'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import { TeamTab } from '@/components/features/settings/team-tab'
import type { MemberData } from '@/components/features/settings/settings-tabs'
import type { WorkspaceRole, WorkspaceStatus } from '@prisma/client'

// Mock useWorkspace hook
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: vi.fn(),
}))

// Mock server actions
vi.mock('@/app/actions/workspace-settings', () => ({
  changeMemberRole: vi.fn(),
  removeMember: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { useWorkspace } from '@/hooks/use-workspace'

// Helper to create mock workspace context
const mockWorkspaceContext = (
  overrides: Partial<ReturnType<typeof useWorkspace>> = {}
): ReturnType<typeof useWorkspace> => ({
  workspaceId: 'ws_123',
  workspaceName: 'Test Workspace',
  workspaceSlug: 'test-workspace',
  workspaceStatus: 'ACTIVE' as WorkspaceStatus,
  role: 'OWNER' as WorkspaceRole,
  isLoading: false,
  error: null,
  refresh: async () => {},
  ...overrides,
})

// Mock members data
const mockMembers: MemberData[] = [
  {
    id: 'mem_1',
    user: {
      id: 'user_1',
      name: 'Anna Owner',
      email: 'anna@example.com',
      avatar_url: null,
    },
    role: 'OWNER' as WorkspaceRole,
    joined_at: new Date('2024-12-01'),
  },
  {
    id: 'mem_2',
    user: {
      id: 'user_2',
      name: 'Bob Admin',
      email: 'bob@example.com',
      avatar_url: null,
    },
    role: 'ADMIN' as WorkspaceRole,
    joined_at: new Date('2024-12-05'),
  },
  {
    id: 'mem_3',
    user: {
      id: 'user_3',
      name: null,
      email: 'charlie@example.com',
      avatar_url: null,
    },
    role: 'MEMBER' as WorkspaceRole,
    joined_at: new Date('2024-12-10'),
  },
]

describe('TeamTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('members table display', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'OWNER' as WorkspaceRole })
      )
    })

    it('renders all members in table', () => {
      render(<TeamTab members={mockMembers} />)

      expect(screen.getByText('Anna Owner')).toBeInTheDocument()
      expect(screen.getByText('Bob Admin')).toBeInTheDocument()
      expect(screen.getByText('charlie@example.com')).toBeInTheDocument()
    })

    it('shows role labels in Swedish', () => {
      render(<TeamTab members={mockMembers} />)

      expect(screen.getByText('Ägare')).toBeInTheDocument()
    })

    it('displays member initials in avatar', () => {
      render(<TeamTab members={mockMembers} />)

      expect(screen.getByText('AO')).toBeInTheDocument() // Anna Owner
      expect(screen.getByText('BA')).toBeInTheDocument() // Bob Admin
      expect(screen.getByText('CH')).toBeInTheDocument() // charlie@example.com (first 2 chars of email)
    })

    it('shows empty state when no members', () => {
      render(<TeamTab members={[]} />)

      expect(
        screen.getByText('Inga medlemmar i arbetsplatsen')
      ).toBeInTheDocument()
    })
  })

  describe('permission gating with OWNER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'OWNER' as WorkspaceRole })
      )
    })

    it('shows invite button for OWNER', () => {
      render(<TeamTab members={mockMembers} />)

      expect(screen.getByText('Bjud in medlem')).toBeInTheDocument()
    })

    it('shows role dropdown for non-owner members', () => {
      render(<TeamTab members={mockMembers} />)

      // Should show role dropdowns for non-owners (Admin and Member)
      // Owner should show a static badge, not dropdown
      const dropdowns = screen.getAllByRole('combobox')
      expect(dropdowns.length).toBeGreaterThan(0)
    })

    it('shows remove button in actions menu for non-owner members', () => {
      render(<TeamTab members={mockMembers} />)

      // There should be action menus for non-owner members
      const menuButtons = screen.getAllByRole('button', { name: 'Öppna meny' })
      expect(menuButtons.length).toBe(2) // For Admin and Member, not Owner
    })
  })

  describe('permission gating with ADMIN role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'ADMIN' as WorkspaceRole })
      )
    })

    it('shows invite button for ADMIN', () => {
      render(<TeamTab members={mockMembers} />)

      expect(screen.getByText('Bjud in medlem')).toBeInTheDocument()
    })

    it('shows role dropdown for ADMIN', () => {
      render(<TeamTab members={mockMembers} />)

      // ADMIN can change roles
      const dropdowns = screen.getAllByRole('combobox')
      expect(dropdowns.length).toBeGreaterThan(0)
    })
  })

  describe('permission gating with MEMBER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'MEMBER' as WorkspaceRole })
      )
    })

    it('hides invite button for MEMBER', () => {
      render(<TeamTab members={mockMembers} />)

      expect(screen.queryByText('Bjud in medlem')).not.toBeInTheDocument()
    })

    it('shows role badges instead of dropdowns for MEMBER', () => {
      render(<TeamTab members={mockMembers} />)

      // MEMBER cannot change roles, so no dropdowns
      const dropdowns = screen.queryAllByRole('combobox')
      expect(dropdowns.length).toBe(0)
    })

    it('hides action menu for MEMBER', () => {
      render(<TeamTab members={mockMembers} />)

      // MEMBER cannot remove members, so no action menus
      const menuButtons = screen.queryAllByRole('button', {
        name: 'Öppna meny',
      })
      expect(menuButtons.length).toBe(0)
    })
  })

  describe('permission gating with AUDITOR role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'AUDITOR' as WorkspaceRole })
      )
    })

    it('hides invite button for AUDITOR', () => {
      render(<TeamTab members={mockMembers} />)

      expect(screen.queryByText('Bjud in medlem')).not.toBeInTheDocument()
    })

    it('shows role badges instead of dropdowns for AUDITOR', () => {
      render(<TeamTab members={mockMembers} />)

      // AUDITOR cannot change roles, so no dropdowns
      const dropdowns = screen.queryAllByRole('combobox')
      expect(dropdowns.length).toBe(0)
    })
  })

  describe('date formatting', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'OWNER' as WorkspaceRole })
      )
    })

    it('formats joined date in Swedish locale', () => {
      render(<TeamTab members={mockMembers} />)

      // The date should be formatted in Swedish format
      // Dec 1, 2024 would be "1 dec. 2024" or similar
      const dateElements = screen.getAllByText(/dec/i)
      expect(dateElements.length).toBeGreaterThan(0)
    })
  })
})
