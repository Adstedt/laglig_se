'use client'

/**
 * Story 6.7: Task Creation Form Component
 * Reusable form with quick/full modes for task creation
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
import { createTask, type TaskWithRelations } from '@/app/actions/tasks'
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

export interface WorkspaceMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

export interface TaskColumn {
  id: string
  name: string
  color: string
}

interface TaskCreationFormProps {
  mode: 'quick' | 'full'
  linkedListItemId?: string
  onSuccess: (_task: TaskWithRelations) => void
  onCancel: () => void
  workspaceMembers?: WorkspaceMember[]
  columns?: TaskColumn[]
  currentUserId?: string
  className?: string
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

export function TaskCreationForm({
  mode,
  linkedListItemId,
  onSuccess,
  onCancel,
  workspaceMembers = [],
  columns = [],
  currentUserId,
  className,
}: TaskCreationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  const form = useForm({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM' as const,
      assigneeId: null as string | null,
      dueDate: null as Date | null,
      columnId: columns[0]?.id as string | undefined,
      linkedListItemIds: linkedListItemId
        ? [linkedListItemId]
        : ([] as string[]),
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form

  const dueDate = watch('dueDate')
  const assigneeId = watch('assigneeId')
  const priority = watch('priority')
  const columnId = watch('columnId')
  const linkedListItemIds = watch('linkedListItemIds') ?? []

  // Set default column when columns are loaded
  useEffect(() => {
    if (columns.length > 0 && !columnId) {
      setValue('columnId', columns[0]?.id)
    }
  }, [columns, columnId, setValue])

  const selectedAssignee = workspaceMembers.find((m) => m.id === assigneeId)

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
        onSuccess(result.data)
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
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn('space-y-4', className)}
    >
      {/* Title - Required */}
      <div className="space-y-2">
        <Label htmlFor="title">
          Titel <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          placeholder="Ange uppgiftens titel..."
          {...register('title')}
          disabled={isSubmitting}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      {/* Description - Optional */}
      <div className="space-y-2">
        <Label htmlFor="description">Beskrivning</Label>
        <Textarea
          id="description"
          placeholder="Lägg till en beskrivning..."
          rows={mode === 'quick' ? 2 : 3}
          {...register('description')}
          disabled={isSubmitting}
        />
      </div>

      {/* Full mode: Priority and Status/Column */}
      {mode === 'full' && (
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
      )}

      {/* Assignee with "Tilldela mig" */}
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
            {workspaceMembers.map((member) => (
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

      {/* Due Date with warning */}
      <div className="space-y-2">
        <Label>Förfallodatum</Label>
        <div className="flex items-center gap-2">
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'flex-1 justify-start text-left font-normal',
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
        </div>
        {/* Due date warning */}
        {!dueDate && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Inget förfallodatum satt</span>
          </div>
        )}
      </div>

      {/* Full mode: Linked Documents */}
      {mode === 'full' && (
        <div className="space-y-2">
          <Label>Länkade dokument</Label>
          <LawLinkSelector
            value={linkedListItemIds}
            onChange={(value) => setValue('linkedListItemIds', value)}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Quick mode: Show pre-linked law indicator */}
      {mode === 'quick' && linkedListItemId && (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          data-testid="linked-law-badge"
        >
          <span className="bg-muted px-2 py-1 rounded text-xs">
            Länkas till aktuell lag
          </span>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Avbryt
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Skapa
        </Button>
      </div>
    </form>
  )
}

// Export the form reset function for use in parent components
export { type CreateTaskInput }
