'use client'

/**
 * AI Chat Panel for Legal Document Modal
 * In-modal AI chat flyout panel with streaming responses
 * Uses shared ChatPanel component for consistent UX
 */

import { ChatPanel } from '@/components/features/ai-chat/chat-panel'

interface AiChatPanelProps {
  documentTitle: string
  documentNumber: string
  listItemId?: string
  summary?: string
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
  onClose,
}: AiChatPanelProps) {
  return (
    <div className="flex flex-col h-full w-full bg-background border-t border-r border-b rounded-r-lg overflow-hidden">
      <ChatPanel
        contextType="law"
        contextId={listItemId}
        initialContext={{
          title: documentTitle,
          sfsNumber: documentNumber,
          summary,
        }}
        analyticsLocation="law_modal"
        onClose={onClose}
        title="AI Assistent"
        subtitle={documentNumber}
        emptyStateTitle="Ställ en fråga om lagen"
        emptyStateDescription={`AI:n kan hjälpa dig förstå ${documentTitle.length > 40 ? documentTitle.substring(0, 40) + '...' : documentTitle}`}
        suggestedQuestions={LAW_SUGGESTED_QUESTIONS}
        className="border-0"
      />
    </div>
  )
}
