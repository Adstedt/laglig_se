/**
 * Story 21.5 — Swedish-labelled status badge for ComplianceAuditCycle.
 * Story 22.1 — Migrated to tone-aware `<Badge>` primitive.
 *
 * Note on `data-status` attribute: preserved for any e2e selectors that key
 * on it. The visual representation comes from `<Badge tone variant>` via
 * the `cycle-status` domain map in `lib/ui/badge-tones.ts`.
 */

import { ComplianceCycleStatus } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { getStatusBadgeProps } from '@/lib/ui/badge-tones'

interface CycleStatusBadgeProps {
  status: ComplianceCycleStatus
  className?: string
}

export function CycleStatusBadge({ status, className }: CycleStatusBadgeProps) {
  const props = getStatusBadgeProps('cycle-status', status)
  return (
    <Badge
      tone={props.tone}
      variant={props.variant}
      data-status={status}
      className={className}
    >
      {props.label}
    </Badge>
  )
}
