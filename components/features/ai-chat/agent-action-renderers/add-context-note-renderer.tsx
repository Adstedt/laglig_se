'use client'

/**
 * Story 14.23, Task 7.3: ADD_CONTEXT_NOTE approval renderer.
 * Re-implements the field surface of the legacy sidebar note-preview card (law
 * title + editable note) on the inline pending-action pattern.
 */

import { useState } from 'react'
import { Check, ArrowUpRight } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import type { AgentActionRendererProps } from './task-approval-renderer'
import {
  ActionRendererFrame,
  LABEL_CLS,
  useDebouncedParamsChange,
} from './renderer-frame'

interface AddContextNoteParams {
  lawListItemId?: string
  lawTitle?: string
  note?: string
}

export function AddContextNoteRenderer({
  action,
  onApprove,
  onReject,
  onParamsChange,
  isSubmitting,
  compact = false,
}: AgentActionRendererProps) {
  const params = (action.params ?? {}) as AddContextNoteParams
  const [note, setNote] = useState(params.note ?? '')

  useDebouncedParamsChange(
    onParamsChange,
    { lawListItemId: params.lawListItemId, lawTitle: params.lawTitle, note },
    action.status === 'PENDING'
  )

  const summary = params.lawTitle
    ? `${params.lawTitle}: ${params.note ?? ''}`
    : (params.note ?? '')

  const approved = (
    <>
      <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Godkänt — anteckning tillagd
      </div>
      <p className="whitespace-pre-wrap text-sm leading-snug">{params.note}</p>
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
      badge="Anteckning"
      summary={summary}
      approved={approved}
      onApprove={onApprove}
      onReject={onReject}
      isSubmitting={isSubmitting}
      canApprove={note.trim().length > 0}
    >
      {params.lawTitle && (
        <p className="text-sm font-medium leading-tight">{params.lawTitle}</p>
      )}
      <div className="space-y-1">
        <span className={`${LABEL_CLS} block`}>Anteckning</span>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-[80px] resize-none text-sm leading-relaxed"
          placeholder="Varför är denna lag relevant för företaget?"
          disabled={isSubmitting}
        />
      </div>
    </ActionRendererFrame>
  )
}
