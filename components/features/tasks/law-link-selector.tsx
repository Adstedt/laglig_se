'use client'

/**
 * Story 6.7: Document Link Selector Component
 * Cascading selection: Law List → Document within list
 *
 * Unified component for linking documents in both:
 * - Task creation modal (multi-select mode)
 * - Task detail modal (single-click linking)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Check,
  ChevronsUpDown,
  X,
  FileText,
  FolderOpen,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import {
  getWorkspaceLawLists,
  getLawListItemsForLinking,
  type LawListItemForLinking,
  type LawListForLinking,
} from '@/app/actions/tasks'

// ============================================================================
// Types
// ============================================================================

interface DocumentLinkSelectorProps {
  value: string[]
  onChange: (_value: string[]) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

// Selected item with display info
interface SelectedItemInfo {
  id: string
  documentTitle: string
  documentNumber: string
  listName: string
}

// ============================================================================
// Component
// ============================================================================

export function LawLinkSelector({
  value,
  onChange,
  disabled = false,
  placeholder = 'Välj dokument...',
  className,
}: DocumentLinkSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Two-level navigation: lists view or items view
  const [currentList, setCurrentList] = useState<LawListForLinking | null>(null)

  // Data
  const [lists, setLists] = useState<LawListForLinking[]>([])
  const [items, setItems] = useState<LawListItemForLinking[]>([])
  const [selectedItemsInfo, setSelectedItemsInfo] = useState<
    SelectedItemInfo[]
  >([])

  // Loading states
  const [isLoadingLists, setIsLoadingLists] = useState(false)
  const [isLoadingItems, setIsLoadingItems] = useState(false)

  // Track if we've loaded item info for current value
  const loadedValueRef = useRef<string>('')

  // Load law lists
  const loadLists = useCallback(async () => {
    setIsLoadingLists(true)
    try {
      const result = await getWorkspaceLawLists()
      if (result.success && result.data) {
        setLists(result.data)
      }
    } catch (error) {
      console.error('Failed to load law lists:', error)
    } finally {
      setIsLoadingLists(false)
    }
  }, [])

  // Load items for a specific list
  const loadItems = useCallback(async (listId: string, query?: string) => {
    setIsLoadingItems(true)
    try {
      const result = await getLawListItemsForLinking(listId, query)
      if (result.success && result.data) {
        setItems(result.data)
      }
    } catch (error) {
      console.error('Failed to load list items:', error)
    } finally {
      setIsLoadingItems(false)
    }
  }, [])

  // Load lists when popover opens
  useEffect(() => {
    if (open && lists.length === 0) {
      loadLists()
    }
  }, [open, lists.length, loadLists])

  // Load items when entering a list or search changes
  useEffect(() => {
    if (!currentList) return

    const timer = setTimeout(() => {
      loadItems(currentList.id, search)
    }, 300)
    return () => clearTimeout(timer)
  }, [currentList, search, loadItems])

  // Load selected items info when value changes (only once per unique value set)
  useEffect(() => {
    const valueKey = value.slice().sort().join(',')

    // Skip if value is empty
    if (value.length === 0) {
      setSelectedItemsInfo((prev) => (prev.length > 0 ? [] : prev))
      loadedValueRef.current = ''
      return
    }

    // Skip if we already loaded this value set
    if (loadedValueRef.current === valueKey) {
      return
    }

    // Skip if lists aren't loaded yet
    if (lists.length === 0) {
      return
    }

    loadedValueRef.current = valueKey

    // Load item info from all lists
    Promise.all(lists.map((list) => getLawListItemsForLinking(list.id))).then(
      (results) => {
        const allItems = results.flatMap((r) => (r.success ? r.data || [] : []))
        const newItems = allItems
          .filter((item) => value.includes(item.id))
          .map((item) => ({
            id: item.id,
            documentTitle: item.documentTitle,
            documentNumber: item.documentNumber,
            listName: item.listName,
          }))
        setSelectedItemsInfo(newItems)
      }
    )
  }, [value, lists])

  // Navigate into a list
  const handleSelectList = (list: LawListForLinking) => {
    setCurrentList(list)
    setSearch('')
    setItems([])
  }

  // Navigate back to lists
  const handleBackToLists = () => {
    setCurrentList(null)
    setSearch('')
    setItems([])
  }

  // Toggle item selection
  const handleToggleItem = (item: LawListItemForLinking) => {
    const isSelected = value.includes(item.id)

    if (isSelected) {
      const newValue = value.filter((id) => id !== item.id)
      onChange(newValue)
      setSelectedItemsInfo((prev) => prev.filter((i) => i.id !== item.id))
      // Update ref to match new value
      loadedValueRef.current = newValue.slice().sort().join(',')
    } else {
      const newValue = [...value, item.id]
      onChange(newValue)
      setSelectedItemsInfo((prev) => [
        ...prev,
        {
          id: item.id,
          documentTitle: item.documentTitle,
          documentNumber: item.documentNumber,
          listName: item.listName,
        },
      ])
      // Update ref to match new value
      loadedValueRef.current = newValue.slice().sort().join(',')
    }
  }

  // Remove a selected item
  const handleRemove = (itemId: string) => {
    const newValue = value.filter((id) => id !== itemId)
    onChange(newValue)
    setSelectedItemsInfo((prev) => prev.filter((i) => i.id !== itemId))
    loadedValueRef.current = newValue.slice().sort().join(',')
  }

  // Filter lists by search when at list level
  const filteredLists = !currentList
    ? lists.filter((list) =>
        list.name.toLowerCase().includes(search.toLowerCase())
      )
    : lists

  // Group selected items by list for display
  const groupedSelected = selectedItemsInfo.reduce<
    Record<string, SelectedItemInfo[]>
  >((acc, item) => {
    const list = acc[item.listName] ?? []
    list.push(item)
    acc[item.listName] = list
    return acc
  }, {})

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={disabled}
          >
            <span className="text-muted-foreground truncate">
              {value.length > 0
                ? `${value.length} dokument vald${value.length > 1 ? 'a' : ''}`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[350px] p-0"
          align="start"
          side="bottom"
          sideOffset={4}
          avoidCollisions={false}
        >
          <Command shouldFilter={false} className="border-0">
            {/* Breadcrumb header */}
            <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30 text-sm">
              <button
                type="button"
                onClick={handleBackToLists}
                className={cn(
                  'hover:underline text-muted-foreground',
                  !currentList && 'font-medium text-foreground'
                )}
                disabled={!currentList}
              >
                Listor
              </button>
              {currentList && (
                <>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium truncate max-w-[200px]">
                    {currentList.name}
                  </span>
                </>
              )}
            </div>

            <CommandInput
              placeholder={currentList ? 'Sök dokument...' : 'Sök lista...'}
              value={search}
              onValueChange={setSearch}
            />

            {/* Fixed height list area */}
            <CommandList className="max-h-[280px] min-h-[200px]">
              {/* Lists view */}
              {!currentList && (
                <>
                  <CommandEmpty>
                    {isLoadingLists ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Laddar listor...
                      </div>
                    ) : (
                      'Inga listor hittades'
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredLists.map((list) => (
                      <CommandItem
                        key={list.id}
                        value={list.id}
                        onSelect={() => handleSelectList(list)}
                        className="cursor-pointer"
                      >
                        <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate font-medium">
                          {list.name}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                          {list.itemCount}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-1 shrink-0" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {/* Items view */}
              {currentList && (
                <>
                  <CommandEmpty>
                    {isLoadingItems ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Laddar dokument...
                      </div>
                    ) : (
                      'Inga dokument hittades'
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {items.map((item) => {
                      const isSelected = value.includes(item.id)
                      return (
                        <CommandItem
                          key={item.id}
                          value={item.id}
                          onSelect={() => handleToggleItem(item)}
                          className="cursor-pointer"
                        >
                          <div
                            className={cn(
                              'mr-2 h-4 w-4 border rounded shrink-0 flex items-center justify-center',
                              isSelected
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground/30'
                            )}
                          >
                            {isSelected && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="truncate text-sm">
                              {item.documentTitle}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.documentNumber}
                            </div>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>

            {/* Selection count footer */}
            {value.length > 0 && (
              <div className="border-t px-3 py-2 text-xs text-muted-foreground bg-muted/30">
                {value.length} dokument vald{value.length > 1 ? 'a' : ''}
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected items display - compact grouped view */}
      {selectedItemsInfo.length > 0 && (
        <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
          {Object.entries(groupedSelected).map(([listName, listItems]) => (
            <div key={listName} className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <FolderOpen className="h-3 w-3 shrink-0" />
                <span className="truncate">{listName}</span>
              </div>
              <div className="flex flex-wrap gap-1 pl-4">
                {listItems.map((item) => (
                  <Badge
                    key={item.id}
                    variant="secondary"
                    className="h-6 pl-1.5 pr-0.5 gap-1 max-w-[180px]"
                  >
                    <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs">
                      {item.documentTitle}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5"
                      disabled={disabled}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
