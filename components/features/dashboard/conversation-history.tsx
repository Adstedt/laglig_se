'use client'

/**
 * Story 14.11: Conversation History
 * Lists saved (archived) conversations with timestamp + first message preview.
 * Click to load a past conversation.
 */

import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Clock, ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getConversationHistory,
  type ConversationSummary,
} from '@/app/actions/ai-chat'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'

interface ConversationHistoryProps {
  onSelectConversation: (_conversationId: string) => void
  onBack: () => void
}

export function ConversationHistory({
  onSelectConversation,
  onBack,
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getConversationHistory()
      if (result.success && result.data) {
        setConversations(result.data)
      }
    } catch (err) {
      console.error('Failed to load conversation history:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8 shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Tillbaka</span>
        </Button>
        <h2 className="text-sm font-semibold">Tidigare konversationer</h2>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Inga sparade konversationer ännu.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {conversations.map((conversation) => (
              <button
                key={conversation.conversationId}
                onClick={() =>
                  onSelectConversation(conversation.conversationId)
                }
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                  'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {conversation.firstMessage}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {formatDistanceToNow(new Date(conversation.createdAt), {
                        addSuffix: true,
                        locale: sv,
                      })}
                    </span>
                    <span>&middot;</span>
                    <span>
                      {conversation.messageCount}{' '}
                      {conversation.messageCount === 1
                        ? 'meddelande'
                        : 'meddelanden'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
