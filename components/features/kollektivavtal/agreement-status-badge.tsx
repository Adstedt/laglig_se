'use client'

/**
 * Story 7.5: Kollektivavtal ingestion-status badge — the first (and canonical)
 * status surface for `CollectiveAgreementStatus`. Tone-aware Badge API only
 * (badge tone system; never legacy shadcn variants on a status surface).
 */

import { Badge } from '@/components/ui/badge'
import type { Tone, Variant } from '@/lib/ui/badge-tones'
import type { CollectiveAgreementStatus } from '@prisma/client'

const STATUS_BADGES: Record<
  CollectiveAgreementStatus,
  { tone: Tone; variant: Variant; label: string }
> = {
  PENDING: { tone: 'neutral', variant: 'soft', label: 'Väntar' },
  PROCESSING: { tone: 'info', variant: 'soft', label: 'Bearbetas' },
  READY: { tone: 'success', variant: 'soft', label: 'Klart' },
  FAILED: { tone: 'danger', variant: 'soft', label: 'Misslyckades' },
}

export function AgreementStatusBadge({
  status,
}: {
  status: CollectiveAgreementStatus
}) {
  const { tone, variant, label } = STATUS_BADGES[status]
  return (
    <Badge tone={tone} variant={variant}>
      {label}
    </Badge>
  )
}
