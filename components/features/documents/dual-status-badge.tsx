/**
 * DualStatusBadge — Story 17.17 AC 1 + AC 11 + AC 14.
 *
 * Renders the doc's current state under Story 17.16's dual-pointer model:
 *  - **Dual state** (`current_approved_version_id` + `current_draft_version_id`
 *    both set): two clickable badge halves wired as separate anchors.
 *    Left = "Godkänd v{N}" → editor route with `?view=approved` (read-only
 *    approved view). Right = "Utkast v{N+1} pågår" → editor default route
 *    (loads draft via Story 17.16 AC 13's explicit fallback chain). Each
 *    half carries its own `aria-label`; container exposes `role="status"`
 *    with the full Swedish state for screen-reader region listings.
 *  - **Single state** (only one pointer set, or terminal status): wraps
 *    today's {@link DocumentStatusBadge} in a single clickable anchor to
 *    the editor default route.
 *
 * Clicks on the badge halves stop propagation so they don't double-fire
 * the parent row's default-navigation click handler (AC 14).
 *
 * Story 17.17 v1.3 PO ratification: copy is FROZEN. Do not paraphrase
 * "Godkänd v{N}" / "Utkast v{N+1} pågår" / `aria-label` text during dev.
 */

'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { DocumentStatusBadge } from '@/components/features/documents/document-status-badge'
import { getStatusBadgeProps } from '@/lib/ui/badge-tones'
import { cn } from '@/lib/utils'

export interface DualStatusBadgeProps {
  documentId: string
  documentTitle: string
  status: string
  draftStatus: 'DRAFT' | 'IN_REVIEW' | null
  currentApprovedVersionId: string | null
  currentDraftVersionId: string | null
  currentApprovedVersionNumber: number | null
  currentDraftVersionNumber: number | null
  className?: string | undefined
}

const ANCHOR_CHROME =
  'inline-flex rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 hover:underline'

export function DualStatusBadge({
  documentId,
  documentTitle,
  status,
  draftStatus,
  currentApprovedVersionId,
  currentDraftVersionId,
  currentApprovedVersionNumber,
  currentDraftVersionNumber,
  className,
}: DualStatusBadgeProps) {
  const editorHref = `/workspace/styrdokument/${documentId}/edit`

  const isDual =
    currentApprovedVersionId != null &&
    currentDraftVersionId != null &&
    currentApprovedVersionNumber != null &&
    currentDraftVersionNumber != null

  if (isDual) {
    const approvedProps = getStatusBadgeProps('document-status', 'APPROVED')
    const draftProps = getStatusBadgeProps(
      'document-status',
      draftStatus ?? 'DRAFT'
    )
    const fullStateLabel = `Godkänd version ${currentApprovedVersionNumber}, utkast version ${currentDraftVersionNumber} pågår`

    return (
      <div
        role="status"
        aria-label={fullStateLabel}
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap',
          className
        )}
      >
        <Link
          href={`${editorHref}?view=approved`}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Öppna godkänd version ${currentApprovedVersionNumber} av ${documentTitle} (läsläge)`}
          className={ANCHOR_CHROME}
        >
          <Badge tone={approvedProps.tone} variant={approvedProps.variant}>
            Godkänd v{currentApprovedVersionNumber}
          </Badge>
        </Link>
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <Link
          href={editorHref}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Öppna utkast version ${currentDraftVersionNumber} av ${documentTitle} i editorn`}
          className={ANCHOR_CHROME}
        >
          <Badge tone={draftProps.tone} variant={draftProps.variant}>
            Utkast v{currentDraftVersionNumber} pågår
          </Badge>
        </Link>
      </div>
    )
  }

  return (
    <Link
      href={editorHref}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Öppna ${documentTitle}`}
      className={cn(ANCHOR_CHROME, className)}
    >
      <DocumentStatusBadge status={status} />
    </Link>
  )
}
