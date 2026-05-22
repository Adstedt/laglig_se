'use client'

/**
 * Story 14.23, Task 3.3: ADD_OBLIGATION approval renderer.
 * Editable kravpunkt text + "bevis krävs" switch (mirrors the Story 17.16
 * kravpunkter inline editor). APPROVED → text preview + bevis badge + link.
 */

import { useState } from 'react'
import { Check, ArrowUpRight } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { AgentActionRendererProps } from './task-approval-renderer'
import {
  ActionRendererFrame,
  LABEL_CLS,
  useDebouncedParamsChange,
} from './renderer-frame'

interface AddObligationParams {
  lawListItemId?: string
  lawTitle?: string
  text?: string
  bevisRequired?: boolean
}

export function AddObligationRenderer({
  action,
  onApprove,
  onReject,
  onParamsChange,
  isSubmitting,
  compact = false,
}: AgentActionRendererProps) {
  const params = (action.params ?? {}) as AddObligationParams
  const [text, setText] = useState(params.text ?? '')
  const [bevisRequired, setBevisRequired] = useState(
    params.bevisRequired ?? false
  )

  useDebouncedParamsChange(
    onParamsChange,
    {
      lawListItemId: params.lawListItemId,
      lawTitle: params.lawTitle,
      text,
      bevisRequired,
    },
    action.status === 'PENDING'
  )

  const summary = params.lawTitle
    ? `${params.lawTitle}: ${params.text ?? ''}`
    : (params.text ?? '')

  const approved = (
    <>
      <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Godkänt — kravpunkt tillagd
      </div>
      <p className="text-sm leading-snug">{params.text}</p>
      {bevisRequired && (
        <Badge tone="neutral" variant="outline" className="text-[10px]">
          Bevis krävs
        </Badge>
      )}
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
      badge="Kravpunkt"
      summary={summary}
      approved={approved}
      onApprove={onApprove}
      onReject={onReject}
      isSubmitting={isSubmitting}
      canApprove={text.trim().length > 0}
    >
      {params.lawTitle && (
        <p className="text-sm font-medium leading-tight">{params.lawTitle}</p>
      )}
      <div className="space-y-1">
        <span className={`${LABEL_CLS} block`}>Kravpunkt</span>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[64px] resize-none text-sm leading-relaxed"
          placeholder="Beskriv kravet…"
          disabled={isSubmitting}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={LABEL_CLS}>Bevis krävs</span>
        <Switch
          checked={bevisRequired}
          onCheckedChange={setBevisRequired}
          disabled={isSubmitting}
          aria-label="Bevis krävs"
        />
      </div>
    </ActionRendererFrame>
  )
}
