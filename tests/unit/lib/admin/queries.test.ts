import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      groupBy: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  getWorkspaceMetrics,
  getUserMetrics,
  getRecentWorkspaces,
  getRecentUsers,
} from '@/lib/admin/queries'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getWorkspaceMetrics', () => {
  it('returns correct shape with groupBy counts', async () => {
    vi.mocked(prisma.workspace.groupBy)
      .mockResolvedValueOnce([
        { status: 'ACTIVE', _count: 10 },
        { status: 'PAUSED', _count: 2 },
        { status: 'DELETED', _count: 1 },
      ] as never)
      .mockResolvedValueOnce([
        { subscription_tier: 'TRIAL', _count: 5 },
        { subscription_tier: 'SOLO', _count: 4 },
        { subscription_tier: 'TEAM', _count: 3 },
        { subscription_tier: 'ENTERPRISE', _count: 1 },
      ] as never)
    vi.mocked(prisma.workspace.count).mockResolvedValue(13 as never)

    const result = await getWorkspaceMetrics()

    expect(result).toEqual({
      total: 13,
      active: 10,
      paused: 2,
      deleted: 1,
      byTier: {
        TRIAL: 5,
        SOLO: 4,
        TEAM: 3,
        ENTERPRISE: 1,
      },
    })

    expect(prisma.workspace.groupBy).toHaveBeenCalledTimes(2)
    expect(prisma.workspace.count).toHaveBeenCalledTimes(1)
  })

  it('defaults missing statuses and tiers to zero', async () => {
    vi.mocked(prisma.workspace.groupBy)
      .mockResolvedValueOnce([{ status: 'ACTIVE', _count: 3 }] as never)
      .mockResolvedValueOnce([
        { subscription_tier: 'SOLO', _count: 3 },
      ] as never)
    vi.mocked(prisma.workspace.count).mockResolvedValue(3 as never)

    const result = await getWorkspaceMetrics()

    expect(result.paused).toBe(0)
    expect(result.deleted).toBe(0)
    expect(result.byTier.TRIAL).toBe(0)
    expect(result.byTier.TEAM).toBe(0)
    expect(result.byTier.ENTERPRISE).toBe(0)
  })
})

describe('getUserMetrics', () => {
  it('returns correct date-filtered counts', async () => {
    vi.mocked(prisma.user.count)
      .mockResolvedValueOnce(100 as never)
      .mockResolvedValueOnce(8 as never)
      .mockResolvedValueOnce(25 as never)

    const result = await getUserMetrics()

    expect(result).toEqual({
      total: 100,
      newLast7Days: 8,
      newLast30Days: 25,
    })

    expect(prisma.user.count).toHaveBeenCalledTimes(3)

    // Verify date filters are passed
    const calls = vi.mocked(prisma.user.count).mock.calls
    expect(calls[0]).toEqual([]) // total — no filter
    expect(calls[1]?.[0]).toHaveProperty('where.created_at.gte') // 7-day filter
    expect(calls[2]?.[0]).toHaveProperty('where.created_at.gte') // 30-day filter
  })
})

describe('getRecentWorkspaces', () => {
  it('returns workspaces ordered by created_at desc with owner info', async () => {
    const mockWorkspaces = [
      {
        id: 'ws-1',
        name: 'Workspace 1',
        slug: 'workspace-1',
        subscription_tier: 'TEAM',
        status: 'ACTIVE',
        created_at: new Date('2026-02-01'),
        owner: { email: 'owner@test.com', name: 'Owner' },
        _count: { members: 3 },
      },
      {
        id: 'ws-2',
        name: 'Workspace 2',
        slug: 'workspace-2',
        subscription_tier: 'TRIAL',
        status: 'PAUSED',
        created_at: new Date('2026-01-15'),
        owner: { email: 'other@test.com', name: null },
        _count: { members: 1 },
      },
    ]

    vi.mocked(prisma.workspace.findMany).mockResolvedValue(
      mockWorkspaces as never
    )

    const result = await getRecentWorkspaces(10)

    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('Workspace 1')
    expect(result[0]?.owner.email).toBe('owner@test.com')
    expect(result[0]?._count.members).toBe(3)

    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      take: 10,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        subscription_tier: true,
        status: true,
        created_at: true,
        owner: { select: { email: true, name: true } },
        _count: { select: { members: true } },
      },
    })
  })
})

describe('getRecentUsers', () => {
  it('returns users ordered by created_at desc with workspace count', async () => {
    const mockUsers = [
      {
        id: 'user-1',
        name: 'Test User',
        email: 'test@test.com',
        last_login_at: new Date('2026-02-01'),
        created_at: new Date('2026-01-01'),
        _count: { workspace_members: 2 },
      },
      {
        id: 'user-2',
        name: null,
        email: 'noname@test.com',
        last_login_at: null,
        created_at: new Date('2026-01-10'),
        _count: { workspace_members: 0 },
      },
    ]

    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as never)

    const result = await getRecentUsers(10)

    expect(result).toHaveLength(2)
    expect(result[0]?.email).toBe('test@test.com')
    expect(result[0]?._count.workspace_members).toBe(2)
    expect(result[1]?.last_login_at).toBeNull()

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      take: 10,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        last_login_at: true,
        created_at: true,
        _count: { select: { workspace_members: true } },
      },
    })
  })
})
