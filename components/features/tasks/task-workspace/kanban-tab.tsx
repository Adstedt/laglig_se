'use client'

/**
 * Story 6.4: Kanban Board Tab
 * Drag-and-drop Kanban board for task management
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  MessageSquare,
  Calendar,
  AlertCircle,
  Plus,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  updateTaskStatus,
  createTask,
  type TaskWithRelations,
  type TaskColumnWithCount,
} from '@/app/actions/tasks'
import { Input } from '@/components/ui/input'
import type { WorkspaceMember } from './index'
import { TaskFilters } from './task-filters'
import { toast } from 'sonner'

// ============================================================================
// Props
// ============================================================================

interface KanbanTabProps {
  initialTasks: TaskWithRelations[]
  initialColumns: TaskColumnWithCount[]
  workspaceMembers: WorkspaceMember[]
  onTaskClick?: (_taskId: string) => void
  onTaskCreated?: (_task: TaskWithRelations) => void
}

// ============================================================================
// Priority Config
// ============================================================================

const PRIORITY_COLORS = {
  LOW: 'border-l-gray-400',
  MEDIUM: 'border-l-blue-500',
  HIGH: 'border-l-orange-500',
  CRITICAL: 'border-l-red-500',
} as const

// ============================================================================
// Main Component
// ============================================================================

export function KanbanTab({
  initialTasks,
  initialColumns,
  workspaceMembers,
  onTaskClick,
  onTaskCreated,
}: KanbanTabProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [columns] = useState(initialColumns)

  // Sync local state when parent's tasks change (e.g., from modal updates)
  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])
  const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)

  // Sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Get tasks for a column
  const getColumnTasks = useCallback(
    (columnId: string) => {
      let result = tasks.filter((task) => task.column_id === columnId)

      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        result = result.filter(
          (task) =>
            task.title.toLowerCase().includes(query) ||
            task.description?.toLowerCase().includes(query)
        )
      }

      if (priorityFilter.length > 0) {
        result = result.filter((task) => priorityFilter.includes(task.priority))
      }

      if (assigneeFilter) {
        result = result.filter((task) => task.assignee_id === assigneeFilter)
      }

      return result.sort((a, b) => a.position - b.position)
    },
    [tasks, searchQuery, priorityFilter, assigneeFilter]
  )

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeTask = tasks.find((t) => t.id === active.id)
    if (!activeTask) return

    // Check if dragging over a column
    const overColumn = columns.find((c) => c.id === over.id)
    if (overColumn && activeTask.column_id !== overColumn.id) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeTask.id ? { ...t, column_id: overColumn.id } : t
        )
      )
    }

    // Check if dragging over another task
    const overTask = tasks.find((t) => t.id === over.id)
    if (overTask && activeTask.id !== overTask.id) {
      setTasks((prev) => {
        const oldIndex = prev.findIndex((t) => t.id === activeTask.id)
        const newIndex = prev.findIndex((t) => t.id === overTask.id)

        const newTasks = [...prev]
        const removed = newTasks.splice(oldIndex, 1)[0]
        if (removed) {
          newTasks.splice(newIndex, 0, {
            ...removed,
            column_id: overTask.column_id,
          })
        }

        return newTasks
      })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active } = event
    const draggedTask = tasks.find((t) => t.id === active.id)

    if (draggedTask) {
      // Calculate position within the column
      const columnTasks = tasks
        .filter((t) => t.column_id === draggedTask.column_id)
        .sort((a, b) => a.position - b.position)
      const newPosition = columnTasks.findIndex((t) => t.id === draggedTask.id)

      // Persist to server
      const result = await updateTaskStatus(
        draggedTask.id,
        draggedTask.column_id,
        newPosition >= 0 ? newPosition : 0
      )

      if (!result.success) {
        toast.error('Kunde inte flytta uppgift', {
          description: result.error,
        })
        // Revert optimistic update by restoring initial tasks
        setTasks(initialTasks)
      }
    }

    setActiveTask(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <TaskFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        assigneeFilter={assigneeFilter}
        onAssigneeFilterChange={setAssigneeFilter}
        columns={columns}
        workspaceMembers={workspaceMembers}
      />

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={getColumnTasks(column.id)}
              onTaskClick={onTaskClick}
              onTaskCreated={(newTask) => {
                // Update local state for immediate display
                setTasks((prev) => [...prev, newTask])
                // Also notify parent for cross-tab sync
                onTaskCreated?.(newTask)
              }}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} isDragging />}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ============================================================================
// Kanban Column Component
// ============================================================================

interface KanbanColumnProps {
  column: TaskColumnWithCount
  tasks: TaskWithRelations[]
  onTaskClick?: ((_taskId: string) => void) | undefined
  onTaskCreated?: ((_task: TaskWithRelations) => void) | undefined
}

function KanbanColumn({
  column,
  tasks,
  onTaskClick,
  onTaskCreated,
}: KanbanColumnProps) {
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const addTaskInputRef = useRef<HTMLInputElement>(null)

  // Focus input when adding task (ref-based for accessibility)
  useEffect(() => {
    if (isAddingTask && addTaskInputRef.current) {
      addTaskInputRef.current.focus()
    }
  }, [isAddingTask])

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || isCreating) return

    setIsCreating(true)
    const result = await createTask({
      title: newTaskTitle.trim(),
      columnId: column.id,
    })

    if (result.success && result.data) {
      toast.success('Uppgift skapad')
      setNewTaskTitle('')
      setIsAddingTask(false)
      onTaskCreated?.(result.data)
    } else {
      toast.error('Kunde inte skapa uppgift', {
        description: result.error,
      })
    }
    setIsCreating(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTask()
    } else if (e.key === 'Escape') {
      setIsAddingTask(false)
      setNewTaskTitle('')
    }
  }

  return (
    <div className="w-80 flex-shrink-0">
      <Card className="bg-muted/30">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: column.color }}
              />
              <CardTitle className="text-sm font-medium">
                {column.name}
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {tasks.length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsAddingTask(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {isAddingTask && (
            <div className="mb-2">
              <Input
                ref={addTaskInputRef}
                placeholder="Uppgiftens titel..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (!newTaskTitle.trim()) {
                    setIsAddingTask(false)
                  }
                }}
                disabled={isCreating}
                className="text-sm"
              />
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={handleAddTask}
                  disabled={!newTaskTitle.trim() || isCreating}
                >
                  {isCreating ? 'Skapar...' : 'Skapa'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingTask(false)
                    setNewTaskTitle('')
                  }}
                  disabled={isCreating}
                >
                  Avbryt
                </Button>
              </div>
            </div>
          )}
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
            id={column.id}
          >
            <div className="space-y-2 min-h-[100px]">
              {tasks.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  onTaskClick={onTaskClick}
                />
              ))}
            </div>
          </SortableContext>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// Sortable Task Card Component
// ============================================================================

function SortableTaskCard({
  task,
  onTaskClick,
}: {
  task: TaskWithRelations
  onTaskClick?: ((_taskId: string) => void) | undefined
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard
        task={task}
        isDragging={isDragging}
        onClick={() => onTaskClick?.(task.id)}
      />
    </div>
  )
}

// ============================================================================
// Task Card Component
// ============================================================================

interface TaskCardProps {
  task: TaskWithRelations
  isDragging?: boolean | undefined
  onClick?: (() => void) | undefined
}

function TaskCard({ task, isDragging, onClick }: TaskCardProps) {
  const isOverdue =
    task.due_date &&
    !task.column.is_done &&
    new Date(task.due_date) < new Date()

  return (
    <Card
      className={cn(
        'cursor-grab border-l-4 transition-shadow',
        PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS],
        isDragging && 'opacity-50 shadow-lg',
        isOverdue && 'border-l-red-500',
        onClick && 'cursor-pointer hover:shadow-md'
      )}
      onClick={(e) => {
        // Only trigger click if not dragging and not clicking a button
        if (!isDragging && !(e.target as HTMLElement).closest('button')) {
          onClick?.()
        }
      }}
    >
      <CardContent className="p-3 space-y-2">
        {/* Title */}
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm font-medium',
              isOverdue && 'text-destructive'
            )}
          >
            {task.title}
          </p>
          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Linked law */}
        {task.list_item_links[0] && (
          <Badge variant="secondary" className="text-xs">
            {task.list_item_links[0].law_list_item.document.document_number}
          </Badge>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          {/* Assignee */}
          <div className="flex items-center gap-1.5">
            {task.assignee ? (
              <Avatar className="h-5 w-5">
                {task.assignee.avatar_url && (
                  <AvatarImage
                    src={task.assignee.avatar_url}
                    alt={task.assignee.name ?? ''}
                  />
                )}
                <AvatarFallback className="text-[10px]">
                  {(task.assignee.name ?? task.assignee.email)
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <span className="text-xs text-muted-foreground">Otilldelad</span>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {task._count.comments > 0 && (
              <div className="flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" />
                {task._count.comments}
              </div>
            )}
            {task.due_date && (
              <div
                className={cn(
                  'flex items-center gap-0.5',
                  isOverdue && 'text-destructive'
                )}
              >
                {isOverdue ? (
                  <AlertCircle className="h-3 w-3" />
                ) : (
                  <Calendar className="h-3 w-3" />
                )}
                {formatDistanceToNow(new Date(task.due_date), {
                  locale: sv,
                  addSuffix: false,
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
