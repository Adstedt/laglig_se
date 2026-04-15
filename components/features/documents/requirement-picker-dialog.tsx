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
import {
  ListChecks,
  Loader2,
  FolderOpen,
  FileText,
  ChevronRight,
} from 'lucide-react'
import {
  getWorkspaceLawLists,
  getLawListItemsForLinking,
} from '@/app/actions/tasks'
import type {
  LawListForLinking,
  LawListItemForLinking,
} from '@/app/actions/tasks'
import { getRequirementsForListItem } from '@/app/actions/law-list-item-requirements'

export interface PickedRequirement {
  id: string
  text: string
  listItemTitle: string
  listItemDocumentNumber: string | null
}

interface RequirementPickerDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  excludeIds?: string[]
  onSelect: (_req: PickedRequirement) => void
}

interface ListItemContext {
  id: string
  title: string
  documentNumber: string | null
}

interface RequirementItem {
  id: string
  text: string
}

export function RequirementPickerDialog({
  open,
  onOpenChange,
  excludeIds,
  onSelect,
}: RequirementPickerDialogProps) {
  const [lawLists, setLawLists] = useState<LawListForLinking[]>([])
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [lawListItems, setLawListItems] = useState<LawListItemForLinking[]>([])
  const [selectedListItem, setSelectedListItem] =
    useState<ListItemContext | null>(null)
  const [requirements, setRequirements] = useState<RequirementItem[]>([])
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

  const loadRequirements = useCallback(async (listItemId: string) => {
    setLoading(true)
    const result = await getRequirementsForListItem(listItemId)
    if (result.success && result.data) {
      setRequirements(result.data.map((r) => ({ id: r.id, text: r.text })))
    }
    setLoading(false)
  }, [])

  // Reset + fetch lagområden when opened
  useEffect(() => {
    if (!open) {
      setSelectedListId(null)
      setSelectedListItem(null)
      setLawListItems([])
      setRequirements([])
      setSearchQuery('')
      return
    }
    loadLawLists()
  }, [open, loadLawLists])

  // Level 2: load list items when a list is chosen
  useEffect(() => {
    if (!selectedListId || selectedListItem) return
    loadLawListItems(selectedListId, searchQuery)
  }, [selectedListId, selectedListItem, searchQuery, loadLawListItems])

  // Level 3: load requirements when a list item is chosen
  useEffect(() => {
    if (!selectedListItem) return
    loadRequirements(selectedListItem.id)
  }, [selectedListItem, loadRequirements])

  const excludeSet = new Set(excludeIds ?? [])

  let placeholder = 'Välj lagområde...'
  if (selectedListItem) placeholder = 'Sök krav...'
  else if (selectedListId) placeholder = 'Sök författningstext...'

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={placeholder}
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
        ) : !selectedListItem ? (
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
              {lawListItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.documentNumber ?? ''} ${item.documentTitle}`}
                  onSelect={() => {
                    setSelectedListItem({
                      id: item.id,
                      title: item.documentTitle,
                      documentNumber: item.documentNumber || null,
                    })
                    setSearchQuery('')
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {item.documentNumber
                      ? `${item.documentNumber} — ${item.documentTitle}`
                      : item.documentTitle}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : (
          <>
            <CommandEmpty>Inga krav hittades</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__back__"
                onSelect={() => {
                  setSelectedListItem(null)
                  setSearchQuery('')
                }}
                className="text-sm text-muted-foreground cursor-pointer"
              >
                ← Tillbaka till författningstexter
              </CommandItem>
            </CommandGroup>
            <Separator />
            <CommandGroup heading={selectedListItem.title}>
              {requirements
                .filter((r) => !excludeSet.has(r.id))
                .map((req) => (
                  <CommandItem
                    key={req.id}
                    value={req.text}
                    onSelect={() =>
                      onSelect({
                        id: req.id,
                        text: req.text,
                        listItemTitle: selectedListItem.title,
                        listItemDocumentNumber: selectedListItem.documentNumber,
                      })
                    }
                    className="flex items-start gap-2 cursor-pointer"
                  >
                    <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                    <span
                      className="flex-1 text-sm line-clamp-2"
                      title={req.text}
                    >
                      {req.text}
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
