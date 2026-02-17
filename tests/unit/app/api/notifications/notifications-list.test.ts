import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
    },
    changeEvent: {
      findUnique: vi.fn(),
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
import { GET } from '@/app/api/notifications/route'
import { NextRequest } from 'next/server'

const mockGetWorkspaceContext = vi.mocked(getWorkspaceContext)
const mockFindMany = vi.mocked(prisma.notification.findMany)
const mockChangeEventFindUnique = vi.mocked(prisma.changeEvent.findUnique)

function createRequest(url = 'http://localhost/api/notifications') {
  return new NextRequest(url)
}

const mockCtx = {
  userId: 'user-1',
  workspaceId: 'ws-1',
  workspaceName: 'Test',
  workspaceSlug: 'test',
  workspaceStatus: 'ACTIVE',
  role: 'MEMBER',
  hasPermission: () => true,
} as Awaited<ReturnType<typeof getWorkspaceContext>>

describe('GET /api/notifications', () => {
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

    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  it('returns notifications ordered by created_at desc', async () => {
    mockGetWorkspaceContext.mockResolvedValue(mockCtx)

    const mockNotifications = [
      {
        id: 'n-1',
        type: 'AMENDMENT_DETECTED',
        title: 'Arbetsmiljölagen uppdaterad',
        body: 'SFS 2026:145',
        entity_type: null,
        entity_id: null,
        created_at: new Date('2026-02-17T10:00:00Z'),
      },
    ]

    mockFindMany.mockResolvedValue(mockNotifications as never)

    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe('Arbetsmiljölagen uppdaterad')
    expect(body[0].link_url).toBeNull()
  })

  it('enriches change_event notifications with link_url', async () => {
    mockGetWorkspaceContext.mockResolvedValue(mockCtx)

    mockFindMany.mockResolvedValue([
      {
        id: 'n-1',
        type: 'AMENDMENT_DETECTED',
        title: 'Lag uppdaterad',
        body: null,
        entity_type: 'change_event',
        entity_id: 'ce-1',
        created_at: new Date('2026-02-17T10:00:00Z'),
      },
    ] as never)

    mockChangeEventFindUnique.mockResolvedValue({
      document: { slug: 'sfs-1977-1160' },
    } as never)

    const res = await GET(createRequest())
    const body = await res.json()

    expect(body[0].link_url).toBe('/dokument/sfs-1977-1160')
  })

  it('respects limit query param', async () => {
    mockGetWorkspaceContext.mockResolvedValue(mockCtx)
    mockFindMany.mockResolvedValue([] as never)

    await GET(createRequest('http://localhost/api/notifications?limit=10'))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    )
  })

  it('clamps limit to max 20', async () => {
    mockGetWorkspaceContext.mockResolvedValue(mockCtx)
    mockFindMany.mockResolvedValue([] as never)

    await GET(createRequest('http://localhost/api/notifications?limit=50'))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    )
  })

  it('defaults limit to 5', async () => {
    mockGetWorkspaceContext.mockResolvedValue(mockCtx)
    mockFindMany.mockResolvedValue([] as never)

    await GET(createRequest('http://localhost/api/notifications'))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    )
  })
})
