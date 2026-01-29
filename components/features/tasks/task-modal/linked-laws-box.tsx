'use client'

/**
 * Story 6.6: Linked Documents Box
 * Display and manage linked legal documents with cascading selection
 *
 * Performance:
 * - Optimistic UI for link/unlink operations
 * - SWR caching for law lists (5 min) and items (2 min)
 */

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Scale,
  Plus,
  X,
  ExternalLink,
  FolderOpen,
  FileText,
  ChevronRight,
  Check,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  unlinkListItemFromTask,
  linkListItemToTask,
} from '@/app/actions/task-modal'
import { useLawLists, useLawListItems } from '@/lib/hooks/use-law-lists'
import type {
  LawListForLinking,
  LawListItemForLinking,
} from '@/app/actions/tasks'
import { toast } from 'sonner'
import { useDebounce } from '@/lib/hooks/use-debounce'
import type { TaskDetails } from '@/app/actions/task-modal'

// Use the same type as TaskDetails to ensure compatibility
type LinkedLaw = TaskDetails['list_item_links'][number]

interface LinkedLawsBoxProps {
  taskId: string
  links: LinkedLaw[]
  onUpdate: () => Promise<void>
  /** Optimistic update callback for immediate UI feedback */
  onOptimisticUpdate?: ((_links: LinkedLaw[]) => void) | undefined
  /** Callback to open a list item in the Legal Document Modal */
  onOpenListItem?: ((_listItemId: string) => void) | undefined
}

export function LinkedLawsBox({
  taskId,
  links,
  onUpdate,
  onOptimisticUpdate,
  onOpenListItem,
}: LinkedLawsBoxProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

  // Optimistic unlink
  const handleUnlink = useCallback(
    async (listItemId: string) => {
      const linkToRemove = links.find((l) => l.law_list_item.id === listItemId)
      if (!linkToRemove) return

      // Optimistic update - immediately remove from UI
      setUnlinkingId(listItemId)
      const optimisticLinks = links.filter(
        (l) => l.law_list_item.id !== listItemId
      )
      onOptimisticUpdate?.(optimisticLinks)

      const result = await unlinkListItemFromTask(taskId, listItemId)

      if (result.success) {
        // Revalidate to sync with server
        await onUpdate()
      } else {
        // Revert on error
        onOptimisticUpdate?.(links)
        toast.error('Kunde inte ta bort länk', { description: result.error })
      }

      setUnlinkingId(null)
    },
    [taskId, links, onUpdate, onOptimisticUpdate]
  )

  // Group links by law list (keyed by list ID to preserve ID for linking)
  const groupedLinks = links.reduce(
    (acc, link) => {
      const listId = link.law_list_item.law_list?.id || 'unknown'
      const listName = link.law_list_item.law_list?.name || 'Okänd lista'
      if (!acc[listId]) {
        acc[listId] = { name: listName, links: [] }
      }
      acc[listId].links.push(link)
      return acc
    },
    {} as Record<string, { name: string; links: LinkedLaw[] }>
  )

  return (
    <Card className="border-border/60 w-full overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">
            Länkade dokument
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Länka dokument till uppgift</DialogTitle>
              </DialogHeader>
              <DocumentLinkDialog
                taskId={taskId}
                links={links}
                onLink={onUpdate}
                onOptimisticLink={onOptimisticUpdate}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Stäng
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Scale className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Inga länkade dokument
            </p>
            <Button
              variant="link"
              size="sm"
              className="text-xs mt-1"
              onClick={() => setDialogOpen(true)}
            >
              + Lägg till länk
            </Button>
          </div>
        ) : (
          <div className="space-y-3 overflow-hidden">
            {Object.entries(groupedLinks).map(
              ([listId, { name: listName, links: listLinks }]) => (
                <div key={listId} className="space-y-1.5 overflow-hidden">
                  {/* List header */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                    <FolderOpen className="h-3 w-3 shrink-0" />
                    <a
                      href={`/laglistor?list=${listId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:underline"
                    >
                      {listName}
                    </a>
                  </div>
                  {/* Documents in list */}
                  <div className="space-y-1 pl-4 overflow-hidden">
                    {listLinks.map((link) => {
                      const isUnlinking = unlinkingId === link.law_list_item.id
                      return (
                        <div
                          key={link.id || link.law_list_item.id}
                          className={cn(
                            'flex items-center gap-2 p-2 rounded-md overflow-hidden',
                            'bg-muted/50 hover:bg-muted transition-colors group',
                            onOpenListItem && !isUnlinking && 'cursor-pointer',
                            isUnlinking && 'opacity-50'
                          )}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (!isUnlinking) {
                              onOpenListItem?.(link.law_list_item.id)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isUnlinking) {
                              onOpenListItem?.(link.law_list_item.id)
                            }
                          }}
                        >
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="w-0 flex-1">
                            <p className="text-sm truncate">
                              {link.law_list_item.document.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {link.law_list_item.document.document_number}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={`/browse/lagar/${link.law_list_item.document.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded hover:bg-background"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUnlink(link.law_list_item.id)
                              }}
                              disabled={isUnlinking}
                            >
                              {isUnlinking ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <X className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface DocumentLinkDialogProps {
  taskId: string
  links: LinkedLaw[]
  onLink: () => Promise<void>
  onOptimisticLink?: ((_links: LinkedLaw[]) => void) | undefined
}

function DocumentLinkDialog({
  taskId,
  links,
  onLink,
  onOptimisticLink,
}: DocumentLinkDialogProps) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  // Two-level navigation
  const [currentList, setCurrentList] = useState<LawListForLinking | null>(null)

  // Linking state
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null)
  const [optimisticLinkedIds, setOptimisticLinkedIds] = useState<Set<string>>(
    new Set()
  )

  // Cached data
  const { lists, isLoading: isLoadingLists } = useLawLists()
  const { items, isLoading: isLoadingItems } = useLawListItems(
    currentList?.id ?? null,
    debouncedSearch
  )

  // Existing + optimistically linked IDs
  const existingLinkIds = new Set(links.map((l) => l.law_list_item.id))
  const allLinkedIds = new Set([...existingLinkIds, ...optimisticLinkedIds])

  // Navigate into a list
  const handleSelectList = (list: LawListForLinking) => {
    setCurrentList(list)
    setSearch('')
  }

  // Navigate back to lists
  const handleBackToLists = () => {
    setCurrentList(null)
    setSearch('')
  }

  // Optimistic link
  const handleLinkItem = async (item: LawListItemForLinking) => {
    setLinkingItemId(item.id)

    // Optimistic update - mark as linked immediately
    setOptimisticLinkedIds((prev) => new Set([...prev, item.id]))

    // Create optimistic link object
    const optimisticLink: LinkedLaw = {
      id: `temp-${item.id}`,
      law_list_item: {
        id: item.id,
        document: {
          id: item.documentId,
          title: item.documentTitle,
          document_number: item.documentNumber,
          slug: '',
        },
        law_list: currentList
          ? { id: currentList.id, name: currentList.name }
          : { id: '', name: 'Okänd lista' },
      },
    }
    onOptimisticLink?.([...links, optimisticLink])

    try {
      const result = await linkListItemToTask(taskId, item.id)
      if (result.success) {
        toast.success('Dokument länkat')
        await onLink()
      } else {
        // Revert optimistic update
        setOptimisticLinkedIds((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
        onOptimisticLink?.(links)
        toast.error('Kunde inte länka dokument', { description: result.error })
      }
    } catch (error) {
      console.error('Failed to link item:', error)
      // Revert optimistic update
      setOptimisticLinkedIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      onOptimisticLink?.(links)
      toast.error('Kunde inte länka dokument')
    } finally {
      setLinkingItemId(null)
    }
  }

  // Filter lists by search when at list level
  const filteredLists = !currentList
    ? lists.filter((list) =>
        list.name.toLowerCase().includes(search.toLowerCase())
      )
    : lists

  return (
    <Command shouldFilter={false} className="border rounded-lg overflow-hidden">
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
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{currentList.name}</span>
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
                const isLinked = allLinkedIds.has(item.id)
                const isLinking = linkingItemId === item.id
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() =>
                      !isLinked && !isLinking && handleLinkItem(item)
                    }
                    className={cn(
                      'cursor-pointer',
                      isLinked && 'opacity-50 cursor-not-allowed'
                    )}
                    disabled={isLinked || isLinking}
                  >
                    {isLinking ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                    ) : isLinked ? (
                      <Check className="mr-2 h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="w-0 flex-1">
                      <div className="truncate text-sm">
                        {item.documentTitle}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.documentNumber}
                      </div>
                    </div>
                    {isLinked && (
                      <Badge
                        variant="secondary"
                        className="ml-2 shrink-0 text-xs"
                      >
                        Länkad
                      </Badge>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  )
}
