'use client'

/**
 * Story 8.1 Task 3: Change Row Component
 * Table row for a single unacknowledged ChangeEvent.
 * Uses shadcn Table components to match the existing document list table design.
 */

import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type {
  UnacknowledgedChange,
  ChangePriority,
} from '@/lib/changes/change-utils'
import {
  ASSESSMENT_STATUS_LABELS,
  ASSESSMENT_STATUS_VARIANT,
} from '@/lib/changes/change-utils'
import type { ChangeType } from '@prisma/client'

// ============================================================================
// Swedish labels
// ============================================================================

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  AMENDMENT: 'Ändring',
  REPEAL: 'Upphävande',
  NEW_LAW: 'Ny lag',
  METADATA_UPDATE: 'Metadata',
  NEW_RULING: 'Nytt avgörande',
}

// ============================================================================
// Priority styles
// ============================================================================

const CHANGE_TYPE_BADGE_VARIANT: Record<
  ChangeType,
  'destructive' | 'default' | 'secondary' | 'outline'
> = {
  REPEAL: 'destructive',
  AMENDMENT: 'default',
  NEW_LAW: 'default',
  NEW_RULING: 'secondary',
  METADATA_UPDATE: 'secondary',
}

const PRIORITY_LABELS: Record<ChangePriority, string> = {
  HIGH: 'Hög',
  MEDIUM: 'Medel',
  LOW: 'Låg',
}

const PRIORITY_COLORS: Record<ChangePriority, string> = {
  HIGH: 'text-destructive',
  MEDIUM: 'text-amber-600',
  LOW: 'text-muted-foreground',
}

// ============================================================================
// Component
// ============================================================================

interface ChangeRowProps {
  change: UnacknowledgedChange
  onSelect: (_change: UnacknowledgedChange) => void
}

export function ChangeRow({ change, onSelect }: ChangeRowProps) {
  const handleClick = () => {
    onSelect(change)
  }

  return (
    <TableRow
      className="group cursor-pointer"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${CHANGE_TYPE_LABELS[change.changeType]}: ${change.documentTitle} (${change.documentNumber})`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      {/* Change type badge */}
      <TableCell className="w-[120px]">
        <Badge variant={CHANGE_TYPE_BADGE_VARIANT[change.changeType]}>
          {CHANGE_TYPE_LABELS[change.changeType]}
        </Badge>
      </TableCell>

      {/* Law title + document number */}
      <TableCell className="bg-background">
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground truncate block">
            {change.documentTitle}
          </span>
          <span className="text-xs text-muted-foreground">
            {change.documentNumber}
          </span>
        </div>
      </TableCell>

      {/* List name */}
      <TableCell>
        <span className="text-sm text-muted-foreground truncate block">
          {change.listName}
        </span>
      </TableCell>

      {/* Priority */}
      <TableCell className="w-[100px]">
        <span
          className={cn(
            'text-sm font-medium',
            PRIORITY_COLORS[change.priority]
          )}
        >
          {PRIORITY_LABELS[change.priority]}
        </span>
      </TableCell>

      {/* Detected date (relative Swedish time) */}
      <TableCell className="w-[160px] text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(change.detectedAt), {
          locale: sv,
          addSuffix: true,
        })}
      </TableCell>

      {/* Status indicator — Story 14.10: show assessment status or "Ny" */}
      <TableCell className="w-[100px]">
        {change.assessmentStatus ? (
          <Badge variant={ASSESSMENT_STATUS_VARIANT[change.assessmentStatus]}>
            {ASSESSMENT_STATUS_LABELS[change.assessmentStatus]}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-amber-500/50 text-amber-600"
          >
            Ny
          </Badge>
        )}
      </TableCell>
    </TableRow>
  )
}
