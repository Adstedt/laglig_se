/**
 * Story 5.2: Tests for requirePermission API middleware
 */

import { vi, describe, beforeEach, it, expect } from 'vitest'
import {
  requirePermission,
  requireAnyPermission,
  requirePermissionWithContext,
} from '@/lib/api/require-permission'
import { WorkspaceAccessError } from '@/lib/auth/workspace-context'
import type { WorkspaceRole, WorkspaceStatus } from '@prisma/client'

// Mock workspace context
vi.mock('@/lib/auth/workspace-context', () => ({
  getWorkspaceContext: vi.fn(),
  WorkspaceAccessError: class WorkspaceAccessError extends Error {
    code: string
    constructor(message: string, code: string) {
      super(message)
      this.name = 'WorkspaceAccessError'
      this.code = code
    }
  },
}))

import { getWorkspaceContext } from '@/lib/auth/workspace-context'

// Helper to create mock context
const mockContext = (role: WorkspaceRole) => ({
  userId: 'user_123',
  workspaceId: 'ws_123',
  workspaceName: 'Test Workspace',
  workspaceSlug: 'test-workspace',
  workspaceStatus: 'ACTIVE' as WorkspaceStatus,
  role,
  hasPermission: vi.fn(),
})

describe('requirePermission middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('with valid context', () => {
    it('returns null when user has permission', async () => {
      vi.mocked(getWorkspaceContext).mockResolvedValue(mockContext('OWNER'))

      const result = await requirePermission('workspace:delete')
      expect(result).toBeNull()
    })

    it('returns 403 when user lacks permission', async () => {
      vi.mocked(getWorkspaceContext).mockResolvedValue(mockContext('MEMBER'))

      const result = await requirePermission('workspace:delete')
      expect(result).not.toBeNull()
      expect(result?.status).toBe(403)

      const body = await result?.json()
      expect(body.error).toBe('Åtkomst nekad')
      expect(body.message).toBe(
        'Du har inte behörighet att utföra denna åtgärd'
      )
      expect(body.required).toBe('workspace:delete')
      expect(body.userRole).toBe('MEMBER')
    })

    it('checks multiple permissions (all required)', async () => {
      vi.mocked(getWorkspaceContext).mockResolvedValue(mockContext('ADMIN'))

      // ADMIN has lists:create but not workspace:delete
      const result = await requirePermission('lists:create', 'workspace:delete')
      expect(result).not.toBeNull()
      expect(result?.status).toBe(403)
    })

    it('grants access when user has all permissions', async () => {
      vi.mocked(getWorkspaceContext).mockResolvedValue(mockContext('OWNER'))

      const result = await requirePermission('lists:create', 'workspace:delete')
      expect(result).toBeNull()
    })
  })

  describe('with auth errors', () => {
    it('returns 401 for UNAUTHORIZED', async () => {
      vi.mocked(getWorkspaceContext).mockRejectedValue(
        new WorkspaceAccessError('No session', 'UNAUTHORIZED')
      )

      const result = await requirePermission('read')
      expect(result?.status).toBe(401)

      const body = await result?.json()
      expect(body.code).toBe('UNAUTHORIZED')
    })

    it('returns 403 for NO_WORKSPACE', async () => {
      vi.mocked(getWorkspaceContext).mockRejectedValue(
        new WorkspaceAccessError('No workspace', 'NO_WORKSPACE')
      )

      const result = await requirePermission('read')
      expect(result?.status).toBe(403)

      const body = await result?.json()
      expect(body.code).toBe('NO_WORKSPACE')
    })

    it('rethrows unexpected errors', async () => {
      vi.mocked(getWorkspaceContext).mockRejectedValue(new Error('DB error'))

      await expect(requirePermission('read')).rejects.toThrow('DB error')
    })
  })
})

describe('requireAnyPermission middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when user has ANY permission', async () => {
    vi.mocked(getWorkspaceContext).mockResolvedValue(mockContext('ADMIN'))

    // ADMIN has lists:create but not workspace:delete
    const result = await requireAnyPermission(
      'workspace:delete',
      'lists:create'
    )
    expect(result).toBeNull()
  })

  it('returns 403 when user has NONE of the permissions', async () => {
    vi.mocked(getWorkspaceContext).mockResolvedValue(mockContext('MEMBER'))

    const result = await requireAnyPermission(
      'workspace:delete',
      'workspace:billing'
    )
    expect(result?.status).toBe(403)

    const body = await result?.json()
    expect(body.requiredAny).toEqual(['workspace:delete', 'workspace:billing'])
  })
})

describe('requirePermissionWithContext middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns context when permission granted', async () => {
    const context = mockContext('OWNER')
    vi.mocked(getWorkspaceContext).mockResolvedValue(context)

    const result = await requirePermissionWithContext('workspace:delete')
    expect(result.granted).toBe(true)
    if (result.granted) {
      expect(result.context.workspaceId).toBe('ws_123')
      expect(result.context.role).toBe('OWNER')
    }
  })

  it('returns response when permission denied', async () => {
    vi.mocked(getWorkspaceContext).mockResolvedValue(mockContext('MEMBER'))

    const result = await requirePermissionWithContext('workspace:delete')
    expect(result.granted).toBe(false)
    if (!result.granted) {
      expect(result.response.status).toBe(403)
    }
  })
})
