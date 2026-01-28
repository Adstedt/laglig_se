'use client'

/**
 * Shared Chat Panel Component
 * Unified chat UI used by main sidebar, task modal, and law document modal
 */

import { useRef, useEffect, ReactNode } from 'react'
import { X } from 'lucide-react'
import { LexaIcon } from '@/components/ui/lexa-icon'
import { Button } from '@/components/ui/button'
import { ChatMessageList } from './chat-message-list'
import { ChatInputModern } from './chat-input-modern'
import { ChatError } from './chat-error'
import {
  useChatInterface,
  type ChatContextType,
  type ChatContextInitial,
} from '@/lib/hooks/use-chat-interface'
import { track } from '@vercel/analytics'
import { cn } from '@/lib/utils'

interface ChatPanelProps {
  /** Context type determines how messages are processed */
  contextType: ChatContextType
  /** Optional context ID (task ID, law ID, etc.) */
  contextId?: string | undefined
  /** Initial context data passed to the API */
  initialContext?: ChatContextInitial | undefined
  /** Analytics location identifier */
  analyticsLocation: 'sidebar' | 'task_modal' | 'law_modal'
  /** Close handler */
  onClose: () => void
  /** Optional header title override */
  title?: string
  /** Optional header subtitle override */
  subtitle?: string
  /** Custom empty state content */
  emptyStateTitle?: string
  /** Custom empty state description */
  emptyStateDescription?: string
  /** Suggested questions to show in empty state */
  suggestedQuestions?: string[]
  /** Additional CSS classes */
  className?: string
  /** Whether to show the header */
  showHeader?: boolean
  /** Custom header content */
  headerContent?: ReactNode
}

export function ChatPanel({
  contextType,
  contextId,
  initialContext,
  analyticsLocation,
  onClose,
  title = 'Lexa',
  subtitle,
  emptyStateTitle = 'Hur kan jag hjälpa dig?',
  emptyStateDescription,
  suggestedQuestions = [],
  className,
  showHeader = true,
  headerContent,
}: ChatPanelProps) {
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
    contextType,
    contextId,
    initialContext,
  })

  const isStreaming = status === 'streaming'
  const isSubmitted = status === 'submitted'
  const hasError = status === 'error' && error !== null
  const isLoading = isStreaming || isSubmitted

  // Track panel open
  useEffect(() => {
    track('ai_chat_opened', { location: analyticsLocation })
    // Focus input when opened
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [analyticsLocation])

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question)
  }

  return (
    <div
      className={cn('flex flex-col h-full w-full bg-background', className)}
      data-testid="chat-panel"
    >
      {/* Header - matches modal header: py-3 padding, h-8 elements */}
      {showHeader &&
        (headerContent || (
          <div className="flex items-center justify-between border-b px-4 py-3 shrink-0 bg-background">
            <div className="flex items-center gap-2 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{title}</span>
                  {subtitle && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {subtitle}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 shrink-0"
              aria-label="Stäng"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}

      {/* Chat messages area */}
      <div className="flex-1 flex flex-col min-h-0">
        {messages.length === 0 && !hasError ? (
          <EmptyState
            title={emptyStateTitle}
            description={emptyStateDescription}
            suggestedQuestions={suggestedQuestions}
            onSelectQuestion={handleSuggestedQuestion}
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

      {/* Input area - simplified for modal context */}
      <ChatInputModern
        ref={inputRef}
        onSend={sendMessage}
        disabled={hasError}
        isLoading={isLoading}
        placeholder="Skriv din fråga..."
        showModelSelector={false}
        showAttach={false}
        showQuickActions={false}
      />
    </div>
  )
}

interface EmptyStateProps {
  title: string
  description?: string | undefined
  suggestedQuestions: string[]
  onSelectQuestion: (_question: string) => void
}

function EmptyState({
  title,
  description,
  suggestedQuestions,
  onSelectQuestion,
}: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted border border-border mb-4">
        <LexaIcon size={20} />
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-[280px] mb-4">
          {description}
        </p>
      )}

      {/* Suggested questions */}
      {suggestedQuestions.length > 0 && (
        <div className="w-full max-w-[320px] space-y-2 mt-2">
          {suggestedQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => onSelectQuestion(question)}
              className="w-full text-left text-xs px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors group"
            >
              <span className="text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2">
                {question}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
