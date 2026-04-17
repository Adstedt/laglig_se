'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Scale,
  Loader2,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Inbox,
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
import { cn } from '@/lib/utils'

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

interface SelectedList {
  id: string
  name: string
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

export function LawListItemPickerDialog({
  open,
  onOpenChange,
  excludeIds,
  onSelect,
}: LawListItemPickerDialogProps) {
  const [lawLists, setLawLists] = useState<LawListForLinking[]>([])
  const [selectedList, setSelectedList] = useState<SelectedList | null>(null)
  const [lawListItems, setLawListItems] = useState<LawListItemForLinking[]>([])
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
      const result = await getLawListItemsForLinking(listId, query || undefined)
      if (result.success && result.data) {
        setLawListItems(result.data)
      }
      setLoading(false)
    },
    []
  )

  useEffect(() => {
    if (!open) {
      setSelectedList(null)
      setLawListItems([])
      setSearchQuery('')
      setExpandedGroups(new Set())
      return
    }
    loadLawLists()
  }, [open, loadLawLists])

  useEffect(() => {
    if (!selectedList) return
    loadLawListItems(selectedList.id, searchQuery)
  }, [selectedList, searchQuery, loadLawListItems])

  const excludeSet = new Set(excludeIds ?? [])

  const groupedItems = useMemo(() => groupItems(lawListItems), [lawListItems])

  const breadcrumbs: { label: string; onClick?: (() => void) | undefined }[] = [
    {
      label: 'Laglistor',
      onClick: selectedList
        ? () => {
            setSelectedList(null)
            setSearchQuery('')
          }
        : undefined,
    },
  ]
  if (selectedList) breadcrumbs.push({ label: selectedList.name })

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={selectedList ? 'Sök dokument...' : 'Välj laglista...'}
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
        ) : (
          <>
            <CommandEmpty>
              <PickerEmpty label="Inga dokument hittades" />
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
              renderItem={(item) => {
                const isLinked = excludeSet.has(item.id)
                return (
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
                    disabled={isLinked}
                    className="flex items-center gap-2.5 cursor-pointer py-1 text-[13px]"
                  >
                    <Scale className="h-4 w-4 shrink-0 text-muted-foreground" />
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
                    {isLinked ? (
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      item.requirementCount > 0 && (
                        <CountPill>{item.requirementCount} krav</CountPill>
                      )
                    )}
                  </CommandItem>
                )
              }}
            />
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}

export interface PickerGroup<T> {
  key: string
  name: string
  items: T[]
}

interface GroupedItemSectionsProps<T> {
  groups: PickerGroup<T>[]
  searching: boolean
  expandedGroups: Set<string>
  onToggleGroup: (_key: string) => void
  renderItem: (_item: T) => React.ReactNode
}

export function GroupedItemSections<T>({
  groups,
  searching,
  expandedGroups,
  onToggleGroup,
  renderItem,
}: GroupedItemSectionsProps<T>) {
  // Skip group UI entirely if there is just one group
  if (groups.length <= 1) {
    return (
      <CommandGroup>
        {groups.flatMap((g) => g.items.map((item) => renderItem(item)))}
      </CommandGroup>
    )
  }

  return (
    <>
      {groups.map((group) => {
        const isOpen = searching || expandedGroups.has(group.key)
        return (
          <CommandGroup
            key={group.key}
            // Hide only cmdk's items wrapper when collapsed; keep the
            // CommandGroup itself + its heading + all CommandItems mounted
            // so cmdk's DOM walker / item registry stay intact across
            // keystrokes (mutating the tree mid-keystroke triggers
            // "Failed to execute 'appendChild' on 'Node'").
            // pt-0.5 anchors items closer to their header.
            className={cn(
              '[&_[cmdk-group-items]]:pt-0.5',
              !isOpen && '[&_[cmdk-group-items]]:hidden'
            )}
            heading={
              <button
                type="button"
                onClick={() => onToggleGroup(group.key)}
                aria-expanded={isOpen}
                className="-mx-2 -my-1.5 flex w-[calc(100%+1rem)] items-center gap-2 rounded-sm px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronDown
                  className={cn(
                    'h-3 w-3 transition-transform',
                    !isOpen && '-rotate-90'
                  )}
                />
                <span className="flex-1 truncate text-left">{group.name}</span>
                <CountPill>{group.items.length}</CountPill>
              </button>
            }
          >
            {group.items.map((item) => renderItem(item))}
          </CommandGroup>
        )
      })}
    </>
  )
}

export function PickerBreadcrumb({
  segments,
}: {
  segments: { label: string; onClick?: (() => void) | undefined }[]
}) {
  return (
    <div className="flex items-center gap-1.5 border-b px-3 py-1.5 text-[11px] text-muted-foreground">
      {segments.map((seg, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
          {seg.onClick ? (
            <button
              type="button"
              onClick={seg.onClick}
              className="truncate rounded-sm transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
            >
              {seg.label}
            </button>
          ) : (
            <span className="truncate font-medium text-foreground">
              {seg.label}
            </span>
          )}
        </Fragment>
      ))}
    </div>
  )
}

export function CountPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-[22px] items-center justify-center rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
      {children}
    </span>
  )
}

export function PickerEmpty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-xs text-muted-foreground">
      <Inbox className="h-4 w-4 opacity-50" />
      <span>{label}</span>
    </div>
  )
}
