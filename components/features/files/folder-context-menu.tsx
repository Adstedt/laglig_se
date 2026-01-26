'use client'

/**
 * Story 6.7b: Folder Context Menu
 * AC: 28 - Right-click context menu for folders with Öppna, Byt namn, Flytta till, Radera
 */

import { useState, useRef, useEffect } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
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
import { FolderOpen, Pencil, FolderInput, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { renameFolder, deleteFolder } from '@/app/actions/files'
import type { FolderInfo } from '@/app/actions/files'

// ============================================================================
// Types
// ============================================================================

interface FolderContextMenuProps {
  folder: FolderInfo
  children: React.ReactNode
  onOpen: () => void
  onMoveClick: () => void
  onDeleted?: () => void
  onRenamed?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function FolderContextMenu({
  folder,
  children,
  onOpen,
  onMoveClick,
  onDeleted,
  onRenamed,
}: FolderContextMenuProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(folder.filename)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmNonEmpty, setDeleteConfirmNonEmpty] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  const handleRename = async () => {
    if (!newName.trim() || newName === folder.filename) {
      setIsRenaming(false)
      setNewName(folder.filename)
      return
    }

    const result = await renameFolder({
      folderId: folder.id,
      newName: newName.trim(),
    })

    if (result.success) {
      toast.success('Mappen har bytt namn')
      setIsRenaming(false)
      onRenamed?.()
    } else {
      toast.error(result.error || 'Kunde inte byta namn på mappen')
    }
  }

  const handleDelete = async (confirmNonEmpty = false) => {
    const result = await deleteFolder(folder.id, confirmNonEmpty)

    if (result.success) {
      toast.success('Mappen har raderats')
      setShowDeleteDialog(false)
      onDeleted?.()
    } else if (result.error === 'FOLDER_NOT_EMPTY') {
      // Show confirmation for non-empty folder
      setDeleteConfirmNonEmpty(true)
    } else {
      toast.error(result.error || 'Kunde inte radera mappen')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setIsRenaming(false)
      setNewName(folder.filename)
    }
  }

  // If renaming, show inline input
  if (isRenaming) {
    return (
      <div className="relative">
        {children}
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-lg">
          <Input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleRename}
            className="max-w-[200px]"
          />
        </div>
      </div>
    )
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={onOpen}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Öppna
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setIsRenaming(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Byt namn
          </ContextMenuItem>
          <ContextMenuItem onClick={onMoveClick}>
            <FolderInput className="h-4 w-4 mr-2" />
            Flytta till...
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Radera
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirmNonEmpty
                ? 'Mappen är inte tom'
                : `Radera "${folder.filename}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmNonEmpty
                ? 'Denna mapp innehåller filer och/eller undermappar. Vill du radera mappen och allt dess innehåll?'
                : 'Är du säker på att du vill radera denna mapp? Åtgärden kan inte ångras.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteDialog(false)
                setDeleteConfirmNonEmpty(false)
              }}
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteConfirmNonEmpty)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteConfirmNonEmpty ? 'Radera allt' : 'Radera'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
