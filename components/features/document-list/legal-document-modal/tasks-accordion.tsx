'use client'

/**
 * Story 6.15: Tasks Accordion
 * Accordion item for managing tasks linked to a law list item
 * Features: collapsible sections (active/completed), link/unlink, create, navigate
 */

import { useState, useEffect, useCallback } from 'react'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
  Link2,
  ChevronDown,
  ChevronRight,
  Check,
} from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import type { TaskProgress } from '@/app/actions/legal-document-modal'
import {
  createTask,
  getWorkspaceMembers,
  getTasksForLinking,
  type TaskForLinking,
} from '@/app/actions/tasks'
import {
  linkListItemToTask,
  unlinkListItemFromTask,
} from '@/app/actions/task-modal'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useDebounce } from '@/lib/hooks/use-debounce'

interface WorkspaceMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface TasksAccordionProps {
  taskProgress: TaskProgress | null
  listItemId: string
  onTasksUpdate: () => Promise<void>
  onOpenTask?: ((_taskId: string) => void) | undefined
  currentUserId?: string | undefined
}

export function TasksAccordion({
  taskProgress,
  listItemId,
  onTasksUpdate,
  onOpenTask,
  currentUserId,
}: TasksAccordionProps) {
  // Form state
  const [isFormExpanded, setIsFormExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  // Task management state
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)

  // Collapsible sections state
  const [activeOpen, setActiveOpen] = useState(true)
  const [completedOpen, setCompletedOpen] = useState(false)

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

  const handleUnlink = useCallback(
    async (taskId: string) => {
      setUnlinkingId(taskId)

      const result = await unlinkListItemFromTask(taskId, listItemId)

      if (result.success) {
        toast.success('Länk borttagen')
        await onTasksUpdate()
      } else {
        toast.error('Kunde inte ta bort länk', { description: result.error })
      }

      setUnlinkingId(null)
    },
    [listItemId, onTasksUpdate]
  )

  const handleLinkTask = useCallback(
    async (taskId: string) => {
      const result = await linkListItemToTask(taskId, listItemId)

      if (result.success) {
        toast.success('Uppgift länkad')
        setLinkDialogOpen(false)
        await onTasksUpdate()
      } else {
        toast.error('Kunde inte länka uppgift', { description: result.error })
      }
    },
    [listItemId, onTasksUpdate]
  )

  const selectedAssignee = members.find((m) => m.id === assigneeId)

  // Normalize taskProgress
  const { tasks } = taskProgress ?? { tasks: [] }

  // Split tasks into active and completed
  const activeTasks = tasks.filter((t) => !t.isDone)
  const completedTasks = tasks.filter((t) => t.isDone)

  const activeCount = activeTasks.length
  const completedCount = completedTasks.length

  return (
    <AccordionItem value="tasks" className="border rounded-lg bg-background">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4" />
          <span>Uppgifter</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {activeCount} pågående
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-4">
          {/* Active Tasks Section */}
          <Collapsible open={activeOpen} onOpenChange={setActiveOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {activeOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Pågående ({activeCount})
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {activeCount > 0 ? (
                <div className="space-y-1">
                  {activeTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      isUnlinking={unlinkingId === task.id}
                      onOpen={() => onOpenTask?.(task.id)}
                      onUnlink={() => handleUnlink(task.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  Inga pågående uppgifter
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Completed Tasks Section */}
          <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {completedOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Avslutade ({completedCount})
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {completedCount > 0 ? (
                <div className="space-y-1">
                  {completedTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      isUnlinking={unlinkingId === task.id}
                      onOpen={() => onOpenTask?.(task.id)}
                      onUnlink={() => handleUnlink(task.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  Inga avslutade uppgifter
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Action Buttons / Create Form */}
          {!isFormExpanded ? (
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setIsFormExpanded(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Skapa uppgift
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setLinkDialogOpen(true)}
              >
                <Link2 className="h-4 w-4 mr-2" />
                Länka befintlig
              </Button>
            </div>
          ) : (
            <CreateTaskForm
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              assigneeId={assigneeId}
              setAssigneeId={setAssigneeId}
              dueDate={dueDate}
              setDueDate={setDueDate}
              datePickerOpen={datePickerOpen}
              setDatePickerOpen={setDatePickerOpen}
              members={members}
              membersLoading={membersLoading}
              selectedAssignee={selectedAssignee}
              currentUserId={currentUserId}
              isSubmitting={isSubmitting}
              onCancel={() => {
                resetForm()
                setIsFormExpanded(false)
              }}
              onCreate={handleCreate}
            />
          )}
        </div>

        {/* Link Existing Task Dialog */}
        <LinkExistingTaskDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          listItemId={listItemId}
          linkedTaskIds={tasks.map((t) => t.id)}
          onLink={handleLinkTask}
        />
      </AccordionContent>
    </AccordionItem>
  )
}

// Task Item Component
interface TaskItemProps {
  task: {
    id: string
    title: string
    isDone: boolean
    columnColor: string | null
  }
  isUnlinking: boolean
  onOpen: () => void
  onUnlink: () => void
}

function TaskItem({ task, isUnlinking, onOpen, onUnlink }: TaskItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 w-full text-left p-2 rounded-md group',
        'hover:bg-muted/50 transition-colors',
        'text-sm',
        isUnlinking && 'opacity-50'
      )}
    >
      <button
        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
        onClick={onOpen}
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

      <button
        className={cn(
          'p-1 rounded hover:bg-muted transition-colors shrink-0',
          'opacity-0 group-hover:opacity-100'
        )}
        onClick={(e) => {
          e.stopPropagation()
          onUnlink()
        }}
        disabled={isUnlinking}
        title="Ta bort länk"
      >
        {isUnlinking ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        )}
      </button>
    </div>
  )
}

// Create Task Form Component
interface CreateTaskFormProps {
  title: string
  setTitle: (_value: string) => void
  description: string
  setDescription: (_value: string) => void
  assigneeId: string | null
  setAssigneeId: (_value: string | null) => void
  dueDate: Date | null
  setDueDate: (_value: Date | null) => void
  datePickerOpen: boolean
  setDatePickerOpen: (_value: boolean) => void
  members: WorkspaceMember[]
  membersLoading: boolean
  selectedAssignee: WorkspaceMember | undefined
  currentUserId?: string | undefined
  isSubmitting: boolean
  onCancel: () => void
  onCreate: (_openAfter: boolean) => void
}

function CreateTaskForm({
  title,
  setTitle,
  description,
  setDescription,
  assigneeId,
  setAssigneeId,
  dueDate,
  setDueDate,
  datePickerOpen,
  setDatePickerOpen,
  members,
  membersLoading,
  selectedAssignee,
  currentUserId,
  isSubmitting,
  onCancel,
  onCreate,
}: CreateTaskFormProps) {
  return (
    <div className="space-y-3 border-t pt-4">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="task-title" className="text-xs">
          Titel <span className="text-destructive">*</span>
        </Label>
        <Input
          id="task-title"
          placeholder="Ange uppgiftens titel..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="task-desc" className="text-xs">
          Beskrivning
        </Label>
        <Textarea
          id="task-desc"
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
                    {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                    <AvatarFallback className="text-[10px]">
                      {(member.name ?? member.email).slice(0, 2).toUpperCase()}
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
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Avbryt
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onCreate(true)}
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
          onClick={() => onCreate(false)}
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
  )
}

// Link Existing Task Dialog Component
interface LinkExistingTaskDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  listItemId: string
  linkedTaskIds: string[]
  onLink: (_taskId: string) => Promise<void>
}

function LinkExistingTaskDialog({
  open,
  onOpenChange,
  listItemId,
  linkedTaskIds,
  onLink,
}: LinkExistingTaskDialogProps) {
  const [search, setSearch] = useState('')
  const [tasks, setTasks] = useState<TaskForLinking[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  // Load tasks when dialog opens or search changes
  useEffect(() => {
    if (!open) return

    setIsLoading(true)
    getTasksForLinking(listItemId, debouncedSearch || undefined)
      .then((result) => {
        if (result.success && result.data) {
          setTasks(result.data)
        }
      })
      .finally(() => setIsLoading(false))
  }, [open, listItemId, debouncedSearch])

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('')
      setTasks([])
    }
  }, [open])

  const handleSelect = async (taskId: string) => {
    setLinkingId(taskId)
    await onLink(taskId)
    setLinkingId(null)
  }

  const linkedTaskIdSet = new Set(linkedTaskIds)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Länka befintlig uppgift</DialogTitle>
        </DialogHeader>
        <Command
          shouldFilter={false}
          className="border rounded-lg overflow-hidden"
        >
          <CommandInput
            placeholder="Sök uppgift..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[280px] min-h-[200px]">
            <CommandEmpty>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Laddar uppgifter...
                </div>
              ) : (
                'Inga uppgifter hittades'
              )}
            </CommandEmpty>
            <CommandGroup>
              {tasks.map((task) => {
                const isLinked = linkedTaskIdSet.has(task.id)
                const isLinking = linkingId === task.id
                return (
                  <CommandItem
                    key={task.id}
                    value={task.id}
                    onSelect={() =>
                      !isLinked && !isLinking && handleSelect(task.id)
                    }
                    className={cn(
                      'cursor-pointer',
                      isLinked && 'opacity-50 cursor-not-allowed'
                    )}
                    disabled={isLinked || isLinking}
                  >
                    {isLinking ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                    ) : isLinked ? (
                      <Check className="mr-2 h-4 w-4 text-green-500 shrink-0" />
                    ) : task.column.is_done ? (
                      <CheckCircle className="mr-2 h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <Circle
                        className="mr-2 h-4 w-4 shrink-0"
                        style={{ color: task.column.color }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm">{task.title}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{task.column.name}</span>
                        {task.assignee && (
                          <>
                            <span>-</span>
                            <div className="flex items-center gap-1">
                              <Avatar className="h-3 w-3">
                                {task.assignee.avatar_url && (
                                  <AvatarImage src={task.assignee.avatar_url} />
                                )}
                                <AvatarFallback className="text-[8px]">
                                  {(task.assignee.name ?? 'U')
                                    .slice(0, 1)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">
                                {task.assignee.name ?? 'Anonym'}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {isLinked && (
                      <Badge
                        variant="secondary"
                        className="ml-2 shrink-0 text-xs"
                      >
                        Länkad
                      </Badge>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Stäng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
