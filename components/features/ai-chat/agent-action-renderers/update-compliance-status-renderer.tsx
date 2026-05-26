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
import { getStatusBadgeProps } from '@/lib/ui/badge-tones'
import { COMPLIANCE_STATUS_OPTIONS } from '@/components/features/document-list/table-cell-editors/compliance-status-editor'
import type { AgentActionRendererProps } from './task-approval-renderer'
import {
  ActionRendererFrame,
  LABEL_CLS,
  useDebouncedParamsChange,
} from './renderer-frame'

function statusLabel(status?: ComplianceStatus): string {
  return status ? getStatusBadgeProps('compliance-status', status).label : ''
}

/** The real tone-coloured compliance pill (single source of truth via
 *  badge-tones) — not a plain outline badge. */
function StatusPill({ status }: { status?: ComplianceStatus }) {
  if (!status) return null
  const p = getStatusBadgeProps('compliance-status', status)
  return (
    <Badge tone={p.tone} variant={p.variant} className="text-[10px]">
      {p.label}
    </Badge>
  )
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

  // Compact (batch) rows lead with the status change; the law title repeats
  // across rows and shows when expanded.
  const statusChange = `${statusLabel(params.oldStatus)} → ${statusLabel(params.newStatus)}`
  const summary =
    compact || !params.lawTitle
      ? statusChange
      : `${params.lawTitle}: ${statusChange}`

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
            <StatusPill status={params.oldStatus} />
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </>
        )}
        <StatusPill status={newStatus} />
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
          <StatusPill status={params.oldStatus} />
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
            {COMPLIANCE_STATUS_OPTIONS.map((o) => {
              const p = getStatusBadgeProps('compliance-status', o.value)
              return (
                <SelectItem key={o.value} value={o.value}>
                  <Badge tone={p.tone} variant={p.variant}>
                    {p.label}
                  </Badge>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <span className={`${LABEL_CLS} block`}>Anledning</span>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          spellCheck={false}
          className="min-h-[88px] resize-y text-sm leading-relaxed focus-visible:ring-inset focus-visible:ring-offset-0"
          placeholder="Beskriv varför statusen ändras…"
          disabled={isSubmitting}
        />
      </div>
    </ActionRendererFrame>
  )
}
