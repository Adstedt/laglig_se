'use client'

/**
 * Story 14.10: Change Assessment View for Hem page
 * Focused chat view for reviewing a single change.
 * Replaces the home state when a change is selected from the picker.
 */

import { useRef, useEffect, useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChatMessageList } from '@/components/features/ai-chat/chat-message-list'
import { ChatInputModern } from '@/components/features/ai-chat/chat-input-modern'
import { ChatError } from '@/components/features/ai-chat/chat-error'
import { AssessmentResolution } from '@/components/features/changes/assessment-resolution'
import { FollowupChips } from '@/components/features/ai-chat/followup-chips'
import { useChatInterface } from '@/lib/hooks/use-chat-interface'
import { useFollowupChips } from '@/lib/hooks/use-followup-chips'
import type { UnacknowledgedChange } from '@/lib/changes/change-utils'
import type { ChangeType } from '@prisma/client'

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  AMENDMENT: 'Ändring',
  REPEAL: 'Upphävande',
  NEW_LAW: 'Ny lag',
  METADATA_UPDATE: 'Metadata',
  NEW_RULING: 'Nytt avgörande',
}

const AUTO_START_MESSAGE =
  'Granska denna lagändring och bedöm hur den påverkar vår verksamhet.'

interface ChangeAssessmentViewProps {
  change: UnacknowledgedChange
  onBack: () => void
}

export function ChangeAssessmentView({
  change,
  onBack,
}: ChangeAssessmentViewProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { messages, sendMessage, status, error, retryAfter, handleRetry } =
    useChatInterface({
      contextType: 'change',
      contextId: change.id,
      initialMessage: AUTO_START_MESSAGE,
    })

  const isStreaming = status === 'streaming'
  const isSubmitted = status === 'submitted'
  const hasError = status === 'error' && error !== null
  const isLoading = isStreaming || isSubmitted
  const hasCompletedReply =
    !isLoading && messages.some((m) => m.role === 'assistant')

  const { questions: followupQuestions, dismiss: dismissFollowups } =
    useFollowupChips(messages, hasCompletedReply)

  const handleSendMessage = useCallback(
    (content: string) => {
      dismissFollowups()
      sendMessage(content)
    },
    [sendMessage, dismissFollowups]
  )

  const handleFollowupClick = useCallback(
    (question: string) => {
      dismissFollowups()
      sendMessage(question)
    },
    [sendMessage, dismissFollowups]
  )

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const assessmentFooter = hasCompletedReply ? (
    <>
      <AssessmentResolution
        changeEventId={change.id}
        lawListItemId={change.lawListItemId}
      />
      {followupQuestions && (
        <FollowupChips
          questions={followupQuestions}
          onSelect={handleFollowupClick}
        />
      )}
    </>
  ) : undefined

  return (
    <div className="flex h-full flex-col">
      {/* Header with back button + change info */}
      <div className="mx-auto w-full max-w-3xl flex items-center gap-3 px-4 py-3 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tillbaka
        </Button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Badge variant="default" className="shrink-0">
            {CHANGE_TYPE_LABELS[change.changeType]}
          </Badge>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {change.documentTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              {change.documentNumber}
            </p>
          </div>
        </div>
      </div>

      {/* Chat area */}
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
                isStreaming={isLoading}
                footer={assessmentFooter}
              />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 mx-auto w-full max-w-3xl px-4 pb-4">
        <ChatInputModern
          ref={inputRef}
          onSend={handleSendMessage}
          disabled={hasError}
          isLoading={isLoading}
          showModelSelector={false}
          showAttach={false}
          showQuickActions={false}
          placeholder="Fråga om ändringen..."
          className="border-none bg-transparent p-0"
        />
      </div>
    </div>
  )
}
