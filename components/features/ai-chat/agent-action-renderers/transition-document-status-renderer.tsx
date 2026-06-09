'use client'

/**
 * Story 14.30: TRANSITION_DOCUMENT_STATUS approval renderer.
 *
 * The PENDING surface is a fixed `oldStatus → newStatus` badge transition
 * (the target is NOT user-editable here — see AC 10) plus an optional
 * editable comment Textarea behind the shared `Justera` disclosure. APPROVED
 * shows a read-only "Status ändrad: A → B" + a link to the document's edit
 * page (AC 11; bare-detail route does not exist — link to `/edit`).
 *
 * The denormalised `documentTitle` + `oldStatus` are captured at propose-time
 * by the tool so the display reflects what was proposed, even if the
 * document's live status drifts before approval (the dispatch + the
 * underlying `updateDocumentStatus` re-validate the ladder against the live
 * status at approve time).
 */

import { useState } from 'react'
import { Check, ArrowUpRight, ArrowRight } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { DocumentStatusBadge } from '@/components/features/documents/document-status-badge'
import type { WorkspaceDocumentStatus } from '@prisma/client'
import type { AgentActionRendererProps } from './task-approval-renderer'
import {
  ActionRendererFrame,
  LABEL_CLS,
  useDebouncedParamsChange,
} from './renderer-frame'

interface TransitionDocumentStatusParams {
  documentId?: string
  documentTitle?: string
  oldStatus?: WorkspaceDocumentStatus
  newStatus?: WorkspaceDocumentStatus
  /** Swedish labels resolved at propose-time (matches UPDATE_COMPLIANCE_STATUS). */
  oldStatusLabel?: string
  newStatusLabel?: string
  comment?: string
  entity_version?: string
}

export function TransitionDocumentStatusRenderer({
  action,
  onApprove,
  onReject,
  onParamsChange,
  isSubmitting,
  compact = false,
}: AgentActionRendererProps) {
  const params = (action.params ?? {}) as TransitionDocumentStatusParams
  const [comment, setComment] = useState(params.comment ?? '')

  useDebouncedParamsChange(
    onParamsChange,
    {
      documentId: params.documentId,
      documentTitle: params.documentTitle,
      oldStatus: params.oldStatus,
      newStatus: params.newStatus,
      ...(comment.trim().length > 0 ? { comment } : {}),
      ...(params.entity_version !== undefined && {
        entity_version: params.entity_version,
      }),
    },
    action.status === 'PENDING'
  )

  // AC 10: the badge transition is the signature UX — render it AS the lead
  // (not buried behind Justera). DocumentStatusBadge does its own STATUS_CONFIG
  // lookup, so the Swedish labels render here even if params.oldStatusLabel /
  // newStatusLabel are absent. Compact-mode (batch row) still gets a plain
  // text summary for clean truncation.
  const summary = compact ? (
    `${params.documentTitle ? `${params.documentTitle}: ` : 'Status: '}${params.oldStatusLabel ?? params.oldStatus ?? '—'} → ${params.newStatusLabel ?? params.newStatus ?? '—'}`
  ) : (
    <span className="inline-flex flex-wrap items-center gap-2 align-middle">
      {params.documentTitle && (
        <span className="font-medium">{params.documentTitle}:</span>
      )}
      {params.oldStatus && <DocumentStatusBadge status={params.oldStatus} />}
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      {params.newStatus && <DocumentStatusBadge status={params.newStatus} />}
    </span>
  )

  // APPROVED state — read-only confirmation + deep-link to the doc's /edit
  // route (AC 11). Bare-detail route does not exist; link to /edit.
  const approved = (
    <>
      <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Godkänt — status ändrad
      </div>
      <div className="flex items-center gap-2 text-sm">
        {params.oldStatus && <DocumentStatusBadge status={params.oldStatus} />}
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        {params.newStatus && <DocumentStatusBadge status={params.newStatus} />}
      </div>
      {params.documentId && (
        <a
          href={`/workspace/styrdokument/${params.documentId}/edit`}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Öppna dokument
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </>
  )

  return (
    <ActionRendererFrame
      status={action.status}
      compact={compact}
      badge="Ändra dokumentstatus"
      summary={summary}
      approved={approved}
      onApprove={onApprove}
      onReject={onReject}
      isSubmitting={isSubmitting}
    >
      {/* The fixed `oldStatus → newStatus` badge transition is now rendered in
          the lead `summary` above (AC 10); behind Justera the user can only
          tweak the optional comment. The target itself is read-only — changing
          it (especially to APPROVED) is not offered here. */}
      <div className="space-y-1">
        <span className={`${LABEL_CLS} block`}>Kommentar (valfri)</span>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="min-h-[60px] resize-none text-sm leading-relaxed"
          placeholder="Varför ska statusen ändras? (loggas på dokumentet)"
          disabled={isSubmitting}
          maxLength={2000}
        />
      </div>
    </ActionRendererFrame>
  )
}
