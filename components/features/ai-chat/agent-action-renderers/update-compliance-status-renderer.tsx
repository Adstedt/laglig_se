'use client'

/**
 * Story 14.23, Task 7.3: UPDATE_COMPLIANCE_STATUS approval renderer.
 * Re-implements the legacy sidebar status-preview card (old → new status +
 * reason) on the inline pending-action pattern.
 */

import { useState } from 'react'
import { Check, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ComplianceStatus } from '@prisma/client'
import type { AgentActionRendererProps } from './task-approval-renderer'
import {
  ActionRendererFrame,
  LABEL_CLS,
  useDebouncedParamsChange,
} from './renderer-frame'

const STATUS_OPTIONS: { value: ComplianceStatus; label: string }[] = [
  { value: 'EJ_PABORJAD', label: 'Ej påbörjad' },
  { value: 'PAGAENDE', label: 'Pågående' },
  { value: 'UPPFYLLD', label: 'Uppfylld' },
  { value: 'EJ_UPPFYLLD', label: 'Ej uppfylld' },
  { value: 'EJ_TILLAMPLIG', label: 'Ej tillämplig' },
]

function statusLabel(status?: string): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status ?? ''
}

interface UpdateStatusParams {
  lawListItemId?: string
  lawTitle?: string
  newStatus?: ComplianceStatus
  oldStatus?: ComplianceStatus
  reason?: string
}

export function UpdateComplianceStatusRenderer({
  action,
  onApprove,
  onReject,
  onParamsChange,
  isSubmitting,
  compact = false,
}: AgentActionRendererProps) {
  const params = (action.params ?? {}) as UpdateStatusParams
  const [newStatus, setNewStatus] = useState<ComplianceStatus>(
    params.newStatus ?? 'PAGAENDE'
  )
  const [reason, setReason] = useState(params.reason ?? '')

  useDebouncedParamsChange(
    onParamsChange,
    {
      lawListItemId: params.lawListItemId,
      lawTitle: params.lawTitle,
      oldStatus: params.oldStatus,
      newStatus,
      reason,
    },
    action.status === 'PENDING'
  )

  const summary = `${params.lawTitle ?? ''}: ${statusLabel(params.oldStatus)} → ${statusLabel(params.newStatus)}`

  const approved = (
    <>
      <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Godkänt — status uppdaterad
      </div>
      {params.lawTitle && (
        <p className="text-sm leading-snug">{params.lawTitle}</p>
      )}
      <div className="flex items-center gap-2">
        {params.oldStatus && (
          <>
            <Badge tone="neutral" variant="outline" className="text-[10px]">
              {statusLabel(params.oldStatus)}
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </>
        )}
        <Badge tone="neutral" variant="outline" className="text-[10px]">
          {statusLabel(newStatus)}
        </Badge>
      </div>
      <a
        href="/laglistor"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Visa i laglistan
        <ArrowUpRight className="h-3 w-3" />
      </a>
    </>
  )

  return (
    <ActionRendererFrame
      status={action.status}
      compact={compact}
      badge="Status"
      summary={summary}
      approved={approved}
      onApprove={onApprove}
      onReject={onReject}
      isSubmitting={isSubmitting}
    >
      {params.lawTitle && (
        <p className="text-sm font-medium leading-tight">{params.lawTitle}</p>
      )}
      {params.oldStatus && (
        <div className="flex items-center gap-2">
          <span className={LABEL_CLS}>Nuvarande</span>
          <Badge tone="neutral" variant="outline" className="text-[10px]">
            {statusLabel(params.oldStatus)}
          </Badge>
        </div>
      )}
      <div className="space-y-1">
        <span className={`${LABEL_CLS} block`}>Ny status</span>
        <Select
          value={newStatus}
          onValueChange={(v) => setNewStatus(v as ComplianceStatus)}
          disabled={isSubmitting}
        >
          <SelectTrigger className="h-9 text-sm" aria-label="Ny status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <span className={`${LABEL_CLS} block`}>Anledning</span>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-[56px] resize-none text-sm leading-relaxed"
          placeholder="Beskriv varför statusen ändras…"
          disabled={isSubmitting}
        />
      </div>
    </ActionRendererFrame>
  )
}
