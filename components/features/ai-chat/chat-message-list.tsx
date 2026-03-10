'use client'

/**
 * Chat Message List Component
 * Scrollable container for chat messages with streaming state management
 */

import { useRef, useEffect } from 'react'
import type { UIMessage } from 'ai'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessage } from './chat-message'
import { StreamingIndicator } from './streaming-indicator'
import { LexaIcon } from '@/components/ui/lexa-icon'
import { cn } from '@/lib/utils'

interface ChatMessageListProps {
  messages: UIMessage[]
  isStreaming?: boolean
  className?: string
  /** Optional inline content rendered after all messages (e.g. assessment UI) */
  footer?: React.ReactNode
}

export function ChatMessageList({
  messages,
  isStreaming = false,
  className,
  footer,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

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

  return (
    <ScrollArea className={cn('flex-1', className)} ref={scrollRef}>
      <div className="px-4 py-4 space-y-4">
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            isStreaming={
              isStreaming &&
              index === lastAssistantIndex &&
              isLastAssistantTheNewest
            }
          />
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
