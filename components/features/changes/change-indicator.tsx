'use client'

/**
 * Story 8.1 Task 6: Change Indicator
 * Small dot/badge showing pending change count on law list items.
 * Clickable — navigates to Changes tab filtered for that document.
 */

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ChangeIndicatorProps {
  /** Number of unacknowledged changes for this document */
  count: number
  /** Document ID used to filter the Changes tab */
  documentId: string
  /** Optional className for layout adjustment */
  className?: string
}

export function ChangeIndicator({
  count,
  documentId,
  className,
}: ChangeIndicatorProps) {
  const router = useRouter()

  if (count === 0) return null

  const label = count === 1 ? '1 ändring' : `${count} ändringar`

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click from firing
    router.push(`/laglistor?tab=changes&document=${documentId}`)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20',
        className
      )}
      aria-label={`${count} oläst${count === 1 ? '' : 'a'} ändring${count === 1 ? '' : 'ar'}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
      {label}
    </button>
  )
}
