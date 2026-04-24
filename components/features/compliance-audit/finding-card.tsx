'use client'

/**
 * Epic 21 Story 21.16 — Shared FindingCard component.
 *
 * Renders a single finding with severity-first visual hierarchy. Used in two
 * places:
 *   1. Cycle Items modal — left-panel Findings section (click-to-edit only,
 *      no inline actions, `showLawContext={false}` since the modal is already
 *      scoped to one law).
 *   2. Cycle Findings tab — cross-item aggregate view (click navigates into
 *      the Items-tab modal via onClick; inline edit/close/reopen/spawn-task
 *      buttons via the `actions` render-prop; `showLawContext={true}` so
 *      users see which law each finding belongs to).
 *
 * Replaces both the old chip-row in cycle-item-row-drawer.tsx and the accordion
 * rows in cycle-findings-tab.tsx. One component, prop-driven behaviour.
 */

import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { AlertTriangle, ClipboardCheck, Eye, Lightbulb } from 'lucide-react'
import { FindingSeverity, FindingType } from '@prisma/client'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  FINDING_SEVERITY_LABELS,
  FINDING_TYPE_LABELS,
  getFindingStatus,
} from '@/components/features/compliance-audit/finding-copy'
import type { FindingRow } from '@/app/actions/compliance-finding'

// ---------------------------------------------------------------------------
// Truncation helper — kravpunkt text can be long; meta row stays one line.
// ---------------------------------------------------------------------------

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

// ---------------------------------------------------------------------------
// Severity ordering (severity-first sort) — exported for consumers.
// ---------------------------------------------------------------------------

/**
 * Sort comparator: AVVIKELSE-MAJOR → AVVIKELSE-MINOR → OBSERVATION →
 * FORBATTRING, then `created_at desc` within each group. Stängda findings
 * can be sorted separately (typically `closed_at desc`).
 */
export function compareFindingsBySeverity(
  a: FindingRow,
  b: FindingRow
): number {
  const rank = (f: FindingRow): number => {
    if (f.type === FindingType.AVVIKELSE) {
      return f.severity === FindingSeverity.MAJOR ? 0 : 1
    }
    if (f.type === FindingType.OBSERVATION) return 2
    return 3 // FORBATTRING
  }
  const diff = rank(a) - rank(b)
  if (diff !== 0) return diff
  return b.createdAt.getTime() - a.createdAt.getTime()
}

// ---------------------------------------------------------------------------
// Priority rail class — left-edge colored stripe on the card.
// ---------------------------------------------------------------------------

function railClass(finding: FindingRow): string {
  if (finding.closedAt !== null) return 'before:bg-muted'
  if (finding.type === FindingType.AVVIKELSE) {
    return finding.severity === FindingSeverity.MAJOR
      ? 'before:bg-red-500'
      : 'before:bg-orange-500'
  }
  if (finding.type === FindingType.OBSERVATION) return 'before:bg-amber-500'
  return 'before:bg-blue-500'
}

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface FindingCardProps {
  finding: FindingRow
  /** Click anywhere on the card body. For the modal: open finding in focus
   *  (or no-op if it's already focused). For the findings tab: drill into the
   *  Items-tab modal on the parent law. Returns void; parent handles state. */
  onClick?: (() => void) | undefined
  /** Show SFS + law title as a small metadata line under the title. Used by
   *  the findings tab (cross-law context); omitted by the modal (single-law
   *  scope already makes this redundant). */
  showLawContext?: boolean | undefined
  /** Rendered on the right side of the card — typically edit/close/reopen/
   *  spawn-task buttons. Wrapped in a stop-propagation zone so clicks don't
   *  bubble to the card-level `onClick`. */
  actions?: React.ReactNode | undefined
  /** Highlight ring + brief pulse when the finding was deep-linked into. */
  focused?: boolean | undefined
  /** Extra data-testid — useful for scoping assertions. */
  'data-testid'?: string | undefined
}

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

export function FindingCard({
  finding,
  onClick,
  showLawContext = false,
  actions,
  focused = false,
  'data-testid': testId,
}: FindingCardProps) {
  const isClosed = finding.closedAt !== null
  const rail = railClass(finding)
  const interactive = onClick !== undefined

  const cardClass = cn(
    'relative rounded-md border bg-card pl-4 pr-3 py-3 transition-colors',
    'before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-[2px] before:rounded-full',
    rail,
    interactive && 'cursor-pointer hover:bg-muted/50',
    focused &&
      'ring-2 ring-primary ring-offset-2 ring-offset-background animate-in fade-in duration-300',
    isClosed && 'opacity-70'
  )

  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <TypeBadge type={finding.type} />
          {finding.type === FindingType.AVVIKELSE && finding.severity ? (
            <SeverityBadge severity={finding.severity} />
          ) : null}
          {finding.correctiveActionTaskId ? (
            <Badge
              variant="outline"
              className="h-5 gap-1 border-blue-200 bg-blue-50 px-1.5 text-[10px] text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
              title="Kopplad till en åtgärdsuppgift"
            >
              <ClipboardCheck className="h-2.5 w-2.5" />
              Åtgärdsuppgift
            </Badge>
          ) : null}
          {/* Epic 21 follow-up (verify step): three-state badge driven by
              getFindingStatus. "Öppen" is implicit (no badge). "Redo att
              verifiera" surfaces the auditor's action moment in amber.
              "Stängd" is terminal. */}
          {(() => {
            const status = getFindingStatus(finding)
            if (status === 'closed') {
              return (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  Stängd
                </Badge>
              )
            }
            if (status === 'ready-to-verify') {
              return (
                <Badge
                  variant="outline"
                  className="h-5 border-amber-300 bg-amber-50 px-1.5 text-[10px] text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
                >
                  Redo att verifiera
                </Badge>
              )
            }
            return null
          })()}
        </div>

        <p
          className={cn(
            'text-sm font-medium leading-snug',
            isClosed && 'line-through text-muted-foreground'
          )}
        >
          {finding.title}
        </p>

        {!isClosed && finding.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {finding.description}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>{format(finding.createdAt, 'd MMM yyyy', { locale: sv })}</span>
          {finding.dueDate && !isClosed ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                förfaller {format(finding.dueDate, 'd MMM', { locale: sv })}
              </span>
            </>
          ) : null}
          {showLawContext && finding.lawListItem ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">
                {finding.lawListItem.title} (
                {finding.lawListItem.documentNumber})
              </span>
            </>
          ) : null}
          {finding.requirement ? (
            <>
              <span aria-hidden="true">·</span>
              <span
                className="truncate italic"
                title={finding.requirement.text}
              >
                Kravpunkt: {truncate(finding.requirement.text, 80)}
              </span>
            </>
          ) : null}
          {isClosed && finding.closedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                stängd {format(finding.closedAt, 'd MMM', { locale: sv })}
                {finding.closedBy ? ` av ${finding.closedBy.name ?? '—'}` : ''}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {actions ? (
        // Stop-propagation zone so action-button clicks don't bubble to the
        // card-level onClick. The presentational role signals to a11y tools
        // that this div itself has no semantic — it's just a click sink.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions
        <div
          role="presentation"
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      ) : null}
    </div>
  )

  if (interactive) {
    return (
      <div
        data-testid={testId ?? `finding-card-${finding.id}`}
        role="button"
        tabIndex={0}
        className={cardClass}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick!()
          }
        }}
      >
        {body}
      </div>
    )
  }

  return (
    <div
      data-testid={testId ?? `finding-card-${finding.id}`}
      className={cardClass}
    >
      {body}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-badges
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: FindingType }) {
  if (type === FindingType.AVVIKELSE) {
    return (
      <Badge
        variant="outline"
        className="h-5 gap-1 border-red-200 bg-red-50 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      >
        <AlertTriangle className="h-2.5 w-2.5" />
        {FINDING_TYPE_LABELS.AVVIKELSE}
      </Badge>
    )
  }
  if (type === FindingType.OBSERVATION) {
    return (
      <Badge
        variant="outline"
        className="h-5 gap-1 border-amber-200 bg-amber-50 px-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
      >
        <Eye className="h-2.5 w-2.5" />
        {FINDING_TYPE_LABELS.OBSERVATION}
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="h-5 gap-1 border-blue-200 bg-blue-50 px-1.5 text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
    >
      <Lightbulb className="h-2.5 w-2.5" />
      {FINDING_TYPE_LABELS.FORBATTRING}
    </Badge>
  )
}

function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 px-1.5 text-[10px] font-semibold uppercase tracking-wide',
        severity === FindingSeverity.MAJOR
          ? 'border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-900/50 dark:text-red-200'
          : 'border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-800 dark:bg-orange-900/50 dark:text-orange-200'
      )}
    >
      {FINDING_SEVERITY_LABELS[severity]}
    </Badge>
  )
}
