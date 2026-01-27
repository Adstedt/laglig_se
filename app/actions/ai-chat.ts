'use server'

/**
 * Story 3.3: AI Chat Server Actions
 * Server actions for chat message persistence (Task 6)
 *
 * Provides:
 * - saveChatMessage: Store a message to the database
 * - getChatHistory: Load chat history for a context
 * - clearChatHistory: Clear chat history for a context
 */

import { prisma } from '@/lib/prisma'
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

const chatContextTypeSchema = z.enum(['GLOBAL', 'TASK', 'LAW'])

const saveChatMessageSchema = z.object({
  role: z.enum(['USER', 'ASSISTANT']),
  content: z.string().min(1).max(50000), // Allow up to 50K chars for AI responses
  contextType: chatContextTypeSchema,
  contextId: z.string().uuid().optional(),
})

const getChatHistorySchema = z.object({
  contextType: chatContextTypeSchema,
  contextId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).optional().default(50),
})

const clearChatHistorySchema = z.object({
  contextType: chatContextTypeSchema,
  contextId: z.string().uuid().optional(),
})

// ============================================================================
// Types
// ============================================================================

export interface ChatMessageData {
  id: string
  role: ChatMessageRole
  content: string
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
    contextType: 'GLOBAL' | 'TASK' | 'LAW'
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
 * Returns messages in chronological order (oldest first).
 */
export async function getChatHistory(
  input: z.infer<typeof getChatHistorySchema>
): Promise<ActionResult<ChatMessageData[]>> {
  try {
    const validated = getChatHistorySchema.parse(input)

    return await withWorkspace(async (ctx) => {
      const messages = await prisma.chatMessage.findMany({
        where: {
          workspace_id: ctx.workspaceId,
          context_type: validated.contextType,
          context_id: validated.contextId ?? null,
        },
        orderBy: { created_at: 'asc' },
        take: validated.limit,
        select: {
          id: true,
          role: true,
          content: true,
          context_type: true,
          context_id: true,
          created_at: true,
        },
      })

      const data: ChatMessageData[] = messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        contextType: msg.context_type,
        contextId: msg.context_id,
        createdAt: msg.created_at,
      }))

      return { success: true, data }
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
