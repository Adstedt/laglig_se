'use client'

/**
 * Story 6.3: Tasks Summary Box
 * Story 6.7: Added inline task creation with quick form
 * Task progress bar and list of up to 5 tasks
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
import {
  ListTodo,
  Plus,
  CheckCircle,
  Circle,
  Calendar as CalendarIcon,
  User,
  Loader2,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import type { TaskProgress } from '@/app/actions/legal-document-modal'
import { createTask, getWorkspaceMembers } from '@/app/actions/tasks'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface WorkspaceMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface TasksSummaryBoxProps {
  taskProgress: TaskProgress | null
  listItemId: string
  onTasksUpdate: () => Promise<void>
  onOpenTask?: (_taskId: string) => void // Story 6.7: For "Skapa och öppna"
  currentUserId?: string
}

export function TasksSummaryBox({
  taskProgress,
  listItemId,
  onTasksUpdate,
  onOpenTask,
  currentUserId,
}: TasksSummaryBoxProps) {
  // Story 6.7: Inline form state
  const [isFormExpanded, setIsFormExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  // Load workspace members when form is expanded
  useEffect(() => {
    if (isFormExpanded && members.length === 0) {
      setMembersLoading(true)
      getWorkspaceMembers()
        .then((result) => {
          if (result.success && result.data) {
            setMembers(result.data)
          }
        })
        .finally(() => setMembersLoading(false))
    }
  }, [isFormExpanded, members.length])

  const resetForm = useCallback(() => {
    setTitle('')
    setDescription('')
    setAssigneeId(null)
    setDueDate(null)
  }, [])

  const handleCreate = async (openAfter: boolean = false) => {
    if (!title.trim() || title.length < 3) {
      toast.error('Titeln måste vara minst 3 tecken')
      return
    }

    setIsSubmitting(true)
    try {
      // Build params object, only including defined values
      const params: Parameters<typeof createTask>[0] = {
        title: title.trim(),
        linkedListItemIds: [listItemId],
      }
      if (description.trim()) params.description = description.trim()
      if (assigneeId) params.assigneeId = assigneeId
      if (dueDate) params.dueDate = dueDate

      const result = await createTask(params)

      if (result.success && result.data) {
        toast.success('Uppgift skapad')
        resetForm()
        setIsFormExpanded(false)
        await onTasksUpdate()

        if (openAfter && onOpenTask) {
          onOpenTask(result.data.id)
        }
      } else {
        toast.error('Kunde inte skapa uppgift', {
          description: result.error,
        })
      }
    } catch (error) {
      console.error('Failed to create task:', error)
      toast.error('Kunde inte skapa uppgift')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedAssignee = members.find((m) => m.id === assigneeId)
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

        {/* Story 6.7: Create task button and inline form */}
        {!isFormExpanded ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setIsFormExpanded(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Skapa uppgift
          </Button>
        ) : (
          <div className="space-y-3 border-t pt-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="quick-task-title" className="text-xs">
                Titel <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quick-task-title"
                placeholder="Ange uppgiftens titel..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="quick-task-desc" className="text-xs">
                Beskrivning
              </Label>
              <Textarea
                id="quick-task-desc"
                placeholder="Lägg till en beskrivning..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                rows={2}
              />
            </div>

            {/* Assignee */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Ansvarig</Label>
                {currentUserId && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setAssigneeId(currentUserId)}
                    disabled={isSubmitting}
                  >
                    Tilldela mig
                  </button>
                )}
              </div>
              <Select
                value={assigneeId ?? 'unassigned'}
                onValueChange={(value) =>
                  setAssigneeId(value === 'unassigned' ? null : value)
                }
                disabled={isSubmitting || membersLoading}
              >
                <SelectTrigger className="h-9">
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
                        <span className="truncate text-sm">
                          {selectedAssignee.name ?? selectedAssignee.email}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span className="text-sm">Otilldelad</span>
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
                  {members.map((member) => (
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
            <div className="space-y-1.5">
              <Label className="text-xs">Förfallodatum</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-full h-9 justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                    disabled={isSubmitting}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
                    {dueDate
                      ? format(dueDate, 'd MMM yyyy', { locale: sv })
                      : 'Välj datum'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ?? undefined}
                    onSelect={(date) => {
                      setDueDate(date ?? null)
                      setDatePickerOpen(false)
                    }}
                    locale={sv}
                    initialFocus
                  />
                  {dueDate && (
                    <div className="border-t p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground hover:text-destructive"
                        onClick={() => setDueDate(null)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Rensa datum
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Pre-linked indicator */}
            <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1.5 rounded">
              Länkas automatiskt till denna lag
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  resetForm()
                  setIsFormExpanded(false)
                }}
                disabled={isSubmitting}
              >
                Avbryt
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleCreate(true)}
                disabled={isSubmitting || !title.trim() || title.length < 3}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Skapa och öppna'
                )}
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => handleCreate(false)}
                disabled={isSubmitting || !title.trim() || title.length < 3}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Skapa'
                )}
              </Button>
            </div>
          </div>
        )}
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
