/**
 * Story 6.6: Task Modal Server Actions Tests
 * Tests for task modal CRUD operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import * as workspaceContext from '@/lib/auth/workspace-context'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    taskColumn: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    workspaceMember: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    activityLog: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    taskListItemLink: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    lawListItem: {
      findFirst: vi.fn(),
    },
  },
}))

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock workspace context
vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(),
}))

// Import after mocking
import {
  getTaskDetails,
  updateTaskTitle,
  updateTaskDescription,
  updateTaskStatusColumn,
  updateTaskAssignee,
  updateTaskDueDate,
  updateTaskPriority,
  createComment,
  updateComment,
  deleteComment,
  getTaskActivity,
  linkListItemToTask,
  unlinkListItemFromTask,
  deleteTaskModal,
} from '../task-modal'

describe('Task Modal Server Actions', () => {
  // Use valid v4 UUIDs for testing (variant must be 8,9,a,b in 4th group)
  const mockWorkspaceId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
  const mockUserId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
  const mockTaskId = 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f'

  // Full mock context matching WorkspaceContext interface
  const mockContext = {
    workspaceId: mockWorkspaceId,
    userId: mockUserId,
    workspaceName: 'Test Workspace',
    workspaceSlug: 'test-workspace',
    workspaceStatus: 'ACTIVE' as const,
    role: 'OWNER' as const,
    hasPermission: () => true,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default withWorkspace mock with full context
    vi.mocked(workspaceContext.withWorkspace).mockImplementation(async (fn) => {
      return fn(mockContext)
    })
  })

  describe('getTaskDetails', () => {
    it('should return task details when found', async () => {
      const mockTask = {
        id: mockTaskId,
        title: 'Test Task',
        description: 'Test description',
        column_id: 'col-1',
        priority: 'MEDIUM',
        column: {
          id: 'd4e5f6a7-b8c9-4d0e-8f2a-3b4c5d6e7f8a',
          name: 'To Do',
          color: '#ccc',
          is_done: false,
        },
        assignee: null,
        creator: {
          id: mockUserId,
          name: 'Test User',
          email: 'test@test.com',
          avatar_url: null,
        },
        list_item_links: [],
        comments: [],
        evidence: [],
        file_links: [],
        _count: { comments: 0, evidence: 0 },
      }

      vi.mocked(prisma.task.findFirst).mockResolvedValue(mockTask as never)

      const result = await getTaskDetails(mockTaskId)

      expect(result.success).toBe(true)
      expect(result.data?.title).toBe('Test Task')
    })

    it('should return error when task not found', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null)

      const result = await getTaskDetails(mockTaskId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Uppgiften hittades inte')
    })
  })

  describe('updateTaskTitle', () => {
    it('should update task title successfully', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        title: 'Old Title',
      } as never)
      vi.mocked(prisma.task.update).mockResolvedValue({} as never)
      vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never)

      const result = await updateTaskTitle(mockTaskId, 'New Title')

      expect(result.success).toBe(true)
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: mockTaskId },
        data: { title: 'New Title' },
      })
    })

    it('should return error for title too short', async () => {
      const result = await updateTaskTitle(mockTaskId, 'AB')

      expect(result.success).toBe(false)
      expect(result.error).toContain('minst 3')
    })
  })

  describe('updateTaskDescription', () => {
    it('should update task description successfully', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        description: 'Old description',
      } as never)
      vi.mocked(prisma.task.update).mockResolvedValue({} as never)
      vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never)

      const result = await updateTaskDescription(mockTaskId, 'New description')

      expect(result.success).toBe(true)
    })

    it('should allow null description', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        description: 'Old',
      } as never)
      vi.mocked(prisma.task.update).mockResolvedValue({} as never)
      vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never)

      const result = await updateTaskDescription(mockTaskId, null)

      expect(result.success).toBe(true)
    })
  })

  describe('updateTaskStatusColumn', () => {
    it('should update task column successfully', async () => {
      const columnId = 'e5f6a7b8-c9d0-4e1f-8a3b-4c5d6e7f8a9b'
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        column: { name: 'To Do' },
      } as never)
      vi.mocked(prisma.taskColumn.findFirst).mockResolvedValue({
        id: columnId,
        name: 'Done',
        is_done: true,
      } as never)
      vi.mocked(prisma.task.aggregate).mockResolvedValue({
        _max: { position: 2 },
      } as never)
      vi.mocked(prisma.task.update).mockResolvedValue({} as never)
      vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never)

      const result = await updateTaskStatusColumn(mockTaskId, columnId)

      expect(result.success).toBe(true)
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            column_id: columnId,
            position: 3,
          }),
        })
      )
    })
  })

  describe('updateTaskAssignee', () => {
    it('should update assignee successfully', async () => {
      const newAssigneeId = 'f6a7b8c9-d0e1-4f2a-8b4c-5d6e7f8a9b0c'
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        assignee: null,
      } as never)
      vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
        id: 'a7b8c9d0-e1f2-4a3b-8c5d-6e7f8a9b0c1d',
      } as never)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        name: 'New Assignee',
        email: 'new@test.com',
      } as never)
      vi.mocked(prisma.task.update).mockResolvedValue({} as never)
      vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never)

      const result = await updateTaskAssignee(mockTaskId, newAssigneeId)

      expect(result.success).toBe(true)
    })

    it('should allow unassigning (null)', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        assignee: { name: 'Old', email: 'old@test.com' },
      } as never)
      vi.mocked(prisma.task.update).mockResolvedValue({} as never)
      vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never)

      const result = await updateTaskAssignee(mockTaskId, null)

      expect(result.success).toBe(true)
    })
  })

  describe('updateTaskDueDate', () => {
    it('should update due date successfully', async () => {
      const newDate = new Date('2025-06-01')
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        due_date: null,
      } as never)
      vi.mocked(prisma.task.update).mockResolvedValue({} as never)
      vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never)

      const result = await updateTaskDueDate(mockTaskId, newDate)

      expect(result.success).toBe(true)
    })
  })

  describe('updateTaskPriority', () => {
    it('should update priority successfully', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        priority: 'MEDIUM',
      } as never)
      vi.mocked(prisma.task.update).mockResolvedValue({} as never)
      vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never)

      const result = await updateTaskPriority(mockTaskId, 'HIGH')

      expect(result.success).toBe(true)
    })
  })

  describe('createComment', () => {
    it('should create root comment successfully', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        id: mockTaskId,
      } as never)
      vi.mocked(prisma.comment.create).mockResolvedValue({
        id: 'b8c9d0e1-f2a3-4b4c-8d6e-7f8a9b0c1d2e',
        content: 'Test comment',
        author: {
          id: mockUserId,
          name: 'Test',
          email: 'test@test.com',
          avatar_url: null,
        },
      } as never)
      vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never)

      const result = await createComment(mockTaskId, 'Test comment')

      expect(result.success).toBe(true)
      expect(result.data?.content).toBe('Test comment')
    })

    it('should create reply to comment', async () => {
      const parentId = 'c9d0e1f2-a3b4-4c5d-8e7f-8a9b0c1d2e3f'
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        id: mockTaskId,
      } as never)
      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        depth: 0,
      } as never)
      vi.mocked(prisma.comment.create).mockResolvedValue({
        id: 'd0e1f2a3-b4c5-4d6e-8f8a-9b0c1d2e3f4a',
        content: 'Reply',
        parent_id: parentId,
        depth: 1,
        author: {
          id: mockUserId,
          name: 'Test',
          email: 'test@test.com',
          avatar_url: null,
        },
      } as never)
      vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never)

      const result = await createComment(mockTaskId, 'Reply', parentId)

      expect(result.success).toBe(true)
    })

    it('should reject replies exceeding max depth', async () => {
      const parentId = 'e1f2a3b4-c5d6-4e7f-8a9b-ac1d2e3f4a5b'
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        id: mockTaskId,
      } as never)
      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        depth: 2,
      } as never)

      const result = await createComment(mockTaskId, 'Too deep reply', parentId)

      expect(result.success).toBe(false)
      expect(result.error).toContain('3 nivåer')
    })
  })

  describe('updateComment', () => {
    it('should update own comment successfully', async () => {
      const commentId = 'f2a3b4c5-d6e7-4f8a-9b0c-ad2e3f4a5b6c'
      vi.mocked(prisma.comment.findFirst).mockResolvedValue({
        id: commentId,
        author_id: mockUserId,
      } as never)
      vi.mocked(prisma.comment.update).mockResolvedValue({} as never)

      const result = await updateComment(commentId, 'Updated content')

      expect(result.success).toBe(true)
    })

    it('should reject updating others comment', async () => {
      const commentId = 'a3b4c5d6-e7f8-4a9b-8c1d-2e3f4a5b6c7d'
      vi.mocked(prisma.comment.findFirst).mockResolvedValue(null)

      const result = await updateComment(commentId, 'Updated content')

      expect(result.success).toBe(false)
    })
  })

  describe('deleteComment', () => {
    it('should delete own comment successfully', async () => {
      const commentId = 'b4c5d6e7-f8a9-4b0c-8d2e-3f4a5b6c7d8e'
      vi.mocked(prisma.comment.findFirst).mockResolvedValue({
        id: commentId,
        author_id: mockUserId,
      } as never)
      vi.mocked(prisma.comment.delete).mockResolvedValue({} as never)

      const result = await deleteComment(commentId)

      expect(result.success).toBe(true)
    })
  })

  describe('getTaskActivity', () => {
    it('should return task activity log', async () => {
      const mockActivity = [
        {
          id: 'c5d6e7f8-a9b0-4c1d-8e3f-4a5b6c7d8e9f',
          action: 'title_updated',
          entity_type: 'task',
          entity_id: mockTaskId,
          old_value: { title: 'Old' },
          new_value: { title: 'New' },
          created_at: new Date(),
          user: {
            id: mockUserId,
            name: 'Test',
            email: 'test@test.com',
            avatar_url: null,
          },
        },
      ]
      vi.mocked(prisma.activityLog.findMany).mockResolvedValue(
        mockActivity as never
      )

      const result = await getTaskActivity(mockTaskId)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })
  })

  describe('linkListItemToTask', () => {
    it('should link list item to task successfully', async () => {
      const listItemId = 'd6e7f8a9-b0c1-4d2e-8f4a-5b6c7d8e9f0a'
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        id: mockTaskId,
      } as never)
      vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue({
        id: listItemId,
        document: { title: 'Test Law' },
      } as never)
      vi.mocked(prisma.taskListItemLink.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.taskListItemLink.create).mockResolvedValue({} as never)
      vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never)

      const result = await linkListItemToTask(mockTaskId, listItemId)

      expect(result.success).toBe(true)
    })

    it('should reject duplicate link', async () => {
      const listItemId = 'e7f8a9b0-c1d2-4e3f-8a5b-6c7d8e9f0a1b'
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        id: mockTaskId,
      } as never)
      vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue({
        id: listItemId,
        document: { title: 'Test Law' },
      } as never)
      vi.mocked(prisma.taskListItemLink.findFirst).mockResolvedValue({
        id: 'f8a9b0c1-d2e3-4f4a-8b6c-7d8e9f0a1b2c',
      } as never)

      const result = await linkListItemToTask(mockTaskId, listItemId)

      expect(result.success).toBe(false)
      expect(result.error).toContain('redan länkad')
    })
  })

  describe('unlinkListItemFromTask', () => {
    it('should unlink list item from task successfully', async () => {
      const listItemId = 'a9b0c1d2-e3f4-4a5b-8c7d-8e9f0a1b2c3d'
      vi.mocked(prisma.taskListItemLink.findFirst).mockResolvedValue({
        id: 'b0c1d2e3-f4a5-4b6c-8d8e-9f0a1b2c3d4e',
        task: { workspace_id: mockWorkspaceId },
        law_list_item: { document: { title: 'Test Law' } },
      } as never)
      vi.mocked(prisma.taskListItemLink.delete).mockResolvedValue({} as never)
      vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never)

      const result = await unlinkListItemFromTask(mockTaskId, listItemId)

      expect(result.success).toBe(true)
    })
  })

  describe('deleteTaskModal', () => {
    it('should delete task successfully', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        id: mockTaskId,
        title: 'Test Task',
      } as never)
      vi.mocked(prisma.task.delete).mockResolvedValue({} as never)
      vi.mocked(prisma.activityLog.create).mockResolvedValue({} as never)

      const result = await deleteTaskModal(mockTaskId)

      expect(result.success).toBe(true)
    })

    it('should return error when task not found', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null)

      const result = await deleteTaskModal(mockTaskId)

      expect(result.success).toBe(false)
      expect(result.error).toContain('hittades inte')
    })
  })
})
