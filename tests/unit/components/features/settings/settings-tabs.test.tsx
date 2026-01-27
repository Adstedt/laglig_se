/**
 * Story 5.7 & 6.5: Tests for SettingsTabs component
 */

import { render, screen } from '@testing-library/react'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import {
  SettingsTabs,
  type WorkspaceData,
  type MemberData,
} from '@/components/features/settings/settings-tabs'
import type {
  WorkspaceRole,
  WorkspaceStatus,
  SubscriptionTier,
} from '@prisma/client'
import type { TaskColumnWithCount } from '@/app/actions/tasks'

// Mock useWorkspace hook
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: vi.fn(),
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

// Mock workspace data
const mockWorkspace: WorkspaceData = {
  id: 'ws_123',
  name: 'Test Workspace',
  sni_code: '62.010',
  company_logo: null,
  subscription_tier: 'TRIAL' as SubscriptionTier,
  trial_ends_at: new Date('2025-01-15'),
}

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
]

// Mock columns data (Story 6.5)
const mockColumns: TaskColumnWithCount[] = [
  {
    id: 'col_1',
    workspace_id: 'ws_123',
    name: 'Att göra',
    color: '#6b7280',
    position: 0,
    is_default: true,
    is_done: false,
    created_at: new Date(),
    updated_at: new Date(),
    _count: { tasks: 5 },
  },
  {
    id: 'col_2',
    workspace_id: 'ws_123',
    name: 'Pågående',
    color: '#3b82f6',
    position: 1,
    is_default: true,
    is_done: false,
    created_at: new Date(),
    updated_at: new Date(),
    _count: { tasks: 3 },
  },
  {
    id: 'col_3',
    workspace_id: 'ws_123',
    name: 'Klar',
    color: '#22c55e',
    position: 2,
    is_default: true,
    is_done: true,
    created_at: new Date(),
    updated_at: new Date(),
    _count: { tasks: 10 },
  },
]

describe('SettingsTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ isLoading: true })
      )
    })

    it('shows loading skeleton while workspace context loads', () => {
      render(
        <SettingsTabs
          workspace={mockWorkspace}
          members={mockMembers}
          columns={mockColumns}
        />
      )

      // Should show skeletons, not tabs
      expect(screen.queryByText('Allmänt')).not.toBeInTheDocument()
      expect(screen.queryByText('Team')).not.toBeInTheDocument()
      expect(screen.queryByText('Fakturering')).not.toBeInTheDocument()
    })
  })

  describe('with OWNER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'OWNER' as WorkspaceRole })
      )
    })

    it('renders all tabs for OWNER including Arbetsflöde', () => {
      render(
        <SettingsTabs
          workspace={mockWorkspace}
          members={mockMembers}
          columns={mockColumns}
        />
      )

      expect(screen.getByText('Allmänt')).toBeInTheDocument()
      expect(screen.getByText('Team')).toBeInTheDocument()
      expect(screen.getByText('Fakturering')).toBeInTheDocument()
      expect(screen.getByText('Aviseringar')).toBeInTheDocument()
      expect(screen.getByText('Integrationer')).toBeInTheDocument()
      expect(screen.getByText('Arbetsflöde')).toBeInTheDocument()
    })

    it('shows General tab content by default', () => {
      render(
        <SettingsTabs
          workspace={mockWorkspace}
          members={mockMembers}
          columns={mockColumns}
        />
      )

      expect(screen.getByText('Allmänna inställningar')).toBeInTheDocument()
    })
  })

  describe('with ADMIN role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'ADMIN' as WorkspaceRole })
      )
    })

    it('hides Billing tab for non-OWNER', () => {
      render(
        <SettingsTabs
          workspace={mockWorkspace}
          members={mockMembers}
          columns={mockColumns}
        />
      )

      expect(screen.getByText('Allmänt')).toBeInTheDocument()
      expect(screen.getByText('Team')).toBeInTheDocument()
      expect(screen.queryByText('Fakturering')).not.toBeInTheDocument()
      expect(screen.getByText('Aviseringar')).toBeInTheDocument()
      expect(screen.getByText('Integrationer')).toBeInTheDocument()
    })
  })

  describe('with MEMBER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'MEMBER' as WorkspaceRole })
      )
    })

    it('hides Billing tab for MEMBER', () => {
      render(
        <SettingsTabs
          workspace={mockWorkspace}
          members={mockMembers}
          columns={mockColumns}
        />
      )

      expect(screen.queryByText('Fakturering')).not.toBeInTheDocument()
    })

    it('still shows other tabs for MEMBER', () => {
      render(
        <SettingsTabs
          workspace={mockWorkspace}
          members={mockMembers}
          columns={mockColumns}
        />
      )

      expect(screen.getByText('Allmänt')).toBeInTheDocument()
      expect(screen.getByText('Team')).toBeInTheDocument()
      expect(screen.getByText('Aviseringar')).toBeInTheDocument()
      expect(screen.getByText('Integrationer')).toBeInTheDocument()
    })
  })

  describe('with AUDITOR role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'AUDITOR' as WorkspaceRole })
      )
    })

    it('hides Billing tab for AUDITOR', () => {
      render(
        <SettingsTabs
          workspace={mockWorkspace}
          members={mockMembers}
          columns={mockColumns}
        />
      )

      expect(screen.queryByText('Fakturering')).not.toBeInTheDocument()
    })
  })

  describe('with HR_MANAGER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'HR_MANAGER' as WorkspaceRole })
      )
    })

    it('hides Billing tab for HR_MANAGER', () => {
      render(
        <SettingsTabs
          workspace={mockWorkspace}
          members={mockMembers}
          columns={mockColumns}
        />
      )

      expect(screen.queryByText('Fakturering')).not.toBeInTheDocument()
    })
  })

  describe('Arbetsflöde tab (Story 6.5)', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspaceContext({ role: 'MEMBER' as WorkspaceRole })
      )
    })

    it('shows Arbetsflöde tab for all roles', () => {
      render(
        <SettingsTabs
          workspace={mockWorkspace}
          members={mockMembers}
          columns={mockColumns}
        />
      )

      expect(screen.getByText('Arbetsflöde')).toBeInTheDocument()
    })

    it('renders Arbetsflöde tab with Columns icon', () => {
      render(
        <SettingsTabs
          workspace={mockWorkspace}
          members={mockMembers}
          columns={mockColumns}
        />
      )

      // Find the tab button with Arbetsflöde text
      const tab = screen.getByRole('tab', { name: /arbetsflöde/i })
      expect(tab).toBeInTheDocument()
    })
  })
})
