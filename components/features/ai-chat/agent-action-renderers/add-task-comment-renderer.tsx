'use client'

/**
 * Story 14.29: ADD_TASK_COMMENT approval renderer.
 *
 * Append-only — no diff, no editor path. PENDING: task title + editable
 * comment Textarea (debounced 500ms via the shared frame helper). APPROVED:
 * read-only comment + a deep-link to the task. The denormalised `taskTitle`
 * is captured at propose-time by the tool so the title shown here is the
 * title-as-proposed (correct for an approval record) even if the task is
 * later renamed.
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

interface AddTaskCommentParams {
  taskId?: string
  taskTitle?: string
  content?: string
  parentCommentId?: string
  entity_version?: string
}

const MAX_CONTENT = 5000

export function AddTaskCommentRenderer({
  action,
  onApprove,
  onReject,
  onParamsChange,
  isSubmitting,
  compact = false,
}: AgentActionRendererProps) {
  const params = (action.params ?? {}) as AddTaskCommentParams
  const [content, setContent] = useState(params.content ?? '')

  useDebouncedParamsChange(
    onParamsChange,
    {
      taskId: params.taskId,
      taskTitle: params.taskTitle,
      content,
      ...(params.parentCommentId !== undefined && {
        parentCommentId: params.parentCommentId,
      }),
      ...(params.entity_version !== undefined && {
        entity_version: params.entity_version,
      }),
    },
    action.status === 'PENDING'
  )

  // Compact summary (AC 11): "Kommentar: \"first ~40 chars…\""
  const previewSnippet =
    (params.content ?? '').length > 40
      ? `${(params.content ?? '').slice(0, 40)}…`
      : (params.content ?? '')
  const summary = params.taskTitle
    ? `${params.taskTitle}: "${previewSnippet}"`
    : `Kommentar: "${previewSnippet}"`

  // APPROVED state — read-only comment + deep-link to the task (AC 9).
  // Navigate by taskId, never by the denormalised title.
  const approved = (
    <>
      <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Godkänt — kommentar publicerad
      </div>
      <p className="whitespace-pre-wrap text-sm leading-snug">
        {params.content}
      </p>
      {params.taskId && (
        <a
          href={`/tasks?task=${params.taskId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Visa uppgift
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </>
  )

  return (
    <ActionRendererFrame
      status={action.status}
      compact={compact}
      badge="Kommentar till uppgift"
      summary={summary}
      approved={approved}
      onApprove={onApprove}
      onReject={onReject}
      isSubmitting={isSubmitting}
      canApprove={content.trim().length > 0 && content.length <= MAX_CONTENT}
    >
      {params.taskTitle && (
        <p className="text-sm font-medium leading-tight">{params.taskTitle}</p>
      )}
      <div className="space-y-1">
        <span className={`${LABEL_CLS} block`}>Kommentar</span>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[80px] resize-none text-sm leading-relaxed"
          placeholder="Vad vill du säga om den här uppgiften?"
          disabled={isSubmitting}
          maxLength={MAX_CONTENT}
        />
      </div>
    </ActionRendererFrame>
  )
}
