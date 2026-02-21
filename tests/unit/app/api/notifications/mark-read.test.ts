import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findFirst: vi.fn(),
      update: vi.fn(),
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
import { PATCH } from '@/app/api/notifications/[id]/read/route'

const mockGetWorkspaceContext = vi.mocked(getWorkspaceContext)
const mockFindFirst = vi.mocked(prisma.notification.findFirst)
const mockUpdate = vi.mocked(prisma.notification.update)

const mockCtx = {
  userId: 'user-1',
  workspaceId: 'ws-1',
  workspaceName: 'Test',
  workspaceSlug: 'test',
  workspaceStatus: 'ACTIVE',
  role: 'MEMBER',
  hasPermission: () => true,
} as Awaited<ReturnType<typeof getWorkspaceContext>>

describe('PATCH /api/notifications/[id]/read', () => {
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

    const res = await PATCH(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'n-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 404 when notification not found', async () => {
    mockGetWorkspaceContext.mockResolvedValue(mockCtx)
    mockFindFirst.mockResolvedValue(null)

    const res = await PATCH(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'non-existent' }),
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Notification not found')
  })

  it('marks notification as read', async () => {
    mockGetWorkspaceContext.mockResolvedValue(mockCtx)
    mockFindFirst.mockResolvedValue({ id: 'n-1' } as never)
    mockUpdate.mockResolvedValue({} as never)

    const res = await PATCH(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'n-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { read_at: expect.any(Date) },
    })
  })

  it('verifies notification belongs to current user', async () => {
    mockGetWorkspaceContext.mockResolvedValue(mockCtx)
    mockFindFirst.mockResolvedValue({ id: 'n-1' } as never)
    mockUpdate.mockResolvedValue({} as never)

    await PATCH(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'n-1' }),
    })

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'n-1',
        user_id: 'user-1',
        workspace_id: 'ws-1',
      },
    })
  })
})
