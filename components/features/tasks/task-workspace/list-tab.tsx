'use client'

/**
 * Story 6.4 / 6.19 → migrated in Story 28.6 (Epic 28) onto the unified
 * DataTable core. Column definitions + adapter mapping + inline-edit
 * orchestration only; table mechanics (client sorting, selection, column
 * reorder/resize with clamp, 56px virtualization, sticky header, row-click
 * guard, the narrow-container card renderer) live in
 * components/ui/data-table.
 *
 * Changes vs legacy, per the story ACs:
 *  - The non-functional dragHandle placeholder column is REMOVED.
 *  - The select column is injected by the core (Set-based adapter).
 *  - The inverted dueDate/priority min/max resize bounds are FIXED.
 */

import { useState, useMemo, useCallback } from 'react'
import type {
  ColumnDef,
  SortingState,
  VisibilityState,
  ColumnSizingState,
  ColumnOrderState,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  MessageSquare,
  ListTodo,
  Plus,
  Trash2,
  UserPlus,
  Flag,
  SquareCheckBig,
  AlertCircle,
} from 'lucide-react'
import { DataTable } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { isTaskOverdue } from '@/lib/utils/task-utils'
import { SortableHeader } from '@/components/ui/sortable-header'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  updateTasksBulk,
  deleteTasksBulk,
  deleteTask,
  type TaskWithRelations,
  type TaskColumnWithCount,
} from '@/app/actions/tasks'
import {
  updateTaskStatusColumn,
  updateTaskAssignee,
  updateTaskDueDate,
  updateTaskPriority,
} from '@/app/actions/task-modal'
import type { TaskPriority } from '@prisma/client'
import type { WorkspaceMember } from './index'
import { TaskStatusEditor } from './task-status-editor'
import {
  PriorityEditor,
  type PriorityOption,
} from '@/components/features/document-list/table-cell-editors/priority-editor'
import { DueDateEditor } from '@/components/features/document-list/table-cell-editors/due-date-editor'
import { AssigneeEditor } from '@/components/features/document-list/table-cell-editors/assignee-editor'
import { BulkActionBar } from './bulk-action-bar'
import { TaskDeleteDialog } from '../task-delete-dialog'
import { toast } from 'sonner'

function stripHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').trim()
}

// Story 22.1: shape aligned with the canonical PriorityEditor (Laglistor +
// Uppgifter share one editor + one tone-aware Badge render). Labels match
// the badge-tones map ("Medel" replaces the legacy "Medium" leak the audit
// flagged on Uppgifter).
const TASK_PRIORITY_OPTIONS: PriorityOption[] = [
  { value: 'LOW', label: 'Låg' },
  { value: 'MEDIUM', label: 'Medel' },
  { value: 'HIGH', label: 'Hög' },
  { value: 'CRITICAL', label: 'Kritisk' },
]

interface ListTabProps {
  filteredTasks: TaskWithRelations[]
  /** Total unfiltered task count — used to distinguish truly-empty from filtered-empty in the empty state. */
  totalTasks: number
  columns: TaskColumnWithCount[]
  workspaceMembers: WorkspaceMember[]
  // Column state from Zustand store
  columnSizing: ColumnSizingState
  onColumnSizingChange: (_sizing: ColumnSizingState) => void
  columnVisibility: VisibilityState
  columnOrder: ColumnOrderState
  onColumnOrderChange: (_order: ColumnOrderState) => void
  sorting: SortingState
  onSortingChange: (_sorting: SortingState) => void
  // Callbacks
  onTaskClick?: (_taskId: string) => void
  onTaskUpdate: (_taskId: string, _updates: Partial<TaskWithRelations>) => void
  onTasksDelete: (_taskIds: string[]) => void
  onCreateTask: () => void
}

export function ListTab({
  filteredTasks,
  totalTasks,
  columns: taskColumns,
  workspaceMembers,
  columnSizing,
  onColumnSizingChange,
  columnVisibility,
  columnOrder,
  onColumnOrderChange,
  sorting,
  onSortingChange,
  onTaskClick,
  onTaskUpdate,
  onTasksDelete,
  onCreateTask,
}: ListTabProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const isOverdue = useCallback(
    (task: TaskWithRelations) => isTaskOverdue(task),
    []
  )

  // Map workspace members to WorkspaceMemberOption shape for AssigneeEditor
  const memberOptions = useMemo(
    () =>
      workspaceMembers.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        avatarUrl: m.avatarUrl,
      })),
    [workspaceMembers]
  )

  // ---- Inline edit handlers (optimistic via parent + rollback on error) ----

  const handleStatusChange = useCallback(
    async (taskId: string, task: TaskWithRelations, newColumnId: string) => {
      const previousColumn = task.column
      const newColumn = taskColumns.find((c) => c.id === newColumnId)
      if (!newColumn) return

      onTaskUpdate(taskId, {
        column_id: newColumnId,
        column: {
          id: newColumn.id,
          name: newColumn.name,
          color: newColumn.color,
          is_done: newColumn.is_done,
        },
      })

      const result = await updateTaskStatusColumn(taskId, newColumnId)
      if (!result.success) {
        onTaskUpdate(taskId, {
          column_id: previousColumn.id,
          column: previousColumn,
        })
        toast.error('Kunde inte uppdatera status', {
          description: result.error,
        })
      }
    },
    [taskColumns, onTaskUpdate]
  )

  const handlePriorityChange = useCallback(
    async (taskId: string, previousPriority: string, newPriority: string) => {
      onTaskUpdate(taskId, { priority: newPriority as TaskPriority })

      const result = await updateTaskPriority(
        taskId,
        newPriority as TaskPriority
      )
      if (!result.success) {
        onTaskUpdate(taskId, { priority: previousPriority as TaskPriority })
        toast.error('Kunde inte uppdatera prioritet', {
          description: result.error,
        })
      }
    },
    [onTaskUpdate]
  )

  const handleDueDateChange = useCallback(
    async (taskId: string, previousDate: Date | null, newDate: Date | null) => {
      onTaskUpdate(taskId, { due_date: newDate })

      const result = await updateTaskDueDate(taskId, newDate)
      if (!result.success) {
        onTaskUpdate(taskId, { due_date: previousDate })
        toast.error('Kunde inte uppdatera datum', {
          description: result.error,
        })
      }
    },
    [onTaskUpdate]
  )

  const handleAssigneeChange = useCallback(
    async (
      taskId: string,
      previousAssigneeId: string | null,
      newAssigneeId: string | null
    ) => {
      const newAssignee = newAssigneeId
        ? workspaceMembers.find((m) => m.id === newAssigneeId)
        : null

      onTaskUpdate(taskId, {
        assignee_id: newAssigneeId,
        assignee: newAssignee
          ? {
              id: newAssignee.id,
              name: newAssignee.name,
              email: newAssignee.email,
              avatar_url: newAssignee.avatarUrl,
            }
          : null,
      })

      const result = await updateTaskAssignee(taskId, newAssigneeId)
      if (!result.success) {
        const prevAssignee = previousAssigneeId
          ? workspaceMembers.find((m) => m.id === previousAssigneeId)
          : null
        onTaskUpdate(taskId, {
          assignee_id: previousAssigneeId,
          assignee: prevAssignee
            ? {
                id: prevAssignee.id,
                name: prevAssignee.name,
                email: prevAssignee.email,
                avatar_url: prevAssignee.avatarUrl,
              }
            : null,
        })
        toast.error('Kunde inte uppdatera ansvarig', {
          description: result.error,
        })
      }
    },
    [workspaceMembers, onTaskUpdate]
  )

  // ---- Column definitions (select column injected by the core) ----

  const columns: ColumnDef<TaskWithRelations, unknown>[] = useMemo(
    () => [
      // Type icon
      {
        id: 'type',
        header: 'Typ',
        cell: () => (
          <div className="flex items-center justify-center">
            <div
              className="flex items-center justify-center w-8 h-8 rounded bg-blue-50 text-blue-600"
              title="Uppgift"
            >
              <SquareCheckBig className="h-4 w-4" />
            </div>
          </div>
        ),
        enableSorting: false,
        enableResizing: false,
        size: 72,
        minSize: 72,
        maxSize: 72,
        meta: {
          dt: {
            label: 'Typ',
            pinned: 'left',
            padding: 'tight',
            mandatory: true,
            card: { role: 'hidden' },
          },
        },
      },
      // Title
      {
        id: 'title',
        accessorKey: 'title',
        header: ({ column }) => (
          <SortableHeader column={column} label="Uppgift" />
        ),
        cell: ({ row }) => {
          const task = row.original
          const overdue = isOverdue(task)
          return (
            <div className="w-full overflow-hidden">
              <span
                className={cn(
                  'text-sm font-medium block truncate',
                  overdue && 'text-destructive inline-flex items-center gap-1.5'
                )}
              >
                {overdue && (
                  <AlertCircle
                    className="h-3.5 w-3.5 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                )}
                {task.title}
              </span>
              {task.list_item_links.length > 0 && (
                <span className="text-xs text-muted-foreground block truncate">
                  {[
                    ...new Set(
                      task.list_item_links.map(
                        (link) => link.law_list_item.document.document_number
                      )
                    ),
                  ].join(' · ')}
                </span>
              )}
            </div>
          )
        },
        size: 300,
        minSize: 150,
        maxSize: 600,
        meta: {
          dt: { label: 'Uppgift', fill: true, card: { role: 'title' } },
        },
      },
      // Description (truncated with tooltip)
      {
        id: 'description',
        accessorKey: 'description',
        header: ({ column }) => (
          <SortableHeader column={column} label="Beskrivning" />
        ),
        cell: ({ row }) => {
          const text = stripHtml(row.original.description)
          if (!text) {
            return <span className="text-sm text-muted-foreground">—</span>
          }
          return (
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="line-clamp-2 text-sm text-foreground cursor-help">
                    {text}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  className="max-w-[400px] max-h-[300px] overflow-y-auto p-4"
                >
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Beskrivning</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {text}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        },
        size: 240,
        minSize: 150,
        maxSize: 500,
        meta: {
          dt: {
            label: 'Beskrivning',
            card: {
              role: 'meta',
              priority: 2,
              cardLabel: null,
              // Skip the row when there is no description.
              renderCard: (row) => {
                const text = stripHtml(row.original.description)
                if (!text) return null
                return (
                  <span className="line-clamp-2 text-sm text-muted-foreground">
                    {text}
                  </span>
                )
              },
            },
          },
        },
      },
      // Status column (inline editor)
      {
        id: 'columnName',
        accessorFn: (row) => row.column.name,
        header: ({ column }) => (
          <SortableHeader column={column} label="Status" />
        ),
        cell: ({ row }) => {
          const task = row.original
          return (
            <TaskStatusEditor
              value={task.column_id}
              columns={taskColumns}
              onChange={async (columnId) => {
                await handleStatusChange(task.id, task, columnId)
              }}
            />
          )
        },
        size: 120,
        minSize: 80,
        maxSize: 200,
        meta: {
          dt: {
            label: 'Status',
            card: { role: 'badge', priority: 0, interactive: true },
          },
        },
      },
      // Comments count
      {
        id: 'comments',
        accessorFn: (row) => row._count.comments,
        header: () => <MessageSquare className="h-4 w-4" />,
        cell: ({ row }) => {
          const count = row.original._count.comments
          if (count === 0) return null
          return (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="text-xs">{count}</span>
            </div>
          )
        },
        enableResizing: false,
        enableSorting: false,
        size: 60,
        minSize: 60,
        maxSize: 60,
        meta: {
          dt: {
            label: 'Kommentarer',
            card: {
              role: 'footer',
              renderCard: (row) => {
                const count = row.original._count.comments
                if (count === 0) return null
                return (
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {count}
                  </span>
                )
              },
            },
          },
        },
      },
      // Assignee (inline editor)
      {
        id: 'assignee',
        accessorFn: (row) => row.assignee?.name ?? row.assignee?.email ?? '',
        header: 'Ansvarig',
        cell: ({ row }) => {
          const task = row.original
          return (
            <AssigneeEditor
              value={task.assignee_id}
              members={memberOptions}
              onChange={async (newAssigneeId) => {
                await handleAssigneeChange(
                  task.id,
                  task.assignee_id,
                  newAssigneeId
                )
              }}
            />
          )
        },
        enableSorting: false,
        size: 150,
        minSize: 105,
        maxSize: 250,
        meta: {
          dt: {
            label: 'Ansvarig',
            card: {
              role: 'meta',
              priority: 3,
              interactive: true,
              renderCard: (row) => {
                const task = row.original
                const member = workspaceMembers.find(
                  (m) => m.id === task.assignee_id
                )
                return (
                  <span className="inline-flex items-center gap-2">
                    <AssigneeEditor
                      value={task.assignee_id}
                      members={memberOptions}
                      onChange={async (newAssigneeId) => {
                        await handleAssigneeChange(
                          task.id,
                          task.assignee_id,
                          newAssigneeId
                        )
                      }}
                    />
                    <span
                      className={cn(
                        'truncate text-sm',
                        !member && 'text-muted-foreground'
                      )}
                    >
                      {member?.name ?? member?.email ?? 'Ej tilldelad'}
                    </span>
                  </span>
                )
              },
            },
          },
        },
      },
      // Due date (inline editor). 28.6 AC: legacy bounds were inverted
      // (size 140 < minSize 160) — fixed to a sane 120–200 range.
      {
        id: 'dueDate',
        accessorKey: 'due_date',
        header: ({ column }) => (
          <SortableHeader column={column} label="Förfallodatum" />
        ),
        cell: ({ row }) => {
          const task = row.original
          return (
            <DueDateEditor
              value={task.due_date ? new Date(task.due_date) : null}
              onChange={async (newDate) => {
                await handleDueDateChange(task.id, task.due_date, newDate)
              }}
            />
          )
        },
        size: 160,
        minSize: 120,
        maxSize: 200,
        meta: {
          dt: {
            label: 'Förfallodatum',
            card: { role: 'meta', priority: 4, interactive: true },
          },
        },
      },
      // Priority (inline editor). 28.6 AC: legacy bounds were inverted
      // (size 100 < minSize 130) — fixed to a sane 100–150 range.
      {
        id: 'priority',
        accessorKey: 'priority',
        header: ({ column }) => (
          <SortableHeader column={column} label="Prioritet" />
        ),
        cell: ({ row }) => {
          const task = row.original
          return (
            <PriorityEditor
              value={task.priority}
              options={TASK_PRIORITY_OPTIONS}
              onChange={async (newPriority) => {
                await handlePriorityChange(task.id, task.priority, newPriority)
              }}
            />
          )
        },
        size: 130,
        minSize: 100,
        maxSize: 150,
        meta: {
          dt: {
            label: 'Prioritet',
            card: { role: 'badge', priority: 1, interactive: true },
          },
        },
      },
      // Created date
      {
        id: 'createdAt',
        accessorKey: 'created_at',
        header: ({ column }) => (
          <SortableHeader column={column} label="Skapad" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.created_at).toLocaleDateString('sv-SE')}
          </span>
        ),
        size: 100,
        minSize: 80,
        maxSize: 150,
        meta: {
          dt: { label: 'Skapad', card: { role: 'footer' } },
        },
      },
      // Actions
      {
        id: 'actions',
        header: () => null,
        cell: ({ row }) => (
          <TaskRowActions task={row.original} onTasksDelete={onTasksDelete} />
        ),
        enableSorting: false,
        enableResizing: false,
        size: 50,
        minSize: 50,
        maxSize: 50,
        meta: {
          dt: {
            label: 'Åtgärder',
            pinned: 'right',
            padding: 'tight',
            mandatory: true,
            card: { role: 'hidden' },
          },
        },
      },
    ],
    [
      isOverdue,
      taskColumns,
      memberOptions,
      workspaceMembers,
      handleStatusChange,
      handlePriorityChange,
      handleDueDateChange,
      handleAssigneeChange,
      onTasksDelete,
    ]
  )

  // ---- Bulk actions (optimistic via parent callbacks) ----

  const selectedItemIds = useMemo(() => [...selected], [selected])

  const handleClearSelection = useCallback(() => setSelected(new Set()), [])

  const handleBulkUpdate = async (updates: {
    columnId?: string
    assigneeId?: string | null
    priority?: string
  }) => {
    if (selectedItemIds.length === 0) return

    const bulkUpdates: {
      columnId?: string
      assigneeId?: string | null
      priority?: TaskPriority
    } = {}

    if (updates.columnId !== undefined) bulkUpdates.columnId = updates.columnId
    if (updates.assigneeId !== undefined) {
      bulkUpdates.assigneeId = updates.assigneeId
    }
    if (updates.priority !== undefined) {
      bulkUpdates.priority = updates.priority as TaskPriority
    }

    for (const taskId of selectedItemIds) {
      const task = filteredTasks.find((t) => t.id === taskId)
      if (!task) continue
      const taskUpdates: Partial<TaskWithRelations> = {}
      if (updates.columnId) {
        const col = taskColumns.find((c) => c.id === updates.columnId)
        if (col) {
          taskUpdates.column_id = updates.columnId
          taskUpdates.column = {
            id: col.id,
            name: col.name,
            color: col.color,
            is_done: col.is_done,
          }
        }
      }
      if (updates.assigneeId !== undefined) {
        taskUpdates.assignee_id = updates.assigneeId
      }
      if (updates.priority) {
        taskUpdates.priority = updates.priority as TaskPriority
      }
      onTaskUpdate(taskId, taskUpdates)
    }
    setSelected(new Set())

    const result = await updateTasksBulk(selectedItemIds, bulkUpdates)

    if (result.success) {
      toast.success(`${selectedItemIds.length} uppgifter uppdaterade`)
    } else {
      toast.error('Kunde inte uppdatera uppgifter', {
        description: result.error,
      })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedItemIds.length === 0) return
    const deletedIds = [...selectedItemIds]

    onTasksDelete(deletedIds)
    setSelected(new Set())

    const result = await deleteTasksBulk(deletedIds)

    if (result.success) {
      toast.success(`${deletedIds.length} uppgifter raderade`)
    } else {
      toast.error('Kunde inte radera uppgifter', {
        description: result.error,
      })
    }
  }

  // Empty state — distinguish truly-empty (no tasks at all in the workspace)
  // from filtered-empty (workspace has tasks but current filters return zero).
  if (filteredTasks.length === 0) {
    if (totalTasks === 0) {
      return (
        <EmptyState
          icon={
            <EmptyState.Icon>
              <ListTodo className="h-8 w-8 text-muted-foreground" />
            </EmptyState.Icon>
          }
          title="Inga uppgifter ännu"
          description="Skapa en uppgift för att börja planera och spåra arbetet med er efterlevnad."
          action={
            <Button onClick={onCreateTask}>
              <Plus className="mr-2 h-4 w-4" />
              Ny uppgift
            </Button>
          }
        />
      )
    }
    return (
      <EmptyState
        icon={
          <EmptyState.Icon>
            <ListTodo className="h-8 w-8 text-muted-foreground" />
          </EmptyState.Icon>
        }
        title="Inga uppgifter matchar"
        description="Justera dina filter eller skapa en ny uppgift"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {selectedItemIds.length > 0 && (
        <BulkActionBar
          selectedCount={selectedItemIds.length}
          onClearSelection={handleClearSelection}
          onBulkUpdate={handleBulkUpdate}
          onBulkDelete={handleBulkDelete}
          columns={taskColumns}
          workspaceMembers={workspaceMembers}
        />
      )}

      <DataTable<TaskWithRelations>
        data={filteredTasks}
        columns={columns}
        getRowId={(row) => row.id}
        sorting={{
          sorting,
          // Store setters take plain values; adapters speak TanStack
          // updaters — resolve here.
          onSortingChange: (updater) =>
            onSortingChange(
              typeof updater === 'function' ? updater(sorting) : updater
            ),
        }}
        selection={{ selected, onSelectedChange: setSelected }}
        columnState={{
          visibility: columnVisibility,
          sizing: columnSizing,
          onSizingChange: (updater) =>
            onColumnSizingChange(
              typeof updater === 'function' ? updater(columnSizing) : updater
            ),
          order: columnOrder,
          onOrderChange: (updater) =>
            onColumnOrderChange(
              typeof updater === 'function' ? updater(columnOrder) : updater
            ),
        }}
        rowInteraction={
          onTaskClick ? { onRowClick: (row) => onTaskClick(row.id) } : {}
        }
        virtualization={{ estimateRowHeight: 56 }}
        // Two tiers (matches krav/styrdokument): full table with horizontal
        // scroll down to 800px container, cards below.
        view={{ cardBelow: 800 }}
      />
    </div>
  )
}

// ============================================================================
// Row actions dropdown (kebab) — also the card kebab via cardActions later
// ============================================================================

function TaskRowActions({
  task,
  onTasksDelete,
}: {
  task: TaskWithRelations
  onTasksDelete: (_taskIds: string[]) => void
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    // Optimistic delete via parent
    onTasksDelete([task.id])

    const result = await deleteTask(task.id)
    if (result.success) {
      toast.success('Uppgift raderad')
    } else {
      toast.error('Kunde inte radera uppgift', {
        description: result.error,
      })
    }
    setIsDeleting(false)
    setDeleteDialogOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <UserPlus className="mr-2 h-4 w-4" />
            Tilldela
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Flag className="mr-2 h-4 w-4" />
            Ändra prioritet
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Ta bort
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TaskDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        taskTitle={task.title}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </>
  )
}
