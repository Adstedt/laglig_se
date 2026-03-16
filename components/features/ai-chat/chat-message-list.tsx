'use client'

/**
 * Chat Message List Component
 * Scrollable container for chat messages with streaming state management,
 * infinite scroll pagination, and date group headers.
 */

import { useRef, useEffect, useCallback } from 'react'
import type { UIMessage } from 'ai'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessage } from './chat-message'
import { StreamingIndicator } from './streaming-indicator'
import { LexaIcon } from '@/components/ui/lexa-icon'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  groupMessagesByDate,
  type DateGroup,
} from '@/lib/utils/group-messages-by-date'

interface ChatMessageListProps {
  messages: UIMessage[]
  isStreaming?: boolean
  className?: string
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
}

export function ChatMessageList({
  messages,
  isStreaming = false,
  className,
  footer,
  onLoadMore,
  isLoadingMore = false,
  hasMore,
  onDeleteMessage,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef<number>(0)
  const isRestoringScrollRef = useRef(false)

  // Auto-scroll to bottom when new messages arrive (but not when prepending older)
  useEffect(() => {
    if (isRestoringScrollRef.current) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  // Preserve scroll position when older messages are prepended
  useEffect(() => {
    if (!isRestoringScrollRef.current) return
    const viewport = scrollRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]'
    )
    if (!viewport) return
    requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight - prevScrollHeightRef.current
      isRestoringScrollRef.current = false
    })
  }, [messages])

  // IntersectionObserver on sentinel to trigger loadMore
  const handleLoadMore = useCallback(async () => {
    if (!onLoadMore || isLoadingMore || hasMore === false) return
    const viewport = scrollRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]'
    )
    if (viewport) {
      prevScrollHeightRef.current = viewport.scrollHeight
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
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [onLoadMore, hasMore, isLoadingMore, handleLoadMore])

  // Only mark the last assistant message as streaming, and only if it's
  // actually the newest message (not a previous response before a new user message)
  const lastAssistantIndex = messages.findLastIndex(
    (m) => m.role === 'assistant'
  )
  const lastMessageIndex = messages.length - 1
  const isLastAssistantTheNewest =
    lastAssistantIndex === lastMessageIndex ||
    // The assistant message might not exist yet — don't mark old ones
    lastAssistantIndex === -1

  // Group messages by date for date separator headers
  const dateGroups: DateGroup[] = groupMessagesByDate(messages)

  return (
    <ScrollArea className={cn('flex-1', className)} ref={scrollRef}>
      <div className="px-4 py-4 space-y-4">
        {/* Sentinel for infinite scroll — triggers loadMore when visible */}
        <div ref={sentinelRef} className="h-1" aria-hidden="true" />

        {/* Loading more indicator */}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* "No more messages" indicator */}
        {hasMore === false && messages.length > 0 && (
          <p className="text-center text-xs text-muted-foreground py-1">
            Början av konversationen
          </p>
        )}

        {dateGroups.map((group) => (
          <div key={group.label} className="space-y-4">
            {/* Date separator header */}
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground shrink-0">
                {group.label}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {group.messages.map((message) => {
              const index = messages.indexOf(message)
              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={
                    isStreaming &&
                    index === lastAssistantIndex &&
                    isLastAssistantTheNewest
                  }
                  onDelete={onDeleteMessage}
                />
              )
            })}
          </div>
        ))}

        {/* Show typing indicator when waiting for first token */}
        {isStreaming && !isLastAssistantTheNewest && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted border border-border">
              <LexaIcon size={16} />
            </div>
            <div className="pt-1">
              <StreamingIndicator />
            </div>
          </div>
        )}

        {/* Inline footer (e.g. assessment resolution) */}
        {footer}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
