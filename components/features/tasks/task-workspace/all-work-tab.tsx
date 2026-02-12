'use client'

/**
 * Story 6.4: All Work Tab
 * Archive view showing all tasks including completed ones
 */

import { useState, useMemo, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnOrderState,
} from '@tanstack/react-table'
import { arrayMove } from '@dnd-kit/sortable'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DraggableColumnHeader } from '@/components/ui/draggable-column-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  CheckCircle2,
  Clock,
  Circle,
  Archive,
  Download,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  exportTasksToCSV,
  type TaskWithRelations,
  type TaskColumnWithCount,
} from '@/app/actions/tasks'
import { toast } from 'sonner'
import type { WorkspaceMember } from './index'

// ============================================================================
// Props
// ============================================================================

interface AllWorkTabProps {
  initialTasks: TaskWithRelations[]
  initialColumns: TaskColumnWithCount[]
  workspaceMembers: WorkspaceMember[]
  onTaskClick?: (_taskId: string) => void
}

// ============================================================================
// Priority Config
// ============================================================================

const PRIORITY_CONFIG = {
  LOW: { label: 'Låg', color: 'bg-gray-100 text-gray-700' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  HIGH: { label: 'Hög', color: 'bg-orange-100 text-orange-700' },
  CRITICAL: { label: 'Kritisk', color: 'bg-red-100 text-red-700' },
} as const

// ============================================================================
// Status Icon
// ============================================================================

function StatusIcon({
  isDone,
  isOverdue,
}: {
  isDone: boolean
  isOverdue: boolean
}) {
  if (isDone) {
    return <CheckCircle2 className="h-4 w-4 text-green-500" />
  }
  if (isOverdue) {
    return <Clock className="h-4 w-4 text-red-500" />
  }
  return <Circle className="h-4 w-4 text-gray-400" />
}

// ============================================================================
// Main Component
// ============================================================================

export function AllWorkTab({
  initialTasks,
  initialColumns: _initialColumns,
  workspaceMembers: _workspaceMembers,
  onTaskClick,
}: AllWorkTabProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'created_at', desc: true },
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isExporting, setIsExporting] = useState(false)

  // Handle CSV export
  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await exportTasksToCSV()
      if (result.success && result.data) {
        // Create a blob and download
        const blob = new Blob([result.data.csv], {
          type: 'text/csv;charset=utf-8;',
        })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = result.data.filename
        link.click()
        URL.revokeObjectURL(link.href)
        toast.success('Export klar', {
          description: `${initialTasks.length} uppgifter exporterade`,
        })
      } else {
        toast.error('Kunde inte exportera', {
          description: result.error,
        })
      }
    } catch {
      toast.error('Något gick fel vid export')
    } finally {
      setIsExporting(false)
    }
  }

  // Check if task is overdue
  const isOverdue = useCallback((task: TaskWithRelations) => {
    if (!task.due_date || task.column.is_done) return false
    return new Date(task.due_date) < new Date()
  }, [])

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = initialTasks

    if (statusFilter === 'done') {
      result = result.filter((t) => t.column.is_done)
    } else if (statusFilter === 'active') {
      result = result.filter((t) => !t.column.is_done)
    }

    return result
  }, [initialTasks, statusFilter])

  // Column definitions
  const columns: ColumnDef<TaskWithRelations>[] = useMemo(
    () => [
      // Status
      {
        id: 'status',
        header: '',
        cell: ({ row }) => (
          <StatusIcon
            isDone={row.original.column.is_done}
            isOverdue={isOverdue(row.original)}
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
        cell: ({ row }) => (
          <span
            className={cn(
              'font-medium',
              row.original.column.is_done &&
                'line-through text-muted-foreground'
            )}
          >
            {row.original.title}
          </span>
        ),
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
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
            style={{
              backgroundColor: `${row.original.column.color}1A`,
              color: row.original.column.color,
            }}
          >
            {row.original.column.name}
          </span>
        ),
        size: 120,
      },
      // Assignee
      {
        id: 'assignee',
        accessorFn: (row) => row.assignee?.name ?? row.assignee?.email ?? '',
        header: 'Ansvarig',
        cell: ({ row }) => {
          const assignee = row.original.assignee
          if (!assignee) {
            return <span className="text-muted-foreground text-sm">-</span>
          }
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                {assignee.avatar_url && (
                  <AvatarImage src={assignee.avatar_url} />
                )}
                <AvatarFallback className="text-[10px]">
                  {(assignee.name ?? assignee.email).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm truncate">
                {assignee.name ?? assignee.email}
              </span>
            </div>
          )
        },
        size: 150,
      },
      // Priority
      {
        id: 'priority',
        accessorKey: 'priority',
        header: ({ column }) => (
          <SortableHeader column={column} label="Prioritet" />
        ),
        cell: ({ row }) => {
          const config =
            PRIORITY_CONFIG[
              row.original.priority as keyof typeof PRIORITY_CONFIG
            ] ?? PRIORITY_CONFIG.MEDIUM
          return (
            <Badge variant="secondary" className={cn('text-xs', config.color)}>
              {config.label}
            </Badge>
          )
        },
        size: 100,
      },
      // Due date
      {
        id: 'due_date',
        accessorKey: 'due_date',
        header: ({ column }) => (
          <SortableHeader column={column} label="Förfaller" />
        ),
        cell: ({ row }) => {
          const dueDate = row.original.due_date
          if (!dueDate) return <span className="text-muted-foreground">-</span>
          const overdue = isOverdue(row.original)
          return (
            <span
              className={cn(
                'text-sm',
                overdue && 'text-destructive font-medium'
              )}
            >
              {new Date(dueDate).toLocaleDateString('sv-SE')}
            </span>
          )
        },
        size: 100,
      },
      // Created date
      {
        id: 'created_at',
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
      // Completed date
      {
        id: 'completed_at',
        accessorKey: 'completed_at',
        header: ({ column }) => (
          <SortableHeader column={column} label="Avslutad" />
        ),
        cell: ({ row }) => {
          const completedAt = row.original.completed_at
          if (!completedAt)
            return <span className="text-muted-foreground">-</span>
          return (
            <span className="text-sm text-muted-foreground">
              {new Date(completedAt).toLocaleDateString('sv-SE')}
            </span>
          )
        },
        size: 100,
      },
    ],
    [isOverdue]
  )

  // Column reorder handler
  const handleColumnReorder = useCallback(
    (activeId: string, overId: string) => {
      const currentOrder =
        columnOrder.length > 0
          ? columnOrder
          : columns.map((c) => c.id ?? '').filter(Boolean)

      const oldIndex = currentOrder.indexOf(activeId)
      const newIndex = currentOrder.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1) return

      setColumnOrder(arrayMove(currentOrder, oldIndex, newIndex))
    },
    [columnOrder, columns]
  )

  // Table instance
  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnOrder,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  })

  // Stats
  const stats = useMemo(() => {
    const done = initialTasks.filter((t) => t.column.is_done).length
    const active = initialTasks.length - done
    return { total: initialTasks.length, done, active }
  }, [initialTasks])

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Alla uppgifter</h3>
          <Badge variant="secondary">{stats.total}</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{stats.active} aktiva</span>
          <span>·</span>
          <span>{stats.done} avslutade</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök i alla uppgifter..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla</SelectItem>
            <SelectItem value="active">Aktiva</SelectItem>
            <SelectItem value="done">Avslutade</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {/* Export button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Exportera CSV
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <DraggableColumnHeader
                    key={header.id}
                    id={header.id}
                    onReorder={handleColumnReorder}
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </DraggableColumnHeader>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    'cursor-pointer hover:bg-muted/50',
                    row.original.column.is_done && 'opacity-60'
                  )}
                  onClick={() => onTaskClick?.(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Inga uppgifter hittades
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
// Sortable Header
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
