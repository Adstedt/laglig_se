/**
 * Story 3.3 + 3.10 + 3.15: AI Chat Server Actions Tests
 * Tests for chat message persistence, pagination, deletion, search, and
 * per-user scoping (Story 3.15).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test UUIDs for consistent test data (RFC 4122 compliant)
const TEST_WORKSPACE_ID = '11111111-1111-4111-a111-111111111111'
const TEST_USER_ID = '22222222-2222-4222-a222-222222222222'
// Story 3.15: second user in the same workspace for cross-user isolation tests
const TEST_USER_ID_B = '66666666-6666-4666-a666-666666666666'
const TEST_TASK_ID = '33333333-3333-4333-a333-333333333333'
const TEST_LAW_ID = '44444444-4444-4444-a444-444444444444'
const TEST_CHANGE_ID = '77777777-7777-4777-a777-777777777777'
const TEST_MSG_ID = '55555555-5555-4555-a555-555555555555'
const TEST_MSG_ID_B = '88888888-8888-4888-a888-888888888888'
const TEST_CURSOR_ID = '99999999-9999-4999-a999-999999999999'
const TEST_CONVERSATION_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'

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
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

// Mock workspace context — default returns User A; tests that need User B
// override via vi.mocked(withWorkspace).mockImplementationOnce(...)
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
import { withWorkspace } from '@/lib/auth/workspace-context'
import {
  saveChatMessage,
  saveChatMessages,
  getChatHistory,
  clearChatHistory,
  deleteChatMessage,
  searchConversations,
  archiveConversation,
  getConversationHistory,
  loadConversation,
} from '@/app/actions/ai-chat'

// Helper: swap the next withWorkspace call to simulate User B in the same workspace
function asUserB() {
  vi.mocked(withWorkspace).mockImplementationOnce(
    async (
      callback: (_ctx: {
        workspaceId: string
        userId: string
      }) => Promise<unknown>
    ) => {
      return callback({
        workspaceId: TEST_WORKSPACE_ID,
        userId: TEST_USER_ID_B,
      })
    }
  )
}

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
          expect.objectContaining({
            role: 'USER',
            content: 'Hello',
            user_id: TEST_USER_ID,
          }),
          expect.objectContaining({
            role: 'ASSISTANT',
            content: 'Hi there!',
            user_id: TEST_USER_ID,
          }),
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

    it('uses cursor to fetch older messages (cursor resolver scoped by user_id)', async () => {
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

      // Story 3.15: cursor resolver must filter by user_id to prevent timing oracle
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          id: TEST_MSG_ID,
          workspace_id: TEST_WORKSPACE_ID,
          user_id: TEST_USER_ID,
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

    it('filters by context ID for task context (with user_id scoping)', async () => {
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
            user_id: TEST_USER_ID,
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

    // Story 3.15 — per-user scoping coverage
    describe('per-user scoping (Story 3.15)', () => {
      it.each([
        ['GLOBAL', null],
        ['TASK', TEST_TASK_ID],
        ['LAW', TEST_LAW_ID],
        ['CHANGE', TEST_CHANGE_ID],
      ] as const)(
        'scopes %s-context reads to the calling user_id',
        async (contextType, contextId) => {
          const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
          mockFindMany.mockResolvedValue([])

          await getChatHistory({
            contextType,
            ...(contextId !== null ? { contextId } : {}),
          })

          expect(mockFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                workspace_id: TEST_WORKSPACE_ID,
                user_id: TEST_USER_ID,
                context_type: contextType,
              }),
            })
          )
        }
      )

      it('uses User-B user_id when invoked in User-B workspace context', async () => {
        const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
        mockFindMany.mockResolvedValue([])

        asUserB()
        await getChatHistory({ contextType: 'GLOBAL' })

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              workspace_id: TEST_WORKSPACE_ID,
              user_id: TEST_USER_ID_B,
            }),
          })
        )
      })

      it('cursor-resolver isolation: a cursor referencing User-B message as User A resolves to null (no timing oracle)', async () => {
        const mockFindFirst = vi.mocked(prisma.chatMessage.findFirst)
        const mockFindMany = vi.mocked(prisma.chatMessage.findMany)

        // Simulate User-B's cursor: findFirst returns null for User A because
        // the where clause includes user_id: TEST_USER_ID and the row belongs
        // to TEST_USER_ID_B. The mock enforces this: only return the cursor
        // date when the where filter includes user_id = TEST_USER_ID_B.
        mockFindFirst.mockImplementation(async (args) => {
          const where = (args as { where?: Record<string, unknown> })?.where
          if (where?.user_id === TEST_USER_ID_B) {
            return { created_at: new Date('2026-01-27T10:00:00') } as never
          }
          return null
        })
        mockFindMany.mockResolvedValue([])

        await getChatHistory({
          contextType: 'GLOBAL',
          cursor: TEST_CURSOR_ID, // User-B's message UUID
        })

        // Verify findFirst was called with User A's user_id (not User B's)
        expect(mockFindFirst).toHaveBeenCalledWith({
          where: {
            id: TEST_CURSOR_ID,
            workspace_id: TEST_WORKSPACE_ID,
            user_id: TEST_USER_ID,
          },
          select: { created_at: true },
        })

        // Since findFirst returns null for User A, the subsequent findMany
        // must NOT include a created_at: { lt: ... } filter
        const findManyCall = mockFindMany.mock.calls[0]?.[0] as {
          where?: { created_at?: unknown }
        }
        expect(findManyCall?.where?.created_at).toBeUndefined()
      })
    })
  })

  describe('deleteChatMessage', () => {
    it('deletes a message owned by the workspace and calling user', async () => {
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
          user_id: TEST_USER_ID,
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

    // Story 3.15
    it('rejects deletion of another user’s message with the same "Message not found" error (does not leak existence)', async () => {
      const mockFindFirst = vi.mocked(prisma.chatMessage.findFirst)
      const mockDelete = vi.mocked(prisma.chatMessage.delete)

      // Simulate: the message exists but belongs to User B. The findFirst
      // where includes user_id: TEST_USER_ID, so it returns null for User A.
      mockFindFirst.mockImplementation(async (args) => {
        const where = (args as { where?: Record<string, unknown> })?.where
        if (where?.user_id === TEST_USER_ID_B && where?.id === TEST_MSG_ID_B) {
          return { id: TEST_MSG_ID_B } as never
        }
        return null
      })

      const result = await deleteChatMessage(TEST_MSG_ID_B)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Message not found')
      // Critical: delete must NOT have been called
      expect(mockDelete).not.toHaveBeenCalled()
    })
  })

  describe('searchConversations', () => {
    it('returns matching conversations with snippets (user-scoped)', async () => {
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

      // Story 3.15: both findMany and count must include user_id
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspace_id: TEST_WORKSPACE_ID,
            user_id: TEST_USER_ID,
          }),
        })
      )
      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspace_id: TEST_WORKSPACE_ID,
            user_id: TEST_USER_ID,
          }),
        })
      )
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
    it('deletes messages for global context (user-scoped)', async () => {
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
          user_id: TEST_USER_ID,
          context_type: 'GLOBAL',
          context_id: null,
          conversation_id: null,
        },
      })
    })

    it('deletes messages for specific law context (user-scoped)', async () => {
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
          user_id: TEST_USER_ID,
          context_type: 'LAW',
          context_id: TEST_LAW_ID,
        },
      })
    })

    // Story 3.15
    it('User A cannot clear User B’s rows — deleteMany where always includes the caller’s user_id', async () => {
      const mockDeleteMany = vi.mocked(prisma.chatMessage.deleteMany)
      mockDeleteMany.mockResolvedValue({ count: 0 })

      asUserB()
      await clearChatHistory({ contextType: 'GLOBAL' })

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          user_id: TEST_USER_ID_B,
        }),
      })
    })
  })

  // Story 3.15 — archiveConversation coverage (not previously tested)
  describe('archiveConversation', () => {
    it('tags only the caller’s active GLOBAL rows with the new conversation_id', async () => {
      const mockUpdateMany = vi.mocked(prisma.chatMessage.updateMany)
      mockUpdateMany.mockResolvedValue({ count: 4 })

      const result = await archiveConversation()

      expect(result.success).toBe(true)
      expect(result.data?.conversationId).toBeTruthy()

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          workspace_id: TEST_WORKSPACE_ID,
          user_id: TEST_USER_ID,
          context_type: 'GLOBAL',
          conversation_id: null,
        },
        data: {
          conversation_id: expect.any(String),
        },
      })
    })

    it('User A and User B archive independently (each only tags their own rows)', async () => {
      const mockUpdateMany = vi.mocked(prisma.chatMessage.updateMany)
      mockUpdateMany.mockResolvedValue({ count: 2 })

      // User A archives
      await archiveConversation()
      // User B archives
      asUserB()
      await archiveConversation()

      expect(mockUpdateMany).toHaveBeenNthCalledWith(1, {
        where: expect.objectContaining({ user_id: TEST_USER_ID }),
        data: expect.any(Object),
      })
      expect(mockUpdateMany).toHaveBeenNthCalledWith(2, {
        where: expect.objectContaining({ user_id: TEST_USER_ID_B }),
        data: expect.any(Object),
      })
    })
  })

  // Story 3.15 — getConversationHistory raw SQL coverage (not previously tested)
  describe('getConversationHistory', () => {
    it('raw SQL query is invoked with workspace_id and user_id template parameters', async () => {
      const mockQueryRaw = vi.mocked(prisma.$queryRaw)
      mockQueryRaw.mockResolvedValue([])

      const result = await getConversationHistory()

      expect(result.success).toBe(true)
      expect(mockQueryRaw).toHaveBeenCalled()

      // Tagged-template values arrive as the function's rest args
      const callArgs = mockQueryRaw.mock.calls[0]
      expect(callArgs).toBeDefined()
      // The tagged template passes the template string array as the first arg,
      // and the interpolated values as rest args. Both workspace_id and
      // user_id must appear among those values.
      const interpolatedValues = (callArgs ?? []).slice(1)
      expect(interpolatedValues).toContain(TEST_WORKSPACE_ID)
      expect(interpolatedValues).toContain(TEST_USER_ID)
    })

    it('User B sees only their own conversations (raw SQL uses User-B user_id)', async () => {
      const mockQueryRaw = vi.mocked(prisma.$queryRaw)
      mockQueryRaw.mockResolvedValue([])

      asUserB()
      await getConversationHistory()

      const callArgs = mockQueryRaw.mock.calls[0]
      const interpolatedValues = (callArgs ?? []).slice(1)
      expect(interpolatedValues).toContain(TEST_USER_ID_B)
      expect(interpolatedValues).not.toContain(TEST_USER_ID)
    })
  })

  // Story 3.15 — loadConversation coverage (not previously tested)
  describe('loadConversation', () => {
    it('loads messages for a conversation scoped to the calling user', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      mockFindMany.mockResolvedValue([])

      await loadConversation(TEST_CONVERSATION_ID)

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspace_id: TEST_WORKSPACE_ID,
            user_id: TEST_USER_ID,
            conversation_id: TEST_CONVERSATION_ID,
          },
          orderBy: { created_at: 'asc' },
          select: expect.any(Object),
        })
      )
    })

    it('User A cannot load a conversation whose rows belong to User B', async () => {
      const mockFindMany = vi.mocked(prisma.chatMessage.findMany)
      // Even if User A knows User B's conversation_id, the where filter on
      // user_id: TEST_USER_ID causes Prisma to return zero rows.
      mockFindMany.mockImplementation(async (args) => {
        const where = (args as { where?: Record<string, unknown> })?.where
        if (where?.user_id === TEST_USER_ID_B) {
          // Simulate rows existing — but since User A is calling, the filter
          // excludes them
          return [] as never
        }
        return [] as never
      })

      const result = await loadConversation(TEST_CONVERSATION_ID)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(0)
      // Verify the where used User A's user_id, NOT User B's
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_id: TEST_USER_ID,
          }),
        })
      )
    })
  })
})
