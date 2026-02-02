'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { updateWorkspaceStatus } from '@/app/actions/admin-workspaces'
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
import { Button } from '@/components/ui/button'
import { STATUS_LABELS } from '@/lib/admin/constants'
import type { WorkspaceStatus } from '@prisma/client'

interface WorkspaceStatusActionsProps {
  workspaceId: string
  currentStatus: WorkspaceStatus
}

export function WorkspaceStatusActions({
  workspaceId,
  currentStatus,
}: WorkspaceStatusActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingStatus, setPendingStatus] = useState<WorkspaceStatus | null>(
    null
  )
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  function handleAction(status: WorkspaceStatus) {
    setPendingStatus(status)
  }

  function handleConfirm() {
    if (!pendingStatus) return
    const targetStatus = pendingStatus
    setPendingStatus(null)
    setMessage(null)

    startTransition(async () => {
      const result = await updateWorkspaceStatus(workspaceId, targetStatus)
      if (result.success) {
        setMessage({
          type: 'success',
          text: `Status ändrad till ${STATUS_LABELS[targetStatus]}`,
        })
        router.refresh()
      } else {
        setMessage({
          type: 'error',
          text: result.error ?? 'Ett oväntat fel uppstod',
        })
      }
    })
  }

  const confirmMessages: Record<WorkspaceStatus, string> = {
    ACTIVE: 'Är du säker på att du vill aktivera denna arbetsyta?',
    PAUSED:
      'Är du säker på att du vill pausa denna arbetsyta? Användare kommer inte kunna logga in.',
    DELETED:
      'Är du säker på att du vill radera denna arbetsyta? Denna åtgärd kan vara svår att ångra.',
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {currentStatus === 'ACTIVE' && (
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={isPending}
              onClick={() => handleAction('PAUSED')}
            >
              {isPending ? 'Uppdaterar...' : 'Pausa'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={() => handleAction('DELETED')}
            >
              {isPending ? 'Uppdaterar...' : 'Radera'}
            </Button>
          </>
        )}
        {currentStatus === 'PAUSED' && (
          <>
            <Button
              variant="default"
              size="sm"
              disabled={isPending}
              onClick={() => handleAction('ACTIVE')}
            >
              {isPending ? 'Uppdaterar...' : 'Aktivera'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={() => handleAction('DELETED')}
            >
              {isPending ? 'Uppdaterar...' : 'Radera'}
            </Button>
          </>
        )}
        {currentStatus === 'DELETED' && (
          <Button
            variant="default"
            size="sm"
            disabled={isPending}
            onClick={() => handleAction('ACTIVE')}
          >
            {isPending ? 'Uppdaterar...' : 'Aktivera'}
          </Button>
        )}
      </div>

      {message && (
        <p
          className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-destructive'}`}
        >
          {message.text}
        </p>
      )}

      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekräfta statusändring</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus ? confirmMessages[pendingStatus] : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                pendingStatus === 'DELETED'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              Bekräfta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
