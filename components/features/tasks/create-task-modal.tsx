'use client'

/**
 * Story 6.7: Global Task Creation Modal
 * Jira-style modal for creating tasks from anywhere in the app
 */

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  Calendar as CalendarIcon,
  User,
  Flag,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { LawLinkSelector } from './law-link-selector'
import {
  createTask,
  getTaskColumns,
  getWorkspaceMembers,
  type TaskWithRelations,
  type TaskColumnWithCount,
} from '@/app/actions/tasks'
import { toast } from 'sonner'
import type { TaskPriority } from '@prisma/client'

// ============================================================================
// Schema
// ============================================================================

const CreateTaskSchema = z.object({
  title: z
    .string()
    .min(3, 'Titeln måste vara minst 3 tecken')
    .max(200, 'Titeln får vara max 200 tecken'),
  description: z.string().max(10000).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.date().nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  columnId: z.string().optional(),
  linkedListItemIds: z.array(z.string()).optional(),
})

type CreateTaskInput = z.infer<typeof CreateTaskSchema>

// ============================================================================
// Types
// ============================================================================

interface WorkspaceMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface CreateTaskModalProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  defaultLinkedLawId?: string | undefined
  currentUserId?: string | undefined
  onTaskCreated?: ((_task: TaskWithRelations) => void) | undefined
}

// ============================================================================
// Constants
// ============================================================================

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Låg', color: 'text-gray-500' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-blue-500' },
  { value: 'HIGH', label: 'Hög', color: 'text-orange-500' },
  { value: 'CRITICAL', label: 'Kritisk', color: 'text-red-500' },
] as const

// ============================================================================
// Component
// ============================================================================

export function CreateTaskModal({
  open,
  onOpenChange,
  defaultLinkedLawId,
  currentUserId,
  onTaskCreated,
}: CreateTaskModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createAnother, setCreateAnother] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  // Data loading
  const [columns, setColumns] = useState<TaskColumnWithCount[]>([])
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const form = useForm({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM' as const,
      assigneeId: null as string | null,
      dueDate: null as Date | null,
      columnId: undefined as string | undefined,
      linkedListItemIds: defaultLinkedLawId
        ? [defaultLinkedLawId]
        : ([] as string[]),
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = form

  const dueDate = watch('dueDate')
  const assigneeId = watch('assigneeId')
  const priority = watch('priority')
  const columnId = watch('columnId')
  const linkedListItemIds = watch('linkedListItemIds') ?? []

  // Load data when modal opens
  useEffect(() => {
    if (open) {
      setIsLoading(true)
      Promise.all([getTaskColumns(), getWorkspaceMembers()])
        .then(([columnsResult, membersResult]) => {
          if (columnsResult.success && columnsResult.data) {
            setColumns(columnsResult.data)
            // Set default column to first one
            if (columnsResult.data.length > 0 && !columnId) {
              setValue('columnId', columnsResult.data[0]?.id)
            }
          }
          if (membersResult.success && membersResult.data) {
            setMembers(membersResult.data)
          }
        })
        .finally(() => setIsLoading(false))
    }
  }, [open, columnId, setValue])

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      reset({
        title: '',
        description: '',
        priority: 'MEDIUM',
        assigneeId: null,
        dueDate: null,
        columnId: columns[0]?.id,
        linkedListItemIds: defaultLinkedLawId ? [defaultLinkedLawId] : [],
      })
      setCreateAnother(false)
    }
  }, [open, reset, columns, defaultLinkedLawId])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit(onSubmit)()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleSubmit]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAssignee = members.find((m) => m.id === assigneeId)

  const handleAssignToMe = () => {
    if (currentUserId) {
      setValue('assigneeId', currentUserId)
    }
  }

  const onSubmit = async (data: CreateTaskInput) => {
    setIsSubmitting(true)
    try {
      // Build params object, only including defined values
      const params: Parameters<typeof createTask>[0] = {
        title: data.title,
        priority: data.priority as TaskPriority,
      }
      if (data.description) params.description = data.description
      if (data.columnId) params.columnId = data.columnId
      if (data.assigneeId) params.assigneeId = data.assigneeId
      if (data.dueDate) params.dueDate = data.dueDate
      if (data.linkedListItemIds && data.linkedListItemIds.length > 0) {
        params.linkedListItemIds = data.linkedListItemIds
      }

      const result = await createTask(params)

      if (result.success && result.data) {
        toast.success('Uppgift skapad')
        onTaskCreated?.(result.data)

        if (createAnother) {
          // Keep selections, clear title and description
          reset({
            ...data,
            title: '',
            description: '',
          })
        } else {
          onOpenChange(false)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px]"
        data-testid="create-task-modal"
      >
        <DialogHeader>
          <DialogTitle>Skapa uppgift</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Title - Required */}
            <div className="space-y-2">
              <Label htmlFor="modal-title">
                Titel <span className="text-destructive">*</span>
              </Label>
              <Input
                id="modal-title"
                placeholder="Ange uppgiftens titel..."
                {...register('title')}
                disabled={isSubmitting}
              />
              {errors.title && (
                <p className="text-sm text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="modal-description">Beskrivning</Label>
              <Textarea
                id="modal-description"
                placeholder="Lägg till en beskrivning..."
                rows={3}
                {...register('description')}
                disabled={isSubmitting}
              />
            </div>

            {/* Priority and Status Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Priority */}
              <div className="space-y-2">
                <Label>Prioritet</Label>
                <Select
                  value={priority}
                  onValueChange={(value) =>
                    setValue('priority', value as CreateTaskInput['priority'])
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
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

              {/* Status/Column */}
              {columns.length > 0 && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={columnId ?? columns[0]?.id ?? ''}
                    onValueChange={(value) => setValue('columnId', value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
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
              )}
            </div>

            {/* Assignee */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ansvarig</Label>
                {currentUserId && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={handleAssignToMe}
                    disabled={isSubmitting}
                  >
                    Tilldela mig
                  </Button>
                )}
              </div>
              <Select
                value={assigneeId ?? 'unassigned'}
                onValueChange={(value) =>
                  setValue('assigneeId', value === 'unassigned' ? null : value)
                }
                disabled={isSubmitting}
              >
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>Förfallodatum</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                    disabled={isSubmitting}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
                    {dueDate
                      ? format(dueDate, 'd MMMM yyyy', { locale: sv })
                      : 'Välj datum'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ?? undefined}
                    onSelect={(date) => {
                      setValue('dueDate', date ?? null)
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
                        onClick={() => setValue('dueDate', null)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Rensa datum
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {/* Due date warning */}
              {!dueDate && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Inget förfallodatum satt</span>
                </div>
              )}
            </div>

            {/* Linked Documents */}
            <div className="space-y-2">
              <Label>Länkade dokument</Label>
              <LawLinkSelector
                value={linkedListItemIds}
                onChange={(value) => setValue('linkedListItemIds', value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Footer */}
            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2 gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="create-another-checkbox"
                  checked={createAnother}
                  onCheckedChange={(checked) =>
                    setCreateAnother(checked === true)
                  }
                  disabled={isSubmitting}
                />
                <Label
                  htmlFor="create-another-checkbox"
                  className="text-sm font-normal cursor-pointer"
                >
                  Skapa en till
                </Label>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Avbryt
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Skapa
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
