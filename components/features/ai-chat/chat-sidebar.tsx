'use client'

/**
 * Story 3.3: Chat Sidebar Component
 * Fixed right sidebar for AI chat (480px width)
 */

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { LexaIcon } from '@/components/ui/lexa-icon'
import { Button } from '@/components/ui/button'
import { ChatMessageList } from './chat-message-list'
import { ChatInput } from './chat-input'
import { ChatError } from './chat-error'
import { useChatInterface } from '@/lib/hooks/use-chat-interface'
import { cn } from '@/lib/utils'
import { track } from '@vercel/analytics'

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
  className?: string
}

export function ChatSidebar({ isOpen, onClose, className }: ChatSidebarProps) {
  const {
    messages,
    sendMessage,
    status,
    error,
    citations,
    retryAfter,
    handleRetry,
  } = useChatInterface({
    contextType: 'global',
  })

  const isStreaming = status === 'streaming'
  const isSubmitted = status === 'submitted'
  const hasError = status === 'error' && error !== null

  // Track sidebar open
  useEffect(() => {
    if (isOpen) {
      track('ai_chat_opened', { location: 'sidebar' })
    }
  }, [isOpen])

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <aside
      className={cn(
        'fixed right-0 top-0 h-screen w-[480px] z-50',
        'flex flex-col bg-background border-l shadow-lg',
        'animate-in slide-in-from-right duration-300',
        className
      )}
      aria-label="AI Chat"
      data-testid="chat-sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
            <LexaIcon size={16} />
          </div>
          <div>
            <span className="text-sm font-medium">Lexa</span>
            <p className="text-xs text-muted-foreground">
              Fråga om regler och efterlevnad
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
          aria-label="Stäng chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages area */}
      {messages.length === 0 && !hasError ? (
        <EmptyState />
      ) : hasError ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <ChatError
            error={error}
            onRetry={handleRetry}
            retryAfter={retryAfter}
          />
        </div>
      ) : (
        <ChatMessageList
          messages={messages}
          citations={citations}
          isStreaming={isStreaming || isSubmitted}
        />
      )}

      {/* Input area */}
      <ChatInput
        onSend={sendMessage}
        disabled={hasError}
        isLoading={isStreaming || isSubmitted}
      />
    </aside>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4">
        <LexaIcon size={32} />
      </div>
      <h3 className="text-base font-medium mb-1">Hur kan jag hjälpa dig?</h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">
        Ställ en fråga om svensk lagstiftning så hjälper jag dig hitta relevanta
        lagar och förklaringar.
      </p>
      <div className="mt-6 space-y-2 text-left w-full max-w-[280px]">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Exempel på frågor
        </p>
        <SuggestedQuestion text="Vad säger arbetsmiljölagen om arbetsgivarens ansvar?" />
        <SuggestedQuestion text="Vilka regler gäller för uppsägning av anställda?" />
        <SuggestedQuestion text="Hur fungerar GDPR i Sverige?" />
      </div>
    </div>
  )
}

function SuggestedQuestion({ text }: { text: string }) {
  return (
    <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
      &quot;{text}&quot;
    </p>
  )
}
