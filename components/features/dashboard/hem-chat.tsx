'use client'

/**
 * Story 14.11: Unified Chat Component for Hem page and sidebar
 * Two render modes: 'full' (Hem page) and 'panel' (right sidebar)
 * Manages home/conversation state transitions.
 */

import { useRef, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Plus, History } from 'lucide-react'
import { useChatInterface } from '@/lib/hooks/use-chat-interface'
import { ChatMessageList } from '@/components/features/ai-chat/chat-message-list'
import { ChatInputModern } from '@/components/features/ai-chat/chat-input-modern'
import { ChatError } from '@/components/features/ai-chat/chat-error'
import {
  ContextCards,
  type DashboardCardData,
} from '@/components/features/dashboard/context-cards'
import { ConversationHistory } from '@/components/features/dashboard/conversation-history'
import { archiveConversation, loadConversation } from '@/app/actions/ai-chat'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const SUGGESTED_PROMPTS = [
  'Visa en översikt av min efterlevnad',
  'Vilka ändringar har jag missat?',
  'Hjälp mig granska en lagändring',
  'Vad behöver jag göra denna vecka?',
]

type ViewState = 'chat' | 'history'

interface HemChatProps {
  /** 'full' for Hem page, 'panel' for right sidebar */
  mode: 'full' | 'panel'
  /** Dashboard data for context cards (full mode only) */
  dashboardData?: DashboardCardData | null
  /** Whether dashboard data is loading */
  dashboardLoading?: boolean
  /** User's first name for greeting */
  userName?: string | undefined
}

export function HemChat({
  mode,
  dashboardData = null,
  dashboardLoading = false,
  userName,
}: HemChatProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [viewState, setViewState] = useState<ViewState>('chat')

  const {
    messages,
    sendMessage,
    status,
    error,
    citations,
    retryAfter,
    handleRetry,
    isLoadingHistory,
    clearHistory,
    replaceMessages,
  } = useChatInterface({
    contextType: 'global',
  })

  const isStreaming = status === 'streaming'
  const isSubmitted = status === 'submitted'
  const hasError = status === 'error' && error !== null
  const isLoading = isStreaming || isSubmitted

  const hasMessages = messages.length > 0
  const isHomeState = !hasMessages && !isLoadingHistory

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content)
    },
    [sendMessage]
  )

  const handlePromptClick = useCallback(
    (prompt: string) => {
      sendMessage(prompt)
    },
    [sendMessage]
  )

  const handleNewConversation = useCallback(async () => {
    try {
      if (hasMessages) {
        await archiveConversation()
        await clearHistory()
      }
      setViewState('chat')
    } catch {
      toast.error('Kunde inte spara konversationen. Försök igen.')
    }
  }, [hasMessages, clearHistory])

  const handleLoadConversation = useCallback(
    async (conversationId: string) => {
      // Archive current active messages first if any
      if (hasMessages) {
        await archiveConversation()
      }
      // Load the selected conversation and display it
      const result = await loadConversation(conversationId)
      if (result.success && result.data) {
        // Convert DB messages to UIMessage format and set them in the chat
        const uiMessages = result.data.map((msg) => ({
          id: msg.id,
          role: (msg.role === 'USER' ? 'user' : 'assistant') as
            | 'user'
            | 'assistant',
          parts: [{ type: 'text' as const, text: msg.content }],
          createdAt: msg.createdAt,
        }))
        replaceMessages(uiMessages)
      }
      setViewState('chat')
    },
    [hasMessages, replaceMessages]
  )

  // Focus input on mount in full mode
  useEffect(() => {
    if (mode === 'full' && viewState === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [mode, viewState])

  const greeting = userName
    ? `Hur kan jag hjälpa dig idag, ${userName}?`
    : 'Hur kan jag hjälpa dig idag?'

  // Show conversation history view
  if (viewState === 'history') {
    return (
      <ConversationHistory
        onSelectConversation={handleLoadConversation}
        onBack={() => setViewState('chat')}
      />
    )
  }

  // Panel mode: always conversation layout
  if (mode === 'panel') {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 flex flex-col min-h-0">
          {hasMessages || hasError ? (
            hasError ? (
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
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Ställ en fråga om lagstiftning och efterlevnad.
              </p>
              <div className="w-full max-w-[340px] space-y-2">
                {SUGGESTED_PROMPTS.slice(0, 2).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptClick(prompt)}
                    className="w-full text-left text-sm px-4 py-3 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                  >
                    <span className="text-muted-foreground hover:text-foreground">
                      {prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <ChatInputModern
          ref={inputRef}
          onSend={handleSend}
          disabled={hasError}
          isLoading={isLoading}
          showModelSelector={false}
          showAttach={false}
          showQuickActions={false}
          placeholder="Skriv ett meddelande..."
        />
      </div>
    )
  }

  // Full mode — two states: home and conversation

  // Conversation state — centered column like Claude.ai
  if (!isHomeState) {
    return (
      <div className="flex h-full flex-col">
        {/* Top bar with "Ny konversation" */}
        <div className="mx-auto w-full max-w-3xl flex items-center justify-end px-4 py-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewConversation}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Ny konversation
          </Button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {hasError ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <ChatError
                error={error}
                onRetry={handleRetry}
                retryAfter={retryAfter}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl">
                <ChatMessageList
                  messages={messages}
                  citations={citations}
                  isStreaming={isLoading}
                />
              </div>
            </div>
          )}
        </div>
        <div className="shrink-0 mx-auto w-full max-w-3xl px-4 pb-4">
          <ChatInputModern
            ref={inputRef}
            onSend={handleSend}
            disabled={hasError}
            isLoading={isLoading}
            showModelSelector={false}
            showAttach={false}
            showQuickActions={false}
            placeholder="Svara..."
            className="border-none bg-transparent p-0"
          />
        </div>
      </div>
    )
  }

  // Home state — centered layout
  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Brand logo */}
        <div className="flex justify-center">
          <Image
            src="/images/logo-icon-white.png"
            alt=""
            width={48}
            height={56}
            className="h-12 w-auto invert dark:invert-0 opacity-80"
            data-testid="brand-logo"
            priority
          />
        </div>

        {/* Greeting */}
        <h1
          className="text-center text-3xl font-semibold font-safiro md:text-4xl"
          style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
        >
          {greeting}
        </h1>

        {/* Context Cards */}
        <div className="flex justify-center">
          <ContextCards
            data={dashboardData}
            isLoading={dashboardLoading}
            onCardClick={handlePromptClick}
          />
        </div>

        {/* Chat Input — remove outer border/bg, let the inner rounded box stand alone */}
        <ChatInputModern
          ref={inputRef}
          onSend={handleSend}
          disabled={false}
          isLoading={false}
          showModelSelector={false}
          showAttach={false}
          showQuickActions={false}
          placeholder="Vad kan jag hjälpa dig med?"
          className="border-none bg-transparent p-0"
        />

        {/* Suggested Prompts */}
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handlePromptClick(prompt)}
              className={cn(
                'rounded-full border border-border bg-background px-4 py-2 text-sm',
                'text-foreground/70 transition-colors',
                'hover:bg-accent hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* History button */}
        <div className="flex justify-center">
          <button
            onClick={() => setViewState('history')}
            className={cn(
              'flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm',
              'text-foreground/70 transition-colors',
              'hover:bg-accent hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            <History className="h-4 w-4" />
            Tidigare konversationer
          </button>
        </div>
      </div>
    </div>
  )
}
