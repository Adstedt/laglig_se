'use client'

/**
 * Story 6.3: Law Header
 * Title display with compliance status and priority badges.
 * Aligned with Task Modal header design.
 *
 * Story 22.1 follow-up — Migrated pills from hand-rolled `bg-X-100 text-X-700`
 * spans to the tone-aware `<Badge>` primitive. Single source of truth for
 * status/priority colors via `lib/ui/badge-tones.ts`. Dot/icon prefix
 * preserved as inline content; the bg/text class strings now flow from the
 * shared map and adapt to light + dark theme automatically.
 */

import { Flag } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  getStatusBadgeProps,
  getPriorityBadgeProps,
} from '@/lib/ui/badge-tones'
import type { ComplianceStatus } from '@prisma/client'

interface LawHeaderProps {
  title: string
  aiCommentary: string | null
  complianceStatus: ComplianceStatus
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  /** Optional action(s) rendered at the right edge of the badges row */
  headerActions?: ReactNode
}

// Tone-color → dot bg class. Mirrors the inline dot prefix that pre-22.1
// renders used. Independent of light/dark theme — solid color reads on both.
const DOT_BG_CLASS: Record<string, string> = {
  neutral: 'bg-slate-500',
  info: 'bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
}

export function LawHeader({
  title,
  aiCommentary,
  complianceStatus,
  priority,
  headerActions,
}: LawHeaderProps) {
  const complianceProps = getStatusBadgeProps(
    'compliance-status',
    complianceStatus
  )
  const priorityProps = getPriorityBadgeProps(priority)

  return (
    <div className="space-y-3">
      {/* Title — Safiro Medium for the brand/identity moment (Story 26.x).
          Safiro ships at weight 500, so use font-medium (font-semibold would
          trigger faux-bold and ruin the display face). */}
      <h2 className="font-safiro text-xl font-medium leading-tight tracking-[-0.01em]">
        {title}
      </h2>

      {/* Status and Priority Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          tone={complianceProps.tone}
          variant={complianceProps.variant}
          className="gap-1.5"
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              DOT_BG_CLASS[complianceProps.tone]
            )}
            aria-hidden="true"
          />
          {complianceProps.label}
        </Badge>

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

      {/* AI Commentary if present */}
      {aiCommentary && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <span className="font-medium">AI-sammanfattning: </span>
            {aiCommentary}
          </p>
        </div>
      )}
    </div>
  )
}
