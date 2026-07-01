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
import { trackEvent } from '@/lib/track-event'
import {
  getChatHistory,
  saveChatMessage,
  clearChatHistory as clearChatHistoryAction,
  type ChatMessageData,
} from '@/app/actions/ai-chat'

export type ChatContextType = 'global' | 'task' | 'law' | 'change'

// Stall watchdog thresholds. A turn is considered stalled after this long with
// zero stream activity. Kept comfortably below the 300s server maxDuration but
// well above a normal turn (heavy drafts complete in ~50s of active streaming),
// so it only trips on true silence, not slow-but-progressing generation.
const STALL_TIMEOUT_MS = 90_000
const STALL_POLL_MS = 5_000

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
  /**
   * Story 19.4a: the active LawListItem id, threaded to the chat route so the
   * agent's law-item write tools default to it and the LAW prompt block surfaces
   * it. For LAW the route also falls back to `contextId`; CHANGE sends it here.
   */
  lawListItemId?: string | undefined
  initialContext?: ChatContextInitial | undefined
}

export interface UseChatInterfaceOptions extends ChatContext {
  onMessageSent?: () => void
  onResponseComplete?: () => void
  /** Auto-send this message on first mount if no history exists */
  initialMessage?: string | undefined
}

/** Story 19.1: a chat attachment carried through send + persisted for history chips. */
export interface ChatAttachmentMeta {
  fileId: string
  filename: string
  mimeType: string | null
}

export interface UseChatInterfaceReturn {
  messages: UIMessage[]
  sendMessage: (_content: string, _attachments?: ChatAttachmentMeta[]) => void
  status: 'submitted' | 'streaming' | 'ready' | 'error'
  error: Error | null
  stop: () => void
  retryAfter: number | undefined
  handleRetry: () => void
  isLoading: boolean
  isLoadingHistory: boolean
  clearHistory: () => Promise<void>
  /** Replace local message state (e.g. when loading an archived conversation) */
  replaceMessages: (_messages: UIMessage[]) => void
  /** Load older messages (pagination). Returns true if there are more pages. */
  loadMore: () => Promise<boolean>
  /** Whether older messages are currently being fetched */
  isLoadingMore: boolean
  /** Whether there are more older messages to load (null = unknown yet) */
  hasMore: boolean | null
}

// Map ChatContextType to Prisma enum format
function toPrismaContextType(
  contextType: ChatContextType
): 'GLOBAL' | 'TASK' | 'LAW' | 'CHANGE' {
  return contextType.toUpperCase() as 'GLOBAL' | 'TASK' | 'LAW' | 'CHANGE'
}

// Convert persisted messages to UIMessage format
function toUIMessages(messages: ChatMessageData[]): UIMessage[] {
  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role === 'USER' ? 'user' : 'assistant',
    parts: [{ type: 'text' as const, text: msg.content }],
    createdAt: msg.createdAt,
    ...(msg.metadata ? { metadata: msg.metadata } : {}),
  }))
}

export function useChatInterface(
  options: UseChatInterfaceOptions
): UseChatInterfaceReturn {
  const {
    contextType,
    contextId,
    lawListItemId,
    initialContext,
    initialMessage,
    onMessageSent,
    onResponseComplete,
  } = options

  const [retryAfter, setRetryAfter] = useState<number | undefined>(undefined)
  // Client-side stall watchdog: when a turn overruns the server (or a heavy
  // draft_styrdokument tool call stalls mid-args), the connection can go silent
  // with no error event, leaving the "skriver utkast" spinner spinning forever.
  // This synthetic error surfaces a retry instead. See the watchdog effect below.
  const [stalledError, setStalledError] = useState<Error | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [hasMore, setHasMore] = useState<boolean | null>(null)
  const lastMessageRef = useRef<string>('')
  const initialMessageSentRef = useRef(false)
  const startTimeRef = useRef<number>(0)
  // Timestamp of the last observed stream progress (any message/status change).
  // The watchdog fires only after this goes silent for STALL_TIMEOUT_MS.
  const lastActivityRef = useRef<number>(0)
  const pendingSaveRef = useRef<Set<string>>(new Set())
  const nextCursorRef = useRef<string | null>(null)

  // Stable chat ID so AI SDK preserves messages in memory across unmount/remount
  const chatId = contextId ? `${contextType}-${contextId}` : contextType

  // Create transport with body data for context
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: {
          contextType,
          contextId,
          // Story 19.4a: surface the active law-list item to the agent.
          lawListItemId,
          ...initialContext,
        },
      }),
    [contextType, contextId, lawListItemId, initialContext]
  )

  const {
    messages,
    status,
    error,
    stop,
    sendMessage: sendChatMessage,
    setMessages,
  } = useChat({
    id: chatId,
    transport,
    // One frame at 60fps — aligns UI updates to vsync so server-paced word
    // chunks surface smoothly instead of in batched stutters.
    experimental_throttle: 16,
    onFinish: ({ message }) => {
      // Track response completion
      const duration = Date.now() - startTimeRef.current
      const textParts = message.parts?.filter((p) => p.type === 'text') ?? []
      const responseText = textParts
        .map((p) => ('text' in p ? p.text : ''))
        .join('')

      trackEvent('ai_chat_response_complete', {
        responseLength: responseText.length,
        durationMs: duration,
      })

      // Story 14.22 / ADR-14.22-A: the assistant message is now persisted
      // server-side in /api/chat/route.ts — a stub ChatMessage is written before
      // the tool loop (so PendingAgentAction.chat_message_id has a valid FK
      // target) and filled with final content + metadata in onFinish. The client
      // no longer saves it, which avoids a double-write. The USER message is
      // still persisted client-side in sendMessage(); pendingSaveRef remains in
      // use for history-load dedup.

      onResponseComplete?.()
    },
    onError: (err) => {
      // Track error
      trackEvent('ai_chat_error', {
        errorType: getErrorType(err),
        errorMessage: err.message,
      })

      // Check for rate limit
      if (err.message.includes('429')) {
        // Try to parse retry-after from error
        const match = err.message.match(/(\d+)/)
        if (match && match[1]) {
          setRetryAfter(parseInt(match[1], 10))
          trackEvent('ai_chat_rate_limited', { userId: 'unknown' })
        }
      }
    },
  })

  // Reset the activity marker on every streaming progress event. useChat hands
  // back a new `messages` reference on each throttled token/tool-part flush, and
  // `status` transitions on submit/stream — so as long as bytes are flowing this
  // keeps the watchdog from firing. A genuine stall stops updating both.
  useEffect(() => {
    lastActivityRef.current = Date.now()
  }, [messages, status])

  // Stall watchdog. While a turn is in flight, poll for total silence longer
  // than STALL_TIMEOUT_MS. If the stream never delivers a terminal event (Vercel
  // function killed at maxDuration, dropped connection, or a stuck generation),
  // abort locally and surface a retryable error rather than an eternal spinner.
  useEffect(() => {
    const loading = status === 'streaming' || status === 'submitted'
    if (!loading) return

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > STALL_TIMEOUT_MS) {
        stop()
        // Message carries "timeout" so <ChatError> classifies it as the timeout
        // branch ("Förfrågan tog för lång tid. Försök igen.") — the displayed
        // copy comes from ERROR_MESSAGES, not this raw string.
        setStalledError(new Error('Chat stream stalled — timeout'))
        trackEvent('ai_chat_stalled', {
          contextType,
          elapsedMs: Date.now() - startTimeRef.current,
        })
      }
    }, STALL_POLL_MS)

    return () => clearInterval(interval)
  }, [status, stop, contextType])

  // Load chat history on mount (skip if AI SDK already has messages in memory)
  useEffect(() => {
    if (historyLoaded) return

    // AI SDK keeps messages in memory keyed by chatId — if we already have
    // messages from a previous mount, skip the DB round-trip.
    if (messages.length > 0) {
      setIsLoadingHistory(false)
      setHistoryLoaded(true)
      return
    }

    async function loadHistory() {
      setIsLoadingHistory(true)
      try {
        const result = await getChatHistory({
          contextType: toPrismaContextType(contextType),
          contextId,
          limit: 30,
        })

        if (result.success && result.data) {
          const { messages: msgData, nextCursor } = result.data
          nextCursorRef.current = nextCursor
          setHasMore(nextCursor !== null)
          if (msgData.length > 0) {
            const uiMessages = toUIMessages(msgData)
            setMessages(uiMessages)
            // Mark these message IDs as already saved
            msgData.forEach((msg) => pendingSaveRef.current.add(msg.id))
          }
        }
      } catch (err) {
        console.error('Failed to load chat history:', err)
      } finally {
        setIsLoadingHistory(false)
        setHistoryLoaded(true)
      }
    }

    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextType, contextId, historyLoaded, setMessages])

  // Auto-send initial message for fresh chats (no existing history)
  useEffect(() => {
    if (!initialMessage) return
    if (!historyLoaded) return
    if (initialMessageSentRef.current) return
    if (messages.length > 0) return // Has history — don't auto-send

    initialMessageSentRef.current = true

    // Small delay to ensure transport is ready
    const timer = setTimeout(() => {
      sendChatMessage({ parts: [{ type: 'text', text: initialMessage }] })

      // Persist the auto-sent message
      saveChatMessage({
        role: 'USER',
        content: initialMessage,
        contextType: toPrismaContextType(contextType),
        contextId,
      }).catch((err) => {
        console.error('Failed to save initial message:', err)
      })
    }, 50)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoaded, initialMessage, messages.length])

  const sendMessage = useCallback(
    (content: string, attachments?: ChatAttachmentMeta[]) => {
      const hasAttachments = !!attachments && attachments.length > 0
      // Allow an attachment-only message (no text) per Story 19.1.
      if (!content.trim() && !hasAttachments) return

      // Reset state
      setRetryAfter(undefined)
      setStalledError(null)
      startTimeRef.current = Date.now()
      lastActivityRef.current = Date.now()
      lastMessageRef.current = content

      // Track message sent
      trackEvent('ai_chat_message_sent', {
        contextType,
        messageLength: content.length,
        hasContext: !!contextId,
      })

      // Persist user message to database. Story 19.1: store attachment metadata
      // so history can re-render file chips (saveChatMessageSchema.metadata is an
      // existing optional Json field — no migration).
      saveChatMessage({
        role: 'USER',
        content: content.trim(),
        contextType: toPrismaContextType(contextType),
        contextId,
        ...(hasAttachments ? { metadata: { attachments } } : {}),
      }).catch((err) => {
        console.error('Failed to save user message:', err)
      })

      // Send message; Story 19.1 threads attachment file ids as a per-call body
      // override (AI SDK v6 ChatRequestOptions.body) — the route converts them
      // server-side and merges the content blocks into this user message.
      sendChatMessage(
        hasAttachments
          ? {
              parts: [{ type: 'text', text: content }],
              // carry chips on the optimistic message so they show immediately
              metadata: { attachments },
            }
          : { parts: [{ type: 'text', text: content }] },
        hasAttachments
          ? { body: { attachmentIds: attachments.map((a) => a.fileId) } }
          : undefined
      )
      onMessageSent?.()
    },
    [contextType, contextId, sendChatMessage, onMessageSent]
  )

  const handleRetry = useCallback(() => {
    setRetryAfter(undefined)
    setStalledError(null)

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

  // Load older messages (cursor pagination)
  const loadMore = useCallback(async (): Promise<boolean> => {
    if (!nextCursorRef.current || isLoadingMore) return false
    setIsLoadingMore(true)
    try {
      const result = await getChatHistory({
        contextType: toPrismaContextType(contextType),
        contextId,
        limit: 30,
        cursor: nextCursorRef.current,
      })

      if (result.success && result.data) {
        const { messages: olderMsgData, nextCursor } = result.data
        nextCursorRef.current = nextCursor
        setHasMore(nextCursor !== null)

        if (olderMsgData.length > 0) {
          const olderUIMessages = toUIMessages(olderMsgData)
          // Mark as already saved
          olderMsgData.forEach((msg) => pendingSaveRef.current.add(msg.id))
          // Prepend older messages — functional updater avoids stale closure
          setMessages((prev) => [...olderUIMessages, ...prev])
        }
        return nextCursor !== null
      }
      return false
    } catch (err) {
      console.error('Failed to load more messages:', err)
      return false
    } finally {
      setIsLoadingMore(false)
    }
  }, [contextType, contextId, isLoadingMore, setMessages])

  // A watchdog stall presents as a terminal error: force status to 'error' and
  // hand back the synthetic error so the panel renders <ChatError> with a retry
  // instead of a stuck spinner. Otherwise pass useChat's own state through.
  const effectiveStatus: UseChatInterfaceReturn['status'] = stalledError
    ? 'error'
    : status
  const effectiveError = stalledError ?? error ?? null
  const isLoading =
    effectiveStatus === 'streaming' || effectiveStatus === 'submitted'

  return {
    messages,
    sendMessage,
    status: effectiveStatus,
    error: effectiveError,
    stop,
    retryAfter,
    handleRetry,
    isLoading,
    isLoadingHistory,
    clearHistory,
    replaceMessages: setMessages,
    loadMore,
    isLoadingMore,
    hasMore,
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
