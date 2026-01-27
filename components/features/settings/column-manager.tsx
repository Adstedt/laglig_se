'use client'

/**
 * Story 6.5: Column Manager
 * Column list with drag-and-drop reordering, inline editing, and CRUD operations.
 * Uses optimistic updates with rollback on error.
 */

import { useState, useTransition } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SortableColumnItem } from './sortable-column-item'
import { ColumnAddDialog } from './column-add-dialog'
import { ColumnDeleteDialog } from './column-delete-dialog'
import {
  createTaskColumn,
  updateTaskColumn,
  deleteTaskColumn,
  reorderTaskColumns,
  type TaskColumnWithCount,
} from '@/app/actions/tasks'

const MAX_COLUMNS = 8

interface ColumnManagerProps {
  initialColumns: TaskColumnWithCount[]
}

export function ColumnManager({ initialColumns }: ColumnManagerProps) {
  const [columns, setColumns] = useState(initialColumns)
  const [isPending, startTransition] = useTransition()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TaskColumnWithCount | null>(
    null
  )
  const [isDeleting, setIsDeleting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Check if we can toggle is_done off (need at least one other done column)
  const canToggleIsDone = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId)
    if (!column?.is_done) return true // Can always toggle on
    const otherDoneColumns = columns.filter(
      (c) => c.id !== columnId && c.is_done
    )
    return otherDoneColumns.length > 0
  }

  // Get first column name for migration message
  const firstColumn = columns[0]
  const firstColumnName = firstColumn?.name ?? 'Att göra'

  // Handle drag end - reorder columns
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = columns.findIndex((c) => c.id === active.id)
    const newIndex = columns.findIndex((c) => c.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    // Optimistic update
    const reordered = arrayMove(columns, oldIndex, newIndex)
    const previousColumns = columns
    setColumns(reordered)

    startTransition(async () => {
      const result = await reorderTaskColumns(reordered.map((c) => c.id))
      if (!result.success) {
        // Rollback
        setColumns(previousColumns)
        toast.error(result.error ?? 'Kunde inte ändra ordning')
      }
    })
  }

  // Handle column update (name, color, is_done)
  const handleUpdate = (
    columnId: string,
    updates: { name?: string; color?: string; is_done?: boolean }
  ) => {
    const previousColumns = columns

    // Optimistic update
    setColumns((cols) =>
      cols.map((col) => (col.id === columnId ? { ...col, ...updates } : col))
    )

    startTransition(async () => {
      const result = await updateTaskColumn(columnId, updates)
      if (!result.success) {
        // Rollback
        setColumns(previousColumns)
        toast.error(result.error ?? 'Kunde inte spara')
      }
    })
  }

  // Handle column create
  const handleCreate = async (name: string, color: string) => {
    setIsCreating(true)

    // Create temp column for optimistic update
    const tempColumn: TaskColumnWithCount = {
      id: `temp-${Date.now()}`,
      name,
      color,
      position: columns.length,
      is_default: false,
      is_done: false,
      workspace_id: '',
      created_at: new Date(),
      updated_at: new Date(),
      _count: { tasks: 0 },
    }

    const previousColumns = columns
    setColumns((cols) => [...cols, tempColumn])
    setShowAddDialog(false)

    const result = await createTaskColumn(name, color)
    setIsCreating(false)

    if (result.success && result.data) {
      // Replace temp with real column
      setColumns((cols) =>
        cols.map((col) => (col.id === tempColumn.id ? result.data! : col))
      )
      toast.success('Kolumn skapad')
    } else {
      // Rollback
      setColumns(previousColumns)
      toast.error(result.error ?? 'Kunde inte skapa kolumn')
    }
  }

  // Handle column delete
  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    const previousColumns = columns

    // Optimistic update - remove from list
    setColumns((cols) => cols.filter((col) => col.id !== deleteTarget.id))
    setDeleteTarget(null)

    const result = await deleteTaskColumn(deleteTarget.id)
    setIsDeleting(false)

    if (result.success) {
      toast.success(
        result.data?.migratedCount
          ? `Kolumn raderad. ${result.data.migratedCount} uppgift${result.data.migratedCount !== 1 ? 'er' : ''} flyttades.`
          : 'Kolumn raderad'
      )
    } else {
      // Rollback
      setColumns(previousColumns)
      toast.error(result.error ?? 'Kunde inte radera')
    }
  }

  const isAtMaxColumns = columns.length >= MAX_COLUMNS

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>Anpassa kolumner</CardTitle>
          <CardDescription>
            Hantera kolumnerna i din Kanban-tavla. Dra för att ändra ordning.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {columns.map((column) => (
                  <SortableColumnItem
                    key={column.id}
                    column={column}
                    onUpdate={handleUpdate}
                    onDelete={setDeleteTarget}
                    isPending={isPending}
                    canToggleIsDone={canToggleIsDone(column.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add column button */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddDialog(true)}
              disabled={isAtMaxColumns || isPending}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Ny kolumn
            </Button>
            <span className="text-sm text-muted-foreground">
              {columns.length} av {MAX_COLUMNS} kolumner används
            </span>
          </div>

          {isAtMaxColumns && (
            <p className="text-sm text-muted-foreground">
              Max antal kolumner nått. Radera en kolumn för att lägga till fler.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add column dialog */}
      <ColumnAddDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onConfirm={handleCreate}
        isCreating={isCreating}
      />

      {/* Delete confirmation dialog */}
      <ColumnDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        columnName={deleteTarget?.name ?? ''}
        taskCount={deleteTarget?._count.tasks ?? 0}
        targetColumnName={firstColumnName}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </TooltipProvider>
  )
}

// Loading skeleton
export function ColumnManagerSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
