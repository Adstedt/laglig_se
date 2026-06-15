'use client'

/**
 * Chat Message List Component
 * Scrollable container for chat messages with date group headers and infinite
 * scroll pagination.
 *
 * Scroll behaviour (Claude/ChatGPT-style "calm" pattern):
 *  - No auto-follow. The viewport stays where the user puts it while text
 *    streams in; the user scrolls at their own pace.
 *  - Scroll-on-send: a newly sent message is scrolled to the top of the viewport
 *    and the active turn reserves ~a screen of space below it (RESERVE_CLASS), so
 *    the answer streams into stable, visible space instead of dragging the view.
 *  - A small "generating" pill (instead of a scroll-to-bottom arrow) signals that
 *    the assistant is still producing, independent of scroll position.
 */

import { useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import type { UIMessage } from 'ai'
import type { ChatContextType } from '@/lib/hooks/use-chat-interface'
import { ChatMessage } from './chat-message'
import { StreamingIndicator } from './streaming-indicator'
import { AssistantAvatar } from './assistant-avatar'
import { useRotatingThinkingPhrase } from '@/lib/ai-chat/thinking-phrases'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  groupMessagesByDate,
  type DateGroup,
} from '@/lib/utils/group-messages-by-date'
import { useChatDetailSafe } from '@/lib/ai/chat-detail-context'
import { SystemMessage } from './system-message'

// Reserved space below the active turn so a just-sent message can scroll to the
// top with the answer streaming into view beneath it. Long answers exceed it
// (so there's no void below them); short answers keep the reserved gap.
const RESERVE_CLASS = 'min-h-[85vh]'
// Breathing room above a message scrolled to the top.
const SCROLL_TOP_GAP = 16

interface ChatMessageListProps {
  messages: UIMessage[]
  isStreaming?: boolean
  className?: string
  /**
   * Optional className applied to the inner content container (inside the
   * scrolling viewport). Use this to center/constrain the message column
   * while keeping the scrollbar at the full-width edge of the viewport.
   */
  contentClassName?: string
  /** Optional inline content rendered after all messages (e.g. assessment UI) */
  footer?: React.ReactNode
  /** Called when user scrolls to top to load older messages */
  onLoadMore?: () => Promise<unknown>
  /** Whether older messages are being fetched */
  isLoadingMore?: boolean
  /** Whether there are more older messages to load (null = unknown, false = no more) */
  hasMore?: boolean | null
  /** Callback when a message is deleted */
  onDeleteMessage?: (_messageId: string) => void
  /** Chat context type for reasoning block default-open behavior */
  contextType?: ChatContextType | undefined
}

export function ChatMessageList({
  messages,
  isStreaming = false,
  className,
  contentClassName,
  footer,
  onLoadMore,
  isLoadingMore = false,
  hasMore,
  onDeleteMessage,
  contextType,
}: ChatMessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef<number>(0)
  const isRestoringScrollRef = useRef(false)
  const didInitialScrollRef = useRef(false)
  const lastUserIdRef = useRef<string | null>(null)

  // Only mark the last assistant message as streaming, and only if it's
  // actually the newest message (not a previous response before a new user message)
  const lastAssistantIndex = messages.findLastIndex(
    (m) => m.role === 'assistant'
  )
  const lastMessageIndex = messages.length - 1
  const isLastAssistantTheNewest =
    lastAssistantIndex === lastMessageIndex || lastAssistantIndex === -1

  // The assistant turn for the latest user message hasn't materialised in the
  // array yet (the last message is the user's) — show the pending "thinking"
  // shell. TRUE on the very first message of a chat (lastAssistantIndex === -1).
  const assistantTurnPending =
    messages.length > 0 && lastAssistantIndex !== lastMessageIndex

  const dateGroups: DateGroup[] = groupMessagesByDate(messages)

  const chatDetail = useChatDetailSafe()
  const systemMessages = chatDetail?.systemMessages ?? []

  const thinkingPhrase = useRotatingThinkingPhrase(
    isStreaming && assistantTurnPending
  )

  // On first load of an existing conversation, jump to the latest message.
  // A fresh first send (single user message) is left to scroll-on-send below.
  useLayoutEffect(() => {
    if (didInitialScrollRef.current || messages.length === 0) return
    didInitialScrollRef.current = true
    const isLoadedThread =
      messages.length > 1 || messages[0]?.role === 'assistant'
    if (isLoadedThread) {
      const vp = viewportRef.current
      if (vp) vp.scrollTop = vp.scrollHeight
    }
  }, [messages])

  // Scroll-on-send: when a new user message is appended, glide it to the top.
  // The reserved space below (RESERVE_CLASS on the active turn) gives the room.
  useLayoutEffect(() => {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'user' || last.id === lastUserIdRef.current) {
      return
    }
    lastUserIdRef.current = last.id
    didInitialScrollRef.current = true
    const vp = viewportRef.current
    if (!vp) return
    const node = vp.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(last.id)}"]`
    )
    if (!node) return
    const delta =
      node.getBoundingClientRect().top - vp.getBoundingClientRect().top
    vp.scrollTo({
      top: vp.scrollTop + delta - SCROLL_TOP_GAP,
      behavior: 'smooth',
    })
  }, [messages])

  // Preserve scroll position when older messages are prepended via loadMore.
  useEffect(() => {
    if (!isRestoringScrollRef.current) return
    const vp = viewportRef.current
    if (!vp) return
    requestAnimationFrame(() => {
      vp.scrollTop = vp.scrollHeight - prevScrollHeightRef.current
      isRestoringScrollRef.current = false
    })
  }, [messages])

  const handleLoadMore = useCallback(async () => {
    if (!onLoadMore || isLoadingMore || hasMore === false) return
    const vp = viewportRef.current
    if (vp) {
      prevScrollHeightRef.current = vp.scrollHeight
      isRestoringScrollRef.current = true
    }
    await onLoadMore()
  }, [onLoadMore, isLoadingMore, hasMore])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !onLoadMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore !== false && !isLoadingMore) {
          handleLoadMore()
        }
      },
      { root: viewportRef.current, threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [onLoadMore, hasMore, isLoadingMore, handleLoadMore])

  return (
    <div className={cn('relative flex-1 overflow-hidden', className)}>
      <div ref={viewportRef} role="log" className="h-full overflow-y-auto">
        <div className={cn('px-4 py-4 space-y-4', contentClassName)}>
          {/* Sentinel for infinite scroll — triggers loadMore when visible */}
          <div ref={sentinelRef} className="h-1" aria-hidden="true" />

          {isLoadingMore && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {hasMore === false && messages.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-1">
              Början av konversationen
            </p>
          )}

          {dateGroups.map((group) => (
            <div key={group.label} className="space-y-4">
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground shrink-0">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {group.messages.map((message) => {
                const index = messages.indexOf(message)
                // Reserve a screen of space below the active turn's answer so the
                // just-sent message can sit at the top while it streams.
                const reserveSpace =
                  isStreaming &&
                  index === lastMessageIndex &&
                  message.role === 'assistant'
                return (
                  <div
                    key={message.id}
                    data-message-id={message.id}
                    className={reserveSpace ? RESERVE_CLASS : undefined}
                  >
                    <ChatMessage
                      message={message}
                      isStreaming={
                        isStreaming &&
                        index === lastAssistantIndex &&
                        isLastAssistantTheNewest
                      }
                      onDelete={onDeleteMessage}
                      contextType={contextType}
                    />
                  </div>
                )
              })}
            </div>
          ))}

          {/* Pending "thinking" shell — shown from submit until the assistant
              message materialises in the array. Carries the reserved space so the
              just-sent user message can scroll to the top before any answer text
              exists. */}
          {isStreaming && assistantTurnPending && (
            // Reserve space on the wrapper (not the avatar row) so the
            // avatar + indicator sit at the TOP of the reserved area — exactly
            // where the materialised ChatMessage renders them. Putting min-h on
            // the flex row instead made `items-center` vertically center the
            // avatar in the 85vh box, so it visibly jumped up when the real
            // message mounted.
            <div className={RESERVE_CLASS}>
              <div className="flex items-center gap-2.5">
                <AssistantAvatar />
                <StreamingIndicator label={thinkingPhrase} />
              </div>
            </div>
          )}

          {systemMessages.map((sysMsg) => (
            <SystemMessage key={sysMsg.id} message={sysMsg} />
          ))}

          {footer}
        </div>
      </div>

      {/* "Generating" pill — signals the assistant is still producing,
          independent of scroll position (replaces the scroll-to-bottom arrow). */}
      {isStreaming && messages.length > 0 && (
        <div
          role="status"
          aria-label="Genererar svar"
          className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/90 px-3 py-1.5 shadow-md backdrop-blur animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      )}
    </div>
  )
}
