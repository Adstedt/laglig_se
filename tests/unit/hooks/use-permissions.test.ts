/**
 * Story 5.2: Tests for usePermissions hook
 */

import { renderHook } from '@testing-library/react'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import { usePermissions } from '@/hooks/use-permissions'

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

describe('usePermissions hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    it('returns false for all permissions while loading (fail closed)', () => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ isLoading: true, role: 'OWNER' as WorkspaceRole })
      )
      const { result } = renderHook(() => usePermissions())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.can.deleteWorkspace).toBe(false)
      expect(result.current.can.manageBilling).toBe(false)
      expect(result.current.can.useAiChat).toBe(false)
    })
  })

  describe('error state', () => {
    it('returns false for all permissions on error (fail closed)', () => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({
          error: 'Network error',
          role: 'OWNER' as WorkspaceRole,
        })
      )
      const { result } = renderHook(() => usePermissions())

      expect(result.current.error).toBe('Network error')
      expect(result.current.can.deleteWorkspace).toBe(false)
      expect(result.current.can.manageBilling).toBe(false)
    })
  })

  describe('with OWNER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ role: 'OWNER' as WorkspaceRole })
      )
    })

    it('returns correct permissions for OWNER', () => {
      const { result } = renderHook(() => usePermissions())

      expect(result.current.role).toBe('OWNER')
      expect(result.current.can.deleteWorkspace).toBe(true)
      expect(result.current.can.manageBilling).toBe(true)
      expect(result.current.can.manageSettings).toBe(true)
      expect(result.current.can.inviteMembers).toBe(true)
      expect(result.current.can.changeRoles).toBe(true)
      expect(result.current.can.createLists).toBe(true)
      expect(result.current.can.manageEmployees).toBe(true)
      expect(result.current.can.viewActivity).toBe(true)
      expect(result.current.can.useAiChat).toBe(true)
    })
  })

  describe('with ADMIN role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ role: 'ADMIN' as WorkspaceRole })
      )
    })

    it('returns correct permissions for ADMIN', () => {
      const { result } = renderHook(() => usePermissions())

      expect(result.current.role).toBe('ADMIN')
      expect(result.current.can.deleteWorkspace).toBe(false)
      expect(result.current.can.manageBilling).toBe(false)
      expect(result.current.can.manageSettings).toBe(true)
      expect(result.current.can.inviteMembers).toBe(true)
      expect(result.current.can.changeRoles).toBe(true)
      expect(result.current.can.createLists).toBe(true)
      expect(result.current.can.viewEmployees).toBe(false) // ADMIN can't see employee data
      expect(result.current.can.viewActivity).toBe(true)
      expect(result.current.can.useAiChat).toBe(true)
    })
  })

  describe('with HR_MANAGER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ role: 'HR_MANAGER' as WorkspaceRole })
      )
    })

    it('returns correct permissions for HR_MANAGER', () => {
      const { result } = renderHook(() => usePermissions())

      expect(result.current.role).toBe('HR_MANAGER')
      expect(result.current.can.deleteWorkspace).toBe(false)
      expect(result.current.can.manageBilling).toBe(false)
      expect(result.current.can.manageSettings).toBe(false)
      expect(result.current.can.inviteMembers).toBe(true)
      expect(result.current.can.changeRoles).toBe(false)
      expect(result.current.can.createLists).toBe(true)
      expect(result.current.can.viewEmployees).toBe(true)
      expect(result.current.can.manageEmployees).toBe(true)
      expect(result.current.can.viewActivity).toBe(false)
      expect(result.current.can.useAiChat).toBe(true)
    })
  })

  describe('with MEMBER role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ role: 'MEMBER' as WorkspaceRole })
      )
    })

    it('returns correct permissions for MEMBER', () => {
      const { result } = renderHook(() => usePermissions())

      expect(result.current.role).toBe('MEMBER')
      expect(result.current.can.deleteWorkspace).toBe(false)
      expect(result.current.can.manageBilling).toBe(false)
      expect(result.current.can.manageSettings).toBe(false)
      expect(result.current.can.inviteMembers).toBe(false)
      expect(result.current.can.createLists).toBe(false)
      expect(result.current.can.editTasks).toBe(true)
      expect(result.current.can.acknowledgeChanges).toBe(true)
      expect(result.current.can.viewEmployees).toBe(false)
      expect(result.current.can.viewActivity).toBe(false)
      expect(result.current.can.useAiChat).toBe(true)
      expect(result.current.can.read).toBe(true)
    })
  })

  describe('with AUDITOR role', () => {
    beforeEach(() => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ role: 'AUDITOR' as WorkspaceRole })
      )
    })

    it('returns correct permissions for AUDITOR', () => {
      const { result } = renderHook(() => usePermissions())

      expect(result.current.role).toBe('AUDITOR')
      expect(result.current.can.deleteWorkspace).toBe(false)
      expect(result.current.can.manageBilling).toBe(false)
      expect(result.current.can.inviteMembers).toBe(false)
      expect(result.current.can.editTasks).toBe(false)
      expect(result.current.can.viewEmployees).toBe(false)
      expect(result.current.can.viewActivity).toBe(true)
      expect(result.current.can.useAiChat).toBe(true)
      expect(result.current.can.read).toBe(true)
    })
  })

  describe('has() method', () => {
    it('returns true for valid permission', () => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ role: 'OWNER' as WorkspaceRole })
      )
      const { result } = renderHook(() => usePermissions())

      expect(result.current.has('workspace:delete')).toBe(true)
      expect(result.current.has('workspace:billing')).toBe(true)
    })

    it('returns false for invalid permission', () => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ role: 'MEMBER' as WorkspaceRole })
      )
      const { result } = renderHook(() => usePermissions())

      expect(result.current.has('workspace:delete')).toBe(false)
      expect(result.current.has('workspace:billing')).toBe(false)
    })

    it('returns false while loading (fail closed)', () => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({ isLoading: true, role: 'OWNER' as WorkspaceRole })
      )
      const { result } = renderHook(() => usePermissions())

      expect(result.current.has('workspace:delete')).toBe(false)
    })

    it('returns false on error (fail closed)', () => {
      vi.mocked(useWorkspace).mockReturnValue(
        mockWorkspace({
          error: 'Network error',
          role: 'OWNER' as WorkspaceRole,
        })
      )
      const { result } = renderHook(() => usePermissions())

      expect(result.current.has('workspace:delete')).toBe(false)
    })
  })
})
