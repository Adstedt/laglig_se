'use client'

/**
 * Story 6.4: Task List View Tab
 * Story 6.19: Refactored for UX parity with law list table
 *   - Column resizing with persistence
 *   - Inline cell editors (status, priority, due date, assignee)
 *   - table-fixed layout with resize handles
 *   - Filter state lifted to parent (receives filteredTasks)
 *
 * Story P.4: Added virtualization for large datasets (>100 items)
 */

import { useState, useMemo, useCallback, useRef, memo } from 'react'
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type VisibilityState,
  type ColumnSizingState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
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
  Trash2,
  UserPlus,
  Flag,
  GripVertical,
  SquareCheckBig,
} from 'lucide-react'
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
import { toast } from 'sonner'

// ============================================================================
// Story P.4: Virtualization Configuration
// ============================================================================

function stripHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').trim()
}

const VIRTUALIZATION_THRESHOLD = 100
const ESTIMATED_ROW_HEIGHT = 56
const OVERSCAN_COUNT = 5
const VIRTUAL_TABLE_MAX_HEIGHT = 600

// ============================================================================
// Task Priority Options (4 levels, matching task schema)
// ============================================================================

const TASK_PRIORITY_OPTIONS: PriorityOption[] = [
  { value: 'LOW', label: 'Låg', color: 'bg-gray-100 text-gray-700' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'HIGH', label: 'Hög', color: 'bg-orange-100 text-orange-700' },
  {
    value: 'CRITICAL',
    label: 'Kritisk',
    color: 'bg-red-100 text-red-700',
  },
]

// ============================================================================
// Props
// ============================================================================

interface ListTabProps {
  filteredTasks: TaskWithRelations[]
  columns: TaskColumnWithCount[]
  workspaceMembers: WorkspaceMember[]
  // Column state from Zustand store
  columnSizing: ColumnSizingState
  onColumnSizingChange: (_sizing: ColumnSizingState) => void
  columnVisibility: VisibilityState
  sorting: SortingState
  onSortingChange: (_sorting: SortingState) => void
  // Callbacks
  onTaskClick?: (_taskId: string) => void
  onTaskUpdate: (_taskId: string, _updates: Partial<TaskWithRelations>) => void
  onTasksDelete: (_taskIds: string[]) => void
}

// ============================================================================
// Main Component
// ============================================================================

export function ListTab({
  filteredTasks,
  columns: taskColumns,
  workspaceMembers,
  columnSizing,
  onColumnSizingChange,
  columnVisibility,
  sorting,
  onSortingChange,
  onTaskClick,
  onTaskUpdate,
  onTasksDelete,
}: ListTabProps) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Story P.4: Virtualization state
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // Check if task is overdue
  const isOverdue = useCallback((task: TaskWithRelations) => {
    if (!task.due_date || task.column.is_done) return false
    return new Date(task.due_date) < new Date()
  }, [])

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

  // ---- Inline edit handlers ----

  const handleStatusChange = useCallback(
    async (taskId: string, task: TaskWithRelations, newColumnId: string) => {
      const previousColumn = task.column
      const newColumn = taskColumns.find((c) => c.id === newColumnId)
      if (!newColumn) return

      // Optimistic update
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
        // Rollback
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
      // Optimistic update
      onTaskUpdate(taskId, { priority: newPriority as TaskPriority })

      const result = await updateTaskPriority(
        taskId,
        newPriority as TaskPriority
      )
      if (!result.success) {
        // Rollback
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
      // Optimistic update
      onTaskUpdate(taskId, { due_date: newDate })

      const result = await updateTaskDueDate(taskId, newDate)
      if (!result.success) {
        // Rollback
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

      // Optimistic update
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
        // Rollback
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

  // ---- Column definitions with inline editors ----

  const columns: ColumnDef<TaskWithRelations>[] = useMemo(
    () => [
      // Select checkbox
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? 'indeterminate'
                  : false
            }
            onCheckedChange={(value: boolean) =>
              table.toggleAllPageRowsSelected(value)
            }
            aria-label="Välj alla"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value: boolean) => row.toggleSelected(value)}
            aria-label="Välj rad"
          />
        ),
        enableSorting: false,
        enableResizing: false,
        size: 40,
        minSize: 40,
        maxSize: 40,
      },
      // Drag handle (visual placeholder — reorder not yet implemented)
      {
        id: 'dragHandle',
        header: '',
        cell: () => (
          <div className="p-1 text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </div>
        ),
        enableSorting: false,
        enableResizing: false,
        size: 40,
        minSize: 40,
        maxSize: 40,
      },
      // Type icon
      {
        id: 'type',
        header: 'Typ',
        cell: () => (
          <div
            className="inline-flex items-center justify-center w-8 h-8 rounded bg-blue-50 text-blue-600"
            title="Uppgift"
          >
            <SquareCheckBig className="h-4 w-4" />
          </div>
        ),
        enableSorting: false,
        enableResizing: false,
        size: 60,
        minSize: 60,
        maxSize: 60,
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
                  overdue && 'text-destructive'
                )}
              >
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
        size: 60,
        minSize: 60,
        maxSize: 60,
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
      },
      // Due date (inline editor)
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
        size: 140,
        minSize: 160,
        maxSize: 200,
      },
      // Priority (inline editor)
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
        size: 100,
        minSize: 130,
        maxSize: 150,
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
      },
      // Actions
      {
        id: 'actions',
        header: '',
        cell: ({ row: _row }) => (
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
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Ta bort
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
        enableResizing: false,
        size: 50,
        minSize: 50,
        maxSize: 50,
      },
    ],
    [
      isOverdue,
      taskColumns,
      memberOptions,
      handleStatusChange,
      handlePriorityChange,
      handleDueDateChange,
      handleAssigneeChange,
    ]
  )

  // ---- Column sizing change handler ----

  const handleColumnSizingChange = useCallback(
    (
      updater:
        | ColumnSizingState
        | ((_old: ColumnSizingState) => ColumnSizingState)
    ) => {
      const newSizing =
        typeof updater === 'function' ? updater(columnSizing) : updater
      onColumnSizingChange(newSizing)
    },
    [columnSizing, onColumnSizingChange]
  )

  // ---- Table instance with column resizing ----

  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: {
      sorting,
      rowSelection,
      columnVisibility,
      columnSizing,
    },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === 'function' ? updater(sorting) : updater
      onSortingChange(newSorting)
    },
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: handleColumnSizingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: 'onEnd',
  })

  // Helper to get column width with live resize preview
  const { columnSizingInfo } = table.getState()
  const getColumnWidth = (headerId: string, defaultSize: number) => {
    if (columnSizingInfo.isResizingColumn === headerId) {
      const column = table.getColumn(headerId)
      const minSize = column?.columnDef.minSize ?? 0
      const maxSize = column?.columnDef.maxSize ?? Infinity
      const newSize =
        (columnSizingInfo.startSize ?? defaultSize) +
        (columnSizingInfo.deltaOffset ?? 0)
      return Math.max(minSize, Math.min(maxSize, newSize))
    }
    return defaultSize
  }

  // Story P.4: Row virtualizer for large datasets
  const rows = table.getRowModel().rows
  const shouldVirtualize = rows.length > VIRTUALIZATION_THRESHOLD
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
    enabled: shouldVirtualize,
  })

  // Selected item IDs
  const selectedItemIds = Object.keys(rowSelection).filter(
    (id) => rowSelection[id]
  )

  // Clear selection
  const handleClearSelection = () => setRowSelection({})

  // Handle bulk update (optimistic via parent callbacks)
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

    if (updates.columnId !== undefined) {
      bulkUpdates.columnId = updates.columnId
    }
    if (updates.assigneeId !== undefined) {
      bulkUpdates.assigneeId = updates.assigneeId
    }
    if (updates.priority !== undefined) {
      bulkUpdates.priority = updates.priority as TaskPriority
    }

    // Optimistic updates via parent
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
    setRowSelection({})

    const result = await updateTasksBulk(selectedItemIds, bulkUpdates)

    if (result.success) {
      toast.success(`${selectedItemIds.length} uppgifter uppdaterade`)
    } else {
      toast.error('Kunde inte uppdatera uppgifter', {
        description: result.error,
      })
    }
  }

  // Handle bulk delete (optimistic via parent callback)
  const handleBulkDelete = async () => {
    if (selectedItemIds.length === 0) return
    const deletedIds = [...selectedItemIds]

    // Optimistic delete via parent
    onTasksDelete(deletedIds)
    setRowSelection({})

    const result = await deleteTasksBulk(deletedIds)

    if (result.success) {
      toast.success(`${deletedIds.length} uppgifter raderade`)
    } else {
      toast.error('Kunde inte radera uppgifter', {
        description: result.error,
      })
    }
  }

  // Empty state
  if (filteredTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="rounded-full bg-muted p-4">
          <ListTodo className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium">Inga uppgifter matchar</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Justera dina filter eller skapa en ny uppgift
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bulk action bar */}
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

      {/* Table with column resizing */}
      <div
        ref={tableContainerRef}
        className={cn(
          'rounded-md border overflow-x-auto',
          shouldVirtualize && 'overflow-y-auto'
        )}
        style={
          shouldVirtualize ? { maxHeight: VIRTUAL_TABLE_MAX_HEIGHT } : undefined
        }
      >
        <Table className="table-fixed">
          <TableHeader
            className={
              shouldVirtualize ? 'sticky top-0 z-20 bg-background' : undefined
            }
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{
                      width: getColumnWidth(header.id, header.getSize()),
                    }}
                    className={cn(
                      'relative',
                      header.id === 'title' && 'bg-background'
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {/* Resize handle */}
                    {header.column.getCanResize() && (
                      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          'absolute right-0 top-0 h-full w-4 cursor-col-resize select-none touch-none group/resize',
                          'flex items-center justify-center'
                        )}
                      >
                        <div
                          className={cn(
                            'h-4 w-0.5 rounded-full bg-border transition-colors',
                            'group-hover/resize:bg-primary group-hover/resize:h-6',
                            header.column.getIsResizing() && 'bg-primary h-6'
                          )}
                        />
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
            style={
              shouldVirtualize
                ? {
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    position: 'relative',
                  }
                : undefined
            }
          >
            {rows.length > 0 ? (
              shouldVirtualize ? (
                rowVirtualizer.getVirtualItems().map((virtualItem) => {
                  const row = rows[virtualItem.index]
                  if (!row) return null
                  return (
                    <VirtualTaskRow
                      key={row.id}
                      row={row}
                      virtualItem={virtualItem}
                      isOverdue={isOverdue(row.original)}
                      onTaskClick={onTaskClick}
                    />
                  )
                })
              ) : (
                rows.map((row) => (
                  <TaskRow
                    key={row.id}
                    row={row}
                    isOverdue={isOverdue(row.original)}
                    onTaskClick={onTaskClick}
                  />
                ))
              )
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Inga uppgifter matchar din sökning
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ============================================================================
// Story P.4: Task Row Components (memoized for performance)
// ============================================================================

type TaskRowType = ReturnType<
  ReturnType<typeof useReactTable<TaskWithRelations>>['getRowModel']
>['rows'][number]

const TaskRow = memo(function TaskRow({
  row,
  isOverdue,
  onTaskClick,
}: {
  row: TaskRowType
  isOverdue: boolean
  onTaskClick?: ((_taskId: string) => void) | undefined
}) {
  return (
    <TableRow
      data-state={row.getIsSelected() && 'selected'}
      className={cn(
        'group cursor-pointer hover:bg-muted/50',
        isOverdue && 'bg-destructive/5'
      )}
      onClick={(e) => {
        // Only trigger click if not clicking interactive elements
        if (
          !(e.target as HTMLElement).closest(
            'button, input[type="checkbox"], [role="combobox"], [role="listbox"], [role="option"]'
          )
        ) {
          onTaskClick?.(row.original.id)
        }
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(cell.column.id === 'title' && 'bg-background')}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
})

const VirtualTaskRow = memo(function VirtualTaskRow({
  row,
  virtualItem,
  isOverdue,
  onTaskClick,
}: {
  row: TaskRowType
  virtualItem: VirtualItem
  isOverdue: boolean
  onTaskClick?: ((_taskId: string) => void) | undefined
}) {
  const style: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: `${virtualItem.size}px`,
    transform: `translateY(${virtualItem.start}px)`,
  }

  return (
    <TableRow
      style={style}
      data-state={row.getIsSelected() && 'selected'}
      className={cn(
        'group cursor-pointer hover:bg-muted/50',
        isOverdue && 'bg-destructive/5'
      )}
      onClick={(e) => {
        if (
          !(e.target as HTMLElement).closest(
            'button, input[type="checkbox"], [role="combobox"], [role="listbox"], [role="option"]'
          )
        ) {
          onTaskClick?.(row.original.id)
        }
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(cell.column.id === 'title' && 'bg-background')}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
})
