'use client'

/**
 * AI Chat Sidebar - Main app chat panel
 * 480px width (960px expanded), integrates with layout store for toggle state
 */

import { useState, useEffect, useRef } from 'react'
import { X, Sparkles, MessageSquare, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChatMessageList } from '@/components/features/ai-chat/chat-message-list'
import { ChatInputModern } from '@/components/features/ai-chat/chat-input-modern'
import { ChatError } from '@/components/features/ai-chat/chat-error'
import { useChatInterface } from '@/lib/hooks/use-chat-interface'
import { track } from '@vercel/analytics'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface RightSidebarProps {
  isOpen: boolean
  onToggle: () => void
}

const SUGGESTED_QUESTIONS = [
  'Vad säger arbetsmiljölagen om arbetsgivarens ansvar?',
  'Vilka regler gäller för uppsägning av anställda?',
  'Hur fungerar GDPR i Sverige?',
  'Vad är skillnaden mellan semesterlagen och arbetstidslagen?',
]

export function RightSidebar({ isOpen, onToggle }: RightSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
  const isLoading = isStreaming || isSubmitted

  // Track sidebar open
  useEffect(() => {
    if (isOpen) {
      track('ai_chat_opened', { location: 'sidebar', expanded: isExpanded })
      // Focus input when opened
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, isExpanded])

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question)
  }

  const handleAttach = () => {
    // TODO: Implement file attachment
  }

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev)
    track('ai_chat_expanded', { expanded: !isExpanded })
  }

  return (
    <>
      {/* Toggle button when sidebar is folded - hidden on mobile */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="hidden lg:flex fixed right-0 top-1/2 z-40 h-14 w-8 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 bg-primary text-primary-foreground shadow-lg transition-all hover:w-10 hover:bg-primary/90"
          aria-label="Öppna AI Chat"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      )}

      {/* Sidebar container - hidden on mobile */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-l bg-card transition-all duration-300 ease-in-out',
          isOpen
            ? isExpanded
              ? 'w-[960px]'
              : 'w-[480px]'
            : 'w-0 overflow-hidden'
        )}
      >
        {/* Header */}
        <div className="flex h-[60px] items-center justify-between border-b px-4 shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted border border-border">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">AI Assistent</h2>
              <p className="text-xs text-muted-foreground">Fråga om lagar</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Expand/Collapse button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleExpanded}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {isExpanded ? 'Förminska' : 'Expandera'}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>
                    {isExpanded ? 'Förminska panel' : 'Expandera för fokusläge'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Stäng AI Chat</span>
            </Button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 flex flex-col min-h-0 bg-background/50">
          {messages.length === 0 && !hasError ? (
            <EmptyState
              onSelectQuestion={handleSuggestedQuestion}
              suggestedQuestions={SUGGESTED_QUESTIONS}
              isExpanded={isExpanded}
            />
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
              isStreaming={isLoading}
            />
          )}
        </div>

        {/* Input area */}
        <ChatInputModern
          ref={inputRef}
          onSend={sendMessage}
          onAttach={handleAttach}
          disabled={hasError}
          isLoading={isLoading}
          isExpanded={isExpanded}
        />
      </aside>
    </>
  )
}

interface EmptyStateProps {
  onSelectQuestion: (_question: string) => void
  suggestedQuestions: string[]
  isExpanded?: boolean
}

function EmptyState({
  onSelectQuestion,
  suggestedQuestions,
  isExpanded,
}: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted border border-border mb-4">
        <MessageSquare className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Hur kan jag hjälpa dig?</h3>
      <p className="text-sm text-muted-foreground max-w-[320px] mb-6">
        Ställ frågor om svensk lagstiftning så hjälper jag dig hitta relevanta
        lagar och förklaringar.
      </p>

      {/* Suggested questions - wider grid when expanded */}
      <div
        className={cn(
          'w-full space-y-2',
          isExpanded
            ? 'max-w-[600px] grid grid-cols-2 gap-2 space-y-0'
            : 'max-w-[400px]'
        )}
      >
        {suggestedQuestions.map((question, index) => (
          <button
            key={index}
            onClick={() => onSelectQuestion(question)}
            className="w-full text-left text-sm px-4 py-3 rounded-lg border border-border bg-background hover:bg-muted hover:border-border transition-colors group"
          >
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              {question}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
