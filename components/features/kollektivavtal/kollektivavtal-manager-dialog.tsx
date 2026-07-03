'use client'

/**
 * Story 7.6 (checkpoint round): Personalregister-toolbar mount of the SAME
 * KollektivavtalManager the Settings tab uses — bulk assignment (Tilldela)
 * is an HR workflow and must be reachable from /personalregister, not only
 * Settings (epic 7.5 AC).
 *
 * Self-contained trigger + wide Dialog (ManageGroupsPopover pattern). The
 * Settings mount prefetches server-side; here the list is fetched on open
 * via `listCollectiveAgreements` (`employees:view`-gated) — a failed fetch
 * passes `null`, the manager's own error copy renders. The manager mounts
 * with `variant="dialog"` (flat sections, title lives in the DialogHeader).
 * On close, `router.refresh()` re-syncs the register island behind the
 * dialog (assign/delete change rows' kollektivavtal and the completeness
 * stat).
 */

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  listCollectiveAgreements,
  type CollectiveAgreementListItem,
} from '@/app/actions/collective-agreements'
import { KollektivavtalManager } from './kollektivavtal-manager'

export interface KollektivavtalManagerDialogProps {
  /** `employees:manage` — passed through to the manager (view-only renders the plain list). */
  canManage: boolean
}

export function KollektivavtalManagerDialog({
  canManage,
}: KollektivavtalManagerDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // undefined = fetch in flight; null = fetch failed (manager's error copy).
  const [agreements, setAgreements] = useState<
    CollectiveAgreementListItem[] | null | undefined
  >(undefined)

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (nextOpen) {
        setAgreements(undefined)
        void listCollectiveAgreements().then((result) => {
          setAgreements(result.success && result.data ? result.data : null)
        })
      } else {
        // Mutations inside the dialog (tilldela/ta bort) already
        // revalidatePath('/personalregister'); refresh() pulls the fresh RSC
        // payload so the island's initialRows/completeness re-sync.
        router.refresh()
      }
    },
    [router]
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(true)}
      >
        <ScrollText className="mr-1.5 h-4 w-4" />
        Kollektivavtal
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {/* Visible header (user checkpoint): gives the ✕ its own space and
            carries the title/description the manager's page-card otherwise
            renders — the manager mounts flat (`variant="dialog"`). */}
        <DialogHeader>
          <DialogTitle>Kollektivavtal</DialogTitle>
          <DialogDescription>
            Uppladdade avtal blir valbara i personalregistret och sökbara för
            AI-assistenten när bearbetningen är klar.
          </DialogDescription>
        </DialogHeader>
        {agreements === undefined ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Laddar kollektivavtal…
          </p>
        ) : (
          <KollektivavtalManager
            initialAgreements={agreements}
            canManage={canManage}
            variant="dialog"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
