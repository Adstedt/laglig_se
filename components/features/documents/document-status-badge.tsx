/**
 * Document status badge.
 * Story 22.1 — Migrated from custom shadcn variant overrides to the
 * tone-aware `<Badge>` primitive backed by `lib/ui/badge-tones.ts`.
 *
 * Acknowledged visual delta: "Utkast" (was solid `bg-secondary`) and
 * "Under granskning" (was solid `bg-primary`) become soft-tone pills,
 * aligning the Styrdokument surface with the rest of the workspace.
 *
 * `STATUS_CONFIG` is preserved as a label catalog for the one external
 * consumer (`status-transition-controls.tsx`) which only reads `.label`.
 */

import { Badge } from '@/components/ui/badge'
import { WorkspaceDocumentStatus } from '@prisma/client'
import { getStatusBadgeProps } from '@/lib/ui/badge-tones'

export const STATUS_CONFIG: Record<WorkspaceDocumentStatus, { label: string }> =
  {
    DRAFT: { label: 'Utkast' },
    IN_REVIEW: { label: 'Under granskning' },
    APPROVED: { label: 'Godkänd' },
    SUPERSEDED: { label: 'Ersatt' },
    ARCHIVED: { label: 'Arkiverad' },
  }

interface DocumentStatusBadgeProps {
  status: WorkspaceDocumentStatus | string
  className?: string | undefined
}

export function DocumentStatusBadge({
  status,
  className,
}: DocumentStatusBadgeProps) {
  const props = getStatusBadgeProps('document-status', status)
  return (
    <Badge tone={props.tone} variant={props.variant} className={className}>
      {props.label}
    </Badge>
  )
}
