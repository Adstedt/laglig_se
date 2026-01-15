/**
 * Story P.3: Optimized Query Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma
const mockPrisma = {
  lawListItem: {
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
    update: vi.fn(),
  },
  lawList: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  lawListGroup: {
    findMany: vi.fn(),
  },
  legalDocument: {
    findMany: vi.fn(),
  },
  workspace: {
    findUnique: vi.fn(),
  },
  workspaceMember: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  task: {
    count: vi.fn(),
  },
  taskColumn: {
    findMany: vi.fn(),
  },
  activityLog: {
    findMany: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  withRetry: vi.fn((fn) => fn()),
}))

describe('Optimized Law List Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getLawListItemsPaginated', () => {
    it('should use cursor-based pagination', async () => {
      mockPrisma.lawListItem.count.mockResolvedValue(100)
      mockPrisma.lawListItem.findMany.mockResolvedValue([
        {
          id: '1',
          status: 'NOT_STARTED',
          priority: 'MEDIUM',
          compliance_status: 'EJ_PABORJAD',
          position: 0,
          due_date: null,
          notes: null,
          commentary: null,
          document: {
            id: 'doc-1',
            title: 'Test Law',
            document_number: 'SFS 2020:1',
            slug: 'sfs-2020-1',
          },
          assignee: null,
          group: null,
        },
      ])

      const { getLawListItemsPaginated } = await import(
        '@/lib/db/queries/optimized/law-list'
      )

      const result = await getLawListItemsPaginated('list-1', {
        limit: 50,
      })

      expect(result.items).toHaveLength(1)
      expect(result.pagination.total).toBe(100)
      expect(mockPrisma.lawListItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 51, // limit + 1 for hasMore check
          orderBy: { position: 'asc' },
          select: expect.objectContaining({
            id: true,
            document: expect.any(Object),
          }),
        })
      )
    })

    it('should limit nesting to 2 levels', async () => {
      mockPrisma.lawListItem.count.mockResolvedValue(0)
      mockPrisma.lawListItem.findMany.mockResolvedValue([])

      const { getLawListItemsPaginated } = await import(
        '@/lib/db/queries/optimized/law-list'
      )

      await getLawListItemsPaginated('list-1')

      const call = mockPrisma.lawListItem.findMany.mock.calls[0]?.[0]
      const select = call?.select

      // Verify no deep nesting (level 1: document, assignee, group - no level 2 relations)
      expect(select?.document?.select).toBeDefined()
      expect(select?.document?.select?.id).toBe(true)
      // No nested includes beyond level 1
      expect(select?.document?.include).toBeUndefined()
    })

    it('should filter by status', async () => {
      mockPrisma.lawListItem.count.mockResolvedValue(10)
      mockPrisma.lawListItem.findMany.mockResolvedValue([])

      const { getLawListItemsPaginated } = await import(
        '@/lib/db/queries/optimized/law-list'
      )

      await getLawListItemsPaginated('list-1', {
        status: ['IN_PROGRESS', 'BLOCKED'],
      })

      expect(mockPrisma.lawListItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['IN_PROGRESS', 'BLOCKED'] },
          }),
        })
      )
    })
  })

  describe('getLawListSummaries', () => {
    it('should use parallel queries for compliance breakdown', async () => {
      mockPrisma.lawList.findMany.mockResolvedValue([
        {
          id: 'list-1',
          name: 'Main',
          description: null,
          is_default: true,
          _count: { items: 50 },
        },
        {
          id: 'list-2',
          name: 'Secondary',
          description: null,
          is_default: false,
          _count: { items: 20 },
        },
      ])
      mockPrisma.lawListItem.groupBy.mockResolvedValue([
        { compliance_status: 'UPPFYLLD', _count: 30 },
        { compliance_status: 'EJ_PABORJAD', _count: 20 },
      ])

      const { getLawListSummaries } = await import(
        '@/lib/db/queries/optimized/law-list'
      )

      const result = await getLawListSummaries('workspace-1')

      expect(result).toHaveLength(2)
      expect(result[0]?.itemCount).toBe(50)
      expect(result[0]?.complianceBreakdown.UPPFYLLD).toBe(30)
    })
  })

  describe('batchFetchDocuments', () => {
    it('should batch fetch documents to prevent N+1', async () => {
      mockPrisma.legalDocument.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          title: 'Law 1',
          document_number: 'SFS 1',
          slug: 's1',
          content_type: 'SFS_LAW',
          summary: null,
        },
        {
          id: 'doc-2',
          title: 'Law 2',
          document_number: 'SFS 2',
          slug: 's2',
          content_type: 'SFS_LAW',
          summary: null,
        },
      ])

      const { batchFetchDocuments } = await import(
        '@/lib/db/queries/optimized/law-list'
      )

      const result = await batchFetchDocuments(['doc-1', 'doc-2'])

      expect(mockPrisma.legalDocument.findMany).toHaveBeenCalledTimes(1)
      expect(mockPrisma.legalDocument.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['doc-1', 'doc-2'] } },
        select: expect.any(Object),
      })
      expect(result.size).toBe(2)
      expect(result.get('doc-1')?.title).toBe('Law 1')
    })

    it('should return empty map for empty input', async () => {
      const { batchFetchDocuments } = await import(
        '@/lib/db/queries/optimized/law-list'
      )

      const result = await batchFetchDocuments([])

      expect(mockPrisma.legalDocument.findMany).not.toHaveBeenCalled()
      expect(result.size).toBe(0)
    })
  })
})

describe('Optimized Workspace Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getWorkspaceOverview', () => {
    it('should use parallel queries for stats', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        name: 'Test Workspace',
        slug: 'test',
        status: 'ACTIVE',
        owner: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
      })
      mockPrisma.workspaceMember.count.mockResolvedValue(5)
      mockPrisma.lawList.count.mockResolvedValue(2)
      mockPrisma.lawList.findMany.mockResolvedValue([])
      mockPrisma.taskColumn.findMany.mockResolvedValue([])
      mockPrisma.task.count.mockResolvedValue(0)

      const { getWorkspaceOverview } = await import(
        '@/lib/db/queries/optimized/workspace'
      )

      const result = await getWorkspaceOverview('ws-1')

      expect(result?.name).toBe('Test Workspace')
      expect(result?.memberCount).toBe(5)
    })

    it('should return null for non-existent workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null)

      const { getWorkspaceOverview } = await import(
        '@/lib/db/queries/optimized/workspace'
      )

      const result = await getWorkspaceOverview('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('checkWorkspaceAccess', () => {
    it('should return hasAccess true for members', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue({
        role: 'MEMBER',
      })

      const { checkWorkspaceAccess } = await import(
        '@/lib/db/queries/optimized/workspace'
      )

      const result = await checkWorkspaceAccess('user-1', 'ws-1')

      expect(result.hasAccess).toBe(true)
      expect(result.role).toBe('MEMBER')
    })

    it('should return hasAccess false for non-members', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null)

      const { checkWorkspaceAccess } = await import(
        '@/lib/db/queries/optimized/workspace'
      )

      const result = await checkWorkspaceAccess('user-1', 'ws-1')

      expect(result.hasAccess).toBe(false)
      expect(result.role).toBeNull()
    })
  })
})

describe('Query Performance Characteristics', () => {
  it('should use select instead of include where possible', async () => {
    mockPrisma.lawListItem.count.mockResolvedValue(0)
    mockPrisma.lawListItem.findMany.mockResolvedValue([])

    const { getLawListItemsPaginated } = await import(
      '@/lib/db/queries/optimized/law-list'
    )

    await getLawListItemsPaginated('list-1')

    const call = mockPrisma.lawListItem.findMany.mock.calls[0]?.[0]

    // Verify using select (not include) for efficient field selection
    expect(call?.select).toBeDefined()
    expect(call?.include).toBeUndefined()
  })
})
