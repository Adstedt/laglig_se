/**
 * Unit tests for tasks server actions
 * Story P.1: Emergency Performance Fixes - Task Pagination
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getWorkspaceTasksPaginated, type TaskPaginationOptions } from '../tasks'
import { prisma } from '@/lib/prisma'
import * as workspaceContext from '@/lib/auth/workspace-context'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    taskColumn: {
      findMany: vi.fn(),
    },
    taskListItemLink: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(),
}))

describe('tasks actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getWorkspaceTasksPaginated', () => {
    const mockColumns = [
      { id: 'col-1', is_done: false, position: 0 }, // Open
      { id: 'col-2', is_done: false, position: 1 }, // In Progress
      { id: 'col-3', is_done: true, position: 2 },  // Done
    ]

    const mockTasks = [
      {
        id: 'task-1',
        title: 'Test Task 1',
        description: 'Description 1',
        column_id: 'col-1',
        position: 1,
        priority: 'MEDIUM',
        due_date: null,
        assignee_id: 'user-1',
        created_by: 'user-2',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        completed_at: null,
        workspace_id: 'workspace-001',
        column: {
          id: 'col-1',
          name: 'To Do',
          color: '#FF0000',
          is_done: false,
        },
        assignee: {
          id: 'user-1',
          name: 'Alice',
          email: 'alice@example.com',
          avatar_url: null,
        },
        creator: {
          id: 'user-2',
          name: 'Bob',
          email: 'bob@example.com',
        },
        _count: {
          comments: 3,
        },
      },
      {
        id: 'task-2',
        title: 'Test Task 2',
        description: 'Description 2',
        column_id: 'col-2',
        position: 2,
        priority: 'HIGH',
        due_date: new Date('2024-12-31'),
        assignee_id: null,
        created_by: 'user-2',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        completed_at: null,
        workspace_id: 'workspace-001',
        column: {
          id: 'col-2',
          name: 'In Progress',
          color: '#00FF00',
          is_done: false,
        },
        assignee: null,
        creator: {
          id: 'user-2',
          name: 'Bob',
          email: 'bob@example.com',
        },
        _count: {
          comments: 0,
        },
      },
    ]

    it('should fetch paginated tasks with default pagination (page 1, limit 50)', async () => {
      // Mock withWorkspace to execute the callback
      vi.mocked(workspaceContext.withWorkspace).mockImplementation(async (callback) => {
        return callback({
          workspaceId: 'workspace-001',
          userId: 'user-123',
          workspaceName: 'Test Workspace',
          workspaceSlug: 'test-workspace',
          workspaceStatus: 'ACTIVE' as any,
          role: 'OWNER' as any,
          hasPermission: () => true
        })
      })

      // Mock Prisma queries
      vi.mocked(prisma.taskColumn.findMany).mockResolvedValue(mockColumns as any)
      vi.mocked(prisma.task.count).mockResolvedValue(100)
      vi.mocked(prisma.task.findMany).mockResolvedValue(mockTasks as any)
      vi.mocked(prisma.taskListItemLink.findMany).mockResolvedValue([])

      // Call the function without pagination options
      const result = await getWorkspaceTasksPaginated()

      // Assertions
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.tasks).toHaveLength(2)
      expect(result.data?.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 100,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      })

      // Verify Prisma queries
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 0,
          orderBy: { position: 'asc' },
        })
      )
    })

    it('should respect custom pagination options', async () => {
      // Mock withWorkspace to execute the callback
      vi.mocked(workspaceContext.withWorkspace).mockImplementation(async (callback) => {
        return callback({
          workspaceId: 'workspace-001',
          userId: 'user-123',
          workspaceName: 'Test Workspace',
          workspaceSlug: 'test-workspace',
          workspaceStatus: 'ACTIVE' as any,
          role: 'OWNER' as any,
          hasPermission: () => true
        })
      })

      // Mock Prisma queries
      vi.mocked(prisma.taskColumn.findMany).mockResolvedValue(mockColumns as any)
      vi.mocked(prisma.task.count).mockResolvedValue(150)
      vi.mocked(prisma.task.findMany).mockResolvedValue(mockTasks as any)
      vi.mocked(prisma.taskListItemLink.findMany).mockResolvedValue([])

      // Custom pagination options
      const pagination: TaskPaginationOptions = {
        page: 3,
        limit: 25,
      }

      // Call the function with custom pagination
      const result = await getWorkspaceTasksPaginated(undefined, pagination)

      // Assertions
      expect(result.success).toBe(true)
      expect(result.data?.pagination).toEqual({
        page: 3,
        limit: 25,
        total: 150,
        totalPages: 6,
        hasNext: true,
        hasPrev: true,
      })

      // Verify Prisma was called with correct skip/take
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
          skip: 50, // (page 3 - 1) * 25
        })
      )
    })

    it('should enforce maximum limit of 100 items per page', async () => {
      // Mock withWorkspace to execute the callback
      vi.mocked(workspaceContext.withWorkspace).mockImplementation(async (callback) => {
        return callback({
          workspaceId: 'workspace-001',
          userId: 'user-123',
          workspaceName: 'Test Workspace',
          workspaceSlug: 'test-workspace',
          workspaceStatus: 'ACTIVE' as any,
          role: 'OWNER' as any,
          hasPermission: () => true
        })
      })

      // Mock Prisma queries
      vi.mocked(prisma.taskColumn.findMany).mockResolvedValue(mockColumns as any)
      vi.mocked(prisma.task.count).mockResolvedValue(500)
      vi.mocked(prisma.task.findMany).mockResolvedValue([])
      vi.mocked(prisma.taskListItemLink.findMany).mockResolvedValue([])

      // Try to request more than 100 items
      const pagination: TaskPaginationOptions = {
        page: 1,
        limit: 200, // Over the maximum
      }

      // Call the function
      const result = await getWorkspaceTasksPaginated(undefined, pagination)

      // Assertions
      expect(result.success).toBe(true)
      expect(result.data?.pagination.limit).toBe(100) // Should be capped at 100

      // Verify Prisma was called with max limit
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // Capped at maximum
        })
      )
    })

    it('should handle empty results gracefully', async () => {
      // Mock withWorkspace to execute the callback
      vi.mocked(workspaceContext.withWorkspace).mockImplementation(async (callback) => {
        return callback({
          workspaceId: 'workspace-001',
          userId: 'user-123',
          workspaceName: 'Test Workspace',
          workspaceSlug: 'test-workspace',
          workspaceStatus: 'ACTIVE' as any,
          role: 'OWNER' as any,
          hasPermission: () => true
        })
      })

      // Mock Prisma queries for empty results
      vi.mocked(prisma.taskColumn.findMany).mockResolvedValue(mockColumns as any)
      vi.mocked(prisma.task.count).mockResolvedValue(0)
      vi.mocked(prisma.task.findMany).mockResolvedValue([])
      vi.mocked(prisma.taskListItemLink.findMany).mockResolvedValue([])

      // Call the function
      const result = await getWorkspaceTasksPaginated()

      // Assertions
      expect(result.success).toBe(true)
      expect(result.data?.tasks).toHaveLength(0)
      expect(result.data?.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      })
    })

    it('should fetch linked law items separately (lazy loading)', async () => {
      // Mock withWorkspace to execute the callback
      vi.mocked(workspaceContext.withWorkspace).mockImplementation(async (callback) => {
        return callback({
          workspaceId: 'workspace-001',
          userId: 'user-123',
          workspaceName: 'Test Workspace',
          workspaceSlug: 'test-workspace',
          workspaceStatus: 'ACTIVE' as any,
          role: 'OWNER' as any,
          hasPermission: () => true
        })
      })

      const mockListItemLinks = [
        {
          task_id: 'task-1',
          law_list_item: {
            id: 'item-1',
            document: {
              title: 'Labor Law 2024',
              document_number: 'SFS 2024:123',
            },
          },
        },
      ]

      // Mock Prisma queries
      vi.mocked(prisma.taskColumn.findMany).mockResolvedValue(mockColumns as any)
      vi.mocked(prisma.task.count).mockResolvedValue(2)
      vi.mocked(prisma.task.findMany).mockResolvedValue(mockTasks as any)
      vi.mocked(prisma.taskListItemLink.findMany).mockResolvedValue(mockListItemLinks as any)

      // Call the function
      const result = await getWorkspaceTasksPaginated()

      // Assertions
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      if (result.data && result.data.tasks.length >= 2) {
        expect(result.data.tasks[0].list_item_links).toHaveLength(1)
        const firstLink = result.data.tasks[0].list_item_links[0]
        if (firstLink) {
          expect(firstLink.law_list_item.document.title).toBe('Labor Law 2024')
        }
        expect(result.data.tasks[1].list_item_links).toHaveLength(0) // No links for task-2
      }

      // Verify lazy loading query was made
      expect(prisma.taskListItemLink.findMany).toHaveBeenCalledWith({
        where: { task_id: { in: ['task-1', 'task-2'] } },
        take: 2,
        include: expect.any(Object),
      })
    })

    it('should handle database errors gracefully', async () => {
      // Mock withWorkspace to throw an error
      vi.mocked(workspaceContext.withWorkspace).mockRejectedValue(
        new Error('Database connection failed')
      )

      // Call the function
      const result = await getWorkspaceTasksPaginated()

      // Assertions
      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
    })

    it('should correctly calculate last page pagination', async () => {
      // Mock withWorkspace to execute the callback
      vi.mocked(workspaceContext.withWorkspace).mockImplementation(async (callback) => {
        return callback({
          workspaceId: 'workspace-001',
          userId: 'user-123',
          workspaceName: 'Test Workspace',
          workspaceSlug: 'test-workspace',
          workspaceStatus: 'ACTIVE' as any,
          role: 'OWNER' as any,
          hasPermission: () => true
        })
      })

      // Mock Prisma queries
      vi.mocked(prisma.taskColumn.findMany).mockResolvedValue(mockColumns as any)
      vi.mocked(prisma.task.count).mockResolvedValue(123) // Odd number for testing
      vi.mocked(prisma.task.findMany).mockResolvedValue([mockTasks[0]] as any) // Single task on last page
      vi.mocked(prisma.taskListItemLink.findMany).mockResolvedValue([])

      // Request last page
      const pagination: TaskPaginationOptions = {
        page: 3, // Last page with limit 50 (123 total / 50 = 3 pages)
        limit: 50,
      }

      // Call the function
      const result = await getWorkspaceTasksPaginated(undefined, pagination)

      // Assertions
      expect(result.success).toBe(true)
      expect(result.data?.pagination).toEqual({
        page: 3,
        limit: 50,
        total: 123,
        totalPages: 3,
        hasNext: false, // No next page
        hasPrev: true,  // Has previous page
      })
    })
  })
})