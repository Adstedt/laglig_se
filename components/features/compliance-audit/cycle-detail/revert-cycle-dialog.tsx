'use client'

/**
 * Story 21.6 — Confirmation dialog for cycle Revert (AVSLUTAD → PAGAENDE).
 *
 * Destructive primary button distinguishes this from the non-destructive
 * Complete dialog — Revert is the "unwind completion" escape hatch and the
 * styling communicates that stepping back is the weightier action.
 */

import { Loader2 } from 'lucide-react'
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
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RevertCycleDialogProps {
  open: boolean
  onOpenChange: (_next: boolean) => void
  onConfirm: () => void | Promise<void>
  isSubmitting: boolean
}

export function RevertCycleDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: RevertCycleDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Återställ kontrollen?</AlertDialogTitle>
          <AlertDialogDescription>
            Kontrollen går tillbaka till Pågående. Signeringar och bedömningar
            behålls oförändrade. Du kan slutföra den på nytt när du är klar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void onConfirm()
            }}
            disabled={isSubmitting}
            className={cn(buttonVariants({ variant: 'destructive' }))}
          >
            {isSubmitting ? (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            Återställ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
