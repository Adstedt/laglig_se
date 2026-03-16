/**
 * Story 3.3 + 3.10: AI Chat Server Actions Tests
 * Tests for chat message persistence, pagination, deletion, and search.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test UUIDs for consistent test data (RFC 4122 compliant)
const TEST_WORKSPACE_ID = '11111111-1111-4111-a111-111111111111'
const TEST_USER_ID = '22222222-2222-4222-a222-222222222222'
const TEST_TASK_ID = '33333333-3333-4333-a333-333333333333'
const TEST_LAW_ID = '44444444-4444-4444-a444-444444444444'
const TEST_MSG_ID = '55555555-5555-4555-a555-555555555555'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    chatMessage: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
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
  deleteChatMessage,
  searchConversations,
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
    it('returns messages with nextCursor when more pages exist', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      // Return limit+1 messages to indicate hasMore
      const mockMessages = Array.from({ length: 31 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'USER' as const,
        content: `Message ${i}`,
        metadata: null,
        context_type: 'GLOBAL' as const,
        context_id: null,
        created_at: new Date(
          `2026-01-27T${String(10 + i).padStart(2, '0')}:00:00`
        ),
      }))
      // Prisma returns in desc order, the function reverses
      mockFindMany.mockResolvedValue(mockMessages)

      const result = await getChatHistory({
        contextType: 'GLOBAL',
      })

      expect(result.success).toBe(true)
      // Should have 30 messages (popped the extra one)
      expect(result.data?.messages).toHaveLength(30)
      // nextCursor should be the first message ID (oldest)
      expect(result.data?.nextCursor).toBeTruthy()
    })

    it('returns nextCursor as null when fewer messages than limit', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'USER' as const,
          content: 'First message',
          metadata: null,
          context_type: 'GLOBAL' as const,
          context_id: null,
          created_at: new Date('2026-01-27T10:00:00'),
        },
        {
          id: 'msg-2',
          role: 'ASSISTANT' as const,
          content: 'Second message',
          metadata: null,
          context_type: 'GLOBAL' as const,
          context_id: null,
          created_at: new Date('2026-01-27T10:01:00'),
        },
      ]
      mockFindMany.mockResolvedValue(mockMessages)

      const result = await getChatHistory({
        contextType: 'GLOBAL',
      })

      expect(result.success).toBe(true)
      expect(result.data?.messages).toHaveLength(2)
      expect(result.data?.nextCursor).toBeNull()
    })

    it('returns empty result when no messages', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      mockFindMany.mockResolvedValue([])

      const result = await getChatHistory({
        contextType: 'GLOBAL',
      })

      expect(result.success).toBe(true)
      expect(result.data?.messages).toHaveLength(0)
      expect(result.data?.nextCursor).toBeNull()
    })

    it('uses cursor to fetch older messages', async () => {
      const mockFindFirst = vi.mocked(prisma.chatMessage.findFirst)
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      const cursorDate = new Date('2026-01-27T10:15:00')

      mockFindFirst.mockResolvedValue({
        created_at: cursorDate,
      } as never)
      mockFindMany.mockResolvedValue([])

      await getChatHistory({
        contextType: 'GLOBAL',
        cursor: TEST_MSG_ID,
      })

      // Should have looked up cursor's created_at
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          id: TEST_MSG_ID,
          workspace_id: TEST_WORKSPACE_ID,
        },
        select: { created_at: true },
      })

      // Should query with created_at lt filter
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            created_at: { lt: cursorDate },
          }),
        })
      )
    })

    it('filters by context ID for task context', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      mockFindMany.mockResolvedValue([])

      await getChatHistory({
        contextType: 'TASK',
        contextId: TEST_TASK_ID,
        limit: 20,
      })

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspace_id: TEST_WORKSPACE_ID,
            context_type: 'TASK',
            context_id: TEST_TASK_ID,
          }),
          take: 21, // limit + 1
        })
      )
    })

    it('uses default limit of 30', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      mockFindMany.mockResolvedValue([])

      await getChatHistory({
        contextType: 'GLOBAL',
      })

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 31, // default 30 + 1
        })
      )
    })
  })

  describe('deleteChatMessage', () => {
    it('deletes a message owned by the workspace', async () => {
      const mockFindFirst = vi.mocked(prisma.chatMessage.findFirst)
      const mockDelete = vi.mocked(prisma.chatMessage.delete)

      mockFindFirst.mockResolvedValue({
        id: TEST_MSG_ID,
      } as never)
      mockDelete.mockResolvedValue({} as never)

      const result = await deleteChatMessage(TEST_MSG_ID)

      expect(result.success).toBe(true)
      expect(result.data?.deleted).toBe(true)
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          id: TEST_MSG_ID,
          workspace_id: TEST_WORKSPACE_ID,
        },
        select: { id: true },
      })
      expect(mockDelete).toHaveBeenCalledWith({
        where: { id: TEST_MSG_ID },
      })
    })

    it('rejects deletion of message from another workspace', async () => {
      const mockFindFirst = vi.mocked(prisma.chatMessage.findFirst)
      mockFindFirst.mockResolvedValue(null)

      const result = await deleteChatMessage(TEST_MSG_ID)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Message not found')
    })

    it('validates message ID format', async () => {
      const result = await deleteChatMessage('not-a-uuid')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid message ID')
    })
  })

  describe('searchConversations', () => {
    it('returns matching conversations with snippets', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      const mockCount = vi.mocked(prisma.chatMessage.count)

      mockFindMany.mockResolvedValue([
        {
          id: 'msg-1',
          content: 'This is about arbetsmiljölagen and safety',
          conversation_id: 'conv-1',
          created_at: new Date('2026-01-27T10:00:00'),
        },
      ] as never)
      mockCount.mockResolvedValue(5)

      const result = await searchConversations('arbetsmiljö')

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.data?.[0]?.conversationId).toBe('conv-1')
      expect(result.data?.[0]?.snippet).toContain('arbetsmiljölagen')
      expect(result.data?.[0]?.messageCount).toBe(5)
    })

    it('returns empty array when no matches', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      mockFindMany.mockResolvedValue([])

      const result = await searchConversations('nonexistent query')

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(0)
    })

    it('validates empty query', async () => {
      const result = await searchConversations('')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid search query')
    })

    it('searches with case-insensitive Prisma contains', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      mockFindMany.mockResolvedValue([])

      await searchConversations('test query')

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            content: {
              contains: 'test query',
              mode: 'insensitive',
            },
          }),
        })
      )
    })

    it('truncates snippet to 120 characters', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      const mockCount = vi.mocked(prisma.chatMessage.count)

      const longContent = 'a'.repeat(100) + 'keyword' + 'b'.repeat(100)
      mockFindMany.mockResolvedValue([
        {
          id: 'msg-1',
          content: longContent,
          conversation_id: null,
          created_at: new Date(),
        },
      ] as never)
      mockCount.mockResolvedValue(1)

      const result = await searchConversations('keyword')

      expect(result.success).toBe(true)
      // Snippet should be around 120 chars (+ ellipsis characters)
      const snippet = result.data?.[0]?.snippet ?? ''
      expect(snippet.length).toBeLessThanOrEqual(125)
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
          conversation_id: null,
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
