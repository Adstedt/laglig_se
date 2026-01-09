'use client'

/**
 * Story 6.5: Column Delete Dialog
 * Confirmation dialog for deleting a task column with task migration info.
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

interface ColumnDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columnName: string
  taskCount: number
  targetColumnName: string
  onConfirm: () => void
  isDeleting?: boolean
}

export function ColumnDeleteDialog({
  open,
  onOpenChange,
  columnName,
  taskCount,
  targetColumnName,
  onConfirm,
  isDeleting = false,
}: ColumnDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Radera kolumn?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Du håller på att radera kolumnen <strong>{columnName}</strong>.
              </p>
              {taskCount > 0 ? (
                <p>
                  <strong>{taskCount}</strong> uppgift{taskCount !== 1 ? 'er' : ''} flyttas till{' '}
                  <strong>{targetColumnName}</strong>.
                </p>
              ) : (
                <p>Kolumnen innehåller inga uppgifter.</p>
              )}
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
            {isDeleting ? 'Raderar...' : 'Radera'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
