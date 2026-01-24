'use client'

/**
 * Story 6.4: Task List View Tab
 * Table-based view matching the document-list-table visual style
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
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  MessageSquare,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  UserPlus,
  Flag,
  ListTodo,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  updateTasksBulk,
  deleteTasksBulk,
  type TaskWithRelations,
  type TaskColumnWithCount,
} from '@/app/actions/tasks'
import type { TaskPriority } from '@prisma/client'
import type { WorkspaceMember } from './index'
import { TaskFilters } from './task-filters'
import { BulkActionBar } from './bulk-action-bar'
import { toast } from 'sonner'

// ============================================================================
// Story P.4: Virtualization Configuration
// ============================================================================

const VIRTUALIZATION_THRESHOLD = 100
const ESTIMATED_ROW_HEIGHT = 56
const OVERSCAN_COUNT = 5
const VIRTUAL_TABLE_MAX_HEIGHT = 600

// ============================================================================
// Props
// ============================================================================

interface ListTabProps {
  initialTasks: TaskWithRelations[]
  initialColumns: TaskColumnWithCount[]
  workspaceMembers: WorkspaceMember[]
}

// ============================================================================
// Priority Helpers
// ============================================================================

const PRIORITY_CONFIG = {
  LOW: { label: 'Låg', color: 'bg-gray-100 text-gray-700' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  HIGH: { label: 'Hög', color: 'bg-orange-100 text-orange-700' },
  CRITICAL: { label: 'Kritisk', color: 'bg-red-100 text-red-700' },
} as const

function getPriorityConfig(priority: string) {
  return (
    PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] ??
    PRIORITY_CONFIG.MEDIUM
  )
}

// ============================================================================
// Status Icon Helper
// ============================================================================

function StatusIcon({
  columnName,
  isDone,
}: {
  columnName: string
  isDone: boolean
}) {
  if (isDone) {
    return <CheckCircle2 className="h-4 w-4 text-green-500" />
  }
  if (columnName.toLowerCase().includes('pågående')) {
    return <Clock className="h-4 w-4 text-blue-500" />
  }
  return <Circle className="h-4 w-4 text-gray-400" />
}

// ============================================================================
// Main Component
// ============================================================================

export function ListTab({
  initialTasks,
  initialColumns,
  workspaceMembers,
}: ListTabProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)

  // Story P.4: Virtualization state
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = tasks

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query)
      )
    }

    if (statusFilter.length > 0) {
      result = result.filter((task) => statusFilter.includes(task.column.name))
    }

    if (priorityFilter.length > 0) {
      result = result.filter((task) => priorityFilter.includes(task.priority))
    }

    if (assigneeFilter) {
      result = result.filter((task) => task.assignee_id === assigneeFilter)
    }

    return result
  }, [tasks, searchQuery, statusFilter, priorityFilter, assigneeFilter])

  // Check if task is overdue
  const isOverdue = useCallback((task: TaskWithRelations) => {
    if (!task.due_date || task.column.is_done) return false
    return new Date(task.due_date) < new Date()
  }, [])

  // Column definitions matching document-list-table style
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
        size: 40,
      },
      // Status icon
      {
        id: 'status',
        accessorFn: (row) => row.column.name,
        header: '',
        cell: ({ row }) => (
          <StatusIcon
            columnName={row.original.column.name}
            isDone={row.original.column.is_done}
          />
        ),
        size: 40,
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
            <div className="flex flex-col gap-1">
              <span
                className={cn(
                  'font-medium line-clamp-1',
                  overdue && 'text-destructive'
                )}
              >
                {task.title}
              </span>
              {task.list_item_links[0] && (
                <Badge variant="secondary" className="w-fit text-xs">
                  {
                    task.list_item_links[0].law_list_item.document
                      .document_number
                  }
                </Badge>
              )}
            </div>
          )
        },
        size: 300,
      },
      // Status column
      {
        id: 'columnName',
        accessorFn: (row) => row.column.name,
        header: ({ column }) => (
          <SortableHeader column={column} label="Status" />
        ),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="whitespace-nowrap"
            style={{
              borderColor: row.original.column.color,
              backgroundColor: `${row.original.column.color}20`,
            }}
          >
            {row.original.column.name}
          </Badge>
        ),
        size: 120,
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
        size: 60,
      },
      // Assignee
      {
        id: 'assignee',
        accessorFn: (row) => row.assignee?.name ?? row.assignee?.email ?? '',
        header: 'Ansvarig',
        cell: ({ row }) => {
          const assignee = row.original.assignee
          if (!assignee) {
            return (
              <span className="text-muted-foreground text-sm">Otilldelad</span>
            )
          }
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                {assignee.avatar_url && (
                  <AvatarImage
                    src={assignee.avatar_url}
                    alt={assignee.name ?? ''}
                  />
                )}
                <AvatarFallback className="text-xs">
                  {(assignee.name ?? assignee.email).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm truncate max-w-[100px]">
                {assignee.name ?? assignee.email}
              </span>
            </div>
          )
        },
        enableSorting: false,
        size: 150,
      },
      // Due date
      {
        id: 'dueDate',
        accessorKey: 'due_date',
        header: ({ column }) => (
          <SortableHeader column={column} label="Förfallodatum" />
        ),
        cell: ({ row }) => {
          const dueDate = row.original.due_date
          if (!dueDate) return null
          const date = new Date(dueDate)
          const overdue = isOverdue(row.original)
          return (
            <div
              className={cn(
                'flex items-center gap-1.5 text-sm',
                overdue && 'text-destructive'
              )}
            >
              {overdue && <AlertCircle className="h-3.5 w-3.5" />}
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>
                {formatDistanceToNow(date, { locale: sv, addSuffix: true })}
              </span>
            </div>
          )
        },
        size: 140,
      },
      // Priority
      {
        id: 'priority',
        accessorKey: 'priority',
        header: ({ column }) => (
          <SortableHeader column={column} label="Prioritet" />
        ),
        cell: ({ row }) => {
          const config = getPriorityConfig(row.original.priority)
          return (
            <Badge variant="secondary" className={cn('text-xs', config.color)}>
              {config.label}
            </Badge>
          )
        },
        size: 100,
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
        size: 50,
      },
    ],
    [isOverdue]
  )

  // Table instance
  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: {
      sorting,
      rowSelection,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
  })

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

  // Handle bulk update (optimistic)
  const handleBulkUpdate = async (updates: {
    columnId?: string
    assigneeId?: string | null
    priority?: string
  }) => {
    if (selectedItemIds.length === 0) return

    // Build updates object, only including defined values
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

    // Store previous state for rollback
    const previousTasks = tasks

    // Optimistic update - update UI immediately
    setTasks((prev) =>
      prev.map((task) => {
        if (!selectedItemIds.includes(task.id)) return task
        return {
          ...task,
          ...(updates.columnId && {
            column_id: updates.columnId,
            column:
              initialColumns.find((c) => c.id === updates.columnId) ??
              task.column,
          }),
          ...(updates.assigneeId !== undefined && {
            assignee_id: updates.assigneeId,
          }),
          ...(updates.priority && {
            priority: updates.priority as TaskPriority,
          }),
        }
      })
    )
    setRowSelection({})

    // Persist to server
    const result = await updateTasksBulk(selectedItemIds, bulkUpdates)

    if (result.success) {
      toast.success(`${selectedItemIds.length} uppgifter uppdaterade`)
    } else {
      // Rollback on error
      setTasks(previousTasks)
      toast.error('Kunde inte uppdatera uppgifter', {
        description: result.error,
      })
    }
  }

  // Handle bulk delete (optimistic)
  const handleBulkDelete = async () => {
    if (selectedItemIds.length === 0) return

    // Store previous state for rollback
    const previousTasks = tasks
    const deletedIds = [...selectedItemIds]

    // Optimistic update - remove from UI immediately
    setTasks((prev) => prev.filter((t) => !deletedIds.includes(t.id)))
    setRowSelection({})

    // Persist to server
    const result = await deleteTasksBulk(deletedIds)

    if (result.success) {
      toast.success(`${deletedIds.length} uppgifter raderade`)
    } else {
      // Rollback on error
      setTasks(previousTasks)
      toast.error('Kunde inte radera uppgifter', {
        description: result.error,
      })
    }
  }

  // Empty state
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="rounded-full bg-muted p-4">
          <ListTodo className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium">Inga uppgifter än</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Skapa din första uppgift för att börja spåra efterlevnadsarbete
          </p>
        </div>
        <Button>+ Skapa uppgift</Button>
      </div>
    )
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
        columns={initialColumns}
        workspaceMembers={workspaceMembers}
      />

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Visar {filteredTasks.length} av {tasks.length} uppgifter
      </p>

      {/* Bulk action bar */}
      {selectedItemIds.length > 0 && (
        <BulkActionBar
          selectedCount={selectedItemIds.length}
          onClearSelection={handleClearSelection}
          onBulkUpdate={handleBulkUpdate}
          onBulkDelete={handleBulkDelete}
          columns={initialColumns}
          workspaceMembers={workspaceMembers}
        />
      )}

      {/* Table - matching document-list-table styling */}
      {/* Story P.4: Use ref for virtualization scroll element */}
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
        <Table>
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
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
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
                // Story P.4: Virtualized rendering for large datasets
                rowVirtualizer.getVirtualItems().map((virtualItem) => {
                  const row = rows[virtualItem.index]
                  if (!row) return null
                  return (
                    <VirtualTaskRow
                      key={row.id}
                      row={row}
                      virtualItem={virtualItem}
                      isOverdue={isOverdue(row.original)}
                    />
                  )
                })
              ) : (
                // Standard rendering for small datasets
                rows.map((row) => (
                  <TaskRow
                    key={row.id}
                    row={row}
                    isOverdue={isOverdue(row.original)}
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
// Sortable Header Component (matching document-list-table)
// ============================================================================

function SortableHeader({
  column,
  label,
}: {
  column: {
    getIsSorted: () => false | 'asc' | 'desc'
    toggleSorting: (_desc?: boolean) => void
  }
  label: string
}) {
  const sorted = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className="-ml-4 h-8"
    >
      {label}
      {sorted === 'asc' ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
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
}: {
  row: TaskRowType
  isOverdue: boolean
}) {
  return (
    <TableRow
      data-state={row.getIsSelected() && 'selected'}
      className={cn(
        'group cursor-pointer hover:bg-muted/50',
        isOverdue && 'bg-destructive/5'
      )}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
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
}: {
  row: TaskRowType
  virtualItem: VirtualItem
  isOverdue: boolean
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
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
})
