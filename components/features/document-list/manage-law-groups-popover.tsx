'use client'

/**
 * Laglistor group management — compact anchored popover, mirroring the
 * Personalregister pattern (`personalregister/manage-groups-popover.tsx`).
 * Replaces the old full-screen `GroupManager` dialog (Story 4.13).
 *
 * Presentation-layer swap ONLY: every control calls the exact Story 4.13
 * server action the dialog called, with identical payloads —
 * `getListGroups` on open, `createListGroup`, `updateListGroup`,
 * `deleteListGroup` (behind the same AlertDialog confirmation), and
 * `reorderGroups` with integer indexes (the server owns the Float
 * fractional ranking of `LawListGroup.position`).
 *
 * The trigger is a standalone toolbar button ("Hantera grupper"),
 * mirroring the Personalregister affordance. Open state stays controlled
 * by the parent so it can gate opening on an active list.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
import {
  ArrowDown,
  ArrowUp,
  Check,
  Folder,
  FolderCog,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import {
  createListGroup,
  updateListGroup,
  deleteListGroup,
  getListGroups,
  reorderGroups,
  type ListGroupSummary,
} from '@/app/actions/document-list'

interface ManageLawGroupsPopoverProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  listId: string | null
  onGroupsUpdated: () => void
}

export function ManageLawGroupsPopover({
  open,
  onOpenChange,
  listId,
  onGroupsUpdated,
}: ManageLawGroupsPopoverProps) {
  const [groups, setGroups] = useState<ListGroupSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New group creation
  const [newGroupName, setNewGroupName] = useState('')
  const [isSubmittingNew, setIsSubmittingNew] = useState(false)

  // Editing state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  // Delete confirmation
  const [groupToDelete, setGroupToDelete] = useState<ListGroupSummary | null>(
    null
  )
  const [isDeleting, setIsDeleting] = useState(false)

  // Reordering state
  const [isReordering, setIsReordering] = useState(false)

  // Fetch groups when the popover opens
  const fetchGroups = useCallback(async () => {
    if (!listId) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await getListGroups(listId)
      if (result.success && result.data) {
        setGroups(result.data)
      } else {
        setError(result.error ?? 'Kunde inte hämta grupper')
      }
    } catch (err) {
      console.error('Error fetching groups:', err)
      setError('Något gick fel')
    } finally {
      setIsLoading(false)
    }
  }, [listId])

  useEffect(() => {
    if (open && listId) {
      fetchGroups()
    }
    // Reset states when the popover closes
    if (!open) {
      setNewGroupName('')
      setEditingGroupId(null)
      setError(null)
      // QA GATE-001: the delete AlertDialog is gated on `groupToDelete`, not
      // `open` — clear it here so the confirmation can never outlive the
      // popover (e.g. activeListId nulling mid-confirmation).
      setGroupToDelete(null)
    }
  }, [open, listId, fetchGroups])

  // Create new group
  const handleCreateGroup = async () => {
    if (!listId || !newGroupName.trim()) return

    setIsSubmittingNew(true)
    setError(null)

    try {
      const result = await createListGroup({
        listId,
        name: newGroupName.trim(),
      })

      if (result.success) {
        setNewGroupName('')
        await fetchGroups()
        onGroupsUpdated()
      } else {
        setError(result.error ?? 'Kunde inte skapa grupp')
      }
    } catch (err) {
      console.error('Error creating group:', err)
      setError('Något gick fel')
    } finally {
      setIsSubmittingNew(false)
    }
  }

  // Start editing a group
  const startEditing = (group: ListGroupSummary) => {
    setEditingGroupId(group.id)
    setEditingName(group.name)
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingGroupId(null)
    setEditingName('')
  }

  // Save edited group
  const handleSaveEdit = async (groupId: string) => {
    if (!editingName.trim()) return

    setIsSubmittingEdit(true)
    setError(null)

    try {
      const result = await updateListGroup({
        groupId,
        name: editingName.trim(),
      })

      if (result.success) {
        setEditingGroupId(null)
        setEditingName('')
        await fetchGroups()
        onGroupsUpdated()
      } else {
        setError(result.error ?? 'Kunde inte uppdatera grupp')
      }
    } catch (err) {
      console.error('Error updating group:', err)
      setError('Något gick fel')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Delete group
  const handleDeleteGroup = async () => {
    if (!groupToDelete) return

    setIsDeleting(true)

    try {
      const result = await deleteListGroup(groupToDelete.id)

      if (result.success) {
        setGroupToDelete(null)
        await fetchGroups()
        onGroupsUpdated()
      } else {
        setError(result.error ?? 'Kunde inte ta bort grupp')
        setGroupToDelete(null)
      }
    } catch (err) {
      console.error('Error deleting group:', err)
      setError('Något gick fel')
      setGroupToDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  // Move group up/down
  const handleMoveGroup = async (groupId: string, direction: 'up' | 'down') => {
    if (!listId) return

    const currentIndex = groups.findIndex((g) => g.id === groupId)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= groups.length) return

    setIsReordering(true)

    // Create new order
    const newGroups = [...groups]
    const [moved] = newGroups.splice(currentIndex, 1)
    if (!moved) return // Safety check
    newGroups.splice(targetIndex, 0, moved)

    // Optimistically update UI
    setGroups(newGroups)

    try {
      const result = await reorderGroups({
        listId,
        groups: newGroups.map((g, i) => ({ id: g.id, position: i })),
      })

      if (!result.success) {
        // Revert on error
        setGroups(groups)
        setError(result.error ?? 'Kunde inte ändra ordning')
      } else {
        onGroupsUpdated()
      }
    } catch (err) {
      console.error('Error reordering groups:', err)
      setGroups(groups)
      setError('Något gick fel')
    } finally {
      setIsReordering(false)
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          {/* Disabled without an active list (LawListPrimaryAction precedent) —
              an inert-but-clickable button would lie about its affordance. */}
          <Button
            variant="outline"
            size="sm"
            disabled={!listId}
            aria-label="Hantera grupper"
            title="Hantera grupper"
          >
            <FolderCog className="h-4 w-4 @[64rem]:mr-1.5" />
            {/* Icon-only when the toolbar container is narrow (chat open). */}
            <span className="hidden @[64rem]:inline">Hantera grupper</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-80"
          // Keep the popover open behind the delete-confirmation dialog.
          onInteractOutside={(e) => {
            if (groupToDelete) e.preventDefault()
          }}
        >
          <div className="space-y-3">
            <p className="text-sm font-medium">Grupper</p>

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
                {error}
                <button
                  onClick={() => setError(null)}
                  className="ml-2 underline hover:no-underline"
                >
                  Stäng
                </button>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {groups.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Inga grupper ännu. Skapa en för att organisera dokumenten i
                    listan.
                  </p>
                )}

                {groups.length > 0 && (
                  <ul className="space-y-1">
                    {groups.map((group, index) => (
                      <li key={group.id} className="flex items-center gap-1">
                        {editingGroupId === group.id ? (
                          <>
                            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(group.id)
                                if (e.key === 'Escape') cancelEditing()
                              }}
                              className="h-8 flex-1"
                              maxLength={50}
                              autoFocus
                              disabled={isSubmittingEdit}
                              aria-label="Nytt gruppnamn"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleSaveEdit(group.id)}
                              disabled={!editingName.trim() || isSubmittingEdit}
                              title="Spara namn"
                            >
                              {isSubmittingEdit ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={cancelEditing}
                              disabled={isSubmittingEdit}
                              title="Avbryt"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Folder className="h-4 w-4 text-primary shrink-0" />
                            <span className="flex-1 truncate text-sm">
                              {group.name}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {group.itemCount}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleMoveGroup(group.id, 'up')}
                              disabled={index === 0 || isReordering}
                              title="Flytta upp"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleMoveGroup(group.id, 'down')}
                              disabled={
                                index === groups.length - 1 || isReordering
                              }
                              title="Flytta ned"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => startEditing(group)}
                              title="Byt namn"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setGroupToDelete(group)}
                              title="Ta bort grupp"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateGroup()
                    }}
                    placeholder="Ny grupp…"
                    className="h-8 flex-1"
                    maxLength={50}
                    disabled={isSubmittingNew}
                    aria-label="Namn på ny grupp"
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateGroup}
                    disabled={
                      isSubmittingNew || newGroupName.trim().length === 0
                    }
                  >
                    {isSubmittingNew ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-1 h-4 w-4" />
                    )}
                    Skapa
                  </Button>
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Delete confirmation — preserved from the old GroupManager dialog */}
      <AlertDialog
        open={!!groupToDelete}
        onOpenChange={() => setGroupToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort gruppen?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort gruppen{' '}
              <strong className="text-foreground">{groupToDelete?.name}</strong>
              ?
              <br />
              <br />
              {groupToDelete?.itemCount && groupToDelete.itemCount > 0 ? (
                <>
                  De {groupToDelete.itemCount} dokumenten i gruppen kommer att
                  flyttas till &quot;Ogrupperade&quot;.
                </>
              ) : (
                <>Gruppen är tom och kan tas bort säkert.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
