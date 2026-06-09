'use client'

/**
 * Story 14.22, Task 4: CREATE_TASK approval renderer.
 * Story 14.23: migrated onto the shared ActionRendererFrame so it collapses in
 * the batch-card `compact` variant like every other type (AC 17). Field surface
 * (title / description / priority) and APPROVED summary are unchanged.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, ArrowUpRight, Flag } from 'lucide-react'
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
import {
  ActionRendererFrame,
  LABEL_CLS,
  useDebouncedParamsChange,
} from './renderer-frame'

const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

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
  /**
   * Story 14.23: batch-card variant. When true the renderer collapses to a
   * one-line summary (expandable to the editable body). Default false (the
   * single-action AgentActionCard renders the full body).
   */
  compact?: boolean
}

export function TaskApprovalRenderer({
  action,
  onApprove,
  onReject,
  onParamsChange,
  isSubmitting,
  compact = false,
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

  useDebouncedParamsChange(
    onParamsChange,
    {
      title,
      description: description || null,
      relatedDocumentId: params.relatedDocumentId ?? null,
      priority,
    },
    action.status === 'PENDING'
  )

  const approved = (
    <>
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
    </>
  )

  return (
    <ActionRendererFrame
      status={action.status}
      compact={compact}
      badge="Uppgift"
      summary={params.title ?? ''}
      approved={approved}
      onApprove={onApprove}
      onReject={onReject}
      isSubmitting={isSubmitting}
      canApprove={title.trim().length > 0}
    >
      <div className="space-y-1">
        <span className={`${LABEL_CLS} block`}>Titel</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
    </ActionRendererFrame>
  )
}
