'use client'

/**
 * Story 17.12: Document Links Section
 * Shows linked tasks and law list items in the document settings panel.
 * Provides actions to link/unlink tasks and list items.
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  CheckSquare,
  Scale,
  Plus,
  X,
  Loader2,
  FolderOpen,
  ChevronRight,
} from 'lucide-react'
import {
  getDocumentLinks,
  linkDocumentToTask,
  unlinkDocumentFromTask,
  linkDocumentToListItem,
  unlinkDocumentFromListItem,
} from '@/app/actions/documents'
import {
  getTasksForLinking,
  getWorkspaceLawLists,
  getLawListItemsForLinking,
} from '@/app/actions/tasks'
import type {
  LawListForLinking,
  LawListItemForLinking,
} from '@/app/actions/tasks'
import { toast } from 'sonner'

// ============================================================================
// Types
// ============================================================================

interface LinkedTask {
  id: string
  title: string
  linkId: string
}

interface LinkedListItem {
  id: string
  title: string
  documentNumber: string | null
  linkId: string
}

interface TaskForPicker {
  id: string
  title: string
  column: { name: string } | null
}

interface DocumentLinksSectionProps {
  documentId: string
  readOnly?: boolean | undefined
}

// ============================================================================
// Component
// ============================================================================

export function DocumentLinksSection({
  documentId,
  readOnly,
}: DocumentLinksSectionProps) {
  const [tasks, setTasks] = useState<LinkedTask[]>([])
  const [listItems, setListItems] = useState<LinkedListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

  // Task picker state
  const [taskPickerOpen, setTaskPickerOpen] = useState(false)
  const [availableTasks, setAvailableTasks] = useState<TaskForPicker[]>([])
  const [taskSearchQuery, setTaskSearchQuery] = useState('')
  const [loadingTasks, setLoadingTasks] = useState(false)

  // List item picker state
  const [listItemPickerOpen, setListItemPickerOpen] = useState(false)
  const [lawLists, setLawLists] = useState<LawListForLinking[]>([])
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [lawListItems, setLawListItems] = useState<LawListItemForLinking[]>([])
  const [listItemSearchQuery, setListItemSearchQuery] = useState('')
  const [loadingListItems, setLoadingListItems] = useState(false)

  const loadLinks = useCallback(async () => {
    const result = await getDocumentLinks(documentId)
    if (result.success && result.data) {
      setTasks(result.data.tasks)
      setListItems(result.data.listItems)
    }
    setIsLoading(false)
  }, [documentId])

  useEffect(() => {
    loadLinks()
  }, [loadLinks])

  // --- Task picker ---

  useEffect(() => {
    if (!taskPickerOpen) {
      setTaskSearchQuery('')
      return
    }
    loadAvailableTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskPickerOpen])

  useEffect(() => {
    if (!taskPickerOpen) return
    const timer = setTimeout(() => loadAvailableTasks(), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSearchQuery])

  const loadAvailableTasks = async () => {
    setLoadingTasks(true)
    const result = await getTasksForLinking(
      undefined,
      taskSearchQuery || undefined
    )
    if (result.success && result.data) {
      setAvailableTasks(
        result.data.map((t) => ({
          id: t.id,
          title: t.title,
          column: t.column,
        }))
      )
    }
    setLoadingTasks(false)
  }

  const handleLinkTask = async (taskId: string) => {
    const result = await linkDocumentToTask(documentId, taskId)
    if (result.success) {
      toast.success('Uppgift länkad')
      setTaskPickerOpen(false)
      await loadLinks()
    } else {
      toast.error(result.error ?? 'Kunde inte länka uppgift')
    }
  }

  // --- List item picker ---

  useEffect(() => {
    if (!listItemPickerOpen) {
      setSelectedListId(null)
      setLawListItems([])
      setListItemSearchQuery('')
      return
    }
    loadLawLists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listItemPickerOpen])

  const loadLawLists = async () => {
    setLoadingListItems(true)
    const result = await getWorkspaceLawLists()
    if (result.success && result.data) {
      setLawLists(result.data)
    }
    setLoadingListItems(false)
  }

  useEffect(() => {
    if (!selectedListId) return
    loadLawListItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListId, listItemSearchQuery])

  const loadLawListItems = async () => {
    if (!selectedListId) return
    setLoadingListItems(true)
    const result = await getLawListItemsForLinking(
      selectedListId,
      listItemSearchQuery || undefined
    )
    if (result.success && result.data) {
      setLawListItems(result.data)
    }
    setLoadingListItems(false)
  }

  const handleLinkListItem = async (listItemId: string) => {
    const result = await linkDocumentToListItem(documentId, listItemId)
    if (result.success) {
      toast.success('Lagkrav länkat')
      setListItemPickerOpen(false)
      await loadLinks()
    } else {
      toast.error(result.error ?? 'Kunde inte länka lagkrav')
    }
  }

  // --- Unlink handlers ---

  const handleUnlinkTask = async (taskId: string) => {
    setUnlinkingId(taskId)
    const result = await unlinkDocumentFromTask(documentId, taskId)
    if (result.success) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      toast.success('Länk borttagen')
    } else {
      toast.error(result.error ?? 'Kunde inte ta bort länk')
    }
    setUnlinkingId(null)
  }

  const handleUnlinkListItem = async (listItemId: string) => {
    setUnlinkingId(listItemId)
    const result = await unlinkDocumentFromListItem(documentId, listItemId)
    if (result.success) {
      setListItems((prev) => prev.filter((li) => li.id !== listItemId))
      toast.success('Länk borttagen')
    } else {
      toast.error(result.error ?? 'Kunde inte ta bort länk')
    }
    setUnlinkingId(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const linkedTaskIds = new Set(tasks.map((t) => t.id))
  const linkedListItemIds = new Set(listItems.map((li) => li.id))

  return (
    <>
      <div>
        <span className="text-sm font-medium mb-2 block">Länkade till</span>

        {tasks.length === 0 && listItems.length === 0 && (
          <p className="text-sm text-muted-foreground mb-2">
            Inga länkade uppgifter eller lagkrav
          </p>
        )}

        {/* Linked tasks */}
        {tasks.length > 0 && (
          <div className="space-y-1 mb-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 group text-sm"
              >
                <CheckSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0 truncate">{task.title}</span>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={() => handleUnlinkTask(task.id)}
                    disabled={unlinkingId === task.id}
                  >
                    {unlinkingId === task.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Linked list items */}
        {listItems.length > 0 && (
          <div className="space-y-1 mb-2">
            {listItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 group text-sm"
              >
                <Scale className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0 truncate">
                  {item.documentNumber
                    ? `${item.documentNumber} — ${item.title}`
                    : item.title}
                </span>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={() => handleUnlinkListItem(item.id)}
                    disabled={unlinkingId === item.id}
                  >
                    {unlinkingId === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Link actions */}
        {!readOnly && (
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => setTaskPickerOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Uppgift
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => setListItemPickerOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Lagkrav
            </Button>
          </div>
        )}
      </div>

      {/* Task picker */}
      <CommandDialog open={taskPickerOpen} onOpenChange={setTaskPickerOpen}>
        <CommandInput
          placeholder="Sök uppgifter..."
          value={taskSearchQuery}
          onValueChange={setTaskSearchQuery}
        />
        <CommandList className="max-h-[400px]">
          {loadingTasks ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <CommandEmpty>Inga uppgifter hittades</CommandEmpty>
              <CommandGroup heading="Uppgifter">
                {availableTasks
                  .filter((t) => !linkedTaskIds.has(t.id))
                  .map((task) => (
                    <CommandItem
                      key={task.id}
                      value={task.title}
                      onSelect={() => handleLinkTask(task.id)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{task.title}</span>
                      {task.column && (
                        <span className="text-xs text-muted-foreground">
                          {task.column.name}
                        </span>
                      )}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>

      {/* List item picker — two-level: lists → items */}
      <CommandDialog
        open={listItemPickerOpen}
        onOpenChange={setListItemPickerOpen}
      >
        <CommandInput
          placeholder={selectedListId ? 'Sök lagkrav...' : 'Välj lagområde...'}
          value={listItemSearchQuery}
          onValueChange={setListItemSearchQuery}
        />
        <CommandList className="max-h-[400px]">
          {loadingListItems ? (
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
                      setListItemSearchQuery('')
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
              <CommandEmpty>Inga lagkrav hittades</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__back__"
                  onSelect={() => {
                    setSelectedListId(null)
                    setListItemSearchQuery('')
                  }}
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  ← Tillbaka till lagområden
                </CommandItem>
              </CommandGroup>
              <Separator />
              <CommandGroup heading="Lagkrav">
                {lawListItems
                  .filter((item) => !linkedListItemIds.has(item.id))
                  .map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.documentNumber ?? ''} ${item.documentTitle}`}
                      onSelect={() => handleLinkListItem(item.id)}
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
    </>
  )
}
