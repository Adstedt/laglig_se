'use client'

/**
 * Story 7.2: "Hantera grupper" affordance — create / rename / reorder /
 * delete employee groups. Visible only for `employees:manage` roles (the
 * parent gates rendering).
 *
 * Mutations call the Story 7.2 server actions; each action ends with
 * `revalidatePath('/personalregister')` so fresh data streams back to the
 * server page automatically. Deleting a group leaves its employees
 * ungrouped (FK `onDelete: SetNull`) — they reappear under "Ogrupperad".
 */

import { useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { toast } from 'sonner'
import {
  createEmployeeGroup,
  renameEmployeeGroup,
  reorderEmployeeGroups,
  deleteEmployeeGroup,
  type EmployeeGroupSummary,
} from '@/app/actions/employees'

interface ManageGroupsPopoverProps {
  groups: EmployeeGroupSummary[]
}

export function ManageGroupsPopover({ groups }: ManageGroupsPopoverProps) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  const run = async (
    action: () => Promise<{ success: boolean; error?: string }>
  ) => {
    setIsBusy(true)
    try {
      const result = await action()
      if (!result.success) {
        toast.error(result.error ?? 'Något gick fel.')
      }
      return result.success
    } finally {
      setIsBusy(false)
    }
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    const ok = await run(() => createEmployeeGroup(name))
    if (ok) setNewName('')
  }

  const handleRenameSave = async () => {
    if (!editingId) return
    const name = editingName.trim()
    if (!name) {
      setEditingId(null)
      return
    }
    const ok = await run(() => renameEmployeeGroup(editingId, name))
    if (ok) setEditingId(null)
  }

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= groups.length) return
    const ids = groups.map((g) => g.id)
    const [moved] = ids.splice(index, 1)
    if (!moved) return
    ids.splice(target, 0, moved)
    await run(() => reorderEmployeeGroups(ids))
  }

  const handleDelete = async (id: string) => {
    await run(() => deleteEmployeeGroup(id))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderCog className="mr-1.5 h-4 w-4" />
          Hantera grupper
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <p className="text-sm font-medium">Grupper</p>

          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Inga grupper ännu. Skapa en för att organisera anställda per
              enhet.
            </p>
          )}

          {groups.length > 0 && (
            <ul className="space-y-1">
              {groups.map((group, index) => (
                <li key={group.id} className="flex items-center gap-1">
                  {editingId === group.id ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSave()
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="h-8 flex-1"
                        autoFocus
                        disabled={isBusy}
                        aria-label="Nytt gruppnamn"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleRenameSave}
                        disabled={isBusy}
                        title="Spara namn"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingId(null)}
                        disabled={isBusy}
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
                        {group.employeeCount}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleMove(index, -1)}
                        disabled={isBusy || index === 0}
                        title="Flytta upp"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleMove(index, 1)}
                        disabled={isBusy || index === groups.length - 1}
                        title="Flytta ned"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingId(group.id)
                          setEditingName(group.name)
                        }}
                        disabled={isBusy}
                        title="Byt namn"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(group.id)}
                        disabled={isBusy}
                        title="Ta bort grupp (anställda blir ogrupperade)"
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
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
              placeholder="Ny grupp…"
              className="h-8 flex-1"
              disabled={isBusy}
              aria-label="Namn på ny grupp"
            />
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={isBusy || newName.trim().length === 0}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 h-4 w-4" />
              )}
              Skapa
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
