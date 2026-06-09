'use client'

/**
 * Story 14.23, Task 3.1/3.2: shared body for the two link approval renderers.
 *
 * The proposal carries denormalised title snapshots, so the PENDING state shows
 * a read-only preview of the proposed link + approve/reject. In-card swap via
 * DocumentPickerModal/TaskPickerDialog is deferred: DocumentPickerModal.onSelect
 * returns ids without titles (no clean snapshot), and the agent already chose
 * both entities — reject + re-ask is the correction path for v1. The other four
 * renderers remain fully editable.
 */

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  ListTodo,
} from 'lucide-react'
import type { AgentActionRendererProps } from './task-approval-renderer'
import { ActionRendererFrame } from './renderer-frame'

interface LinkParams {
  taskId?: string
  taskTitle?: string
  documentId?: string
  documentTitle?: string
}

/** direction = the framing of the proposal (which entity the user started from). */
export function LinkRenderer({
  action,
  onApprove,
  onReject,
  isSubmitting,
  compact = false,
  direction,
}: AgentActionRendererProps & {
  direction: 'task-to-document' | 'document-to-task'
}) {
  const params = (action.params ?? {}) as LinkParams
  const taskTitle = params.taskTitle ?? 'uppgift'
  const docTitle = params.documentTitle ?? 'dokument'

  const summary =
    direction === 'task-to-document'
      ? `Koppla uppgift "${taskTitle}" → dokument "${docTitle}"`
      : `Koppla dokument "${docTitle}" → uppgift "${taskTitle}"`

  const left =
    direction === 'task-to-document'
      ? { icon: ListTodo, label: taskTitle }
      : { icon: FileText, label: docTitle }
  const right =
    direction === 'task-to-document'
      ? { icon: FileText, label: docTitle }
      : { icon: ListTodo, label: taskTitle }

  const approved = (
    <>
      <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Godkänt — koppling skapad
      </div>
      <p className="text-sm leading-snug">{summary.replace(/^Koppla /, '')}</p>
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
      badge="Koppling"
      summary={summary}
      approved={approved}
      onApprove={onApprove}
      onReject={onReject}
      isSubmitting={isSubmitting}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border/70 px-2 py-1">
          <left.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{left.label}</span>
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border/70 px-2 py-1">
          <right.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{right.label}</span>
        </span>
      </div>
    </ActionRendererFrame>
  )
}
