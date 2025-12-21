/**
 * Story 5.2: Tests for <Can> and <Cannot> permission components
 */

import { render, screen } from '@testing-library/react'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import { Can, Cannot } from '@/components/permissions/can'

// Mock useWorkspace hook
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: vi.fn(),
}))

import { useWorkspace } from '@/hooks/use-workspace'
import type { WorkspaceRole, WorkspaceStatus } from '@prisma/client'

// Helper to create mock workspace context
const mockWorkspace = (
  overrides: Partial<ReturnType<typeof useWorkspace>> = {}
): ReturnType<typeof useWorkspace> => ({
  workspaceId: 'ws_123',
  workspaceName: 'Test Workspace',
  workspaceSlug: 'test-workspace',
  workspaceStatus: 'ACTIVE' as WorkspaceStatus,
  role: 'MEMBER' as WorkspaceRole,
  isLoading: false,
  error: null,
  refresh: async () => {},
  ...overrides,
})

describe('<Can> component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ isLoading: true })
      )
    })

    it('renders loading content while loading', () => {
      render(
        <Can permission="workspace:delete" loading={<span>Loading...</span>}>
          <button>Delete</button>
        </Can>
      )
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    })

    it('renders nothing by default while loading', () => {
      render(
        <Can permission="workspace:delete">
          <button>Delete</button>
        </Can>
      )
      expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    })
  })

  describe('error state', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ error: 'Failed to load workspace' })
      )
    })

    it('renders fallback on error (fail closed)', () => {
      render(
        <Can permission="workspace:delete" fallback={<span>No access</span>}>
          <button>Delete</button>
        </Can>
      )
      expect(screen.getByText('No access')).toBeInTheDocument()
      expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    })
  })

  describe('with OWNER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ role: 'OWNER' as WorkspaceRole })
      )
    })

    it('renders children when user has permission', () => {
      render(
        <Can permission="workspace:delete">
          <button>Delete</button>
        </Can>
      )
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('renders children for all permissions an OWNER has', () => {
      render(
        <>
          <Can permission="workspace:billing">
            <span>Billing</span>
          </Can>
          <Can permission="employees:manage">
            <span>Employees</span>
          </Can>
          <Can permission="ai:chat">
            <span>AI Chat</span>
          </Can>
        </>
      )
      expect(screen.getByText('Billing')).toBeInTheDocument()
      expect(screen.getByText('Employees')).toBeInTheDocument()
      expect(screen.getByText('AI Chat')).toBeInTheDocument()
    })
  })

  describe('with MEMBER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ role: 'MEMBER' as WorkspaceRole })
      )
    })

    it('hides children when user lacks permission', () => {
      render(
        <Can permission="workspace:delete">
          <button>Delete</button>
        </Can>
      )
      expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    })

    it('renders fallback when provided', () => {
      render(
        <Can permission="workspace:delete" fallback={<span>No access</span>}>
          <button>Delete</button>
        </Can>
      )
      expect(screen.getByText('No access')).toBeInTheDocument()
    })

    it('renders children for permissions MEMBER has', () => {
      render(
        <>
          <Can permission="tasks:edit">
            <span>Edit Tasks</span>
          </Can>
          <Can permission="ai:chat">
            <span>AI Chat</span>
          </Can>
          <Can permission="read">
            <span>Read</span>
          </Can>
        </>
      )
      expect(screen.getByText('Edit Tasks')).toBeInTheDocument()
      expect(screen.getByText('AI Chat')).toBeInTheDocument()
      expect(screen.getByText('Read')).toBeInTheDocument()
    })
  })

  describe('with AUDITOR role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ role: 'AUDITOR' as WorkspaceRole })
      )
    })

    it('shows read-only content', () => {
      render(
        <>
          <Can permission="read">
            <span>Read Content</span>
          </Can>
          <Can permission="activity:view">
            <span>Activity Log</span>
          </Can>
          <Can permission="tasks:edit">
            <span>Edit Tasks</span>
          </Can>
        </>
      )
      expect(screen.getByText('Read Content')).toBeInTheDocument()
      expect(screen.getByText('Activity Log')).toBeInTheDocument()
      expect(screen.queryByText('Edit Tasks')).not.toBeInTheDocument()
    })
  })

  describe('with multiple permissions', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ role: 'ADMIN' as WorkspaceRole })
      )
    })

    it('shows content when user has ANY permission (default OR)', () => {
      render(
        <Can permission={['workspace:delete', 'lists:create']}>
          <button>Action</button>
        </Can>
      )
      // ADMIN has lists:create but not workspace:delete
      expect(screen.getByText('Action')).toBeInTheDocument()
    })

    it('hides content when requireAll=true and missing some', () => {
      render(
        <Can permission={['workspace:delete', 'lists:create']} requireAll>
          <button>Action</button>
        </Can>
      )
      // ADMIN has lists:create but not workspace:delete
      expect(screen.queryByText('Action')).not.toBeInTheDocument()
    })

    it('shows content when requireAll=true and has all', () => {
      render(
        <Can permission={['lists:create', 'lists:delete']} requireAll>
          <button>Action</button>
        </Can>
      )
      // ADMIN has both
      expect(screen.getByText('Action')).toBeInTheDocument()
    })
  })
})

describe('<Cannot> component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('with MEMBER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ role: 'MEMBER' as WorkspaceRole })
      )
    })

    it('shows children when user lacks permission', () => {
      render(
        <Cannot permission="workspace:billing">
          <span>Upgrade to access billing</span>
        </Cannot>
      )
      expect(screen.getByText('Upgrade to access billing')).toBeInTheDocument()
    })

    it('hides children when user has permission', () => {
      render(
        <Cannot permission="ai:chat">
          <span>Upgrade to access AI</span>
        </Cannot>
      )
      expect(screen.queryByText('Upgrade to access AI')).not.toBeInTheDocument()
    })
  })

  describe('with OWNER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ role: 'OWNER' as WorkspaceRole })
      )
    })

    it('hides children when user has permission', () => {
      render(
        <Cannot permission="workspace:billing">
          <span>Upgrade prompt</span>
        </Cannot>
      )
      expect(screen.queryByText('Upgrade prompt')).not.toBeInTheDocument()
    })

    it('shows fallback when user has permission', () => {
      render(
        <Cannot
          permission="workspace:billing"
          fallback={<span>Billing available</span>}
        >
          <span>Upgrade prompt</span>
        </Cannot>
      )
      expect(screen.getByText('Billing available')).toBeInTheDocument()
    })
  })
})
