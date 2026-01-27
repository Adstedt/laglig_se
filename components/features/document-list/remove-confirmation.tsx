'use client'

/**
 * Story 4.11: Remove Document Confirmation
 * Confirmation dialog before removing a document from a list
 */

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

interface RemoveConfirmationProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  documentTitle: string
  onConfirm: () => void
}

export function RemoveConfirmation({
  open,
  onOpenChange,
  documentTitle,
  onConfirm,
}: RemoveConfirmationProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ta bort dokument från listan?</AlertDialogTitle>
          <AlertDialogDescription>
            Är du säker på att du vill ta bort{' '}
            <strong className="text-foreground">{documentTitle}</strong> från
            listan?
            <br />
            <br />
            Dokumentet kommer fortfarande vara tillgängligt i databasen och kan
            läggas till igen senare.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Ta bort
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
