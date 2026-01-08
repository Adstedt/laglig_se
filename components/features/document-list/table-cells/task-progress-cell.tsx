'use client'

/**
 * Story 6.2: Task Progress Cell for Table View
 * Displays task progress: "3/5 uppgifter klara" with mini progress bar
 */

import { memo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface TaskProgressCellProps {
  completed: number | null
  total: number | null
  isLoading?: boolean
  className?: string
}

/**
 * TaskProgressCell displays task completion progress for a list item
 * Shows "—" if data is unavailable (null values indicate Task model unavailable)
 */
export const TaskProgressCell = memo(function TaskProgressCell({
  completed,
  total,
  isLoading = false,
  className,
}: TaskProgressCellProps) {
  // Loading state
  if (isLoading) {
    return <TaskProgressCellSkeleton />
  }

  // Unavailable data (Task model doesn't exist or no tasks)
  if (completed === null || total === null) {
    return <span className="text-muted-foreground">—</span>
  }

  // No tasks linked
  if (total === 0) {
    return <span className="text-muted-foreground text-sm">Inga uppgifter</span>
  }

  const percentage = Math.round((completed / total) * 100)
  const isComplete = percentage === 100

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Mini progress bar */}
      <div
        className="h-2 w-16 bg-muted rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${completed} av ${total} uppgifter klara`}
      >
        <div
          className={cn(
            'h-full transition-all duration-300',
            isComplete ? 'bg-green-500' : 'bg-blue-500'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {/* Text display */}
      <span
        className={cn(
          'text-xs whitespace-nowrap',
          isComplete ? 'text-green-600 font-medium' : 'text-muted-foreground'
        )}
      >
        {completed}/{total} klara
      </span>
    </div>
  )
})

/**
 * Loading skeleton for TaskProgressCell
 */
export function TaskProgressCellSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-2 w-16" />
      <Skeleton className="h-4 w-16" />
    </div>
  )
}
