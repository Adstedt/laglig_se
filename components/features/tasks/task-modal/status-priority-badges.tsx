'use client'

/**
 * Story 6.6: Status and Priority Badges
 * Display-only badges for task status and priority
 */

import { Badge } from '@/components/ui/badge'
import { Flag, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskPriority } from '@prisma/client'

interface StatusPriorityBadgesProps {
  status: string
  statusColor: string
  priority: TaskPriority
  isDone: boolean
}

const PRIORITY_CONFIG = {
  LOW: {
    label: 'Låg',
    className: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
    iconClassName: 'text-gray-500',
  },
  MEDIUM: {
    label: 'Medium',
    className: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    iconClassName: 'text-blue-500',
  },
  HIGH: {
    label: 'Hög',
    className: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
    iconClassName: 'text-orange-500',
  },
  CRITICAL: {
    label: 'Kritisk',
    className: 'bg-red-100 text-red-700 hover:bg-red-100',
    iconClassName: 'text-red-500',
  },
} as const

export function StatusPriorityBadges({
  status,
  statusColor,
  priority,
  isDone,
}: StatusPriorityBadgesProps) {
  const priorityConfig = PRIORITY_CONFIG[priority]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status Badge */}
      <Badge
        variant="outline"
        className={cn(
          'gap-1.5 font-medium',
          isDone && 'bg-green-50 text-green-700 border-green-200'
        )}
        style={
          !isDone
            ? {
                backgroundColor: `${statusColor}15`,
                borderColor: `${statusColor}40`,
                color: statusColor,
              }
            : undefined
        }
      >
        {isDone && <CheckCircle2 className="h-3 w-3" />}
        <span
          className={cn('w-2 h-2 rounded-full', !isDone && 'inline-block')}
          style={!isDone ? { backgroundColor: statusColor } : undefined}
        />
        {status}
      </Badge>

      {/* Priority Badge */}
      <Badge
        variant="secondary"
        className={cn('gap-1.5', priorityConfig.className)}
      >
        <Flag className={cn('h-3 w-3', priorityConfig.iconClassName)} />
        {priorityConfig.label}
      </Badge>
    </div>
  )
}
