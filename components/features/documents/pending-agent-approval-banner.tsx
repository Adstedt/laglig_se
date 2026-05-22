'use client'

/**
 * Story 14.24 (AC 15-16): banner shown on the styrdokument editor page when the
 * document was opened from an agent draft (`?agentApprovalId=`). Lets the user
 * finalize the approval (wire links + mark APPROVED — content is already autosaved)
 * or reject (delete the draft + mark REJECTED).
 *
 * SWR-backed on `pending-action:${id}` (shares cache with the inline card). Renders
 * only while the row is IN_EDITOR — when "Slutför" flips it to APPROVED, SWR
 * revalidation unmounts the banner cleanly (no local optimistic status).
 */

import { useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import {
  getPendingAgentAction,
  finalizeDraftFromEditor,
  rejectDraftFromEditor,
} from '@/app/actions/pending-agent-actions'
import type { PendingAgentAction } from '@prisma/client'

export function PendingAgentApprovalBanner({
  pendingActionId,
}: {
  pendingActionId: string
}) {
  const swrKey = `pending-action:${pendingActionId}`
  const { data, mutate } = useSWR<PendingAgentAction | null>(
    swrKey,
    async () => {
      const result = await getPendingAgentAction(pendingActionId)
      return result.success && result.data ? result.data : null
    },
    { revalidateOnFocus: false }
  )
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  // AC 15: SWR is the source of truth — render only on IN_EDITOR.
  if (data?.status !== 'IN_EDITOR') return null

  const handleFinalize = async () => {
    setBusy(true)
    try {
      const result = await finalizeDraftFromEditor(pendingActionId)
      if (!result.success) {
        toast.error(result.error ?? 'Kunde inte slutföra godkännandet')
        return
      }
      toast.success('Utkastet godkändes')
      await mutate() // status → APPROVED → render guard unmounts the banner
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    setBusy(true)
    try {
      const result = await rejectDraftFromEditor(pendingActionId)
      if (!result.success) {
        toast.error(result.error ?? 'Kunde inte avvisa utkastet')
        return
      }
      router.push('/workspace/styrdokument')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-lg bg-card/70 px-4 py-3 ring-1 ring-border/45">
      <span className="agent-spine pointer-events-none absolute bottom-2.5 left-0 top-2.5 w-[3px]" />
      <div className="flex flex-wrap items-center justify-between gap-3 pl-2">
        <p className="text-[13px] text-muted-foreground">
          Väntar på godkännande från agent-utkast. Spara för att slutföra
          godkännandet, eller avvisa för att ta bort utkastet.
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleFinalize}
            disabled={busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Slutför godkännande
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={busy}
            className="inline-flex h-8 items-center rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Avvisa
          </button>
        </div>
      </div>
    </div>
  )
}
