'use client'

/**
 * Chat Message List Component
 * Scrollable container for chat messages with modern styling
 */

import { useRef, useEffect } from 'react'
import type { UIMessage } from 'ai'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessage } from './chat-message'
import { StreamingIndicator } from './streaming-indicator'
import type { Citation } from '@/lib/ai/citations'
import { cn } from '@/lib/utils'

interface ChatMessageListProps {
  messages: UIMessage[]
  citations?: Citation[]
  isStreaming?: boolean
  className?: string
}

export function ChatMessageList({
  messages,
  citations = [],
  isStreaming = false,
  className,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  return (
    <ScrollArea className={cn('flex-1', className)} ref={scrollRef}>
      <div className="px-4 py-4 space-y-4">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            citations={message.role === 'assistant' ? citations : []}
          />
        ))}

        {isStreaming && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <span className="text-xs font-medium text-primary">AI</span>
            </div>
            <div className="pt-1">
              <StreamingIndicator />
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
