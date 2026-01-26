'use client'

/**
 * Story 6.3: Tasks Summary Box
 * Task progress bar and list of up to 5 tasks
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ListTodo, Plus, CheckCircle, Circle } from 'lucide-react'
import type { TaskProgress } from '@/app/actions/legal-document-modal'
import { cn } from '@/lib/utils'

interface TasksSummaryBoxProps {
  taskProgress: TaskProgress | null
  listItemId: string
  onTasksUpdate: () => Promise<void>
}

export function TasksSummaryBox({
  taskProgress,
  listItemId: _listItemId,
  onTasksUpdate: _onTasksUpdate,
}: TasksSummaryBoxProps) {
  // Handle model not existing (graceful fallback)
  if (taskProgress === null) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">
            Uppgifter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TasksEmptyState />
        </CardContent>
      </Card>
    )
  }

  const { completed, total, tasks } = taskProgress
  const progressPercent = total > 0 ? (completed / total) * 100 : 0

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">
            Uppgifter
          </CardTitle>
          {total > 0 && (
            <span className="text-xs text-muted-foreground">
              {completed}/{total} klara
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {total > 0 ? (
          <>
            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Task list (max 5) */}
            <div className="space-y-2">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  className={cn(
                    'flex items-center gap-2 w-full text-left p-2 rounded-md',
                    'hover:bg-muted/50 transition-colors',
                    'text-sm'
                  )}
                  // Task modal will be implemented in Story 6.6
                  disabled
                >
                  {task.isDone ? (
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <Circle
                      className="h-4 w-4 shrink-0"
                      style={{ color: task.columnColor ?? undefined }}
                    />
                  )}
                  <span
                    className={cn(
                      'truncate',
                      task.isDone && 'line-through text-muted-foreground'
                    )}
                  >
                    {task.title}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <TasksEmptyState />
        )}

        {/* Create task button */}
        <Button variant="outline" size="sm" className="w-full" disabled>
          <Plus className="h-4 w-4 mr-2" />
          Skapa uppgift
        </Button>
      </CardContent>
    </Card>
  )
}

function TasksEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-4 text-center">
      <div className="rounded-full bg-muted p-2 mb-2">
        <ListTodo className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">Inga uppgifter</p>
    </div>
  )
}
