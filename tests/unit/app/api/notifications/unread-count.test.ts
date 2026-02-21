import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      count: vi.fn(),
    },
  },
}))

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

import { prisma } from '@/lib/prisma'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'
import { GET } from '@/app/api/notifications/unread-count/route'

const mockGetWorkspaceContext = vi.mocked(getWorkspaceContext)
const mockCount = vi.mocked(prisma.notification.count)

describe('GET /api/notifications/unread-count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetWorkspaceContext.mockRejectedValue(
      new (WorkspaceAccessError as unknown as new (
        _msg: string,
        _code: string
      ) => Error)('Unauthorized', 'UNAUTHORIZED')
    )

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  it('returns correct unread count', async () => {
    mockGetWorkspaceContext.mockResolvedValue({
      userId: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Test',
      workspaceSlug: 'test',
      workspaceStatus: 'ACTIVE',
      role: 'MEMBER',
      hasPermission: () => true,
    } as Awaited<ReturnType<typeof getWorkspaceContext>>)

    mockCount.mockResolvedValue(5)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.count).toBe(5)
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        workspace_id: 'ws-1',
        read_at: null,
      },
    })
  })

  it('returns 0 when no unread notifications', async () => {
    mockGetWorkspaceContext.mockResolvedValue({
      userId: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Test',
      workspaceSlug: 'test',
      workspaceStatus: 'ACTIVE',
      role: 'MEMBER',
      hasPermission: () => true,
    } as Awaited<ReturnType<typeof getWorkspaceContext>>)

    mockCount.mockResolvedValue(0)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.count).toBe(0)
  })
})
