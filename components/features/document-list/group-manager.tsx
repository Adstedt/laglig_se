'use client'

/**
 * Story 4.13: Group Manager Component
 * Dialog for managing groups within a law list:
 * - Create new groups
 * - Edit existing groups (rename)
 * - Delete groups (items move to ungrouped)
 * - Reorder groups (up/down buttons)
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  FolderPlus,
  Check,
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
import { cn } from '@/lib/utils'

interface GroupManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  listId: string
  onGroupsUpdated: () => void
}

export function GroupManager({
  open,
  onOpenChange,
  listId,
  onGroupsUpdated,
}: GroupManagerProps) {
  const [groups, setGroups] = useState<ListGroupSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New group creation
  const [isCreating, setIsCreating] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [isSubmittingNew, setIsSubmittingNew] = useState(false)

  // Editing state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  // Delete confirmation
  const [groupToDelete, setGroupToDelete] = useState<ListGroupSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Reordering state
  const [isReordering, setIsReordering] = useState(false)

  // Fetch groups when dialog opens
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
    // Reset states when dialog closes
    if (!open) {
      setIsCreating(false)
      setNewGroupName('')
      setEditingGroupId(null)
      setError(null)
    }
  }, [open, listId, fetchGroups])

  // Create new group
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return

    setIsSubmittingNew(true)
    setError(null)

    try {
      const result = await createListGroup({
        listId,
        name: newGroupName.trim(),
      })

      if (result.success) {
        setNewGroupName('')
        setIsCreating(false)
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
    const currentIndex = groups.findIndex(g => g.id === groupId)
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5" />
              Hantera grupper
            </DialogTitle>
            <DialogDescription>
              Organisera din lista med grupper. Dokument kan placeras i grupper
              för bättre överblick.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {/* Error message */}
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
                <button
                  onClick={() => setError(null)}
                  className="ml-2 underline hover:no-underline"
                >
                  Stäng
                </button>
              </div>
            )}

            {/* Loading state */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Existing groups list */}
                <div className="flex flex-col gap-2">
                  {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Inga grupper skapade ännu.
                    </p>
                  ) : (
                    groups.map((group, index) => (
                      <div
                        key={group.id}
                        className={cn(
                          "flex items-center gap-2 rounded-md border p-2",
                          editingGroupId === group.id && "ring-2 ring-primary"
                        )}
                      >
                        {editingGroupId === group.id ? (
                          // Edit mode
                          <>
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-8 flex-1"
                              placeholder="Gruppnamn"
                              maxLength={50}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveEdit(group.id)
                                } else if (e.key === 'Escape') {
                                  cancelEditing()
                                }
                              }}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleSaveEdit(group.id)}
                              disabled={!editingName.trim() || isSubmittingEdit}
                            >
                              {isSubmittingEdit ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={cancelEditing}
                              disabled={isSubmittingEdit}
                            >
                              <X className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </>
                        ) : (
                          // Display mode
                          <>
                            {/* Reorder buttons */}
                            <div className="flex flex-col">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5 p-0"
                                onClick={() => handleMoveGroup(group.id, 'up')}
                                disabled={index === 0 || isReordering}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5 p-0"
                                onClick={() => handleMoveGroup(group.id, 'down')}
                                disabled={index === groups.length - 1 || isReordering}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>

                            {/* Group name and count */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{group.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {group.itemCount} dokument
                              </p>
                            </div>

                            {/* Actions */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => startEditing(group)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setGroupToDelete(group)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Create new group */}
                {isCreating ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Nytt gruppnamn..."
                      maxLength={50}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateGroup()
                        } else if (e.key === 'Escape') {
                          setIsCreating(false)
                          setNewGroupName('')
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim() || isSubmittingNew}
                    >
                      {isSubmittingNew ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        setIsCreating(false)
                        setNewGroupName('')
                      }}
                      disabled={isSubmittingNew}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setIsCreating(true)}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Skapa ny grupp
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!groupToDelete} onOpenChange={() => setGroupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort gruppen?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort gruppen{' '}
              <strong className="text-foreground">{groupToDelete?.name}</strong>?
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
