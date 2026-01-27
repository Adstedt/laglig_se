/**
 * Story 3.3 Task 6: AI Chat Server Actions Tests
 * Tests for chat message persistence functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test UUIDs for consistent test data (RFC 4122 compliant)
// Format: xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx where M=version (1-8), N=variant (8,9,a,b)
const TEST_WORKSPACE_ID = '11111111-1111-4111-a111-111111111111'
const TEST_USER_ID = '22222222-2222-4222-a222-222222222222'
const TEST_TASK_ID = '33333333-3333-4333-a333-333333333333'
const TEST_LAW_ID = '44444444-4444-4444-a444-444444444444'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    chatMessage: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

// Mock workspace context
vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(
    async (
      callback: (_ctx: {
        workspaceId: string
        userId: string
      }) => Promise<unknown>
    ) => {
      return callback({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID,
      })
    }
  ),
}))

// Import after mocks
import { prisma } from '@/lib/prisma'
import {
  saveChatMessage,
  saveChatMessages,
  getChatHistory,
  clearChatHistory,
} from '@/app/actions/ai-chat'

describe('AI Chat Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveChatMessage', () => {
    it('saves a user message with correct data', async () => {
      const mockCreate = vi.mocked(prisma.chatMessage.create)
      mockCreate.mockResolvedValue({
        id: 'msg-1',
        workspace_id: TEST_WORKSPACE_ID,
        user_id: TEST_USER_ID,
        role: 'USER',
        content: 'What is arbetsmiljölagen?',
        context_type: 'GLOBAL',
        context_id: null,
        created_at: new Date(),
      })

      const result = await saveChatMessage({
        role: 'USER',
        content: 'What is arbetsmiljölagen?',
        contextType: 'GLOBAL',
      })

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('msg-1')
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspace_id: TEST_WORKSPACE_ID,
          user_id: TEST_USER_ID,
          role: 'USER',
          content: 'What is arbetsmiljölagen?',
          context_type: 'GLOBAL',
          context_id: null,
        }),
        select: { id: true },
      })
    })

    it('saves an assistant message with task context', async () => {
      const mockCreate = vi.mocked(prisma.chatMessage.create)
      mockCreate.mockResolvedValue({
        id: 'msg-2',
        workspace_id: TEST_WORKSPACE_ID,
        user_id: TEST_USER_ID,
        role: 'ASSISTANT',
        content: 'Arbetsmiljölagen reglerar...',
        context_type: 'TASK',
        context_id: TEST_TASK_ID,
        created_at: new Date(),
      })

      const result = await saveChatMessage({
        role: 'ASSISTANT',
        content: 'Arbetsmiljölagen reglerar...',
        contextType: 'TASK',
        contextId: TEST_TASK_ID,
      })

      expect(result.success).toBe(true)
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          context_type: 'TASK',
          context_id: TEST_TASK_ID,
        }),
        select: { id: true },
      })
    })

    it('validates content length', async () => {
      const result = await saveChatMessage({
        role: 'USER',
        content: '', // Empty content
        contextType: 'GLOBAL',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid input')
    })

    it('validates context type enum', async () => {
      const result = await saveChatMessage({
        role: 'USER',
        content: 'Hello',
        contextType: 'INVALID' as 'GLOBAL',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid input')
    })
  })

  describe('saveChatMessages', () => {
    it('saves multiple messages in batch', async () => {
      const mockCreateMany = vi.mocked(prisma.chatMessage.createMany)
      mockCreateMany.mockResolvedValue({ count: 2 })

      const result = await saveChatMessages([
        { role: 'USER', content: 'Hello', contextType: 'GLOBAL' },
        { role: 'ASSISTANT', content: 'Hi there!', contextType: 'GLOBAL' },
      ])

      expect(result.success).toBe(true)
      expect(result.data?.count).toBe(2)
      expect(mockCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ role: 'USER', content: 'Hello' }),
          expect.objectContaining({ role: 'ASSISTANT', content: 'Hi there!' }),
        ]),
      })
    })
  })

  describe('getChatHistory', () => {
    it('returns messages in chronological order', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'USER' as const,
          content: 'First message',
          context_type: 'GLOBAL' as const,
          context_id: null,
          created_at: new Date('2026-01-27T10:00:00'),
        },
        {
          id: 'msg-2',
          role: 'ASSISTANT' as const,
          content: 'Second message',
          context_type: 'GLOBAL' as const,
          context_id: null,
          created_at: new Date('2026-01-27T10:01:00'),
        },
      ]
      mockFindMany.mockResolvedValue(mockMessages)

      const result = await getChatHistory({
        contextType: 'GLOBAL',
        limit: 50,
      })

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.data?.[0].content).toBe('First message')
      expect(result.data?.[1].content).toBe('Second message')
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          workspace_id: TEST_WORKSPACE_ID,
          context_type: 'GLOBAL',
          context_id: null,
        },
        orderBy: { created_at: 'asc' },
        take: 50,
        select: expect.any(Object),
      })
    })

    it('filters by context ID for task context', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      mockFindMany.mockResolvedValue([])

      await getChatHistory({
        contextType: 'TASK',
        contextId: TEST_TASK_ID,
        limit: 20,
      })

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          workspace_id: TEST_WORKSPACE_ID,
          context_type: 'TASK',
          context_id: TEST_TASK_ID,
        },
        orderBy: { created_at: 'asc' },
        take: 20,
        select: expect.any(Object),
      })
    })

    it('uses default limit of 50', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      mockFindMany.mockResolvedValue([])

      await getChatHistory({
        contextType: 'GLOBAL',
      })

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      )
    })
  })

  describe('clearChatHistory', () => {
    it('deletes messages for global context', async () => {
      const mockDeleteMany = vi.mocked(prisma.chatMessage.deleteMany)
      mockDeleteMany.mockResolvedValue({ count: 5 })

      const result = await clearChatHistory({
        contextType: 'GLOBAL',
      })

      expect(result.success).toBe(true)
      expect(result.data?.deleted).toBe(5)
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: {
          workspace_id: TEST_WORKSPACE_ID,
          context_type: 'GLOBAL',
          context_id: null,
        },
      })
    })

    it('deletes messages for specific law context', async () => {
      const mockDeleteMany = vi.mocked(prisma.chatMessage.deleteMany)
      mockDeleteMany.mockResolvedValue({ count: 3 })

      const result = await clearChatHistory({
        contextType: 'LAW',
        contextId: TEST_LAW_ID,
      })

      expect(result.success).toBe(true)
      expect(result.data?.deleted).toBe(3)
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: {
          workspace_id: TEST_WORKSPACE_ID,
          context_type: 'LAW',
          context_id: TEST_LAW_ID,
        },
      })
    })
  })
})
