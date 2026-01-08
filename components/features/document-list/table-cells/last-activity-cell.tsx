'use client'

/**
 * Story 6.2: Last Activity Cell for Table View
 * Displays relative timestamp with tooltip showing action description
 */

import { memo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface LastActivity {
  action: string
  timestamp: Date
  userName: string | null
}

interface LastActivityCellProps {
  activity: LastActivity | null
  isLoading?: boolean
  className?: string
}

/**
 * Map activity action codes to Swedish descriptions
 */
function getActionDescription(action: string): string {
  const actionMap: Record<string, string> = {
    create: 'Skapade',
    update: 'Uppdaterade',
    status_change: 'Ändrade status',
    compliance_change: 'Ändrade efterlevnadsstatus',
    assign: 'Tilldelade',
    comment: 'Kommenterade',
    evidence_add: 'Lade till bevis',
    task_complete: 'Slutförde uppgift',
  }
  return actionMap[action] ?? action
}

/**
 * LastActivityCell displays the most recent activity for a list item
 * Shows "—" if data is unavailable (null value indicates ActivityLog model unavailable)
 */
export const LastActivityCell = memo(function LastActivityCell({
  activity,
  isLoading = false,
  className,
}: LastActivityCellProps) {
  // Loading state
  if (isLoading) {
    return <LastActivityCellSkeleton />
  }

  // Unavailable data (ActivityLog model doesn't exist or no activity)
  if (!activity) {
    return <span className="text-muted-foreground">—</span>
  }

  const relativeTime = formatDistanceToNow(new Date(activity.timestamp), {
    addSuffix: true,
    locale: sv,
  })

  const actionDescription = getActionDescription(activity.action)
  const tooltipText = activity.userName
    ? `${actionDescription} av ${activity.userName}`
    : actionDescription

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'text-sm text-muted-foreground cursor-default whitespace-nowrap',
            className
          )}
        >
          {relativeTime}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  )
})

/**
 * Loading skeleton for LastActivityCell
 */
export function LastActivityCellSkeleton() {
  return <Skeleton className="h-4 w-24" />
}
