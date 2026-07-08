'use client'

/**
 * Story 6.4 → migrated in Story 28.6 (Epic 28) onto the unified DataTable
 * core. Archive view showing all tasks including completed ones —
 * read-only columns + CSV export; sorting/reorder/cards come from the core.
 * The local SortableHeader copy (byte-identical to ui/sortable-header) is
 * deleted.
 */

import { useState, useMemo } from 'react'
import type {
  ColumnDef,
  ColumnOrderState,
  SortingState,
  Updater,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ColorTagBadge } from '@/components/ui/color-tag-badge'
import { DataTable } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { SortableHeader } from '@/components/ui/sortable-header'
import {
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

interface AllWorkTabProps {
  filteredTasks: TaskWithRelations[]
  allTasksCount: number
  initialColumns: TaskColumnWithCount[]
  workspaceMembers: WorkspaceMember[]
  onTaskClick?: (_taskId: string) => void
}

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
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [isExporting, setIsExporting] = useState(false)

  // Handle CSV export
  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await exportTasksToCSV()
      if (result.success && result.data) {
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

  // Column definitions (read-only display cells)
  const columns: ColumnDef<TaskWithRelations, unknown>[] = useMemo(
    () => [
      {
        id: 'status',
        header: () => null,
        cell: ({ row }) => (
          <StatusIcon
            isDone={row.original.column.is_done}
            isOverdue={isTaskOverdue(row.original)}
          />
        ),
        enableSorting: false,
        size: 40,
        minSize: 40,
        maxSize: 40,
        meta: {
          dt: {
            label: 'Status',
            pinned: 'left',
            padding: 'tight',
            card: { role: 'hidden' },
          },
        },
      },
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
        minSize: 180,
        meta: {
          dt: { label: 'Uppgift', fill: true, card: { role: 'title' } },
        },
      },
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
        meta: {
          dt: { label: 'Status', card: { role: 'badge', priority: 0 } },
        },
      },
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
        enableSorting: false,
        size: 150,
        meta: {
          dt: {
            label: 'Ansvarig',
            card: {
              role: 'meta',
              priority: 1,
              renderCard: (row) =>
                row.original.assignee ? (
                  <span className="inline-flex items-center gap-2 text-sm">
                    <Avatar className="h-5 w-5">
                      {row.original.assignee.avatar_url && (
                        <AvatarImage src={row.original.assignee.avatar_url} />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {(
                          row.original.assignee.name ??
                          row.original.assignee.email
                        )
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {row.original.assignee.name ?? row.original.assignee.email}
                  </span>
                ) : null,
            },
          },
        },
      },
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
        meta: {
          dt: { label: 'Prioritet', card: { role: 'badge', priority: 1 } },
        },
      },
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
        meta: {
          dt: {
            label: 'Förfaller',
            card: {
              role: 'meta',
              priority: 2,
              renderCard: (row) =>
                row.original.due_date ? (
                  <span
                    className={cn(
                      'text-sm',
                      isTaskOverdue(row.original) &&
                        'text-destructive font-medium'
                    )}
                  >
                    {new Date(row.original.due_date).toLocaleDateString(
                      'sv-SE'
                    )}
                  </span>
                ) : null,
            },
          },
        },
      },
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
        meta: {
          dt: { label: 'Skapad', card: { role: 'footer' } },
        },
      },
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
        meta: {
          dt: {
            label: 'Avslutad',
            card: {
              role: 'meta',
              priority: 3,
              renderCard: (row) =>
                row.original.completed_at ? (
                  <span className="text-sm text-muted-foreground">
                    {new Date(row.original.completed_at).toLocaleDateString(
                      'sv-SE'
                    )}
                  </span>
                ) : null,
            },
          },
        },
      },
    ],
    []
  )

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
        <DataTable<TaskWithRelations>
          data={filteredTasks}
          columns={columns}
          getRowId={(row) => row.id}
          sorting={{
            sorting,
            onSortingChange: (updater: Updater<SortingState>) =>
              setSorting(
                typeof updater === 'function' ? updater(sorting) : updater
              ),
          }}
          columnState={{
            order: columnOrder,
            onOrderChange: (updater: Updater<ColumnOrderState>) =>
              setColumnOrder(
                typeof updater === 'function' ? updater(columnOrder) : updater
              ),
          }}
          rowInteraction={{
            ...(onTaskClick
              ? { onRowClick: (row: TaskWithRelations) => onTaskClick(row.id) }
              : {}),
            getRowClassName: (row: TaskWithRelations) =>
              cn(
                row.column.is_done && 'opacity-60',
                isTaskOverdue(row) && 'border-l-2 border-l-destructive'
              ),
          }}
          view={{ cardBelow: 800 }}
        />
      )}
    </div>
  )
}
