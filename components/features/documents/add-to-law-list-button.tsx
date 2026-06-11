'use client'

import { useMemo, useState } from 'react'
import { ListPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddToLawListDialog } from '@/components/features/documents/add-to-law-list-dialog'

interface AddToLawListButtonProps {
  documentId: string
  initialListIdsContaining: string[]
}

export function AddToLawListButton({
  documentId,
  initialListIdsContaining,
}: AddToLawListButtonProps) {
  const [open, setOpen] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const excludeListIds = useMemo(
    () => new Set([...initialListIdsContaining, ...addedIds]),
    [initialListIdsContaining, addedIds]
  )

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full justify-center gap-1.5 sm:w-auto"
      >
        <ListPlus className="h-4 w-4" />
        Lägg till i laglista
      </Button>
      <AddToLawListDialog
        open={open}
        onOpenChange={setOpen}
        documentId={documentId}
        excludeListIds={excludeListIds}
        onAdded={(listId) =>
          setAddedIds((prev) => {
            const next = new Set(prev)
            next.add(listId)
            return next
          })
        }
      />
    </>
  )
}
