'use client'

/**
 * Story 6.17: Group Compliance Overview Indicators
 * Task 1: GroupComplianceIndicator component
 * Displays compliance progress indicator in group headers
 * Based on TasksAccordion progress bar pattern (lines 331-344)
 */

import { useMemo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { DocumentListItem } from '@/app/actions/document-list'
import { COMPLIANCE_STATUS_OPTIONS } from './table-cell-editors/compliance-status-editor'
import { cn } from '@/lib/utils'

interface GroupComplianceIndicatorProps {
  items: DocumentListItem[]
}

export function GroupComplianceIndicator({
  items,
}: GroupComplianceIndicatorProps) {
  // Memoized calculation (AC: 20-22)
  const {
    compliantCount,
    applicableCount,
    percentage,
    statusCounts,
    excludedCount,
  } = useMemo(() => {
    const counts = {
      UPPFYLLD: 0,
      PAGAENDE: 0,
      EJ_UPPFYLLD: 0,
      EJ_PABORJAD: 0,
      EJ_TILLAMPLIG: 0,
    }

    // Count each status
    for (const item of items) {
      if (item.complianceStatus in counts) {
        counts[item.complianceStatus as keyof typeof counts]++
      }
    }

    // Applicable = all except EJ_TILLAMPLIG
    const applicable = items.length - counts.EJ_TILLAMPLIG
    const compliant = counts.UPPFYLLD

    return {
      compliantCount: compliant,
      applicableCount: applicable,
      percentage: applicable > 0 ? (compliant / applicable) * 100 : null,
      statusCounts: counts,
      excludedCount: counts.EJ_TILLAMPLIG,
    }
  }, [items])

  // Color coding based on percentage (AC: 5)
  const getProgressColor = (pct: number | null) => {
    if (pct === null) return 'bg-muted'
    if (pct === 100) return 'bg-green-500'
    if (pct >= 50) return 'bg-blue-500'
    if (pct > 0) return 'bg-amber-500'
    return 'bg-red-500'
  }

  // Get status label from COMPLIANCE_STATUS_OPTIONS
  const getStatusLabel = (status: string) => {
    return (
      COMPLIANCE_STATUS_OPTIONS.find((opt) => opt.value === status)?.label ??
      status
    )
  }

  // If no applicable items, show "—" (AC: 6)
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
        {/* Progress indicator matching TasksAccordion pattern (AC: 1-4) */}
        <div className="flex items-center gap-2">
          {/* Fraction: AC 3 */}
          <span className="text-xs text-muted-foreground tabular-nums">
            {compliantCount}/{applicableCount}
          </span>
          {/* Progress bar: AC 4 - hidden on mobile (AC: 15) */}
          <div className="hidden sm:block w-12 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                getProgressColor(percentage)
              )}
              style={{ width: `${percentage ?? 0}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      {/* Tooltip with full breakdown (AC: 18) - Matching column header tooltip styling */}
      <TooltipContent side="bottom" className="max-w-[280px] p-3">
        <div className="space-y-2">
          <p className="font-semibold text-sm text-foreground">
            Efterlevnadsstatus
          </p>
          <ul className="space-y-1.5">
            <li className="text-xs text-muted-foreground leading-relaxed flex gap-2">
              <span className="text-muted-foreground/60">•</span>
              <span>
                {getStatusLabel('UPPFYLLD')}: {statusCounts.UPPFYLLD}
              </span>
            </li>
            <li className="text-xs text-muted-foreground leading-relaxed flex gap-2">
              <span className="text-muted-foreground/60">•</span>
              <span>
                {getStatusLabel('PAGAENDE')}: {statusCounts.PAGAENDE}
              </span>
            </li>
            <li className="text-xs text-muted-foreground leading-relaxed flex gap-2">
              <span className="text-muted-foreground/60">•</span>
              <span>
                {getStatusLabel('EJ_UPPFYLLD')}: {statusCounts.EJ_UPPFYLLD}
              </span>
            </li>
            <li className="text-xs text-muted-foreground leading-relaxed flex gap-2">
              <span className="text-muted-foreground/60">•</span>
              <span>
                {getStatusLabel('EJ_PABORJAD')}: {statusCounts.EJ_PABORJAD}
              </span>
            </li>
            <li className="text-xs text-muted-foreground/70 leading-relaxed flex gap-2">
              <span className="text-muted-foreground/40">•</span>
              <span>
                {getStatusLabel('EJ_TILLAMPLIG')}: {excludedCount} (exkluderade)
              </span>
            </li>
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
