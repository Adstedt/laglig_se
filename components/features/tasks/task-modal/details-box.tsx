'use client'

/**
 * Story 6.6: Details Box
 * Right panel details: status, assignee, due date, priority, created
 *
 * Design: Minimal inline style with hover states for interactivity
 * Aligned with Legal Document Modal and TasksAccordion design patterns
 *
 * Optimistic UI: Updates UI immediately, then syncs with server
 */

import { useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Button } from '@/components/ui/button'
import {
  Calendar as CalendarIcon,
  User,
  Flag,
  X,
  ChevronDown,
} from 'lucide-react'
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

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; color: string; bgColor: string; iconColor: string }
> = {
  LOW: {
    label: 'Låg',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    iconColor: 'text-gray-500',
  },
  MEDIUM: {
    label: 'Medium',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    iconColor: 'text-blue-500',
  },
  HIGH: {
    label: 'Hög',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    iconColor: 'text-orange-500',
  },
  CRITICAL: {
    label: 'Kritisk',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    iconColor: 'text-red-500',
  },
}

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

  // Optimistic status change
  const handleStatusChange = async (columnId: string) => {
    onOptimisticStatusChange?.(columnId)
    const result = await updateTaskStatusColumn(task.id, columnId)
    if (!result.success) {
      toast.error('Kunde inte uppdatera status', { description: result.error })
      await onUpdate()
    }
  }

  // Optimistic assignee change
  const handleAssigneeChange = async (userId: string) => {
    const newAssignee =
      userId === 'unassigned'
        ? null
        : (workspaceMembers.find((m) => m.id === userId) ?? null)
    onOptimisticAssigneeChange?.(newAssignee)
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
    onOptimisticDueDateChange?.(date ?? null)
    const result = await updateTaskDueDate(task.id, date ?? null)
    if (!result.success) {
      toast.error('Kunde inte uppdatera datum', { description: result.error })
      await onUpdate()
    }
  }

  // Optimistic priority change
  const handlePriorityChange = async (priority: string) => {
    onOptimisticPriorityChange?.(priority)
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
  const currentColumn = columns.find((c) => c.id === task.column_id)
  const priorityConfig = PRIORITY_CONFIG[task.priority]

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-foreground">
          Detaljer
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-1">
        <div className="space-y-0">
          {/* Status - Editable */}
          <DetailRow label="Status" interactive>
            <Select value={task.column_id} onValueChange={handleStatusChange}>
              <SelectTrigger className="!h-auto !p-0 !border-0 !shadow-none !bg-transparent hover:!bg-transparent focus:!ring-0 !w-auto gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-70">
                <SelectValue>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: currentColumn?.color ?? '#888',
                      }}
                    />
                    <span className="text-sm text-foreground">
                      {currentColumn?.name ?? 'Status'}
                    </span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                {columns.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: column.color }}
                      />
                      <span>{column.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailRow>

          {/* Assignee - Editable */}
          <DetailRow label="Ansvarig" interactive>
            <Select
              value={task.assignee_id ?? 'unassigned'}
              onValueChange={handleAssigneeChange}
            >
              <SelectTrigger className="!h-auto !p-0 !border-0 !shadow-none !bg-transparent hover:!bg-transparent focus:!ring-0 !w-auto gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-70">
                <SelectValue>
                  {selectedAssignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5 border border-border/30">
                        {selectedAssignee.avatarUrl && (
                          <AvatarImage src={selectedAssignee.avatarUrl} />
                        )}
                        <AvatarFallback className="text-[9px] bg-muted">
                          {(selectedAssignee.name ?? selectedAssignee.email)
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-foreground">
                        {selectedAssignee.name ?? selectedAssignee.email}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="text-sm">Ingen tilldelad</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="unassigned">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Ingen tilldelad</span>
                  </div>
                </SelectItem>
                {workspaceMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        {member.avatarUrl && (
                          <AvatarImage src={member.avatarUrl} />
                        )}
                        <AvatarFallback className="text-[9px]">
                          {(member.name ?? member.email)
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{member.name ?? member.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailRow>

          {/* Due Date - Editable */}
          <DetailRow label="Förfallodatum" interactive>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity">
                  {task.due_date ? (
                    <>
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">
                        {format(new Date(task.due_date), 'd MMM yyyy', {
                          locale: sv,
                        })}
                      </span>
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Välj datum</span>
                    </>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
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
          </DetailRow>

          {/* Priority - Editable */}
          <DetailRow label="Prioritet" interactive>
            <Select value={task.priority} onValueChange={handlePriorityChange}>
              <SelectTrigger className="!h-auto !p-0 !border-0 !shadow-none !bg-transparent hover:!bg-transparent focus:!ring-0 !w-auto gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-70">
                <SelectValue>
                  <div className="flex items-center gap-1.5">
                    <Flag className={cn('h-4 w-4', priorityConfig.iconColor)} />
                    <span className="text-sm text-foreground">
                      {priorityConfig.label}
                    </span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                      <Flag className={cn('h-4 w-4', config.iconColor)} />
                      <span>{config.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailRow>

          {/* Created - Read only */}
          <DetailRow label="Skapad">
            <span className="text-sm text-foreground">
              {format(new Date(task.created_at), 'd MMM yyyy', { locale: sv })}
              {task.creator && (
                <span className="text-muted-foreground ml-1">
                  av {task.creator.name ?? task.creator.email}
                </span>
              )}
            </span>
          </DetailRow>
        </div>
      </CardContent>
    </Card>
  )
}

// Shared DetailRow component for consistent styling
interface DetailRowProps {
  label: string
  children: React.ReactNode
  interactive?: boolean
}

function DetailRow({ label, children, interactive = false }: DetailRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-2.5 -mx-2 px-2 rounded-md transition-colors',
        interactive && 'hover:bg-muted/40 cursor-pointer'
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center">{children}</div>
    </div>
  )
}
