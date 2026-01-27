'use client'

/**
 * Story 3.3: Streaming Indicator
 * Typing animation while AI response is being generated
 */

import { cn } from '@/lib/utils'

interface StreamingIndicatorProps {
  className?: string
}

export function StreamingIndicator({ className }: StreamingIndicatorProps) {
  return (
    <div
      className={cn('flex items-center gap-1 py-2', className)}
      aria-label="AI skriver..."
      role="status"
    >
      <span className="text-xs text-muted-foreground mr-2">AI skriver</span>
      <span className="flex gap-1">
        <span
          className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </span>
    </div>
  )
}
