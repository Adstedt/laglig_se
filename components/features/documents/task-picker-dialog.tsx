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
import { CheckSquare, Loader2 } from 'lucide-react'
import { getTasksForLinking } from '@/app/actions/tasks'
import {
  GroupedItemSections,
  PickerEmpty,
  type PickerGroup,
} from '@/components/features/documents/law-list-item-picker-dialog'

interface TaskForPicker {
  id: string
  title: string
  column: { id: string; name: string; position: number }
}

interface TaskPickerDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  excludeIds?: string[]
  onSelect: (_task: { id: string; title: string }) => void
}

function groupTasks(tasks: TaskForPicker[]): PickerGroup<TaskForPicker>[] {
  const map = new Map<
    string,
    { key: string; name: string; position: number; items: TaskForPicker[] }
  >()
  for (const task of tasks) {
    const key = task.column.id
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: task.column.name,
        position: task.column.position,
        items: [],
      })
    }
    map.get(key)!.items.push(task)
  }
  return Array.from(map.values())
    .sort((a, b) => a.position - b.position)
    .map(({ key, name, items }) => ({ key, name, items }))
}

export function TaskPickerDialog({
  open,
  onOpenChange,
  excludeIds,
  onSelect,
}: TaskPickerDialogProps) {
  const [availableTasks, setAvailableTasks] = useState<TaskForPicker[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const loadTasks = useCallback(async (query: string) => {
    setLoading(true)
    const result = await getTasksForLinking(undefined, query || undefined)
    if (result.success && result.data) {
      setAvailableTasks(
        result.data.map((t) => ({
          id: t.id,
          title: t.title,
          column: {
            id: t.column.id,
            name: t.column.name,
            position: t.column.position,
          },
        }))
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setExpandedGroups(new Set())
      return
    }
    loadTasks('')
  }, [open, loadTasks])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => loadTasks(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, open, loadTasks])

  const excludeSet = new Set(excludeIds ?? [])

  const groupedTasks = useMemo(
    () => groupTasks(availableTasks.filter((t) => !excludeSet.has(t.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableTasks, excludeIds?.join(',')]
  )

  const renderTask = (task: TaskForPicker) => (
    <CommandItem
      key={task.id}
      value={task.title}
      onSelect={() => onSelect({ id: task.id, title: task.title })}
      className="flex items-center gap-2.5 cursor-pointer py-1 text-[13px]"
    >
      <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{task.title}</span>
    </CommandItem>
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Sök uppgifter..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList className="max-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <CommandEmpty>
              <PickerEmpty label="Inga uppgifter hittades" />
            </CommandEmpty>
            {groupedTasks.length <= 1 ? (
              <CommandGroup>
                {groupedTasks.flatMap((g) =>
                  g.items.map((task) => renderTask(task))
                )}
              </CommandGroup>
            ) : (
              <GroupedItemSections
                groups={groupedTasks}
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
                renderItem={renderTask}
              />
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
