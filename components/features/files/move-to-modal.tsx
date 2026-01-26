'use client'

/**
 * Story 6.7b: Move To Modal
 * AC: 6, 28 - Modal for moving files/folders to a new location
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Folder, FolderPlus, ChevronRight, Home, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getFolderTree, createFolder, moveItem } from '@/app/actions/files'
import type { FolderTreeNode } from '@/app/actions/files'

// ============================================================================
// Types
// ============================================================================

interface MoveToModalProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  itemIds: string[]
  itemNames: string[]
  currentFolderId: string | null
  onMoved: () => void
}

interface FolderPickerNodeProps {
  node: FolderTreeNode
  depth: number
  selectedId: string | null
  disabledIds: Set<string>
  onSelect: (_id: string | null) => void
}

// ============================================================================
// FolderPickerNode Component - Dropbox-inspired clean design
// ============================================================================

function FolderPickerNode({
  node,
  depth,
  selectedId,
  disabledIds,
  onSelect,
}: FolderPickerNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isSelected = selectedId === node.id
  const isDisabled = disabledIds.has(node.id)

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="select-none">
      <button
        type="button"
        className={cn(
          'w-full flex items-center gap-1.5 py-1.5 px-2 rounded-md text-sm text-left transition-all duration-150',
          isSelected && 'bg-accent font-medium text-accent-foreground',
          isDisabled && 'opacity-40 cursor-not-allowed',
          !isSelected && !isDisabled && 'hover:bg-accent/60'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => !isDisabled && onSelect(node.id)}
        disabled={isDisabled}
      >
        {/* Chevron toggle */}
        <span
          role="button"
          tabIndex={-1}
          className={cn(
            'flex items-center justify-center w-4 h-4 rounded transition-colors',
            node.children.length > 0
              ? 'hover:bg-muted cursor-pointer'
              : 'opacity-0 pointer-events-none'
          )}
          onClick={node.children.length > 0 ? handleToggle : undefined}
          onKeyDown={
            node.children.length > 0
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsExpanded(!isExpanded)
                  }
                }
              : undefined
          }
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground/70 transition-transform duration-200',
              isExpanded && 'rotate-90'
            )}
          />
        </span>

        {/* Folder icon */}
        <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />

        {/* Folder name */}
        <span className="truncate">{node.name}</span>
      </button>

      {/* Children with smooth animation */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isExpanded ? 'opacity-100' : 'opacity-0 h-0'
        )}
      >
        {isExpanded &&
          node.children.map((child) => (
            <FolderPickerNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              disabledIds={disabledIds}
              onSelect={onSelect}
            />
          ))}
      </div>
    </div>
  )
}

// ============================================================================
// MoveToModal Component
// ============================================================================

export function MoveToModal({
  open,
  onOpenChange,
  itemIds,
  itemNames,
  currentFolderId,
  onMoved,
}: MoveToModalProps) {
  const [folders, setFolders] = useState<FolderTreeNode[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMoving, setIsMoving] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Load folder tree
  useEffect(() => {
    if (!open) return

    const loadFolders = async () => {
      setIsLoading(true)
      const result = await getFolderTree()
      if (result.success && result.data) {
        setFolders(result.data)
      }
      setIsLoading(false)
    }

    loadFolders()
  }, [open])

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectedFolderId(null)
      setNewFolderName('')
      setIsCreatingFolder(false)
    }
  }, [open])

  // Build set of disabled folder IDs (can't move to self or current location)
  const disabledIds = new Set<string>([
    ...itemIds, // Can't move into itself
    ...(currentFolderId ? [currentFolderId] : []), // Already in this folder
  ])

  // Create new folder inline
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    const result = await createFolder({
      name: newFolderName.trim(),
      parentFolderId: selectedFolderId,
    })

    if (result.success && result.data) {
      toast.success('Mapp skapad')
      setNewFolderName('')
      setIsCreatingFolder(false)
      // Select the new folder
      setSelectedFolderId(result.data.id)
      // Reload folder tree
      const treeResult = await getFolderTree()
      if (treeResult.success && treeResult.data) {
        setFolders(treeResult.data)
      }
    } else {
      toast.error(result.error || 'Kunde inte skapa mapp')
    }
  }

  // Move items
  const handleMove = useCallback(async () => {
    setIsMoving(true)

    let successCount = 0
    for (const itemId of itemIds) {
      const result = await moveItem({
        itemId,
        targetFolderId: selectedFolderId,
      })
      if (result.success) successCount++
    }

    setIsMoving(false)

    if (successCount === itemIds.length) {
      toast.success(
        itemIds.length === 1
          ? 'Objektet har flyttats'
          : `${successCount} objekt har flyttats`
      )
      onOpenChange(false)
      onMoved()
    } else if (successCount > 0) {
      toast.warning(`${successCount} av ${itemIds.length} objekt flyttades`)
      onOpenChange(false)
      onMoved()
    } else {
      toast.error('Kunde inte flytta objekten')
    }
  }, [itemIds, selectedFolderId, onOpenChange, onMoved])

  const targetName =
    selectedFolderId === null
      ? 'Mina filer'
      : folders
          .flatMap((f) => [f, ...flattenNodes(f.children)])
          .find((f) => f.id === selectedFolderId)?.name || 'vald mapp'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Flytta till</DialogTitle>
          <DialogDescription>
            {itemIds.length === 1
              ? `Flytta "${itemNames[0]}" till en annan plats.`
              : `Flytta ${itemIds.length} objekt till en annan plats.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Root folder option - Dropbox style */}
          <button
            type="button"
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-all duration-150',
              selectedFolderId === null &&
                'bg-accent font-medium text-accent-foreground',
              currentFolderId === null && 'opacity-40 cursor-not-allowed',
              selectedFolderId !== null &&
                currentFolderId !== null &&
                'hover:bg-accent/60'
            )}
            onClick={() =>
              currentFolderId !== null && setSelectedFolderId(null)
            }
            disabled={currentFolderId === null}
          >
            <Home className="h-4 w-4 text-muted-foreground" />
            <span>Alla filer</span>
          </button>

          {/* Folder tree */}
          <ScrollArea className="h-[250px] border rounded-md p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : folders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Inga mappar ännu
              </p>
            ) : (
              <div className="space-y-0.5">
                {folders.map((folder) => (
                  <FolderPickerNode
                    key={folder.id}
                    node={folder}
                    depth={0}
                    selectedId={selectedFolderId}
                    disabledIds={disabledIds}
                    onSelect={setSelectedFolderId}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Create new folder inline */}
          {isCreatingFolder ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Mappnamn"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') setIsCreatingFolder(false)
                }}
                ref={(input) => input?.focus()}
              />
              <Button size="sm" onClick={handleCreateFolder}>
                Skapa
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsCreatingFolder(false)}
              >
                Avbryt
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreatingFolder(true)}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Ny mapp
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleMove} disabled={isMoving}>
            {isMoving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Flyttar...
              </>
            ) : (
              `Flytta till ${targetName}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

function flattenNodes(nodes: FolderTreeNode[]): FolderTreeNode[] {
  const result: FolderTreeNode[] = []
  for (const node of nodes) {
    result.push(node)
    if (node.children.length > 0) {
      result.push(...flattenNodes(node.children))
    }
  }
  return result
}
