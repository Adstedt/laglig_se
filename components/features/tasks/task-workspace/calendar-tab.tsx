'use client'

/**
 * Story 6.4: Calendar View Tab
 * Monthly calendar view with task due dates
 */

import { useState, useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { sv } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/app/actions/tasks'
import type { WorkspaceMember } from './index'

// ============================================================================
// Props
// ============================================================================

interface CalendarTabProps {
  initialTasks: TaskWithRelations[]
  workspaceMembers: WorkspaceMember[]
  onTaskClick?: (_taskId: string) => void
}

// ============================================================================
// Main Component
// ============================================================================

export function CalendarTab({ initialTasks, onTaskClick }: CalendarTabProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  // Get tasks with due dates
  const tasksWithDueDates = useMemo(
    () => initialTasks.filter((task) => task.due_date !== null),
    [initialTasks]
  )

  // Get calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { locale: sv })
    const calendarEnd = endOfWeek(monthEnd, { locale: sv })

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentDate])

  // Get tasks for a specific day
  const getTasksForDay = (day: Date) => {
    return tasksWithDueDates.filter((task) =>
      isSameDay(new Date(task.due_date!), day)
    )
  }

  // Navigation
  const goToPreviousMonth = () => setCurrentDate((d) => subMonths(d, 1))
  const goToNextMonth = () => setCurrentDate((d) => addMonths(d, 1))
  const goToToday = () => setCurrentDate(new Date())

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: sv })}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Idag
          </Button>
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const dayTasks = getTasksForDay(day)
              const isCurrentMonth = isSameMonth(day, currentDate)
              const isCurrentDay = isToday(day)
              const hasOverdue = dayTasks.some(
                (t) => !t.column.is_done && new Date(t.due_date!) < new Date()
              )

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[100px] p-2 border rounded-md transition-colors',
                    !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
                    isCurrentDay && 'border-primary bg-primary/5',
                    'hover:bg-muted/50'
                  )}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isCurrentDay &&
                          'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {hasOverdue && (
                      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                  </div>

                  {/* Tasks */}
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((task) => (
                      <CalendarTask
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick?.(task.id)}
                      />
                    ))}
                    {dayTasks.length > 3 && (
                      <button className="text-xs text-muted-foreground hover:text-foreground">
                        +{dayTasks.length - 3} fler
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-400" />
          <span>Att göra</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>Pågående</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>Klar</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span>Försenad</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Calendar Task Component
// ============================================================================

function CalendarTask({
  task,
  onClick,
}: {
  task: TaskWithRelations
  onClick?: () => void
}) {
  const isOverdue =
    !task.column.is_done &&
    task.due_date &&
    new Date(task.due_date) < new Date()

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'text-xs p-1 rounded truncate cursor-pointer transition-colors hover:opacity-80',
        task.column.is_done && 'bg-green-100 text-green-700',
        !task.column.is_done && !isOverdue && 'bg-blue-100 text-blue-700',
        isOverdue && 'bg-red-100 text-red-700'
      )}
      title={task.title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      {task.title}
    </div>
  )
}
