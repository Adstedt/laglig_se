'use client'

/**
 * Story 14.23, Task 5: AgentActionBatchCard.
 *
 * Consolidates 2+ PendingAgentAction rows that share a chat_message_id into one
 * card: a header, one compact per-type renderer per row, and a footer with
 * "Godkänn alla" / "Avvisa alla". Single-action messages render the standalone
 * AgentActionCard instead (the chat-message router decides — AC 20).
 *
 * SWR key: `pending-actions:by-message:${chatMessageId}` (AC 15). Mutations
 * revalidate this key AND each `pending-action:${id}` key so a row open in a
 * standalone card elsewhere stays in sync.
 */

import { useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getPendingAgentActionsByMessage,
  approvePendingAction,
  rejectPendingAction,
  updatePendingActionParams,
} from '@/app/actions/pending-agent-actions'
import type { PendingAgentAction } from '@prisma/client'
import { RENDERERS } from './agent-action-card'

interface AgentActionBatchCardProps {
  chatMessageId: string
}

export function AgentActionBatchCard({
  chatMessageId,
}: AgentActionBatchCardProps) {
  const swrKey = `pending-actions:by-message:${chatMessageId}`
  const {
    data: actions,
    mutate,
    isLoading,
  } = useSWR<PendingAgentAction[]>(
    swrKey,
    async () => {
      const result = await getPendingAgentActionsByMessage(chatMessageId)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta förslagen')
      }
      return result.data
    },
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  )

  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="my-2 rounded-xl bg-card/60 px-5 py-4 ring-1 ring-border/45">
        <Skeleton className="mb-3 h-3.5 w-40" />
        <Skeleton className="mb-2 h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  if (!actions || actions.length === 0) return null

  const pendingRows = actions.filter((a) => a.status === 'PENDING')

  /** Revalidate the batch key + each per-action key for cross-card sync (AC 15). */
  const revalidateAll = async () => {
    await mutate()
    for (const a of actions) globalMutate(`pending-action:${a.id}`)
  }

  const handleApproveOne = async (id: string) => {
    setBusy(true)
    try {
      const result = await approvePendingAction(id)
      if (!result.success) {
        throw new Error(result.error ?? 'Kunde inte godkänna förslaget')
      }
      await revalidateAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte godkänna')
    } finally {
      setBusy(false)
    }
  }

  const handleRejectOne = async (id: string) => {
    setBusy(true)
    try {
      const result = await rejectPendingAction(id)
      if (!result.success) {
        throw new Error(result.error ?? 'Kunde inte avvisa förslaget')
      }
      await revalidateAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte avvisa')
    } finally {
      setBusy(false)
    }
  }

  const handleParamsChangeOne = (
    id: string,
    params: Record<string, unknown>
  ) => {
    updatePendingActionParams(id, params as never)
      .then((result) => {
        if (!result.success) {
          throw new Error(result.error ?? 'Kunde inte spara ändringen')
        }
        globalMutate(`pending-action:${id}`)
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Kunde inte spara')
      })
  }

  // AC 18: sequential approve in array (created_at) order so a row that depends
  // on a prior row (e.g. link after create) dispatches after its prerequisite.
  // Partial success is allowed — failed rows stay PENDING with their error.
  const handleApproveAll = async () => {
    setBusy(true)
    setSummary(null)
    let success = 0
    try {
      for (const row of pendingRows) {
        const result = await approvePendingAction(row.id)
        if (result.success) success++
      }
      // Story 14.24 (AC 20): IN_EDITOR rows are never in pendingRows (PENDING-only),
      // so they're skipped for free — note them in the summary.
      const inEditor = actions.filter((a) => a.status === 'IN_EDITOR').length
      const skipNote =
        inEditor > 0
          ? ` (${inEditor} hoppad${inEditor > 1 ? 'e' : ''} över — öppen i editor)`
          : ''
      setSummary(`${success} av ${pendingRows.length} godkända${skipNote}`)
      await revalidateAll()
    } finally {
      setBusy(false)
    }
  }

  // AC 19: reject is non-destructive — no confirmation, parallel.
  const handleRejectAll = async () => {
    setBusy(true)
    try {
      await Promise.all(pendingRows.map((r) => rejectPendingAction(r.id)))
      await revalidateAll()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="my-2 animate-fade-up">
      <div className="relative overflow-hidden rounded-xl bg-card/70 shadow-[0_1px_2px_rgba(0,0,0,0.025)] ring-1 ring-border/45">
        <span className="agent-spine pointer-events-none absolute bottom-3 left-0 top-3 w-[3px]" />
        <div className="py-4 pl-5 pr-4">
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <h3 className="font-safiro text-[15px] font-medium text-foreground">
              Föreslagna åtgärder
            </h3>
            <span className="shrink-0 text-[12px] text-muted-foreground">
              {actions.length} förslag
            </span>
          </div>

          <div className="-mx-2 space-y-0.5">
            {actions.map((action) => {
              const Renderer = RENDERERS[action.action_type]
              return (
                <div key={action.id}>
                  {Renderer ? (
                    <Renderer
                      action={action}
                      compact
                      onApprove={() => handleApproveOne(action.id)}
                      onReject={() => handleRejectOne(action.id)}
                      onParamsChange={(p) =>
                        handleParamsChangeOne(action.id, p)
                      }
                      isSubmitting={busy}
                    />
                  ) : (
                    <p className="px-2 py-2 text-sm text-muted-foreground">
                      Den här typen av förslag stöds inte ännu
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer — approve/reject all (AC 16/18/19). */}
          {pendingRows.length > 0 && (
            <div className="mt-3 flex items-center gap-1 border-t border-border/45 pt-3">
              <button
                type="button"
                onClick={handleApproveAll}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Godkänn alla
              </button>
              <button
                type="button"
                onClick={handleRejectAll}
                disabled={busy}
                className="inline-flex h-8 items-center rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                Avvisa alla
              </button>
              {summary && (
                <span className="ml-auto text-[12px] text-muted-foreground">
                  {summary}
                </span>
              )}
            </div>
          )}
          {pendingRows.length === 0 && summary && (
            <p className="mt-3 border-t border-border/45 pt-3 text-[12px] text-muted-foreground">
              {summary}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
