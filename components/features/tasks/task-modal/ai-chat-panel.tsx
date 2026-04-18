'use client'

/**
 * AI Chat Panel for Task Modal
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
  taskTitle: string
  taskId?: string | undefined
  taskDescription?: string | undefined
  linkedLawIds?: string[] | undefined
  /** Chat panel is in fullscreen-within-modal mode (State 3). */
  expanded: boolean
  /** Toggle expanded mode. */
  onToggleExpand: () => void
  /** Close the chat panel entirely. */
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
  expanded,
  onToggleExpand,
  onClose,
}: AiChatPanelProps) {
  const chat = useChatInterface({
    contextType: 'task',
    contextId: taskId,
    initialContext: {
      title: taskTitle,
      description: taskDescription,
      linkedLawIds,
    },
  })

  const handleNewChat = useCallback(() => {
    void chat.clearHistory()
  }, [chat])

  const handleExport = useCallback(() => {
    void exportConversation({ contextType: 'task', contextId: taskId })
  }, [taskId])

  return (
    <div
      className="flex flex-col h-full w-full bg-background overflow-hidden"
      data-testid="ai-chat-panel"
    >
      <ChatPanelChrome
        title="Fråga Lexa"
        subtitle="uppgiften"
        expanded={expanded}
        onNewChat={handleNewChat}
        onToggleExpand={onToggleExpand}
        onClose={onClose}
        onExport={handleExport}
        messageCount={chat.messages.length}
      />
      <ChatPanel
        contextType="task"
        contextId={taskId}
        analyticsLocation="task_modal"
        onClose={onClose}
        title="Lexa"
        subtitle="Fråga om uppgiften"
        showHeader={false}
        emptyStateTitle="Fråga Lexa om uppgiften"
        emptyStateDescription={`Lexa kan hjälpa dig med "${taskTitle.length > 30 ? taskTitle.substring(0, 30) + '...' : taskTitle}"`}
        suggestedQuestions={TASK_SUGGESTED_QUESTIONS}
        className="border-0 flex-1 min-h-0"
        chat={chat}
      />
    </div>
  )
}
