'use client'

/**
 * Story 17.19: Compact Task Strip (State 3 header)
 *
 * Thin contextual bar pinned above the chat when the chat is in fullscreen mode.
 * Keeps the user oriented in the task while the rest of the modal body is hidden.
 */

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Squircle, X } from 'lucide-react'
import { useSplitPanelModal } from '@/components/shared/split-panel-modal/context'
import type { TaskDetails } from '@/app/actions/task-modal'
import type { TaskColumnWithCount } from '@/app/actions/tasks'

interface CompactTaskStripProps {
  task: TaskDetails
  columns: TaskColumnWithCount[]
}

export function CompactTaskStrip({ task, columns }: CompactTaskStripProps) {
  const { toggleExpand, closeModal } = useSplitPanelModal()
  const column = columns.find((c) => c.id === task.column_id)

  return (
    <div className="flex items-center gap-3 px-6 py-3 bg-muted/30">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground">
        <Squircle className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">Uppgift</span>
          {column && (
            <>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
                {column.name}
              </span>
            </>
          )}
        </div>
        <div
          className={cn(
            'truncate text-sm font-medium text-foreground',
            'leading-tight'
          )}
          title={task.title}
        >
          {task.title}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={toggleExpand}
        className="h-8 px-2.5 shrink-0"
      >
        <ChevronLeft className="mr-1 h-3.5 w-3.5" />
        Tillbaka till uppgiften
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={closeModal}
        className="h-8 w-8 p-0 shrink-0"
        aria-label="Stäng"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
