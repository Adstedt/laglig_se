'use client'

/**
 * Story 6.6: Status and Priority Badges
 * Display-only badges for task status and priority.
 *
 * Story 22.1 follow-up — Priority pill migrated to the tone-aware Badge
 * primitive (closes the audit-found "Hög orange vs rose" drift on the
 * Tasks surface; aligns with /tasks list-tab pill rendering). Status pill
 * keeps its inline-style hex rendering — task statuses are user-defined
 * column colors, a different domain from the enum-based status pills.
 */

import { Badge } from '@/components/ui/badge'
import { Flag, CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { getPriorityBadgeProps } from '@/lib/ui/badge-tones'
import type { TaskPriority } from '@prisma/client'

interface StatusPriorityBadgesProps {
  status: string
  statusColor: string
  priority: TaskPriority
  isDone: boolean
  /** Optional action(s) rendered at the right edge of the badges row */
  headerActions?: ReactNode
}

export function StatusPriorityBadges({
  status,
  statusColor,
  priority,
  isDone,
  headerActions,
}: StatusPriorityBadgesProps) {
  const priorityProps = getPriorityBadgeProps(priority)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status Badge — user-customised column hex color */}
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
          isDone && 'bg-green-100 text-green-700'
        )}
        style={
          !isDone
            ? {
                backgroundColor: `${statusColor}1A`,
                color: statusColor,
              }
            : undefined
        }
      >
        {isDone && <CheckCircle2 className="h-3 w-3" />}
        {status}
      </span>

      {/* Priority Badge — tone-aware via shared map */}
      <Badge
        tone={priorityProps.tone}
        variant={priorityProps.variant}
        className="gap-1.5"
      >
        <Flag className="h-3 w-3" aria-hidden="true" />
        {priorityProps.label}
      </Badge>

      {headerActions && <div className="ml-auto">{headerActions}</div>}
    </div>
  )
}
