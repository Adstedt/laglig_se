'use client'

/**
 * Story 6.6: Details Box
 * Right panel details: status, assignee, due date, priority, created
 *
 * Optimistic UI: Updates UI immediately, then syncs with server
 */

import { useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar as CalendarIcon, User, Flag, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  updateTaskStatusColumn,
  updateTaskAssignee,
  updateTaskDueDate,
  updateTaskPriority,
  type TaskDetails,
} from '@/app/actions/task-modal'
import type { TaskPriority } from '@prisma/client'
import type { WorkspaceMember } from '../task-workspace'
import type { TaskColumnWithCount } from '@/app/actions/tasks'
import { toast } from 'sonner'

interface DetailsBoxProps {
  task: TaskDetails
  workspaceMembers: WorkspaceMember[]
  columns: TaskColumnWithCount[]
  onUpdate: () => Promise<void>
  // Optimistic update callbacks
  onOptimisticStatusChange?: ((_columnId: string) => void) | undefined
  onOptimisticPriorityChange?: ((_priority: string) => void) | undefined
  onOptimisticAssigneeChange?:
    | ((_member: WorkspaceMember | null) => void)
    | undefined
  onOptimisticDueDateChange?: ((_dueDate: Date | null) => void) | undefined
}

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Låg', color: 'text-gray-500' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-blue-500' },
  { value: 'HIGH', label: 'Hög', color: 'text-orange-500' },
  { value: 'CRITICAL', label: 'Kritisk', color: 'text-red-500' },
] as const

export function DetailsBox({
  task,
  workspaceMembers,
  columns,
  onUpdate,
  onOptimisticStatusChange,
  onOptimisticPriorityChange,
  onOptimisticAssigneeChange,
  onOptimisticDueDateChange,
}: DetailsBoxProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  // Optimistic status change - update UI immediately, then sync with server
  const handleStatusChange = async (columnId: string) => {
    // Optimistic update
    onOptimisticStatusChange?.(columnId)

    // Server update
    const result = await updateTaskStatusColumn(task.id, columnId)
    if (!result.success) {
      toast.error('Kunde inte uppdatera status', { description: result.error })
      // Revert on error
      await onUpdate()
    }
  }

  // Optimistic assignee change
  const handleAssigneeChange = async (userId: string) => {
    const newAssignee =
      userId === 'unassigned'
        ? null
        : (workspaceMembers.find((m) => m.id === userId) ?? null)

    // Optimistic update
    onOptimisticAssigneeChange?.(newAssignee)

    // Server update
    const result = await updateTaskAssignee(
      task.id,
      userId === 'unassigned' ? null : userId
    )
    if (!result.success) {
      toast.error('Kunde inte uppdatera ansvarig', {
        description: result.error,
      })
      await onUpdate()
    }
  }

  // Optimistic due date change
  const handleDueDateChange = async (date: Date | undefined) => {
    setDatePickerOpen(false)

    // Optimistic update
    onOptimisticDueDateChange?.(date ?? null)

    // Server update
    const result = await updateTaskDueDate(task.id, date ?? null)
    if (!result.success) {
      toast.error('Kunde inte uppdatera datum', { description: result.error })
      await onUpdate()
    }
  }

  // Optimistic priority change
  const handlePriorityChange = async (priority: string) => {
    // Optimistic update
    onOptimisticPriorityChange?.(priority)

    // Server update
    const result = await updateTaskPriority(task.id, priority as TaskPriority)
    if (!result.success) {
      toast.error('Kunde inte uppdatera prioritet', {
        description: result.error,
      })
      await onUpdate()
    }
  }

  const selectedAssignee = workspaceMembers.find(
    (m) => m.id === task.assignee_id
  )

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
          Detaljer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status */}
        <div className="flex items-center justify-between min-h-[32px]">
          <span className="text-sm font-medium text-foreground/70">Status</span>
          <Select value={task.column_id} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {columns.map((column) => (
                <SelectItem key={column.id} value={column.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: column.color }}
                    />
                    {column.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Assignee */}
        <div className="flex items-center justify-between min-h-[32px]">
          <span className="text-sm font-medium text-foreground/70">
            Ansvarig
          </span>
          <Select
            value={task.assignee_id ?? 'unassigned'}
            onValueChange={handleAssigneeChange}
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue>
                {selectedAssignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      {selectedAssignee.avatarUrl && (
                        <AvatarImage src={selectedAssignee.avatarUrl} />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {(selectedAssignee.name ?? selectedAssignee.email)
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                      {selectedAssignee.name ?? selectedAssignee.email}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    Otilldelad
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Otilldelad
                </div>
              </SelectItem>
              {workspaceMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      {member.avatarUrl && (
                        <AvatarImage src={member.avatarUrl} />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {(member.name ?? member.email)
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {member.name ?? member.email}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Due Date */}
        <div className="flex items-center justify-between min-h-[32px]">
          <span className="text-sm font-medium text-foreground/70">
            Förfallodatum
          </span>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[140px] h-8 justify-start text-left font-normal',
                  !task.due_date && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">
                  {task.due_date
                    ? format(new Date(task.due_date), 'd MMM yyyy', {
                        locale: sv,
                      })
                    : 'Välj datum'}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={task.due_date ? new Date(task.due_date) : undefined}
                onSelect={handleDueDateChange}
                locale={sv}
                initialFocus
              />
              {task.due_date && (
                <div className="border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-destructive"
                    onClick={() => handleDueDateChange(undefined)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Rensa datum
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Priority */}
        <div className="flex items-center justify-between min-h-[32px]">
          <span className="text-sm font-medium text-foreground/70">
            Prioritet
          </span>
          <Select value={task.priority} onValueChange={handlePriorityChange}>
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <Flag className={cn('h-4 w-4', option.color)} />
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Created */}
        <div className="flex items-center justify-between min-h-[32px]">
          <span className="text-sm font-medium text-foreground/70">Skapad</span>
          <span className="text-sm">
            {format(new Date(task.created_at), 'd MMM yyyy', { locale: sv })}
            {task.creator && (
              <span className="text-muted-foreground">
                {' '}
                av {task.creator.name ?? task.creator.email}
              </span>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
