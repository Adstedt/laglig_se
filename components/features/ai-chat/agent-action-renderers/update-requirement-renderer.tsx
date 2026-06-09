'use client'

/**
 * Story 14.28: UPDATE_REQUIREMENT approval renderer.
 *
 * Renders a field-by-field old→new diff for a proposed kravpunkt edit — only the
 * fields present in `params.patch` (compared against `params.oldSnapshot`). The
 * proposed new values are editable inline (text/comment Textarea, fulfilled/bevis
 * Switch). `entity_version` + `oldSnapshot` are carried through edits unchanged
 * (forward-compat with Story 14.31's staleness guard). On approve, dispatch calls
 * the existing `updateRequirement` server action.
 */

import { useState } from 'react'
import { Check, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { AgentActionRendererProps } from './task-approval-renderer'
import {
  ActionRendererFrame,
  LABEL_CLS,
  useDebouncedParamsChange,
} from './renderer-frame'

interface RequirementFields {
  text?: string
  isFulfilled?: boolean
  comment?: string | null
  bevisRequired?: boolean
}

interface UpdateRequirementParams {
  requirementId?: string
  lawListItemId?: string
  patch?: RequirementFields
  oldSnapshot?: RequirementFields
  entity_version?: string
}

const yesNo = (v: boolean | undefined): string => (v ? 'Ja' : 'Nej')
/** Empty / whitespace-only / null comment renders as "(tom)". */
const commentText = (v: string | null | undefined): string =>
  v && v.trim().length > 0 ? v : '(tom)'

export function UpdateRequirementRenderer({
  action,
  onApprove,
  onReject,
  onParamsChange,
  isSubmitting,
  compact = false,
}: AgentActionRendererProps) {
  const params = (action.params ?? {}) as UpdateRequirementParams
  const patch = params.patch ?? {}
  const old = params.oldSnapshot ?? {}

  // Which fields this proposal changes (drives both the diff rows and which
  // edits we persist — we never add fields the agent didn't propose).
  const hasText = 'text' in patch
  const hasFulfilled = 'isFulfilled' in patch
  const hasBevis = 'bevisRequired' in patch
  const hasComment = 'comment' in patch

  const [text, setText] = useState(patch.text ?? '')
  const [isFulfilled, setIsFulfilled] = useState(patch.isFulfilled ?? false)
  const [bevisRequired, setBevisRequired] = useState(
    patch.bevisRequired ?? false
  )
  const [comment, setComment] = useState(patch.comment ?? '')

  // Rebuild the patch from the edited values — only the originally-proposed keys.
  // Carry requirementId / lawListItemId / oldSnapshot / entity_version unchanged
  // (entity_version must survive edits for the 14.31 staleness guard).
  const editedPatch: RequirementFields = {}
  if (hasText) editedPatch.text = text
  if (hasFulfilled) editedPatch.isFulfilled = isFulfilled
  if (hasBevis) editedPatch.bevisRequired = bevisRequired
  if (hasComment)
    editedPatch.comment = comment.trim().length > 0 ? comment : null

  useDebouncedParamsChange(
    onParamsChange,
    {
      requirementId: params.requirementId,
      lawListItemId: params.lawListItemId,
      patch: editedPatch,
      oldSnapshot: old,
      entity_version: params.entity_version,
    },
    action.status === 'PENDING'
  )

  // One-line summary — the changed fields (with boolean transitions inline).
  const parts: string[] = []
  if (hasText) parts.push('text')
  if (hasFulfilled)
    parts.push(`uppfylld: ${yesNo(old.isFulfilled)} → ${yesNo(isFulfilled)}`)
  if (hasBevis)
    parts.push(
      `bevis krävs: ${yesNo(old.bevisRequired)} → ${yesNo(bevisRequired)}`
    )
  if (hasComment) parts.push('kommentar')
  const summary = `Ändra kravpunkt — ${parts.join(', ')}`

  // Can't approve a text edit that's been cleared (server requires min 1 char).
  const canApprove = !hasText || text.trim().length > 0

  const approved = (
    <>
      <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Godkänt — kravpunkt uppdaterad
      </div>
      <p className="text-sm leading-snug text-muted-foreground">{summary}</p>
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
      canApprove={canApprove}
    >
      {hasText && (
        <div className="space-y-1">
          <span className={`${LABEL_CLS} block`}>Kravpunkt</span>
          {old.text && (
            <p className="text-[13px] leading-snug text-muted-foreground line-through">
              {old.text}
            </p>
          )}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="min-h-[72px] resize-y text-sm leading-relaxed focus-visible:ring-inset focus-visible:ring-offset-0"
            placeholder="Beskriv kravet…"
            disabled={isSubmitting}
          />
        </div>
      )}

      {hasFulfilled && (
        <div className="flex items-center justify-between gap-2">
          <span className={LABEL_CLS}>Uppfylld</span>
          <div className="flex items-center gap-2">
            <Badge
              tone="neutral"
              variant="outline"
              className="text-[10px] line-through"
            >
              {yesNo(old.isFulfilled)}
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-[13px] font-medium tabular-nums">
              {yesNo(isFulfilled)}
            </span>
            <Switch
              checked={isFulfilled}
              onCheckedChange={setIsFulfilled}
              disabled={isSubmitting}
              aria-label="Uppfylld"
            />
          </div>
        </div>
      )}

      {hasBevis && (
        <div className="flex items-center justify-between gap-2">
          <span className={LABEL_CLS}>Bevis krävs</span>
          <div className="flex items-center gap-2">
            <Badge
              tone="neutral"
              variant="outline"
              className="text-[10px] line-through"
            >
              {yesNo(old.bevisRequired)}
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-[13px] font-medium tabular-nums">
              {yesNo(bevisRequired)}
            </span>
            <Switch
              checked={bevisRequired}
              onCheckedChange={setBevisRequired}
              disabled={isSubmitting}
              aria-label="Bevis krävs"
            />
          </div>
        </div>
      )}

      {hasComment && (
        <div className="space-y-1">
          <span className={`${LABEL_CLS} block`}>Kommentar</span>
          <p className="text-[13px] leading-snug text-muted-foreground line-through">
            {commentText(old.comment)}
          </p>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            spellCheck={false}
            className="min-h-[64px] resize-y text-sm leading-relaxed focus-visible:ring-inset focus-visible:ring-offset-0"
            placeholder="Lägg till en kommentar… (tomt rensar)"
            disabled={isSubmitting}
          />
        </div>
      )}
    </ActionRendererFrame>
  )
}
