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
import { Separator } from '@/components/ui/separator'
import { Scale, Loader2, FolderOpen, ChevronRight } from 'lucide-react'
import {
  getWorkspaceLawLists,
  getLawListItemsForLinking,
} from '@/app/actions/tasks'
import type {
  LawListForLinking,
  LawListItemForLinking,
} from '@/app/actions/tasks'

export interface PickedLawListItem {
  id: string
  documentId: string
  documentTitle: string
  documentNumber: string
}

interface LawListItemPickerDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  excludeIds?: string[]
  onSelect: (_item: PickedLawListItem) => void
}

export function LawListItemPickerDialog({
  open,
  onOpenChange,
  excludeIds,
  onSelect,
}: LawListItemPickerDialogProps) {
  const [lawLists, setLawLists] = useState<LawListForLinking[]>([])
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [lawListItems, setLawListItems] = useState<LawListItemForLinking[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const loadLawLists = useCallback(async () => {
    setLoading(true)
    const result = await getWorkspaceLawLists()
    if (result.success && result.data) {
      setLawLists(result.data)
    }
    setLoading(false)
  }, [])

  const loadLawListItems = useCallback(
    async (listId: string, query: string) => {
      setLoading(true)
      const result = await getLawListItemsForLinking(listId, query || undefined)
      if (result.success && result.data) {
        setLawListItems(result.data)
      }
      setLoading(false)
    },
    []
  )

  // Reset + fetch lists when opened
  useEffect(() => {
    if (!open) {
      setSelectedListId(null)
      setLawListItems([])
      setSearchQuery('')
      return
    }
    loadLawLists()
  }, [open, loadLawLists])

  // Load items when a list is chosen or the query changes
  useEffect(() => {
    if (!selectedListId) return
    loadLawListItems(selectedListId, searchQuery)
  }, [selectedListId, searchQuery, loadLawListItems])

  const excludeSet = new Set(excludeIds ?? [])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={
          selectedListId ? 'Sök författningstext...' : 'Välj lagområde...'
        }
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList className="max-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !selectedListId ? (
          <>
            <CommandEmpty>Inga lagområden hittades</CommandEmpty>
            <CommandGroup heading="Lagområden">
              {lawLists.map((list) => (
                <CommandItem
                  key={list.id}
                  value={list.name}
                  onSelect={() => {
                    setSelectedListId(list.id)
                    setSearchQuery('')
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{list.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {list.itemCount} st
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : (
          <>
            <CommandEmpty>Inga författningstexter hittades</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__back__"
                onSelect={() => {
                  setSelectedListId(null)
                  setSearchQuery('')
                }}
                className="text-sm text-muted-foreground cursor-pointer"
              >
                ← Tillbaka till lagområden
              </CommandItem>
            </CommandGroup>
            <Separator />
            <CommandGroup heading="Författningstexter">
              {lawListItems
                .filter((item) => !excludeSet.has(item.id))
                .map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.documentNumber ?? ''} ${item.documentTitle}`}
                    onSelect={() =>
                      onSelect({
                        id: item.id,
                        documentId: item.documentId,
                        documentTitle: item.documentTitle,
                        documentNumber: item.documentNumber,
                      })
                    }
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Scale className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">
                      {item.documentNumber
                        ? `${item.documentNumber} — ${item.documentTitle}`
                        : item.documentTitle}
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
