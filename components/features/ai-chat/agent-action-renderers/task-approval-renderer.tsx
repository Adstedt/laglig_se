'use client'

/**
 * Story 14.22, Task 4: CREATE_TASK approval renderer.
 *
 * Per-type body for the AgentActionCard. Mirrors the field surface of the
 * legacy sidebar write-preview-task.tsx (title / description / priority) so the
 * UX is unchanged, but persists edits via updatePendingActionParams (debounced
 * 500ms) instead of holding ephemeral SDK state. Re-implemented, not copied.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, X, ArrowUpRight, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { getPriorityBadgeProps } from '@/lib/ui/badge-tones'
import type { PendingAgentAction, TaskPriority } from '@prisma/client'

const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

const LABEL_CLS =
  'text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground'

/**
 * Priority pill — canonical task-surface treatment via the shared
 * `getPriorityBadgeProps` map + tone-aware Badge (matches the task modal's
 * StatusPriorityBadges and the /tasks list; no local color drift).
 */
function PriorityPill({ priority }: { priority: TaskPriority }) {
  const p = getPriorityBadgeProps(priority)
  return (
    <Badge tone={p.tone} variant={p.variant} className="gap-1.5">
      <Flag className="h-3 w-3" aria-hidden="true" />
      {p.label}
    </Badge>
  )
}

interface CreateTaskParams {
  title?: string
  description?: string | null
  relatedDocumentId?: string | null
  priority?: TaskPriority
}

export interface AgentActionRendererProps {
  action: PendingAgentAction
  onApprove: () => void
  onReject: () => void
  /** Persist edited params (debounced by the renderer). */
  onParamsChange: (_params: Record<string, unknown>) => void
  isSubmitting: boolean
}

export function TaskApprovalRenderer({
  action,
  onApprove,
  onReject,
  onParamsChange,
  isSubmitting,
}: AgentActionRendererProps) {
  const params = (action.params ?? {}) as CreateTaskParams
  const resultRef = (action.result_ref ?? {}) as { taskId?: string }

  const [title, setTitle] = useState(params.title ?? '')
  const [description, setDescription] = useState(params.description ?? '')
  const [priority, setPriority] = useState<TaskPriority>(
    params.priority ?? 'MEDIUM'
  )

  // Auto-grow the description so the full proposal is readable without a
  // mid-text scrollbar (capped — very long drafts still scroll).
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = descriptionRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`
  }, [description])

  // 500ms debounced persistence of edits (AC 16). Skip the initial mount.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (action.status !== 'PENDING') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onParamsChange({
        title,
        description: description || null,
        relatedDocumentId: params.relatedDocumentId ?? null,
        priority,
      })
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, priority])

  // ---- APPROVED -----------------------------------------------------------
  if (action.status === 'APPROVED') {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          Godkänt — uppgift skapad
        </div>
        <p className="text-sm leading-snug">{params.title}</p>
        {resultRef.taskId ? (
          <a
            href={`/tasks?task=${resultRef.taskId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Visa uppgift
            <ArrowUpRight className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    )
  }

  // ---- REJECTED -----------------------------------------------------------
  if (action.status === 'REJECTED') {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="neutral" variant="outline" className="text-[10px]">
          Avvisat
        </Badge>
        <p className="truncate text-sm text-muted-foreground line-through">
          {params.title}
        </p>
      </div>
    )
  }

  // ---- EXPIRED ------------------------------------------------------------
  if (action.status === 'EXPIRED') {
    return (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Förslaget har gått ut</p>
        <p className="truncate text-sm text-muted-foreground line-through">
          {params.title}
        </p>
      </div>
    )
  }

  // ---- PENDING (editable) -------------------------------------------------
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <span className={`${LABEL_CLS} block`}>Titel</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9 text-sm font-medium"
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-1">
        <span className={`${LABEL_CLS} block`}>Beskrivning</span>
        <Textarea
          ref={descriptionRef}
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[72px] max-h-[260px] resize-none text-sm leading-relaxed"
          placeholder="Valfritt…"
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-1">
        <span className={`${LABEL_CLS} block`}>Prioritet</span>
        <Select
          value={priority}
          onValueChange={(v) => setPriority(v as TaskPriority)}
          disabled={isSubmitting}
        >
          <SelectTrigger className="h-9 text-sm" aria-label="Prioritet">
            {/* SelectTrigger applies `[&>span]:line-clamp-1` to its direct span
                child, which forces display:-webkit-box and stacks the pill's
                flag over its label. This wrapper span's `!flex` overrides that
                so the Badge inside renders horizontally. */}
            <span className="!flex items-center">
              <PriorityPill priority={priority} />
            </span>
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                <PriorityPill priority={p} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1 border-t border-border/60 pt-3">
        <Button
          size="sm"
          onClick={onApprove}
          disabled={isSubmitting || !title.trim()}
          className="gap-1.5"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Godkänn
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReject}
          disabled={isSubmitting}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Avvisa
        </Button>
      </div>
    </div>
  )
}
