'use client'

/**
 * AI Chat Sidebar — desktop right-rail.
 * Story 14.25: reuses ChatPanelChrome for consistent header UX across chat
 * surfaces (sidebar + modal chats). Hoists useChatInterface so the Chrome's
 * message-count-aware buttons stay in sync with the ChatPanel body.
 *
 * History opens as a LOCAL slide-over inside the sidebar (distinct from
 * Hem's global left-side panel) — keeps the history browsing visually
 * scoped to the chat surface the user is in.
 */

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import type { UIMessage } from 'ai'
import { MessageSquare } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ChatPanel } from '@/components/features/ai-chat/chat-panel'
import { ChatPanelChrome } from '@/components/features/ai-chat/chat-panel-chrome'
import { ConversationHistory } from '@/components/features/dashboard/conversation-history'
import { useChatInterface } from '@/lib/hooks/use-chat-interface'
import { archiveConversation, loadConversation } from '@/app/actions/ai-chat'
import { exportConversation } from '@/lib/utils/format-conversation-export'

interface RightSidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export function RightSidebar({ isOpen, onToggle }: RightSidebarProps) {
  const pathname = usePathname()
  const isHemPage = pathname === '/dashboard'
  const [isExpanded, setIsExpanded] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const chat = useChatInterface({ contextType: 'global' })
  const hasMessages = chat.messages.length > 0

  // Reset the local history overlay whenever the sidebar itself is folded.
  useEffect(() => {
    if (!isOpen) setHistoryOpen(false)
  }, [isOpen])

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const handleNewChat = useCallback(async () => {
    try {
      if (hasMessages) {
        await archiveConversation()
        await chat.clearHistory()
      }
    } catch {
      toast.error('Kunde inte spara konversationen. Försök igen.')
    }
  }, [hasMessages, chat])

  const handleHistoryClick = useCallback(() => {
    setHistoryOpen(true)
  }, [])

  const handleExport = useCallback(() => {
    void exportConversation({ contextType: 'global' })
  }, [])

  const handleLoadConversation = useCallback(
    async (conversationId: string) => {
      if (hasMessages) {
        await archiveConversation()
      }
      const result = await loadConversation(conversationId)
      if (result.success && result.data) {
        const uiMessages: UIMessage[] = result.data.map((msg) => ({
          id: msg.id,
          role: msg.role === 'USER' ? 'user' : 'assistant',
          parts: [{ type: 'text' as const, text: msg.content }],
          createdAt: msg.createdAt,
          ...(msg.metadata ? { metadata: msg.metadata } : {}),
        }))
        chat.replaceMessages(uiMessages)
      }
    },
    [hasMessages, chat]
  )

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      setHistoryOpen(false)
      void handleLoadConversation(conversationId)
    },
    [handleLoadConversation]
  )

  // Keep responding to Hem's left-panel selections too — cross-surface sync
  // when a user navigates between /hem and a sidebar-enabled route with a
  // conversation tee'd up.
  useEffect(() => {
    const handler = (e: Event) => {
      const { conversationId } = (e as CustomEvent<{ conversationId: string }>)
        .detail
      handleLoadConversation(conversationId)
    }
    window.addEventListener('laglig:load-conversation', handler)
    return () => window.removeEventListener('laglig:load-conversation', handler)
  }, [handleLoadConversation])

  return (
    <>
      {/* Toggle FAB when sidebar is folded - desktop only, hidden on Hem
          (Hem renders the onboarding FAB in the same corner). */}
      {!isOpen && !isHemPage && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggle}
                aria-label="Öppna assistent"
                className="hidden lg:inline-flex fixed bottom-6 right-6 z-40 h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <MessageSquare className="h-5 w-5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Assistent</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Sidebar container - hidden on mobile */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-l bg-card transition-all duration-300 ease-in-out',
          isOpen
            ? isExpanded
              ? 'w-[min(768px,55vw)]'
              : 'w-[480px]'
            : 'w-0 overflow-hidden'
        )}
      >
        {isOpen && (
          <>
            <ChatPanelChrome
              title="Assistent"
              subtitle="Fråga om regler och efterlevnad"
              expanded={isExpanded}
              onNewChat={handleNewChat}
              onHistoryClick={handleHistoryClick}
              onToggleExpand={toggleExpanded}
              onClose={onToggle}
              onExport={handleExport}
              messageCount={chat.messages.length}
            />

            {/* Relative wrapper so the history slide-over can overlay just the
                chat body (below the chrome) without breaking modal focus. */}
            <div className="relative flex-1 flex flex-col min-h-0 bg-background/50">
              <ChatPanel
                contextType="global"
                analyticsLocation="sidebar"
                onClose={onToggle}
                showHeader={false}
                chat={chat}
              />

              {historyOpen && (
                <div
                  className="absolute inset-0 z-10 flex flex-col bg-background animate-in slide-in-from-right duration-200"
                  data-testid="sidebar-history-overlay"
                >
                  <ConversationHistory
                    onSelectConversation={handleSelectConversation}
                    onBack={() => setHistoryOpen(false)}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  )
}
