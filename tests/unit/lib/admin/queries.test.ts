import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      groupBy: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
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
  getWorkspaceList,
  getWorkspaceDetail,
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

// ============================================================================
// getWorkspaceList (Story 11.3)
// ============================================================================

describe('getWorkspaceList', () => {
  const mockListData = [
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
  ]

  it('returns paginated result shape with no filters', async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue(
      mockListData as never
    )
    vi.mocked(prisma.workspace.count).mockResolvedValue(1 as never)

    const result = await getWorkspaceList({})

    expect(result).toEqual({
      data: mockListData,
      total: 1,
      page: 1,
      pageSize: 25,
    })

    const findManyCall = vi.mocked(prisma.workspace.findMany).mock.calls[0]?.[0]
    expect(findManyCall).toMatchObject({
      skip: 0,
      take: 25,
      orderBy: { created_at: 'desc' },
    })
  })

  it('builds correct where clause with search parameter', async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.workspace.count).mockResolvedValue(0 as never)

    await getWorkspaceList({ search: 'test' })

    const findManyCall = vi.mocked(prisma.workspace.findMany).mock.calls[0]?.[0]
    expect(findManyCall?.where).toEqual({
      OR: [
        { name: { contains: 'test', mode: 'insensitive' } },
        { slug: { contains: 'test', mode: 'insensitive' } },
        { owner: { email: { contains: 'test', mode: 'insensitive' } } },
      ],
    })

    // Count query should use same where
    const countCall = vi.mocked(prisma.workspace.count).mock.calls[0]?.[0]
    expect(countCall?.where).toEqual(findManyCall?.where)
  })

  it('passes correct subscription_tier to where with tier filter', async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.workspace.count).mockResolvedValue(0 as never)

    await getWorkspaceList({ tier: 'ENTERPRISE' })

    const findManyCall = vi.mocked(prisma.workspace.findMany).mock.calls[0]?.[0]
    expect(findManyCall?.where).toMatchObject({
      subscription_tier: 'ENTERPRISE',
    })
  })

  it('passes correct status to where with status filter', async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.workspace.count).mockResolvedValue(0 as never)

    await getWorkspaceList({ status: 'PAUSED' })

    const findManyCall = vi.mocked(prisma.workspace.findMany).mock.calls[0]?.[0]
    expect(findManyCall?.where).toMatchObject({
      status: 'PAUSED',
    })
  })

  it('calculates correct skip and take for pagination', async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.workspace.count).mockResolvedValue(100 as never)

    const result = await getWorkspaceList({ page: 3, pageSize: 10 })

    expect(result.page).toBe(3)
    expect(result.pageSize).toBe(10)

    const findManyCall = vi.mocked(prisma.workspace.findMany).mock.calls[0]?.[0]
    expect(findManyCall).toMatchObject({
      skip: 20,
      take: 10,
    })
  })

  it('combines search and tier filter in where clause', async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.workspace.count).mockResolvedValue(0 as never)

    await getWorkspaceList({ search: 'acme', tier: 'TEAM' })

    const findManyCall = vi.mocked(prisma.workspace.findMany).mock.calls[0]?.[0]
    expect(findManyCall?.where).toEqual({
      OR: [
        { name: { contains: 'acme', mode: 'insensitive' } },
        { slug: { contains: 'acme', mode: 'insensitive' } },
        { owner: { email: { contains: 'acme', mode: 'insensitive' } } },
      ],
      subscription_tier: 'TEAM',
    })
  })

  it('falls back to created_at for invalid sort field', async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.workspace.count).mockResolvedValue(0 as never)

    await getWorkspaceList({ sortBy: 'invalid_field', sortDir: 'asc' })

    const findManyCall = vi.mocked(prisma.workspace.findMany).mock.calls[0]?.[0]
    expect(findManyCall?.orderBy).toEqual({ created_at: 'asc' })
  })
})

// ============================================================================
// getWorkspaceDetail (Story 11.3)
// ============================================================================

describe('getWorkspaceDetail', () => {
  it('returns full workspace with relations', async () => {
    const mockDetail = {
      id: 'ws-1',
      name: 'Test Workspace',
      slug: 'test-workspace',
      org_number: '5591234567',
      status: 'ACTIVE',
      subscription_tier: 'TEAM',
      created_at: new Date('2026-01-01'),
      paused_at: null,
      deleted_at: null,
      company_profile: {
        company_name: 'Test AB',
        sni_code: '62010',
        legal_form: 'AB',
        employee_count: 10,
        address: 'Testgatan 1',
      },
      members: [
        {
          id: 'mem-1',
          role: 'OWNER',
          joined_at: new Date('2026-01-01'),
          user: { name: 'Owner', email: 'owner@test.com' },
        },
      ],
      _count: { law_lists: 2, tasks: 5, files: 3 },
    }

    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
      mockDetail as never
    )

    const result = await getWorkspaceDetail('ws-1')

    expect(result).toEqual(mockDetail)
    expect(result?.company_profile?.company_name).toBe('Test AB')
    expect(result?.members).toHaveLength(1)
    expect(result?._count.files).toBe(3)

    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: 'ws-1' },
      select: expect.objectContaining({
        id: true,
        name: true,
        _count: {
          select: {
            law_lists: true,
            tasks: true,
            files: { where: { is_folder: false } },
          },
        },
      }),
    })
  })

  it('returns null when workspace not found', async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null as never)

    const result = await getWorkspaceDetail('nonexistent')

    expect(result).toBeNull()
  })
})
