import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      updateMany: vi.fn(),
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
import { PATCH } from '@/app/api/notifications/mark-all-read/route'

const mockGetWorkspaceContext = vi.mocked(getWorkspaceContext)
const mockUpdateMany = vi.mocked(prisma.notification.updateMany)

const mockCtx = {
  userId: 'user-1',
  workspaceId: 'ws-1',
  workspaceName: 'Test',
  workspaceSlug: 'test',
  workspaceStatus: 'ACTIVE',
  role: 'MEMBER',
  hasPermission: () => true,
} as Awaited<ReturnType<typeof getWorkspaceContext>>

describe('PATCH /api/notifications/mark-all-read', () => {
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

    const res = await PATCH()
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  it('marks all unread notifications as read', async () => {
    mockGetWorkspaceContext.mockResolvedValue(mockCtx)
    mockUpdateMany.mockResolvedValue({ count: 3 } as never)

    const res = await PATCH()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.updated).toBe(3)
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        workspace_id: 'ws-1',
        read_at: null,
      },
      data: { read_at: expect.any(Date) },
    })
  })

  it('returns 0 updated when no unread notifications', async () => {
    mockGetWorkspaceContext.mockResolvedValue(mockCtx)
    mockUpdateMany.mockResolvedValue({ count: 0 } as never)

    const res = await PATCH()
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.updated).toBe(0)
  })
})
