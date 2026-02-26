'use client'

/**
 * Story 3.3: Shared Chat Interface Hook
 * Provides chat functionality for sidebar, task modal, and legal document modal
 *
 * Task 6: Chat history persistence
 * - Loads chat history on mount
 * - Saves messages to database via server actions
 */

import { useCallback, useState, useRef, useMemo, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { track } from '@vercel/analytics'
import type { Citation } from '@/lib/ai/citations'
import { createCitationsFromContext } from '@/lib/ai/citations'
import {
  getChatHistory,
  saveChatMessage,
  clearChatHistory as clearChatHistoryAction,
  type ChatMessageData,
} from '@/app/actions/ai-chat'

export type ChatContextType = 'global' | 'task' | 'law'

export interface ChatContextInitial {
  title?: string | undefined
  description?: string | undefined
  sfsNumber?: string | undefined
  summary?: string | undefined
  linkedLawIds?: string[] | undefined
}

export interface ChatContext {
  contextType: ChatContextType
  contextId?: string | undefined
  initialContext?: ChatContextInitial | undefined
}

export interface UseChatInterfaceOptions extends ChatContext {
  onMessageSent?: () => void
  onResponseComplete?: () => void
}

export interface UseChatInterfaceReturn {
  messages: UIMessage[]
  sendMessage: (_content: string) => void
  status: 'submitted' | 'streaming' | 'ready' | 'error'
  error: Error | null
  stop: () => void
  citations: Citation[]
  retryAfter: number | undefined
  handleRetry: () => void
  isLoading: boolean
  isLoadingHistory: boolean
  clearHistory: () => Promise<void>
  /** Replace local message state (e.g. when loading an archived conversation) */
  replaceMessages: (_messages: UIMessage[]) => void
}

// Map ChatContextType to Prisma enum format
function toPrismaContextType(
  contextType: ChatContextType
): 'GLOBAL' | 'TASK' | 'LAW' {
  return contextType.toUpperCase() as 'GLOBAL' | 'TASK' | 'LAW'
}

// Convert persisted messages to UIMessage format
function toUIMessages(messages: ChatMessageData[]): UIMessage[] {
  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role === 'USER' ? 'user' : 'assistant',
    parts: [{ type: 'text' as const, text: msg.content }],
    createdAt: msg.createdAt,
  }))
}

export function useChatInterface(
  options: UseChatInterfaceOptions
): UseChatInterfaceReturn {
  const {
    contextType,
    contextId,
    initialContext,
    onMessageSent,
    onResponseComplete,
  } = options

  const [citations, setCitations] = useState<Citation[]>([])
  const [retryAfter, setRetryAfter] = useState<number | undefined>(undefined)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const lastMessageRef = useRef<string>('')
  const startTimeRef = useRef<number>(0)
  const pendingSaveRef = useRef<Set<string>>(new Set())

  // Create transport with body data for context
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: {
          contextType,
          contextId,
          ...initialContext,
        },
      }),
    [contextType, contextId, initialContext]
  )

  const {
    messages,
    status,
    error,
    stop,
    sendMessage: sendChatMessage,
    setMessages,
  } = useChat({
    transport,
    onFinish: ({ message }) => {
      // Track response completion
      const duration = Date.now() - startTimeRef.current
      const textParts = message.parts?.filter((p) => p.type === 'text') ?? []
      const responseText = textParts
        .map((p) => ('text' in p ? p.text : ''))
        .join('')

      track('ai_chat_response_complete', {
        responseLength: responseText.length,
        citationCount: citations.length,
        durationMs: duration,
      })

      // Persist assistant message to database
      if (responseText && !pendingSaveRef.current.has(message.id)) {
        pendingSaveRef.current.add(message.id)
        saveChatMessage({
          role: 'ASSISTANT',
          content: responseText,
          contextType: toPrismaContextType(contextType),
          contextId,
        }).catch((err) => {
          console.error('Failed to save assistant message:', err)
          pendingSaveRef.current.delete(message.id)
        })
      }

      onResponseComplete?.()
    },
    onError: (err) => {
      // Track error
      track('ai_chat_error', {
        errorType: getErrorType(err),
        errorMessage: err.message,
      })

      // Check for rate limit
      if (err.message.includes('429')) {
        // Try to parse retry-after from error
        const match = err.message.match(/(\d+)/)
        if (match && match[1]) {
          setRetryAfter(parseInt(match[1], 10))
          track('ai_chat_rate_limited', { userId: 'unknown' })
        }
      }
    },
  })

  // Load chat history on mount
  useEffect(() => {
    if (historyLoaded) return

    async function loadHistory() {
      setIsLoadingHistory(true)
      try {
        const result = await getChatHistory({
          contextType: toPrismaContextType(contextType),
          contextId,
          limit: 50,
        })

        if (result.success && result.data && result.data.length > 0) {
          const uiMessages = toUIMessages(result.data)
          setMessages(uiMessages)
          // Mark these message IDs as already saved
          result.data.forEach((msg) => pendingSaveRef.current.add(msg.id))
        }
      } catch (err) {
        console.error('Failed to load chat history:', err)
      } finally {
        setIsLoadingHistory(false)
        setHistoryLoaded(true)
      }
    }

    loadHistory()
  }, [contextType, contextId, historyLoaded, setMessages])

  // Update citations when messages change (from response metadata)
  const updateCitationsFromMessage = useCallback((msg: UIMessage) => {
    const metadata = msg.metadata as
      | {
          citations?: Array<{
            id: string
            title: string
            sfsNumber: string
            content: string
          }>
        }
      | undefined

    if (metadata?.citations) {
      const newCitations = createCitationsFromContext(metadata.citations)
      setCitations(newCitations)
    }
  }, [])

  // Check for citations in the latest assistant message
  useEffect(() => {
    const latestAssistantMessage = messages.findLast(
      (m) => m.role === 'assistant'
    )
    if (latestAssistantMessage) {
      updateCitationsFromMessage(latestAssistantMessage)
    }
  }, [messages, updateCitationsFromMessage])

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return

      // Reset state
      setRetryAfter(undefined)
      startTimeRef.current = Date.now()
      lastMessageRef.current = content

      // Track message sent
      track('ai_chat_message_sent', {
        contextType,
        messageLength: content.length,
        hasContext: !!contextId,
      })

      // Persist user message to database
      saveChatMessage({
        role: 'USER',
        content: content.trim(),
        contextType: toPrismaContextType(contextType),
        contextId,
      }).catch((err) => {
        console.error('Failed to save user message:', err)
      })

      // Send message using the parts format
      sendChatMessage({ parts: [{ type: 'text', text: content }] })
      onMessageSent?.()
    },
    [contextType, contextId, sendChatMessage, onMessageSent]
  )

  const handleRetry = useCallback(() => {
    setRetryAfter(undefined)

    // If there was a last message, resend it
    if (lastMessageRef.current) {
      sendMessage(lastMessageRef.current)
    } else if (messages.length > 0) {
      // Clear error state by setting messages again
      setMessages([...messages])
    }
  }, [messages, sendMessage, setMessages])

  // Clear chat history (both local state and database)
  const clearHistory = useCallback(async () => {
    try {
      await clearChatHistoryAction({
        contextType: toPrismaContextType(contextType),
        contextId,
      })
      // Clear local state
      setMessages([])
      pendingSaveRef.current.clear()
    } catch (err) {
      console.error('Failed to clear chat history:', err)
      throw err
    }
  }, [contextType, contextId, setMessages])

  const isLoading = status === 'streaming' || status === 'submitted'

  return {
    messages,
    sendMessage,
    status,
    error: error ?? null,
    stop,
    citations,
    retryAfter,
    handleRetry,
    isLoading,
    isLoadingHistory,
    clearHistory,
    replaceMessages: setMessages,
  }
}

function getErrorType(error: Error): string {
  const message = error.message.toLowerCase()

  if (message.includes('network') || message.includes('fetch')) {
    return 'network'
  }
  if (message.includes('timeout') || message.includes('aborted')) {
    return 'timeout'
  }
  if (message.includes('rate') || message.includes('429')) {
    return 'rate_limit'
  }
  if (message.includes('401') || message.includes('unauthorized')) {
    return 'unauthorized'
  }
  if (message.includes('500') || message.includes('server')) {
    return 'server_error'
  }

  return 'unknown'
}
