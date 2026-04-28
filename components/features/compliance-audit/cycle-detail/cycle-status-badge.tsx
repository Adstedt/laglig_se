/** Story 21.5 — Swedish-labelled status badge for ComplianceAuditCycle. */

import { ComplianceCycleStatus } from '@prisma/client'
import { cn } from '@/lib/utils'

interface StatusVariant {
  label: string
  color: string
}

const STATUS_VARIANTS: Record<ComplianceCycleStatus, StatusVariant> = {
  PLANERAD: { label: 'Planerad', color: 'bg-gray-100 text-gray-700' },
  PAGAENDE: { label: 'Pågående', color: 'bg-blue-100 text-blue-700' },
  AVSLUTAD: { label: 'Avslutad', color: 'bg-amber-100 text-amber-700' },
}

interface CycleStatusBadgeProps {
  status: ComplianceCycleStatus
  className?: string
}

export function CycleStatusBadge({ status, className }: CycleStatusBadgeProps) {
  const variant = STATUS_VARIANTS[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant.color,
        className
      )}
      data-status={status}
    >
      {variant.label}
    </span>
  )
}
