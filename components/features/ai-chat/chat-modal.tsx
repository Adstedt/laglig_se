'use client'

/**
 * Story 3.3: Chat Modal Component
 * Full-screen modal for mobile chat experience
 */

import { useEffect } from 'react'
import { X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChatMessageList } from './chat-message-list'
import { ChatInput } from './chat-input'
import { ChatError } from './chat-error'
import { useChatInterface } from '@/lib/hooks/use-chat-interface'
import { track } from '@vercel/analytics'

interface ChatModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ChatModal({ isOpen, onClose }: ChatModalProps) {
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

  // Track modal open
  useEffect(() => {
    if (isOpen) {
      track('ai_chat_opened', { location: 'modal' })
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="h-[100dvh] max-h-[100dvh] w-screen max-w-none p-0 gap-0 rounded-none sm:rounded-none"
        data-testid="chat-modal"
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between border-b px-4 py-3 space-y-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle className="text-sm font-medium">
              AI Assistent
            </DialogTitle>
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
        </DialogHeader>

        {/* Messages area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {messages.length === 0 && !hasError ? (
            <MobileEmptyState />
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
              className="flex-1 min-h-0"
            />
          )}
        </div>

        {/* Input area */}
        <ChatInput
          onSend={sendMessage}
          disabled={hasError}
          isLoading={isStreaming || isSubmitted}
        />
      </DialogContent>
    </Dialog>
  )
}

function MobileEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-base font-medium mb-1">Hur kan jag hjälpa dig?</h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">
        Ställ en fråga om svensk lagstiftning så hjälper jag dig hitta relevanta
        lagar och förklaringar.
      </p>
    </div>
  )
}
