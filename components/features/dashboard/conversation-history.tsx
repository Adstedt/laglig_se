'use client'

/**
 * Story 14.11 + 3.10: Conversation History with Search
 * Lists saved (archived) conversations with timestamp + first message preview.
 * Click to load a past conversation. Search across all conversations.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MessageSquare,
  Clock,
  ChevronLeft,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getConversationHistory,
  searchConversations,
  type ConversationSummary,
} from '@/app/actions/ai-chat'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'

interface ConversationHistoryProps {
  onSelectConversation: (_conversationId: string) => void
  /** Called when selecting the active conversation from search results */
  onSelectActive?: () => void
  onBack: () => void
}

interface SearchResult {
  conversationId: string | null
  snippet: string
  messageCount: number
  createdAt: Date
}

export function ConversationHistory({
  onSelectConversation,
  onSelectActive,
  onBack,
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null
  )
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      setSearchResults(null)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await searchConversations(value.trim())
        if (result.success && result.data) {
          setSearchResults(result.data)
        }
      } catch {
        // Silently handle search errors
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults(null)
    setIsSearching(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  // Highlight matching text in snippet
  const highlightSnippet = useCallback(
    (snippet: string) => {
      if (!searchQuery.trim()) return snippet
      const regex = new RegExp(
        `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
        'gi'
      )
      const parts = snippet.split(regex)
      // Odd-indexed elements from split with a capture group are always matches
      return parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-900/50 rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )
    },
    [searchQuery]
  )

  const handleSelectSearchResult = useCallback(
    (result: SearchResult) => {
      if (result.conversationId) {
        onSelectConversation(result.conversationId)
      } else {
        // Active conversation
        onSelectActive?.()
        onBack()
      }
    },
    [onSelectConversation, onSelectActive, onBack]
  )

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

      {/* Search input */}
      <div className="px-4 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Sök i konversationer..."
            className="pl-8 pr-8 h-8 text-sm"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearSearch}
              className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7"
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Rensa sökning</span>
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading || isSearching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : searchResults !== null ? (
          /* Search results */
          searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Search className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Inga resultat för &ldquo;{searchQuery}&rdquo;
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {searchResults.map((result, index) => (
                <button
                  key={result.conversationId ?? `active-${index}`}
                  onClick={() => handleSelectSearchResult(result)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                    'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm line-clamp-2">
                      {highlightSnippet(result.snippet)}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      {!result.conversationId && (
                        <>
                          <span className="text-primary font-medium">
                            Aktiv
                          </span>
                          <span>&middot;</span>
                        </>
                      )}
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(result.createdAt), {
                          addSuffix: true,
                          locale: sv,
                        })}
                      </span>
                      <span>&middot;</span>
                      <span>
                        {result.messageCount}{' '}
                        {result.messageCount === 1
                          ? 'meddelande'
                          : 'meddelanden'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )
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
