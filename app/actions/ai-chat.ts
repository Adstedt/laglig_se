'use server'

/**
 * Story 3.3 + 14.11: AI Chat Server Actions
 * Server actions for chat message persistence and conversation management.
 *
 * Provides:
 * - saveChatMessage: Store a message to the database
 * - getChatHistory: Load chat history for a context
 * - clearChatHistory: Clear chat history for a context
 * - archiveConversation: Tag active GLOBAL messages with a conversation_id (Story 14.11)
 * - getConversationHistory: List archived conversations (Story 14.11)
 * - loadConversation: Load messages for a specific conversation (Story 14.11)
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { z } from 'zod'
import type { ChatMessageRole, ChatContextType } from '@prisma/client'

// ============================================================================
// Action Result Type
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// Validation Schemas
// ============================================================================

const chatContextTypeSchema = z.enum(['GLOBAL', 'TASK', 'LAW', 'CHANGE'])

// Context IDs can be UUIDs (law list items, tasks) or CUIDs (change events)
const contextIdSchema = z.string().min(1).max(128)

const saveChatMessageSchema = z.object({
  role: z.enum(['USER', 'ASSISTANT']),
  content: z.string().min(1).max(50000), // Allow up to 50K chars for AI responses
  metadata: z.record(z.string(), z.unknown()).optional(), // Citation sources, tool results, etc.
  contextType: chatContextTypeSchema,
  contextId: contextIdSchema.optional(),
})

const getChatHistorySchema = z.object({
  contextType: chatContextTypeSchema,
  contextId: contextIdSchema.optional(),
  limit: z.number().min(1).max(100).optional().default(30),
  cursor: z.string().uuid().optional(),
})

const clearChatHistorySchema = z.object({
  contextType: chatContextTypeSchema,
  contextId: contextIdSchema.optional(),
})

// ============================================================================
// Types
// ============================================================================

export interface ChatMessageData {
  id: string
  role: ChatMessageRole
  content: string
  metadata: Record<string, unknown> | null
  contextType: ChatContextType
  contextId: string | null
  createdAt: Date
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Save a chat message to the database.
 * Scoped to the current workspace.
 */
export async function saveChatMessage(
  input: z.infer<typeof saveChatMessageSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const validated = saveChatMessageSchema.parse(input)

    return await withWorkspace(async (ctx) => {
      const message = await prisma.chatMessage.create({
        data: {
          workspace_id: ctx.workspaceId,
          user_id: ctx.userId,
          role: validated.role,
          content: validated.content,
          metadata: validated.metadata
            ? (validated.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          context_type: validated.contextType,
          context_id: validated.contextId ?? null,
        },
        select: { id: true },
      })

      return { success: true, data: { id: message.id } }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input: ' + error.message }
    }
    console.error('Error saving chat message:', error)
    return { success: false, error: 'Failed to save message' }
  }
}

/**
 * Save multiple chat messages at once (batch operation).
 * Useful for persisting a conversation after it ends.
 */
export async function saveChatMessages(
  messages: Array<{
    role: 'USER' | 'ASSISTANT'
    content: string
    contextType: 'GLOBAL' | 'TASK' | 'LAW' | 'CHANGE'
    contextId?: string | undefined
  }>
): Promise<ActionResult<{ count: number }>> {
  try {
    // Validate all messages
    const validated = messages.map((msg) => saveChatMessageSchema.parse(msg))

    return await withWorkspace(async (ctx) => {
      const result = await prisma.chatMessage.createMany({
        data: validated.map((msg) => ({
          workspace_id: ctx.workspaceId,
          user_id: ctx.userId,
          role: msg.role,
          content: msg.content,
          context_type: msg.contextType,
          context_id: msg.contextId ?? null,
        })),
      })

      return { success: true, data: { count: result.count } }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input: ' + error.message }
    }
    console.error('Error saving chat messages:', error)
    return { success: false, error: 'Failed to save messages' }
  }
}

/**
 * Get chat history for a specific context.
 * Returns messages in chronological order (oldest first) with cursor-based pagination.
 * When a cursor is provided, fetches messages older than that cursor.
 */
export async function getChatHistory(
  input: z.infer<typeof getChatHistorySchema>
): Promise<
  ActionResult<{ messages: ChatMessageData[]; nextCursor: string | null }>
> {
  try {
    const validated = getChatHistorySchema.parse(input)

    return await withWorkspace(async (ctx) => {
      // If cursor provided, look up its created_at for the range query
      let cursorDate: Date | undefined
      if (validated.cursor) {
        const cursorMsg = await prisma.chatMessage.findFirst({
          where: {
            id: validated.cursor,
            workspace_id: ctx.workspaceId,
          },
          select: { created_at: true },
        })
        if (cursorMsg) {
          cursorDate = cursorMsg.created_at
        }
      }

      const messages = await prisma.chatMessage.findMany({
        where: {
          workspace_id: ctx.workspaceId,
          context_type: validated.contextType,
          context_id: validated.contextId ?? null,
          // Only fetch active (non-archived) messages for GLOBAL context
          ...(validated.contextType === 'GLOBAL'
            ? { conversation_id: null }
            : {}),
          // Cursor: fetch messages older than cursor
          ...(cursorDate ? { created_at: { lt: cursorDate } } : {}),
        },
        orderBy: { created_at: 'desc' },
        take: validated.limit + 1, // Fetch one extra to detect hasMore
        select: {
          id: true,
          role: true,
          content: true,
          metadata: true,
          context_type: true,
          context_id: true,
          created_at: true,
        },
      })

      const hasMore = messages.length > validated.limit
      if (hasMore) messages.pop()

      // Reverse to chronological order (oldest first)
      messages.reverse()

      const data: ChatMessageData[] = messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata as Record<string, unknown> | null,
        contextType: msg.context_type,
        contextId: msg.context_id,
        createdAt: msg.created_at,
      }))

      return {
        success: true,
        data: {
          messages: data,
          nextCursor: hasMore && data.length > 0 ? (data[0]?.id ?? null) : null,
        },
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input: ' + error.message }
    }
    console.error('Error getting chat history:', error)
    return { success: false, error: 'Failed to get chat history' }
  }
}

/**
 * Clear chat history for a specific context.
 * Deletes all messages for the given context type and ID.
 */
export async function clearChatHistory(
  input: z.infer<typeof clearChatHistorySchema>
): Promise<ActionResult<{ deleted: number }>> {
  try {
    const validated = clearChatHistorySchema.parse(input)

    return await withWorkspace(async (ctx) => {
      const result = await prisma.chatMessage.deleteMany({
        where: {
          workspace_id: ctx.workspaceId,
          context_type: validated.contextType,
          context_id: validated.contextId ?? null,
          // For GLOBAL context, only delete active (non-archived) messages
          // to preserve archived conversations
          ...(validated.contextType === 'GLOBAL'
            ? { conversation_id: null }
            : {}),
        },
      })

      return { success: true, data: { deleted: result.count } }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input: ' + error.message }
    }
    console.error('Error clearing chat history:', error)
    return { success: false, error: 'Failed to clear chat history' }
  }
}

// ============================================================================
// Story 14.11: Conversation Management Actions
// ============================================================================

export interface ConversationSummary {
  conversationId: string
  firstMessage: string
  createdAt: Date
  messageCount: number
}

/**
 * Archive the current active GLOBAL conversation.
 * Tags all messages with conversation_id=null and context_type=GLOBAL
 * with a new conversation_id (cuid), effectively "saving" the conversation.
 */
export async function archiveConversation(): Promise<
  ActionResult<{ conversationId: string }>
> {
  try {
    return await withWorkspace(async (ctx) => {
      // Generate a new conversation ID
      const conversationId = crypto.randomUUID()

      const result = await prisma.chatMessage.updateMany({
        where: {
          workspace_id: ctx.workspaceId,
          context_type: 'GLOBAL',
          conversation_id: null,
        },
        data: {
          conversation_id: conversationId,
        },
      })

      // If no messages were archived, return success but with count info
      if (result.count === 0) {
        return {
          success: true,
          data: { conversationId },
        }
      }

      return { success: true, data: { conversationId } }
    })
  } catch (error) {
    console.error('Error archiving conversation:', error)
    return { success: false, error: 'Failed to archive conversation' }
  }
}

/**
 * Get a list of archived conversations for the current workspace.
 * Returns distinct conversations with their first message preview and timestamp.
 */
export async function getConversationHistory(): Promise<
  ActionResult<ConversationSummary[]>
> {
  try {
    return await withWorkspace(async (ctx) => {
      // Get all archived conversations: distinct conversation_ids with first message
      const conversations = await prisma.$queryRaw<
        Array<{
          conversation_id: string
          first_message: string
          created_at: Date
          message_count: bigint
        }>
      >`
        SELECT
          cm.conversation_id,
          (
            SELECT content FROM chat_messages cm2
            WHERE cm2.conversation_id = cm.conversation_id
              AND cm2.role = 'USER'
            ORDER BY cm2.created_at ASC
            LIMIT 1
          ) as first_message,
          MIN(cm.created_at) as created_at,
          COUNT(*) as message_count
        FROM chat_messages cm
        WHERE cm.workspace_id = ${ctx.workspaceId}
          AND cm.context_type = 'GLOBAL'
          AND cm.conversation_id IS NOT NULL
        GROUP BY cm.conversation_id
        ORDER BY MIN(cm.created_at) DESC
        LIMIT 20
      `

      const data: ConversationSummary[] = conversations.map((c) => ({
        conversationId: c.conversation_id,
        firstMessage: c.first_message ?? '',
        createdAt: c.created_at,
        messageCount: Number(c.message_count),
      }))

      return { success: true, data }
    })
  } catch (error) {
    console.error('Error getting conversation history:', error)
    return { success: false, error: 'Failed to get conversation history' }
  }
}

// ============================================================================
// Story 3.10: Enhanced Chat Features
// ============================================================================

/**
 * Delete a single chat message by ID.
 * Verifies workspace ownership before deletion.
 */
export async function deleteChatMessage(
  messageId: string
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const validated = z.string().uuid().parse(messageId)

    return await withWorkspace(async (ctx) => {
      // Verify message belongs to this workspace
      const message = await prisma.chatMessage.findFirst({
        where: {
          id: validated,
          workspace_id: ctx.workspaceId,
        },
        select: { id: true },
      })

      if (!message) {
        return { success: false, error: 'Message not found' }
      }

      await prisma.chatMessage.delete({
        where: { id: validated },
      })

      return { success: true, data: { deleted: true } }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid message ID' }
    }
    console.error('Error deleting chat message:', error)
    return { success: false, error: 'Failed to delete message' }
  }
}

/**
 * Search across all conversations (active and archived) by message content.
 * Returns matching conversations with a snippet of the matching message.
 */
export async function searchConversations(query: string): Promise<
  ActionResult<
    Array<{
      conversationId: string | null
      snippet: string
      messageCount: number
      createdAt: Date
    }>
  >
> {
  try {
    const validated = z.string().min(1).max(200).parse(query)

    return await withWorkspace(async (ctx) => {
      // Find messages matching the query across all conversations
      const matchingMessages = await prisma.chatMessage.findMany({
        where: {
          workspace_id: ctx.workspaceId,
          context_type: 'GLOBAL',
          content: {
            contains: validated,
            mode: 'insensitive',
          },
        },
        orderBy: { created_at: 'desc' },
        take: 50,
        select: {
          id: true,
          content: true,
          conversation_id: true,
          created_at: true,
        },
      })

      // Group by conversation_id (null = active conversation)
      const conversationMap = new Map<
        string,
        { snippet: string; createdAt: Date; conversationId: string | null }
      >()

      for (const msg of matchingMessages) {
        const key = msg.conversation_id ?? '__active__'
        if (!conversationMap.has(key)) {
          // Extract snippet around the match
          const snippet = extractSnippet(msg.content, validated, 120)
          conversationMap.set(key, {
            snippet,
            createdAt: msg.created_at,
            conversationId: msg.conversation_id,
          })
        }
      }

      // Get message counts for each conversation
      const results = await Promise.all(
        Array.from(conversationMap.entries()).map(async ([key, data]) => {
          const count = await prisma.chatMessage.count({
            where: {
              workspace_id: ctx.workspaceId,
              context_type: 'GLOBAL',
              ...(key === '__active__'
                ? { conversation_id: null }
                : { conversation_id: key }),
            },
          })
          return {
            conversationId: data.conversationId,
            snippet: data.snippet,
            messageCount: count,
            createdAt: data.createdAt,
          }
        })
      )

      return { success: true, data: results }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid search query' }
    }
    console.error('Error searching conversations:', error)
    return { success: false, error: 'Failed to search conversations' }
  }
}

/**
 * Extract a snippet from content around the first occurrence of the query.
 * Truncates to maxLength with ellipsis.
 */
function extractSnippet(
  content: string,
  query: string,
  maxLength: number
): string {
  const lowerContent = content.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const matchIndex = lowerContent.indexOf(lowerQuery)

  if (matchIndex === -1) {
    // Shouldn't happen, but fallback
    return content.length > maxLength
      ? content.slice(0, maxLength) + '\u2026'
      : content
  }

  // Center the snippet around the match
  const padding = Math.floor((maxLength - query.length) / 2)
  let start = Math.max(0, matchIndex - padding)
  const end = Math.min(content.length, start + maxLength)

  // Adjust start if we hit the end
  if (end === content.length) {
    start = Math.max(0, end - maxLength)
  }

  let snippet = content.slice(start, end)
  if (start > 0) snippet = '\u2026' + snippet
  if (end < content.length) snippet = snippet + '\u2026'

  return snippet
}

/**
 * Load messages for a specific archived conversation.
 */
export async function loadConversation(
  conversationId: string
): Promise<ActionResult<ChatMessageData[]>> {
  try {
    const validated = z.string().uuid().parse(conversationId)

    return await withWorkspace(async (ctx) => {
      const messages = await prisma.chatMessage.findMany({
        where: {
          workspace_id: ctx.workspaceId,
          conversation_id: validated,
        },
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          metadata: true,
          context_type: true,
          context_id: true,
          created_at: true,
        },
      })

      const data: ChatMessageData[] = messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata as Record<string, unknown> | null,
        contextType: msg.context_type,
        contextId: msg.context_id,
        createdAt: msg.created_at,
      }))

      return { success: true, data }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid conversation ID' }
    }
    console.error('Error loading conversation:', error)
    return { success: false, error: 'Failed to load conversation' }
  }
}
