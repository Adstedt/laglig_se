'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDocumentListStore } from '@/lib/stores/document-list-store'
import { AddDocumentModal, type DocumentInfoForAdd } from './add-document-modal'

export function LawListPrimaryAction() {
  const [open, setOpen] = useState(false)
  const activeListId = useDocumentListStore((s) => s.activeListId)
  const addItem = useDocumentListStore((s) => s.addItem)

  const handleAddDocument = async (
    documentId: string,
    documentInfo: DocumentInfoForAdd
  ) => {
    if (!activeListId) return false
    return addItem(activeListId, documentId, documentInfo)
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={!activeListId}>
        <Plus className="mr-1.5 h-4 w-4" />
        Lägg till dokument
      </Button>

      <AddDocumentModal
        open={open}
        onOpenChange={setOpen}
        listId={activeListId}
        onAddDocument={handleAddDocument}
      />
    </>
  )
}
