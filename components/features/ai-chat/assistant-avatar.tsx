'use client'

/**
 * Shared brand avatar for assistant turns. Rendered identically by the pending
 * "thinking" row (chat-message-list) and the real assistant message
 * (chat-message), so the icon stays visually stable across the
 * submitted → streaming → ready transition instead of flickering when one
 * element unmounts and the other mounts.
 */

import { LexaIcon } from '@/components/ui/lexa-icon'
import { cn } from '@/lib/utils'

export function AssistantAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted',
        className
      )}
    >
      <LexaIcon size={16} />
    </div>
  )
}
