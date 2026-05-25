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
import useSWR, { mutate as globalMutate } from 'swr'
import { toast } from 'sonner'
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
import { LinkTaskToDocumentRenderer } from './agent-action-renderers/link-task-to-document-renderer'
import { LinkDocumentToTaskRenderer } from './agent-action-renderers/link-document-to-task-renderer'
import { AddObligationRenderer } from './agent-action-renderers/add-obligation-renderer'
import { AssignTaskRenderer } from './agent-action-renderers/assign-task-renderer'
import { AddContextNoteRenderer } from './agent-action-renderers/add-context-note-renderer'
import { UpdateComplianceStatusRenderer } from './agent-action-renderers/update-compliance-status-renderer'
import { DraftDocumentRenderer } from './agent-action-renderers/draft-document-renderer'

export const ACTION_TYPE_LABELS: Partial<
  Record<PendingAgentActionType, string>
> = {
  CREATE_TASK: 'Ny uppgift',
  LINK_TASK_TO_DOCUMENT: 'Koppla uppgift till dokument',
  LINK_DOCUMENT_TO_TASK: 'Koppla dokument till uppgift',
  ADD_OBLIGATION: 'Ny kravpunkt',
  ASSIGN_TASK: 'Tilldela uppgift',
  ADD_CONTEXT_NOTE: 'Ny anteckning',
  UPDATE_COMPLIANCE_STATUS: 'Ändra status',
  DRAFT_DOCUMENT: 'Utkast styrdokument',
}

/** Per-type renderer registry. Story 14.23: all seven types registered. */
export const RENDERERS: Partial<
  Record<PendingAgentActionType, ComponentType<AgentActionRendererProps>>
> = {
  CREATE_TASK: TaskApprovalRenderer,
  LINK_TASK_TO_DOCUMENT: LinkTaskToDocumentRenderer,
  LINK_DOCUMENT_TO_TASK: LinkDocumentToTaskRenderer,
  ADD_OBLIGATION: AddObligationRenderer,
  ASSIGN_TASK: AssignTaskRenderer,
  ADD_CONTEXT_NOTE: AddContextNoteRenderer,
  UPDATE_COMPLIANCE_STATUS: UpdateComplianceStatusRenderer,
  DRAFT_DOCUMENT: DraftDocumentRenderer,
}

/**
 * Story 19.4a follow-up: after an agent write is approved in the chat, the
 * open law-item modal panels (kravpunkter, business-context, status) are
 * separate SWR scopes and don't see the change until a manual refresh. Map the
 * approved action → the entity SWR keys it touches so we can revalidate them
 * live. Keyed on the `lawListItemId` the write tools stamp into `params`.
 */
function affectedSwrKeys(action: PendingAgentAction): string[] {
  const params = (action.params ?? {}) as { lawListItemId?: string }
  const itemId = params.lawListItemId
  if (!itemId) return []
  switch (action.action_type) {
    case 'ADD_OBLIGATION':
      // New kravpunkt → the modal's KravpunkterChecklist + the artifacts panel.
      return [`list-item-requirements:${itemId}`, `linked-artifacts:${itemId}`]
    case 'ADD_CONTEXT_NOTE':
      // business_context append → the item + its "extra" fields.
      return [`list-item:${itemId}`, `list-item-extra:${itemId}`]
    case 'UPDATE_COMPLIANCE_STATUS':
      return [`list-item:${itemId}`]
    default:
      return []
  }
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
      <div className="my-2 rounded-xl bg-card/60 px-5 py-4 ring-1 ring-border/45">
        <Skeleton className="mb-2 h-3 w-24" />
        <Skeleton className="h-4 w-full" />
      </div>
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
      // Story 19.4a follow-up: revalidate the open law-item modal panels so the
      // approved change (e.g. a new kravpunkt) shows live without a manual refresh.
      for (const key of affectedSwrKeys(action)) {
        void globalMutate(key)
      }
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

  // Story 14.23: the renderer's shared frame draws the full card (spine +
  // eyebrow + body); the single card is just a margin + entrance wrapper.
  return (
    <div className="my-2 animate-fade-up">
      {Renderer ? (
        <Renderer
          action={action}
          onApprove={handleApprove}
          onReject={handleReject}
          onParamsChange={handleParamsChange}
          isSubmitting={isSubmitting}
        />
      ) : (
        <div className="rounded-xl bg-muted/30 px-4 py-3 text-sm text-muted-foreground ring-1 ring-border/45">
          Den här typen av förslag stöds inte ännu
        </div>
      )}
    </div>
  )
}
