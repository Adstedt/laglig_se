'use client'

/**
 * Shared hook for extracting follow-up question chips from agent messages.
 * Used by ChatPanel and ChangeAssessmentView.
 * Story 14.10: Dynamic follow-up suggestions
 */

import { useState, useMemo, useCallback } from 'react'
import type { UIMessage } from 'ai'
import { isToolUIPart } from 'ai'

export interface FollowupQuestion {
  text: string
  category?: string
}

export function useFollowupChips(
  messages: UIMessage[],
  hasCompletedReply: boolean
) {
  const [dismissed, setDismissed] = useState(false)

  const questions = useMemo(() => {
    if (dismissed || !hasCompletedReply) return null

    // Only show when user has sent exactly 1 message (the initial auto-message)
    const userMessages = messages.filter((m) => m.role === 'user')
    if (userMessages.length > 1) return null

    // Find suggest_followups tool result in first assistant message
    const firstAssistant = messages.find((m) => m.role === 'assistant')
    if (!firstAssistant) return null

    for (const part of firstAssistant.parts ?? []) {
      if (
        isToolUIPart(part) &&
        'toolName' in part &&
        (part as { toolName: string }).toolName === 'suggest_followups' &&
        part.state === 'output-available'
      ) {
        const result = (part as { result?: unknown }).result as
          | { data?: FollowupQuestion[] }
          | undefined
        if (result?.data && Array.isArray(result.data)) {
          return result.data
        }
      }
    }

    return null
  }, [messages, hasCompletedReply, dismissed])

  const dismiss = useCallback(() => setDismissed(true), [])

  return { questions, dismiss }
}
