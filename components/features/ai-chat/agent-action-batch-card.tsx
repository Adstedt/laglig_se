'use client'

/**
 * Story 14.23, Task 5: AgentActionBatchCard.
 *
 * Consolidates 2+ PendingAgentAction rows that share a chat_message_id into one
 * card. Each pending row carries a selection checkbox (all preselected); a
 * single "Godkänn markerade" action approves the selected set — document edits
 * on the same document are consolidated SERVER-SIDE into ONE new version (not
 * one per edit). "Avvisa markerade" rejects the selected set. Single-action
 * messages render the standalone AgentActionCard instead, which keeps its
 * instant approve/reject UX (the chat-message router decides — AC 20).
 *
 * SWR key: `pending-actions:by-message:${chatMessageId}` (AC 15). Mutations
 * revalidate this key AND each `pending-action:${id}` key so a row open in a
 * standalone card elsewhere stays in sync.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { toast } from 'sonner'
import { ArrowUpRight, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  getPendingAgentActionsByMessage,
  approvePendingActions,
  rejectPendingAction,
  updatePendingActionParams,
} from '@/app/actions/pending-agent-actions'
import type { PendingAgentAction } from '@prisma/client'
import { RENDERERS } from './agent-action-card'
import { BatchSelectionProvider } from './agent-action-renderers/batch-selection-context'

interface AgentActionBatchCardProps {
  chatMessageId: string
}

const noop = () => {}

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

  // Selection state — a Set of selected PENDING ids. New pending rows default to
  // selected (preselected); user toggles are preserved across revalidation, and
  // ids that leave PENDING (approved/rejected) are dropped. `seenRef` tracks
  // which ids we've already defaulted so a deselect isn't re-checked on refetch.
  const pendingRows = useMemo(
    () => (actions ?? []).filter((a) => a.status === 'PENDING'),
    [actions]
  )
  const pendingKey = pendingRows.map((r) => r.id).join(',')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const seenRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const ids = pendingKey ? pendingKey.split(',') : []
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (!seenRef.current.has(id)) {
          next.add(id)
          seenRef.current.add(id)
        }
      }
      for (const id of [...next]) {
        if (!ids.includes(id)) next.delete(id)
      }
      return next
    })
  }, [pendingKey])

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

  const selectedPendingIds = pendingRows
    .filter((r) => selected.has(r.id))
    .map((r) => r.id)
  const selectedCount = selectedPendingIds.length
  const allSelected =
    pendingRows.length > 0 && selectedCount === pendingRows.length

  // Show the consolidation hint only when ≥2 document edits on the SAME document
  // are pending — that's the case the single-version consolidation applies to.
  const docEditPending = pendingRows.filter(
    (a) =>
      a.action_type === 'UPDATE_DOCUMENT' ||
      a.action_type === 'ADD_DOCUMENT_SECTION'
  )
  const docIds = new Set(
    docEditPending
      .map((a) => (a.params as { documentId?: string } | null)?.documentId)
      .filter(Boolean)
  )
  const showConsolidationNote = docEditPending.length >= 2 && docIds.size === 1

  // After a consolidated approval the approved document-edit rows share one
  // result_ref (documentId + the single new version). Surface it once as a link
  // to the resulting draft — mirrors the new-document (DRAFT_DOCUMENT) flow.
  const approvedDocRef = actions
    .filter(
      (a) =>
        (a.action_type === 'UPDATE_DOCUMENT' ||
          a.action_type === 'ADD_DOCUMENT_SECTION') &&
        a.status === 'APPROVED' &&
        a.result_ref != null
    )
    .map((a) => a.result_ref as { documentId?: string; versionNumber?: number })
    .find((ref) => typeof ref.documentId === 'string')

  /** Revalidate the batch key + each per-action key for cross-card sync (AC 15). */
  const revalidateAll = async () => {
    await mutate()
    for (const a of actions) globalMutate(`pending-action:${a.id}`)
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        for (const r of pendingRows) next.delete(r.id)
      } else {
        for (const r of pendingRows) next.add(r.id)
      }
      return next
    })
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

  // Approve the selected set in one call. Same-document edits consolidate into
  // ONE new version server-side; other actions dispatch in created_at order.
  // Partial success is allowed — failed rows stay PENDING with their error.
  const handleApproveSelected = async () => {
    if (selectedCount === 0) return
    setBusy(true)
    setSummary(null)
    try {
      const result = await approvePendingActions(selectedPendingIds)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte godkänna förslagen')
      }
      const { approved, failed, errors } = result.data
      setSummary(`${approved} av ${selectedPendingIds.length} godkända`)
      if (failed > 0 && errors[0]) {
        toast.error(errors[0])
      }
      await revalidateAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte godkänna')
    } finally {
      setBusy(false)
    }
  }

  // Reject is non-destructive — no confirmation, parallel over the selection.
  const handleRejectSelected = async () => {
    if (selectedCount === 0) return
    setBusy(true)
    try {
      await Promise.all(selectedPendingIds.map((id) => rejectPendingAction(id)))
      await revalidateAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte avvisa')
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

          <BatchSelectionProvider value={{ selectionMode: true }}>
            <div className="space-y-0.5">
              {actions.map((action) => {
                const Renderer = RENDERERS[action.action_type]
                const isPending = action.status === 'PENDING'
                return (
                  <div key={action.id} className="flex items-start gap-1.5">
                    {isPending ? (
                      <Checkbox
                        checked={selected.has(action.id)}
                        onCheckedChange={() => toggleOne(action.id)}
                        disabled={busy}
                        aria-label="Markera förslag"
                        className="ml-1 mt-2.5 shrink-0"
                      />
                    ) : (
                      <span className="ml-1 w-4 shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      {Renderer ? (
                        <Renderer
                          action={action}
                          compact
                          onApprove={noop}
                          onReject={noop}
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
                  </div>
                )
              })}
            </div>
          </BatchSelectionProvider>

          {/* Footer — approve/reject the selected set, the resulting draft
              link, and status summary. */}
          {(pendingRows.length > 0 ||
            summary ||
            approvedDocRef?.documentId) && (
            <div className="mt-3 border-t border-border/45 pt-3">
              {pendingRows.length > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleApproveSelected}
                    disabled={busy || selectedCount === 0}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Godkänn markerade ({selectedCount})
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectSelected}
                    disabled={busy || selectedCount === 0}
                    className="inline-flex h-8 items-center rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    Avvisa markerade
                  </button>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    disabled={busy}
                    className="ml-auto shrink-0 text-[12px] text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    {allSelected ? 'Avmarkera alla' : 'Markera alla'}
                  </button>
                </div>
              )}
              {showConsolidationNote && pendingRows.length > 0 && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Markerade dokumentändringar slås ihop till en ny version.
                </p>
              )}
              {approvedDocRef?.documentId && (
                <a
                  href={`/workspace/styrdokument/${approvedDocRef.documentId}/edit`}
                  className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {typeof approvedDocRef.versionNumber === 'number'
                    ? `Nytt utkast v${approvedDocRef.versionNumber} skapat`
                    : 'Nytt utkast skapat'}
                  <span className="text-muted-foreground/50">·</span>
                  Öppna utkast
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
              {summary && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  {summary}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
