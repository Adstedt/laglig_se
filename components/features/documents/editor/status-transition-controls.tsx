'use client'

import { useCallback, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { updateDocumentStatus } from '@/app/actions/documents'
import { getValidNextStatuses } from '@/lib/validation/documents'
import { STATUS_CONFIG } from '@/components/features/documents/document-status-badge'
import { WorkspaceDocumentStatus } from '@prisma/client'

interface StatusTransitionControlsProps {
  documentId: string
  currentStatus: string
  onStatusChange: () => void
}

export function StatusTransitionControls({
  documentId,
  currentStatus,
  onStatusChange,
}: StatusTransitionControlsProps) {
  const [pendingStatus, setPendingStatus] =
    useState<WorkspaceDocumentStatus | null>(null)
  const [comment, setComment] = useState('')
  const [updating, setUpdating] = useState(false)

  const validNextStatuses = getValidNextStatuses(
    currentStatus as WorkspaceDocumentStatus
  )

  const handleConfirm = useCallback(async () => {
    if (!pendingStatus) return
    setUpdating(true)
    const result = await updateDocumentStatus({
      documentId,
      newStatus: pendingStatus,
      comment: comment.trim() || undefined,
    })
    setUpdating(false)
    setPendingStatus(null)
    setComment('')
    if (result.success) {
      onStatusChange()
    }
  }, [documentId, pendingStatus, comment, onStatusChange])

  if (validNextStatuses.length === 0) return null

  const pendingConfig = pendingStatus ? STATUS_CONFIG[pendingStatus] : null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
            Ändra status
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {validNextStatuses.map((nextStatus) => {
            const config = STATUS_CONFIG[nextStatus]
            return (
              <DropdownMenuItem
                key={nextStatus}
                onClick={() => setPendingStatus(nextStatus)}
              >
                {config?.label ?? nextStatus}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={!!pendingStatus}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStatus(null)
            setComment('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ändra status</AlertDialogTitle>
            <AlertDialogDescription>
              Ändra status till &quot;{pendingConfig?.label}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <span className="text-sm text-muted-foreground mb-1 block">
              Kommentar (valfritt)
            </span>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anledning till ändringen..."
              maxLength={500}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={updating}>
              {updating ? 'Ändrar...' : 'Bekräfta'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
