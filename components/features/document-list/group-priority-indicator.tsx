'use client'

/**
 * Story 6.17: Group Compliance Overview Indicators
 * Task 2: GroupPriorityIndicator component
 * Displays priority risk distribution badges in group headers
 */

import { useMemo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { DocumentListItem } from '@/app/actions/document-list'
import { PRIORITY_OPTIONS } from './table-cell-editors/priority-editor'
import { cn } from '@/lib/utils'

interface GroupPriorityIndicatorProps {
  items: DocumentListItem[]
}

const PRIORITY_BADGE_COLORS = {
  HIGH: 'bg-rose-100 text-rose-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-slate-100 text-slate-600',
} as const

const PRIORITY_ORDER = ['HIGH', 'MEDIUM', 'LOW'] as const

export function GroupPriorityIndicator({ items }: GroupPriorityIndicatorProps) {
  // Memoized calculation excluding EJ_TILLAMPLIG (AC: 11, 20-22)
  const { priorityCounts, applicableCount } = useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 }

    for (const item of items) {
      if (item.complianceStatus === 'EJ_TILLAMPLIG') continue
      if (item.priority in counts) {
        counts[item.priority as keyof typeof counts]++
      }
    }

    return {
      priorityCounts: counts,
      applicableCount: counts.HIGH + counts.MEDIUM + counts.LOW,
    }
  }, [items])

  // Get priority label from PRIORITY_OPTIONS
  const getPriorityLabel = (priority: string) => {
    return (
      PRIORITY_OPTIONS.find((opt) => opt.value === priority)?.label ?? priority
    )
  }

  // If no applicable items, show "—" (AC: 12)
  if (applicableCount === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs text-muted-foreground">—</span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-sm">Inga tillämpliga dokument</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Priority badges - only non-zero counts (AC: 8-10) */}
        <div className="flex items-center gap-1.5">
          {PRIORITY_ORDER.map((level) => {
            const count = priorityCounts[level]
            if (count === 0) return null
            return (
              <span
                key={level}
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none',
                  PRIORITY_BADGE_COLORS[level]
                )}
              >
                {count} {getPriorityLabel(level)}
              </span>
            )
          })}
        </div>
      </TooltipTrigger>
      {/* Tooltip with full breakdown (AC: 19) */}
      <TooltipContent side="bottom" className="max-w-[280px] p-3">
        <div className="space-y-2">
          <p className="font-semibold text-sm text-foreground">
            Prioritetsnivåer (tillämpliga dokument)
          </p>
          <ul className="space-y-1.5">
            {PRIORITY_ORDER.map((level) => (
              <li
                key={level}
                className="text-xs text-muted-foreground leading-relaxed flex gap-2"
              >
                <span className="text-muted-foreground/60">•</span>
                <span>
                  {getPriorityLabel(level)}: {priorityCounts[level]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
