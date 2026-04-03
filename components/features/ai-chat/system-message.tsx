'use client'

/**
 * Story 14.15b, Task 9: Ephemeral system messages in the chat.
 * Styled as centered muted text (similar to date separators).
 * Auto-fades after SYSTEM_MESSAGE_FADE_MS.
 */

import { useEffect, useState } from 'react'
import {
  useChatDetail,
  type SystemMessageItem,
} from '@/lib/ai/chat-detail-context'
import { cn } from '@/lib/utils'

/** Time in ms before a system message starts fading out */
export const SYSTEM_MESSAGE_FADE_MS = 30000

interface SystemMessageProps {
  message: SystemMessageItem
}

export function SystemMessage({ message }: SystemMessageProps) {
  const { removeSystemMessage } = useChatDetail()
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), SYSTEM_MESSAGE_FADE_MS)
    // Remove from state after fade animation completes (500ms transition)
    const removeTimer = setTimeout(
      () => removeSystemMessage(message.id),
      SYSTEM_MESSAGE_FADE_MS + 500
    )
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [message.id, removeSystemMessage])

  return (
    <div
      className={cn(
        'flex items-center justify-center py-1 transition-opacity duration-500',
        fading ? 'opacity-0' : 'opacity-100'
      )}
    >
      <span className="text-xs text-muted-foreground/70 italic">
        {message.text}
      </span>
    </div>
  )
}
