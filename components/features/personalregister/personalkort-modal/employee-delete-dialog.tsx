'use client'

/**
 * Story 7.3: hard-delete confirmation for an employee (GDPR erasure). Mirrors
 * the canonical `task-delete-dialog` AlertDialog — a destructive, irreversible
 * action wants an explicit confirm (unlike the low-stakes group delete, which
 * is SetNull and needs none).
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

interface EmployeeDeleteDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  employeeName: string
  onConfirm: () => void
  isDeleting?: boolean
}

export function EmployeeDeleteDialog({
  open,
  onOpenChange,
  employeeName,
  onConfirm,
  isDeleting = false,
}: EmployeeDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ta bort anställd?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Du håller på att ta bort <strong>{employeeName}</strong> ur
                personalregistret, inklusive personnummer och löneuppgifter.
              </p>
              <p className="text-destructive">Detta kan inte ångras.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Tar bort...' : 'Ta bort'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
