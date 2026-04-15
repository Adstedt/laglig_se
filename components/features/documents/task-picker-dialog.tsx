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
import { CheckSquare, Loader2 } from 'lucide-react'
import { getTasksForLinking } from '@/app/actions/tasks'

interface TaskForPicker {
  id: string
  title: string
  column: { name: string } | null
}

interface TaskPickerDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  excludeIds?: string[]
  onSelect: (_task: { id: string; title: string }) => void
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

  const loadTasks = useCallback(async (query: string) => {
    setLoading(true)
    const result = await getTasksForLinking(undefined, query || undefined)
    if (result.success && result.data) {
      setAvailableTasks(
        result.data.map((t) => ({
          id: t.id,
          title: t.title,
          column: t.column,
        }))
      )
    }
    setLoading(false)
  }, [])

  // Reset query + load on open
  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      return
    }
    loadTasks('')
  }, [open, loadTasks])

  // Debounced reload on query change while open
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => loadTasks(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, open, loadTasks])

  const excludeSet = new Set(excludeIds ?? [])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Sök uppgifter..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList className="max-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <CommandEmpty>Inga uppgifter hittades</CommandEmpty>
            <CommandGroup heading="Uppgifter">
              {availableTasks
                .filter((t) => !excludeSet.has(t.id))
                .map((task) => (
                  <CommandItem
                    key={task.id}
                    value={task.title}
                    onSelect={() =>
                      onSelect({ id: task.id, title: task.title })
                    }
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
  )
}
