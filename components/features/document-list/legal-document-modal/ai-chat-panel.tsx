'use client'

/**
 * AI Chat Panel for Legal Document Modal
 *
 * Hoists useChatInterface so <ChatPanelChrome> (header) and <ChatPanel>
 * (body) share the same messages/clearHistory instance.
 */

import { useCallback } from 'react'
import { ChatPanel } from '@/components/features/ai-chat/chat-panel'
import { ChatPanelChrome } from '@/components/features/ai-chat/chat-panel-chrome'
import { useChatInterface } from '@/lib/hooks/use-chat-interface'
import { exportConversation } from '@/lib/utils/format-conversation-export'

interface AiChatPanelProps {
  documentTitle: string
  documentNumber: string
  listItemId?: string | undefined
  summary?: string | undefined
  /** Chat panel is in fullscreen-within-modal mode (State 3). */
  expanded: boolean
  /** Toggle expanded mode. */
  onToggleExpand: () => void
  /** Close the chat panel entirely. */
  onClose: () => void
}

const LAW_SUGGESTED_QUESTIONS = [
  'Sammanfatta lagens huvudsakliga syfte',
  'Vilka är de viktigaste paragraferna?',
  'När trädde lagen i kraft?',
  'Finns det relaterade lagar jag bör känna till?',
]

export function AiChatPanel({
  documentTitle,
  documentNumber,
  listItemId,
  summary,
  expanded,
  onToggleExpand,
  onClose,
}: AiChatPanelProps) {
  const chat = useChatInterface({
    contextType: 'law',
    contextId: listItemId,
    // Story 19.4a: surface the active law-list item explicitly (not only via
    // contextId) so the agent's write tools default to it + the prompt shows it.
    lawListItemId: listItemId,
    initialContext: {
      title: documentTitle,
      sfsNumber: documentNumber,
      summary,
    },
  })

  const handleNewChat = useCallback(() => {
    void chat.clearHistory()
  }, [chat])

  const handleExport = useCallback(() => {
    void exportConversation({ contextType: 'law', contextId: listItemId })
  }, [listItemId])

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      <ChatPanelChrome
        title="Fråga assistenten"
        subtitle={documentNumber}
        expanded={expanded}
        onNewChat={handleNewChat}
        onToggleExpand={onToggleExpand}
        onClose={onClose}
        onExport={handleExport}
        messageCount={chat.messages.length}
      />
      <ChatPanel
        contextType="law"
        contextId={listItemId}
        analyticsLocation="law_modal"
        onClose={onClose}
        title="Assistent"
        subtitle={documentNumber}
        showHeader={false}
        emptyStateTitle="Fråga assistenten om lagen"
        emptyStateDescription={`Assistenten kan hjälpa dig förstå ${documentTitle.length > 40 ? documentTitle.substring(0, 40) + '...' : documentTitle}`}
        suggestedQuestions={LAW_SUGGESTED_QUESTIONS}
        className="border-0 flex-1 min-h-0"
        chat={chat}
      />
    </div>
  )
}
