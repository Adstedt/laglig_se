import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockActivityLogFindMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    activityLog: {
      findMany: (...args: unknown[]) => mockActivityLogFindMany(...args),
    },
  },
}))

const MOCK_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'
const MOCK_USER_ID = '00000000-0000-4000-8000-000000000002'

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(
    async (
      fn: (_ctx: { workspaceId: string; userId: string }) => Promise<unknown>,
      _mode?: string
    ) => fn({ workspaceId: MOCK_WORKSPACE_ID, userId: MOCK_USER_ID })
  ),
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const ACTIVITY_USER = {
  id: MOCK_USER_ID,
  name: 'Test User',
  email: 'test@test.com',
  avatar_url: null,
}

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'act-1',
    action: 'status_changed',
    entity_type: 'list_item',
    entity_id: 'entity-1',
    old_value: null,
    new_value: null,
    created_at: new Date('2026-03-10T10:00:00Z'),
    user: ACTIVITY_USER,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getWorkspaceActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns activities for workspace', async () => {
    const activities = [makeActivity()]
    mockActivityLogFindMany.mockResolvedValueOnce(activities)

    const { getWorkspaceActivity } = await import(
      '@/app/actions/workspace-activity'
    )
    const result = await getWorkspaceActivity()

    expect(result).toEqual({
      success: true,
      data: {
        activities,
        nextCursor: null,
      },
    })

    expect(mockActivityLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspace_id: MOCK_WORKSPACE_ID },
        orderBy: { created_at: 'desc' },
        take: 51, // limit + 1
      })
    )
  })

  it('applies user filter', async () => {
    mockActivityLogFindMany.mockResolvedValueOnce([])

    const { getWorkspaceActivity } = await import(
      '@/app/actions/workspace-activity'
    )
    await getWorkspaceActivity({ userId: 'user-filter' })

    expect(mockActivityLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspace_id: MOCK_WORKSPACE_ID,
          user_id: 'user-filter',
        }),
      })
    )
  })

  it('applies action filter', async () => {
    mockActivityLogFindMany.mockResolvedValueOnce([])

    const { getWorkspaceActivity } = await import(
      '@/app/actions/workspace-activity'
    )
    await getWorkspaceActivity({
      action: ['status_changed', 'priority_changed'],
    })

    expect(mockActivityLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: { in: ['status_changed', 'priority_changed'] },
        }),
      })
    )
  })

  it('applies entity type filter', async () => {
    mockActivityLogFindMany.mockResolvedValueOnce([])

    const { getWorkspaceActivity } = await import(
      '@/app/actions/workspace-activity'
    )
    await getWorkspaceActivity({ entityType: ['list_item', 'task'] })

    expect(mockActivityLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entity_type: { in: ['list_item', 'task'] },
        }),
      })
    )
  })

  it('applies date range filter', async () => {
    mockActivityLogFindMany.mockResolvedValueOnce([])

    const { getWorkspaceActivity } = await import(
      '@/app/actions/workspace-activity'
    )
    await getWorkspaceActivity({
      startDate: '2026-03-01',
      endDate: '2026-03-15',
    })

    expect(mockActivityLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          created_at: {
            gte: new Date('2026-03-01'),
            lte: new Date('2026-03-15'),
          },
        }),
      })
    )
  })

  it('pagination with cursor works (returns nextCursor when hasMore)', async () => {
    // Return limit + 1 items to signal hasMore
    const activities = Array.from({ length: 51 }, (_, i) =>
      makeActivity({ id: `act-${i}` })
    )
    mockActivityLogFindMany.mockResolvedValueOnce(activities)

    const { getWorkspaceActivity } = await import(
      '@/app/actions/workspace-activity'
    )
    const result = await getWorkspaceActivity({}, undefined, 50)

    // Should return 50 items with a nextCursor
    expect(result.data!.activities).toHaveLength(50)
    expect(result.data!.nextCursor).toBe('act-49')
  })

  it('returns null nextCursor when no more results', async () => {
    // Return fewer than limit + 1 items
    const activities = [makeActivity({ id: 'act-1' })]
    mockActivityLogFindMany.mockResolvedValueOnce(activities)

    const { getWorkspaceActivity } = await import(
      '@/app/actions/workspace-activity'
    )
    const result = await getWorkspaceActivity({}, undefined, 50)

    expect(result.data!.activities).toHaveLength(1)
    expect(result.data!.nextCursor).toBeNull()
  })

  it('passes cursor and skip when cursor is provided', async () => {
    mockActivityLogFindMany.mockResolvedValueOnce([])

    const { getWorkspaceActivity } = await import(
      '@/app/actions/workspace-activity'
    )
    await getWorkspaceActivity({}, 'cursor-id-123')

    expect(mockActivityLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'cursor-id-123' },
        skip: 1,
      })
    )
  })
})
