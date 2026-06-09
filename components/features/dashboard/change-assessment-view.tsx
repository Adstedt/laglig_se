'use client'

/**
 * Story 14.10: Change Assessment View for Hem page
 * Focused chat view for reviewing a single change.
 * Replaces the home state when a change is selected from the picker.
 *
 * Story 14.15b: Wraps in ChatDetailProvider, routes assessment to sidebar
 * when assistant has replied (instead of footer).
 */

import { useRef, useEffect, useCallback } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChatMessageList } from '@/components/features/ai-chat/chat-message-list'
import { ChatInputModern } from '@/components/features/ai-chat/chat-input-modern'
import { ChatError } from '@/components/features/ai-chat/chat-error'
import { ChatDetailSidebar } from '@/components/features/ai-chat/chat-detail-sidebar'
import { FollowupChips } from '@/components/features/ai-chat/followup-chips'
import {
  ChatDetailProvider,
  useChatDetail,
  type AssessmentDetailData,
} from '@/lib/ai/chat-detail-context'
import { findLatestAssessmentRecommendation } from '@/lib/changes/assessment-preview'
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

export function ChangeAssessmentView(props: ChangeAssessmentViewProps) {
  return (
    <ChatDetailProvider>
      <ChangeAssessmentViewInner {...props} />
    </ChatDetailProvider>
  )
}

function ChangeAssessmentViewInner({
  change,
  onBack,
}: ChangeAssessmentViewProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { openDetail } = useChatDetail()

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

  // Open assessment detail in sidebar when first reply completes. Pre-fill from
  // the agent's save_assessment preview if one was emitted; otherwise open blank
  // (safety net if the agent skipped the tool). One-shot on hasCompletedReply:
  // by then streaming is done, so `messages` already holds the tool output, and
  // re-running on every `messages` change would re-call openDetail with the same
  // id and toggle the panel shut.
  useEffect(() => {
    if (!hasCompletedReply) return
    const recommendation = findLatestAssessmentRecommendation(messages)
    const assessmentData: AssessmentDetailData = {
      changeEventId: change.id,
      lawListItemId: change.lawListItemId,
      amendmentSfs: change.amendmentSfs ?? '',
      changeType: change.changeType,
      affectedSections: [],
      effectiveDate: change.effectiveDate ?? null,
      existingAssessment: null,
      recommendation,
      documentTitle: change.documentTitle,
      documentNumber: change.documentNumber,
      onComplete: onBack,
    }
    openDetail({
      type: 'assessment',
      id: `assessment-${change.id}`,
      data: assessmentData,
    })
  }, [hasCompletedReply]) // eslint-disable-line react-hooks/exhaustive-deps

  const followupFooter =
    hasCompletedReply && followupQuestions ? (
      <FollowupChips
        questions={followupQuestions}
        onSelect={handleFollowupClick}
      />
    ) : undefined

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col min-w-0">
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="shrink-0 h-8 w-8"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Stäng</span>
          </Button>
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
            <ChatMessageList
              messages={messages}
              isStreaming={isLoading}
              footer={followupFooter}
              contentClassName="mx-auto w-full max-w-3xl"
            />
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

      {/* Sidebar */}
      <ChatDetailSidebar />
    </div>
  )
}
