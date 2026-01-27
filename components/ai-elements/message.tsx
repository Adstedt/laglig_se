'use client'

/**
 * AI Elements: Message Components
 * Based on Vercel AI Elements patterns for AI SDK integration
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User, Sparkles } from 'lucide-react'

interface MessageProps {
  from: 'user' | 'assistant' | 'system'
  children: React.ReactNode
  className?: string
}

interface MessageContentProps {
  children: React.ReactNode
  className?: string
}

const MessageContext = React.createContext<{
  from: 'user' | 'assistant' | 'system'
}>({
  from: 'user',
})

export function Message({ from, children, className }: MessageProps) {
  return (
    <MessageContext.Provider value={{ from }}>
      <div
        className={cn(
          'flex gap-3 py-3',
          from === 'user' ? 'flex-row-reverse' : 'flex-row',
          className
        )}
        data-role={from}
      >
        <MessageAvatar from={from} />
        <div
          className={cn(
            'flex-1 space-y-2',
            from === 'user' ? 'text-right' : 'text-left'
          )}
        >
          {children}
        </div>
      </div>
    </MessageContext.Provider>
  )
}

function MessageAvatar({ from }: { from: 'user' | 'assistant' | 'system' }) {
  return (
    <Avatar className="h-8 w-8 shrink-0">
      <AvatarFallback
        className={cn(
          from === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-gradient-to-br from-primary/20 to-primary/5'
        )}
      >
        {from === 'user' ? (
          <User className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4 text-primary" />
        )}
      </AvatarFallback>
    </Avatar>
  )
}

export function MessageContent({ children, className }: MessageContentProps) {
  const { from } = React.useContext(MessageContext)

  return (
    <div
      className={cn(
        'rounded-lg px-3 py-2 text-sm',
        from === 'user'
          ? 'bg-primary text-primary-foreground ml-auto max-w-[85%] inline-block'
          : 'bg-muted max-w-[85%]',
        className
      )}
    >
      {children}
    </div>
  )
}

export function useMessageContext() {
  return React.useContext(MessageContext)
}
