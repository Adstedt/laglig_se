'use client'

/**
 * Story 14.23, Task 3.4: ASSIGN_TASK approval renderer.
 * Editable workspace-member <Select> (mirrors the create-task-modal assignee
 * pattern). APPROVED → "Tilldelad: {namn}" + link to the task.
 */

import { useState } from 'react'
import useSWR from 'swr'
import { Check, ArrowUpRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getWorkspaceMembers } from '@/app/actions/tasks'
import type { AgentActionRendererProps } from './task-approval-renderer'
import {
  ActionRendererFrame,
  LABEL_CLS,
  useDebouncedParamsChange,
} from './renderer-frame'

interface AssignTaskParams {
  taskId?: string
  taskTitle?: string
  userId?: string
  userName?: string
}

type Member = { id: string; name: string | null; email: string }

export function AssignTaskRenderer({
  action,
  onApprove,
  onReject,
  onParamsChange,
  isSubmitting,
  compact = false,
}: AgentActionRendererProps) {
  const params = (action.params ?? {}) as AssignTaskParams
  const [userId, setUserId] = useState(params.userId ?? '')

  const { data: members } = useSWR<Member[]>(
    action.status === 'PENDING' ? 'workspace-members' : null,
    async () => {
      const result = await getWorkspaceMembers()
      return result.success && result.data ? result.data : []
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  const selectedName =
    members?.find((m) => m.id === userId)?.name ??
    members?.find((m) => m.id === userId)?.email ??
    params.userName ??
    ''

  useDebouncedParamsChange(
    onParamsChange,
    {
      taskId: params.taskId,
      taskTitle: params.taskTitle,
      userId,
      userName: selectedName,
    },
    action.status === 'PENDING'
  )

  const summary = `${params.taskTitle ?? ''} → ${selectedName || params.userName || '…'}`

  const approved = (
    <>
      <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Godkänt — uppgift tilldelad
      </div>
      <p className="text-sm leading-snug">
        {params.taskTitle} — tilldelad {params.userName || selectedName}
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
      badge="Tilldela"
      summary={summary}
      approved={approved}
      onApprove={onApprove}
      onReject={onReject}
      isSubmitting={isSubmitting}
      canApprove={userId.trim().length > 0}
    >
      {params.taskTitle && (
        <p className="text-sm font-medium leading-tight">{params.taskTitle}</p>
      )}
      <div className="space-y-1">
        <span className={`${LABEL_CLS} block`}>Ansvarig</span>
        <Select
          value={userId}
          onValueChange={setUserId}
          disabled={isSubmitting}
        >
          <SelectTrigger className="h-9 text-sm" aria-label="Ansvarig">
            <SelectValue placeholder="Välj medlem…" />
          </SelectTrigger>
          <SelectContent>
            {(members ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name ?? m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </ActionRendererFrame>
  )
}
