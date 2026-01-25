'use client'

/**
 * Story 6.6: Modal Footer
 * Created/updated timestamps and delete action
 */

import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2, Loader2, Clock } from 'lucide-react'
import { deleteTaskModal } from '@/app/actions/task-modal'
import { toast } from 'sonner'

interface ModalFooterProps {
  taskId: string
  createdAt: Date
  updatedAt: Date
  creator: {
    id: string
    name: string | null
    email: string
  }
  onDelete: () => void
}

export function ModalFooter({
  taskId,
  createdAt,
  updatedAt,
  creator,
  onDelete,
}: ModalFooterProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    const result = await deleteTaskModal(taskId)

    if (result.success) {
      toast.success('Uppgift raderad')
      onDelete()
    } else {
      toast.error('Kunde inte radera uppgift', { description: result.error })
    }

    setIsDeleting(false)
  }

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
      {/* Timestamps */}
      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>
            Skapad{' '}
            <span title={format(new Date(createdAt), 'PPpp', { locale: sv })}>
              {formatDistanceToNow(new Date(createdAt), {
                addSuffix: true,
                locale: sv,
              })}
            </span>
            {creator && <span> av {creator.name ?? creator.email}</span>}
          </span>
        </div>
        <div className="ml-4">
          Uppdaterad{' '}
          <span title={format(new Date(updatedAt), 'PPpp', { locale: sv })}>
            {formatDistanceToNow(new Date(updatedAt), {
              addSuffix: true,
              locale: sv,
            })}
          </span>
        </div>
      </div>

      {/* Delete button */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Radera uppgift
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera uppgift?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill radera denna uppgift? Alla kommentarer,
              bevis och länkar kommer också att raderas. Detta kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Radera uppgift
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
