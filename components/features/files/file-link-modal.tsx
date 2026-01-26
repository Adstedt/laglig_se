'use client'

/**
 * Story 6.7a: File Link Modal
 * Modal for linking a file to tasks and/or law list items
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, CheckSquare, Scale } from 'lucide-react'
import { toast } from 'sonner'
import { getWorkspaceTasksPaginated } from '@/app/actions/tasks'
import {
  linkFileToTask,
  linkFileToListItem,
  unlinkFile,
} from '@/app/actions/files'
import {
  getWorkspaceLawLists,
  getLawListItemsForLinking,
} from '@/app/actions/tasks'
import type { WorkspaceFileWithLinks } from '@/app/actions/files'
import type {
  TaskWithRelations,
  LawListForLinking,
  LawListItemForLinking,
} from '@/app/actions/tasks'

// ============================================================================
// Types
// ============================================================================

interface FileLinkModalProps {
  file: WorkspaceFileWithLinks | null
  open: boolean
  onOpenChange: (_open: boolean) => void
  onUpdate?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function FileLinkModal({
  file,
  open,
  onOpenChange,
  onUpdate,
}: FileLinkModalProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'laws'>('tasks')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Tasks state
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [taskSearch, setTaskSearch] = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [initialTaskIds, setInitialTaskIds] = useState<Set<string>>(new Set())

  // Laws state
  const [lawLists, setLawLists] = useState<LawListForLinking[]>([])
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [listItems, setListItems] = useState<LawListItemForLinking[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [initialItemIds, setInitialItemIds] = useState<Set<string>>(new Set())

  // Load data when modal opens
  useEffect(() => {
    if (open && file) {
      // Initialize selected IDs from file's current links
      const taskIds = new Set(file.task_links.map((l) => l.task.id))
      const itemIds = new Set(file.list_item_links.map((l) => l.list_item.id))
      setSelectedTaskIds(taskIds)
      setInitialTaskIds(taskIds)
      setSelectedItemIds(itemIds)
      setInitialItemIds(itemIds)

      // Load data
      loadTasks()
      loadLawLists()
    } else {
      // Reset state when closing
      setSelectedTaskIds(new Set())
      setSelectedItemIds(new Set())
      setSelectedListId(null)
      setListItems([])
      setTaskSearch('')
      setItemSearch('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file])

  // Load tasks
  const loadTasks = async () => {
    setIsLoading(true)
    try {
      const result = await getWorkspaceTasksPaginated(
        taskSearch ? { search: taskSearch } : undefined,
        { limit: 50 }
      )
      if (result.success && result.data) {
        setTasks(result.data.tasks)
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Debounced task search
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(loadTasks, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSearch])

  // Load law lists
  const loadLawLists = async () => {
    try {
      const result = await getWorkspaceLawLists()
      if (result.success && result.data) {
        setLawLists(result.data)
      }
    } catch (error) {
      console.error('Failed to load law lists:', error)
    }
  }

  // Load list items when a list is selected
  useEffect(() => {
    if (selectedListId) {
      loadListItems(selectedListId)
    } else {
      setListItems([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListId])

  const loadListItems = async (listId: string) => {
    setIsLoading(true)
    try {
      const result = await getLawListItemsForLinking(
        listId,
        itemSearch || undefined
      )
      if (result.success && result.data) {
        setListItems(result.data)
      }
    } catch (error) {
      console.error('Failed to load list items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Debounced item search
  useEffect(() => {
    if (!open || !selectedListId) return
    const timer = setTimeout(() => loadListItems(selectedListId), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemSearch, selectedListId])

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!file) return

    setIsSaving(true)
    try {
      // Determine changes for tasks
      const tasksToLink = Array.from(selectedTaskIds).filter(
        (id) => !initialTaskIds.has(id)
      )
      const tasksToUnlink = Array.from(initialTaskIds).filter(
        (id) => !selectedTaskIds.has(id)
      )

      // Determine changes for list items
      const itemsToLink = Array.from(selectedItemIds).filter(
        (id) => !initialItemIds.has(id)
      )
      const itemsToUnlink = Array.from(initialItemIds).filter(
        (id) => !selectedItemIds.has(id)
      )

      // Execute changes
      await Promise.all([
        ...tasksToLink.map((taskId) => linkFileToTask(file.id, taskId)),
        ...tasksToUnlink.map((taskId) => unlinkFile(file.id, 'task', taskId)),
        ...itemsToLink.map((itemId) => linkFileToListItem(file.id, itemId)),
        ...itemsToUnlink.map((itemId) =>
          unlinkFile(file.id, 'list_item', itemId)
        ),
      ])

      toast.success('Länkar har uppdaterats')
      onUpdate?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save links:', error)
      toast.error('Kunde inte spara ändringar')
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges =
    !setsEqual(selectedTaskIds, initialTaskIds) ||
    !setsEqual(selectedItemIds, initialItemIds)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Länka fil</DialogTitle>
          <DialogDescription>
            Välj uppgifter och/eller lagar att länka filen till.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'tasks' | 'laws')}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Uppgifter
              {selectedTaskIds.size > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {selectedTaskIds.size}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="laws" className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Lagar
              {selectedItemIds.size > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {selectedItemIds.size}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="tasks"
            className="flex-1 flex flex-col min-h-0 mt-4"
          >
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök uppgifter..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6 max-h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : tasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Inga uppgifter hittades
                </p>
              ) : (
                <div className="space-y-1">
                  {tasks.map((task) => (
                    <label
                      key={task.id}
                      htmlFor={`task-${task.id}`}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        id={`task-${task.id}`}
                        checked={selectedTaskIds.has(task.id)}
                        onCheckedChange={() => toggleTask(task.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.column.name}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="laws"
            className="flex-1 flex flex-col min-h-0 mt-4"
          >
            {/* Law list selector */}
            <div className="mb-3 space-y-2">
              <p className="text-sm font-medium">Välj laglista</p>
              <div className="flex flex-wrap gap-2">
                {lawLists.map((list) => (
                  <Button
                    key={list.id}
                    variant={selectedListId === list.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedListId(list.id)}
                  >
                    {list.name}
                    <Badge variant="secondary" className="ml-2">
                      {list.itemCount}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>

            {selectedListId && (
              <>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Sök lagar..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <ScrollArea className="flex-1 -mx-6 px-6 max-h-[250px]">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : listItems.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Inga lagar hittades
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {listItems.map((item) => (
                        <label
                          key={item.id}
                          htmlFor={`listitem-${item.id}`}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            id={`listitem-${item.id}`}
                            checked={selectedItemIds.has(item.id)}
                            onCheckedChange={() => toggleItem(item.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">
                              {item.documentTitle}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.documentNumber}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            )}

            {!selectedListId && (
              <p className="text-center text-muted-foreground py-8">
                Välj en laglista ovan för att se lagar
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Spara ändringar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Utilities
// ============================================================================

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}
