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
import { ColorTagBadge } from '@/components/ui/color-tag-badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
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
import { isTaskOverdue } from '@/lib/utils/task-utils'
import { getPriorityBadgeProps } from '@/lib/ui/badge-tones'
import { toast } from 'sonner'
import type { WorkspaceMember } from './index'

// ============================================================================
// Props
// ============================================================================

interface AllWorkTabProps {
  filteredTasks: TaskWithRelations[]
  allTasksCount: number
  initialColumns: TaskColumnWithCount[]
  workspaceMembers: WorkspaceMember[]
  onTaskClick?: (_taskId: string) => void
}

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
    return <AlertCircle className="h-4 w-4 text-destructive" />
  }
  return <Circle className="h-4 w-4 text-gray-400" />
}

// ============================================================================
// Main Component
// ============================================================================

export function AllWorkTab({
  filteredTasks,
  allTasksCount,
  initialColumns: _initialColumns,
  workspaceMembers: _workspaceMembers,
  onTaskClick,
}: AllWorkTabProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'created_at', desc: true },
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
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
          description: `${filteredTasks.length} uppgifter exporterade`,
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
            isOverdue={isTaskOverdue(row.original)}
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
          const overdue = isTaskOverdue(row.original)
          return (
            <span
              className={cn(
                'font-medium',
                row.original.column.is_done &&
                  'line-through text-muted-foreground',
                overdue && !row.original.column.is_done && 'text-destructive'
              )}
            >
              {row.original.title}
            </span>
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
          <ColorTagBadge
            name={row.original.column.name}
            color={row.original.column.color}
          />
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
          const props = getPriorityBadgeProps(row.original.priority)
          return props ? (
            <Badge tone={props.tone} variant={props.variant}>
              {props.label}
            </Badge>
          ) : null
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
          const overdue = isTaskOverdue(row.original)
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
    []
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
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  })

  // Stats
  const stats = useMemo(() => {
    const done = filteredTasks.filter((t) => t.column.is_done).length
    const active = filteredTasks.length - done
    return { total: allTasksCount, showing: filteredTasks.length, done, active }
  }, [filteredTasks, allTasksCount])

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Alla uppgifter</h3>
          <Badge variant="secondary">{stats.showing}</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{stats.active} aktiva</span>
          <span>·</span>
          <span>{stats.done} avslutade</span>
          <span>·</span>
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
      </div>

      {/* Table or empty state */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={
            <EmptyState.Icon>
              <Archive className="h-8 w-8 text-muted-foreground" />
            </EmptyState.Icon>
          }
          title="Inga uppgifter matchar"
          description="Inga uppgifter hittades med dessa filter."
        />
      ) : (
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
              {table.getRowModel().rows.map((row) => {
                const overdue = isTaskOverdue(row.original)
                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50',
                      row.original.column.is_done && 'opacity-60',
                      overdue && 'border-l-2 border-l-destructive'
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
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
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
