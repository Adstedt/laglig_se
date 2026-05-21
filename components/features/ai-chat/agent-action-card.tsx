'use client'

/**
 * Story 14.22, Task 3: AgentActionCard — inline approval card primitive.
 *
 * SWR-backed (key `pending-action:${id}`) container that routes to a per-type
 * renderer by `action_type`. Owns approve / reject / edit with optimistic SWR
 * updates + rollback + Swedish error toasts. For 14.22 only CREATE_TASK is
 * supported; other types render a non-intrusive fallback. 14.23+ register more
 * renderers in RENDERERS.
 */

import { useState, type ComponentType } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { ListTodo } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getPendingAgentAction,
  approvePendingAction,
  rejectPendingAction,
  updatePendingActionParams,
} from '@/app/actions/pending-agent-actions'
import type { PendingAgentAction, PendingAgentActionType } from '@prisma/client'
import {
  TaskApprovalRenderer,
  type AgentActionRendererProps,
} from './agent-action-renderers/task-approval-renderer'

const ACTION_TYPE_LABELS: Partial<Record<PendingAgentActionType, string>> = {
  CREATE_TASK: 'Ny uppgift',
}

/** Per-type renderer registry. 14.23+ extend this map. */
const RENDERERS: Partial<
  Record<PendingAgentActionType, ComponentType<AgentActionRendererProps>>
> = {
  CREATE_TASK: TaskApprovalRenderer,
}

interface AgentActionCardProps {
  pendingActionId: string
}

export function AgentActionCard({ pendingActionId }: AgentActionCardProps) {
  const swrKey = `pending-action:${pendingActionId}`
  const {
    data: action,
    mutate,
    isLoading,
  } = useSWR<PendingAgentAction | null>(
    swrKey,
    async () => {
      const result = await getPendingAgentAction(pendingActionId)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta förslaget')
      }
      return result.data
    },
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  )

  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isLoading) {
    return (
      <Card className="my-2">
        <CardContent className="p-3">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!action) return null

  const handleApprove = async () => {
    if (!action) return
    setIsSubmitting(true)
    try {
      await mutate(
        async () => {
          const result = await approvePendingAction(action.id)
          if (!result.success) {
            throw new Error(result.error ?? 'Kunde inte godkänna förslaget')
          }
          return {
            ...action,
            status: 'APPROVED',
            result_ref: (result.data?.resultRef ?? null) as never,
            decided_at: new Date(),
          }
        },
        {
          optimisticData: { ...action, status: 'APPROVED' },
          rollbackOnError: true,
          revalidate: true,
        }
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Kunde inte godkänna förslaget'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!action) return
    setIsSubmitting(true)
    try {
      await mutate(
        async () => {
          const result = await rejectPendingAction(action.id)
          if (!result.success) {
            throw new Error(result.error ?? 'Kunde inte avvisa förslaget')
          }
          return { ...action, status: 'REJECTED', decided_at: new Date() }
        },
        {
          optimisticData: { ...action, status: 'REJECTED' },
          rollbackOnError: true,
          revalidate: true,
        }
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Kunde inte avvisa förslaget'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleParamsChange = (params: Record<string, unknown>) => {
    if (!action) return
    mutate(
      async () => {
        const result = await updatePendingActionParams(
          action.id,
          params as never
        )
        if (!result.success) {
          throw new Error(result.error ?? 'Kunde inte spara ändringen')
        }
        return { ...action, params: params as never }
      },
      {
        optimisticData: { ...action, params: params as never },
        rollbackOnError: true,
        revalidate: false,
      }
    ).catch((err) => {
      toast.error(
        err instanceof Error ? err.message : 'Kunde inte spara ändringen'
      )
    })
  }

  const Renderer = RENDERERS[action.action_type]
  const label = ACTION_TYPE_LABELS[action.action_type] ?? 'Förslag'

  return (
    <Card className="my-2 animate-fade-up overflow-hidden border-border/70">
      <CardHeader className="flex-row items-center gap-2.5 space-y-0 p-3 pb-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ListTodo className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-muted-foreground">
            Förslag från assistenten
          </p>
          <p className="mt-1 truncate text-sm font-medium leading-tight">
            {label}
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {Renderer ? (
          <Renderer
            action={action}
            onApprove={handleApprove}
            onReject={handleReject}
            onParamsChange={handleParamsChange}
            isSubmitting={isSubmitting}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Den här typen av förslag stöds inte ännu
          </p>
        )}
      </CardContent>
    </Card>
  )
}
