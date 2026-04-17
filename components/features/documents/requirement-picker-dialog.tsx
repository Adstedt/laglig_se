'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  ListChecks,
  Loader2,
  FolderOpen,
  FileText,
  ChevronRight,
  Check,
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
import {
  CountPill,
  GroupedItemSections,
  PickerBreadcrumb,
  PickerEmpty,
} from '@/components/features/documents/law-list-item-picker-dialog'

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

interface SelectedList {
  id: string
  name: string
}

interface SelectedListItem {
  id: string
  title: string
  documentNumber: string | null
}

interface RequirementItem {
  id: string
  text: string
}

interface ItemGroup {
  key: string
  name: string
  items: LawListItemForLinking[]
}

function groupItems(items: LawListItemForLinking[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>()
  for (const item of items) {
    const key = item.groupId ?? '__ungrouped__'
    const name = item.groupName ?? 'Övrigt'
    if (!map.has(key)) map.set(key, { key, name, items: [] })
    map.get(key)!.items.push(item)
  }
  return Array.from(map.values())
}

export function RequirementPickerDialog({
  open,
  onOpenChange,
  excludeIds,
  onSelect,
}: RequirementPickerDialogProps) {
  const [lawLists, setLawLists] = useState<LawListForLinking[]>([])
  const [selectedList, setSelectedList] = useState<SelectedList | null>(null)
  const [lawListItems, setLawListItems] = useState<LawListItemForLinking[]>([])
  const [selectedListItem, setSelectedListItem] =
    useState<SelectedListItem | null>(null)
  const [requirements, setRequirements] = useState<RequirementItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

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
      const result = await getLawListItemsForLinking(
        listId,
        query || undefined,
        { onlyWithRequirements: true }
      )
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

  useEffect(() => {
    if (!open) {
      setSelectedList(null)
      setSelectedListItem(null)
      setLawListItems([])
      setRequirements([])
      setSearchQuery('')
      setExpandedGroups(new Set())
      return
    }
    loadLawLists()
  }, [open, loadLawLists])

  useEffect(() => {
    if (!selectedList || selectedListItem) return
    loadLawListItems(selectedList.id, searchQuery)
  }, [selectedList, selectedListItem, searchQuery, loadLawListItems])

  useEffect(() => {
    if (!selectedListItem) return
    loadRequirements(selectedListItem.id)
  }, [selectedListItem, loadRequirements])

  const excludeSet = new Set(excludeIds ?? [])

  const groupedItems = useMemo(() => groupItems(lawListItems), [lawListItems])

  const breadcrumbs: { label: string; onClick?: (() => void) | undefined }[] = [
    {
      label: 'Laglistor',
      onClick:
        selectedList || selectedListItem
          ? () => {
              setSelectedList(null)
              setSelectedListItem(null)
              setSearchQuery('')
              setExpandedGroups(new Set())
            }
          : undefined,
    },
  ]
  if (selectedList) {
    breadcrumbs.push({
      label: selectedList.name,
      onClick: selectedListItem
        ? () => {
            setSelectedListItem(null)
            setSearchQuery('')
          }
        : undefined,
    })
  }
  if (selectedListItem) {
    breadcrumbs.push({
      label: selectedListItem.documentNumber
        ? `${selectedListItem.documentNumber} — ${selectedListItem.title}`
        : selectedListItem.title,
    })
  }

  let placeholder = 'Välj laglista...'
  if (selectedListItem) placeholder = 'Sök krav...'
  else if (selectedList) placeholder = 'Sök dokument...'

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={placeholder}
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <PickerBreadcrumb segments={breadcrumbs} />
      <CommandList className="max-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !selectedList ? (
          <>
            <CommandEmpty>
              <PickerEmpty label="Inga laglistor hittades" />
            </CommandEmpty>
            <CommandGroup>
              {lawLists.map((list) => (
                <CommandItem
                  key={list.id}
                  value={list.name}
                  onSelect={() => {
                    setSelectedList({ id: list.id, name: list.name })
                    setSearchQuery('')
                  }}
                  className="flex items-center gap-2.5 cursor-pointer py-1 text-[13px]"
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{list.name}</span>
                  <CountPill>{list.itemCount}</CountPill>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : !selectedListItem ? (
          <>
            <CommandEmpty>
              <PickerEmpty label="Inga dokument med krav" />
            </CommandEmpty>
            <GroupedItemSections
              groups={groupedItems}
              searching={searchQuery.length > 0}
              expandedGroups={expandedGroups}
              onToggleGroup={(key) =>
                setExpandedGroups((prev) => {
                  const next = new Set(prev)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })
              }
              renderItem={(item) => (
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
                  className="flex items-center gap-2.5 cursor-pointer py-1 text-[13px]"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {item.documentNumber ? (
                      <>
                        <span className="font-medium">
                          {item.documentNumber}
                        </span>
                        {' — '}
                        {item.documentTitle}
                      </>
                    ) : (
                      item.documentTitle
                    )}
                  </span>
                  <CountPill>{item.requirementCount} krav</CountPill>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                </CommandItem>
              )}
            />
          </>
        ) : (
          <>
            <CommandEmpty>
              <PickerEmpty label="Inga krav hittades" />
            </CommandEmpty>
            <CommandGroup>
              {requirements.map((req) => {
                const isLinked = excludeSet.has(req.id)
                return (
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
                    disabled={isLinked}
                    className="flex items-start gap-2.5 cursor-pointer py-1 text-[13px]"
                  >
                    <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground mt-[2px]" />
                    <span
                      className="flex-1 leading-snug line-clamp-2"
                      title={req.text}
                    >
                      {req.text}
                    </span>
                    {isLinked && (
                      <Check className="h-3.5 w-3.5 text-muted-foreground mt-[2px] shrink-0" />
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
