'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Check,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderX,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { getWorkspaceLawLists } from '@/app/actions/tasks'
import type { LawListForLinking } from '@/app/actions/tasks'
import { addDocumentToList, getListGroups } from '@/app/actions/document-list'
import type { ListGroupSummary } from '@/app/actions/document-list'
import {
  CountPill,
  PickerBreadcrumb,
  PickerEmpty,
} from '@/components/features/documents/law-list-item-picker-dialog'
import { cn } from '@/lib/utils'

interface AddToLawListDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  documentId: string
  excludeListIds: Set<string>
  onAdded: (_listId: string) => void
}

interface SelectedList {
  id: string
  name: string
}

const UNGROUPED_KEY = '__ungrouped__'

export function AddToLawListDialog({
  open,
  onOpenChange,
  documentId,
  excludeListIds,
  onAdded,
}: AddToLawListDialogProps) {
  const [lists, setLists] = useState<LawListForLinking[]>([])
  const [selectedList, setSelectedList] = useState<SelectedList | null>(null)
  const [groups, setGroups] = useState<ListGroupSummary[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [pendingGroupKey, setPendingGroupKey] = useState<string | null>(null)

  const loadLists = useCallback(async () => {
    setLoading(true)
    const result = await getWorkspaceLawLists()
    if (result.success && result.data) {
      setLists(result.data)
    } else if (!result.success) {
      toast.error(result.error ?? 'Kunde inte hämta laglistor')
    }
    setLoading(false)
  }, [])

  const addToList = useCallback(
    async (list: SelectedList, groupId: string | null) => {
      const result = await addDocumentToList({
        listId: list.id,
        documentId,
        source: 'MANUAL',
        groupId,
      })
      if (result.success) {
        toast.success(`Tillagd i ${list.name}`)
        onAdded(list.id)
        onOpenChange(false)
        return true
      }
      toast.error(result.error ?? 'Kunde inte lägga till dokument')
      return false
    },
    [documentId, onAdded, onOpenChange]
  )

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setSelectedList(null)
      setGroups([])
      setPendingGroupKey(null)
      return
    }
    loadLists()
  }, [open, loadLists])

  useEffect(() => {
    if (!selectedList) return
    let cancelled = false
    setLoadingGroups(true)
    getListGroups(selectedList.id).then(async (result) => {
      if (cancelled) return
      if (result.success && result.data) {
        // If the list has no groups, skip the second step and add as ungrouped.
        if (result.data.length === 0) {
          const added = await addToList(selectedList, null)
          if (!added && !cancelled) {
            // Stay on the list step so the user can retry or pick another list.
            setSelectedList(null)
          }
          return
        }
        setGroups(result.data)
        setLoadingGroups(false)
      } else {
        toast.error(
          (!result.success && result.error) || 'Kunde inte hämta grupper'
        )
        setSelectedList(null)
        setLoadingGroups(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedList, addToList])

  const handleListSelect = (list: LawListForLinking) => {
    if (excludeListIds.has(list.id) || selectedList) return
    setSelectedList({ id: list.id, name: list.name })
    setSearchQuery('')
  }

  const handleGroupSelect = async (groupId: string | null) => {
    if (!selectedList || pendingGroupKey) return
    const key = groupId ?? UNGROUPED_KEY
    setPendingGroupKey(key)
    await addToList(selectedList, groupId)
    setPendingGroupKey(null)
  }

  const breadcrumbs: { label: string; onClick?: (() => void) | undefined }[] = [
    {
      label: 'Laglistor',
      onClick: selectedList
        ? () => {
            setSelectedList(null)
            setGroups([])
            setSearchQuery('')
          }
        : undefined,
    },
  ]
  if (selectedList) breadcrumbs.push({ label: selectedList.name })

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={selectedList ? 'Sök grupp...' : 'Sök laglista...'}
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <PickerBreadcrumb segments={breadcrumbs} />
      <CommandList className="max-h-[400px]">
        {loading || (selectedList && loadingGroups) ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !selectedList ? (
          <>
            <CommandEmpty>
              <PickerEmpty label="Inga laglistor hittades" />
            </CommandEmpty>
            <CommandGroup>
              {lists.map((list) => {
                const alreadyIn = excludeListIds.has(list.id)
                return (
                  <CommandItem
                    key={list.id}
                    value={list.name}
                    onSelect={() => handleListSelect(list)}
                    disabled={alreadyIn}
                    className={cn(
                      'flex items-center gap-2.5 cursor-pointer py-1 text-[13px]',
                      alreadyIn && 'opacity-60'
                    )}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{list.name}</span>
                    <CountPill>{list.itemCount}</CountPill>
                    {alreadyIn ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Check className="h-3.5 w-3.5" />
                        Finns i listan
                      </span>
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        ) : (
          <>
            <CommandEmpty>
              <PickerEmpty label="Inga grupper hittades" />
            </CommandEmpty>
            <CommandGroup heading="Välj grupp">
              <CommandItem
                value="Ogrupperad"
                onSelect={() => handleGroupSelect(null)}
                disabled={pendingGroupKey !== null}
                className="flex items-center gap-2.5 cursor-pointer py-1 text-[13px]"
              >
                <FolderX className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">Ogrupperad</span>
                {pendingGroupKey === UNGROUPED_KEY ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                )}
              </CommandItem>
              {groups.map((group) => {
                const isPending = pendingGroupKey === group.id
                return (
                  <CommandItem
                    key={group.id}
                    value={group.name}
                    onSelect={() => handleGroupSelect(group.id)}
                    disabled={pendingGroupKey !== null}
                    className="flex items-center gap-2.5 cursor-pointer py-1 text-[13px]"
                  >
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{group.name}</span>
                    <CountPill>{group.itemCount}</CountPill>
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
