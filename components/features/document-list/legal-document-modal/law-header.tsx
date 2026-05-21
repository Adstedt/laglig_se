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
 *
 * 2026-05-21 — AI-sammanfattning packaging: was previously rendered as a
 * tall always-visible blue callout under the badge row, dwarfing the
 * action surface below. Now lives as a default-closed Collapsible: the
 * trigger is a discreet Sparkles pill in the badge row ("Visa AI-
 * sammanfattning ▾"); when expanded, the body renders with neutral chrome
 * (--border, --muted) so it doesn't read as the generic blue "AI card."
 */

import { useState } from 'react'
import { Flag, Sparkles, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
  const [summaryOpen, setSummaryOpen] = useState(false)

  return (
    <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen} asChild>
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

          {/* AI-sammanfattning toggle — only rendered when a summary exists.
              Lives in the badge row so the pill semantics are consistent with
              its neighbours; default-closed so the modal opens onto the
              actionable section accordions, not onto a wall of context text. */}
          {aiCommentary && (
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-transparent px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                aria-label={
                  summaryOpen
                    ? 'Dölj AI-sammanfattning'
                    : 'Visa AI-sammanfattning'
                }
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                <span>Visa AI-sammanfattning</span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 transition-transform duration-200',
                    summaryOpen && 'rotate-180'
                  )}
                  aria-hidden="true"
                />
              </button>
            </CollapsibleTrigger>
          )}

          {headerActions && <div className="ml-auto">{headerActions}</div>}
        </div>

        {/* Expanded AI-sammanfattning body — neutral chrome (border + muted
            bg) so the block is visually distinct from regular content without
            reading as the generic blue "AI card." */}
        {aiCommentary && (
          <CollapsibleContent>
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
              {aiCommentary}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  )
}
