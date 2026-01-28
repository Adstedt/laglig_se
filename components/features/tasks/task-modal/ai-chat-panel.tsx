'use client'

/**
 * AI Chat Panel for Task Modal
 * In-modal AI chat flyout panel with streaming responses
 * Uses shared ChatPanel component for consistent UX
 */

import { ChatPanel } from '@/components/features/ai-chat/chat-panel'

interface AiChatPanelProps {
  taskTitle: string
  taskId?: string
  taskDescription?: string
  linkedLawIds?: string[]
  onClose: () => void
}

const TASK_SUGGESTED_QUESTIONS = [
  'Vilka lagar är relevanta för denna uppgift?',
  'Vad bör jag tänka på?',
  'Finns det tidsfrister att vara medveten om?',
]

export function AiChatPanel({
  taskTitle,
  taskId,
  taskDescription,
  linkedLawIds,
  onClose,
}: AiChatPanelProps) {
  return (
    <div
      className="flex flex-col h-full w-full bg-background border-t border-r border-b rounded-r-lg overflow-hidden"
      data-testid="ai-chat-panel"
    >
      <ChatPanel
        contextType="task"
        contextId={taskId}
        initialContext={{
          title: taskTitle,
          description: taskDescription,
          linkedLawIds,
        }}
        analyticsLocation="task_modal"
        onClose={onClose}
        title="Lexa"
        subtitle="Fråga om uppgiften"
        showHeader={false}
        emptyStateTitle="Fråga Lexa om uppgiften"
        emptyStateDescription={`Lexa kan hjälpa dig med "${taskTitle.length > 30 ? taskTitle.substring(0, 30) + '...' : taskTitle}"`}
        suggestedQuestions={TASK_SUGGESTED_QUESTIONS}
        className="border-0"
      />
    </div>
  )
}
