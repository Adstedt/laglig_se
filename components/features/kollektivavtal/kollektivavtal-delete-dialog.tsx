'use client'

/**
 * Story 7.6: delete-confirmation dialog — states every consequence of the
 * cascade before the user confirms (AC 3): tilldelade anställda avtilldelas,
 * dokumentet tas bort från Filer, AI-assistenten tappar innehållet.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  deleteCollectiveAgreement,
  type CollectiveAgreementListItem,
} from '@/app/actions/collective-agreements'

export interface KollektivavtalDeleteDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  agreement: CollectiveAgreementListItem | null
  onDeleted: (_agreementId: string) => void
}

function unassignLine(count: number): string {
  if (count === 0) return 'Inga anställda är tilldelade avtalet.'
  if (count === 1) return '1 anställd kommer att avtilldelas.'
  return `${count} anställda kommer att avtilldelas.`
}

export function KollektivavtalDeleteDialog({
  open,
  onOpenChange,
  agreement,
  onDeleted,
}: KollektivavtalDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async (event: React.MouseEvent) => {
    // Keep the dialog open while the action runs (Radix closes on click).
    event.preventDefault()
    if (!agreement) return
    setDeleting(true)
    try {
      const result = await deleteCollectiveAgreement(agreement.id)
      if (!result.success) {
        toast.error(result.error ?? 'Kunde inte ta bort kollektivavtalet.')
        return
      }
      toast.success('Kollektivavtalet togs bort.')
      onDeleted(agreement.id)
      onOpenChange(false)
    } catch {
      toast.error('Ett oväntat fel uppstod.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ta bort kollektivavtalet?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Du håller på att ta bort{' '}
                <strong>{agreement?.name ?? 'kollektivavtalet'}</strong>.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>{unassignLine(agreement?.assignedEmployeeCount ?? 0)}</li>
                <li>Dokumentet tas bort från Filer.</li>
                <li>AI-assistenten kan inte längre läsa avtalet.</li>
              </ul>
              <p className="text-destructive">Detta kan inte ångras.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? 'Tar bort…' : 'Ta bort'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
