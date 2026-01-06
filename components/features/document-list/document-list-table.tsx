'use client'

/**
 * Story 4.12: Document List Table View
 * TanStack Table with sorting, selection, and inline editing
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Eye,
  Trash2,
  FileText,
  Loader2,
} from 'lucide-react'
import { RemoveConfirmation } from './remove-confirmation'
import { BulkActionBar } from './bulk-action-bar'
import { StatusEditor } from './table-cell-editors/status-editor'
import { PriorityEditor } from './table-cell-editors/priority-editor'
import { DueDateEditor } from './table-cell-editors/due-date-editor'
import { AssigneeEditor } from './table-cell-editors/assignee-editor'
import {
  getContentTypeIcon,
  getContentTypeBadgeColor,
  getContentTypeLabel,
} from '@/lib/utils/content-type'
import type { DocumentListItem, WorkspaceMemberOption, ListGroupSummary } from '@/app/actions/document-list'
import type { LawListItemStatus, LawListItemPriority } from '@prisma/client'
import { useDebouncedCallback } from 'use-debounce'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { GroupEditor } from './table-cell-editors/group-editor'
import { ColumnSettings } from './column-settings'

// ============================================================================
// Props
// ============================================================================

interface DocumentListTableProps {
  items: DocumentListItem[]
  total: number
  hasMore: boolean
  isLoading: boolean
  workspaceMembers: WorkspaceMemberOption[]
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (visibility: VisibilityState) => void
  onLoadMore: () => void
  onRemoveItem: (itemId: string) => Promise<boolean>
  onReorderItems: (items: Array<{ id: string; position: number }>) => Promise<boolean>
  onUpdateItem: (
    itemId: string,
    updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
      dueDate?: Date | null
      assignedTo?: string | null
      groupId?: string | null // Story 4.13
    }
  ) => Promise<boolean>
  onBulkUpdate: (
    itemIds: string[],
    updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
    }
  ) => Promise<boolean>
  // Story 4.13: Group props
  groups?: ListGroupSummary[]
  onMoveToGroup?: (itemId: string, groupId: string | null) => Promise<boolean>
  emptyMessage?: string
}

// ============================================================================
// Helper: Get document URL
// ============================================================================

function getDocumentUrl(item: DocumentListItem): string {
  const contentType = item.document.contentType
  const slug = item.document.slug

  if (contentType.startsWith('COURT_CASE_')) {
    const courtCode = contentType.replace('COURT_CASE_', '').toLowerCase()
    return `/browse/rattsfall/${courtCode}/${slug}`
  }
  if (contentType === 'EU_REGULATION' || contentType === 'EU_DIRECTIVE') {
    return `/browse/eu/${slug}`
  }
  return `/browse/lagar/${slug}`
}

// Status/Priority labels moved to individual editor components

// ============================================================================
// Main Component
// ============================================================================

export function DocumentListTable({
  items,
  total,
  hasMore,
  isLoading,
  workspaceMembers,
  columnVisibility,
  onColumnVisibilityChange,
  onLoadMore,
  onRemoveItem,
  onReorderItems,
  onUpdateItem,
  onBulkUpdate,
  // Story 4.13: Group props for inline group editing
  groups = [],
  onMoveToGroup,
  emptyMessage = 'Inga dokument i listan.',
}: DocumentListTableProps) {
  // Local state
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [removeConfirmItem, setRemoveConfirmItem] = useState<DocumentListItem | null>(null)
  const [localItems, setLocalItems] = useState<DocumentListItem[]>(items)

  // Sync local items with props
  useEffect(() => {
    setLocalItems(items)
  }, [items])

  // Sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Debounced reorder
  const debouncedReorder = useDebouncedCallback(
    async (newItems: DocumentListItem[]) => {
      const updates = newItems.map((item, index) => ({
        id: item.id,
        position: index,
      }))
      await onReorderItems(updates)
    },
    500
  )

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        const oldIndex = localItems.findIndex((item) => item.id === active.id)
        const newIndex = localItems.findIndex((item) => item.id === over.id)
        const newItems = arrayMove(localItems, oldIndex, newIndex)
        setLocalItems(newItems)
        debouncedReorder(newItems)
      }
    },
    [localItems, debouncedReorder]
  )

  // Column definitions
  const columns: ColumnDef<DocumentListItem>[] = useMemo(
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
            onCheckedChange={(value: boolean) => table.toggleAllPageRowsSelected(value)}
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
      // Drag handle
      {
        id: 'dragHandle',
        header: '',
        cell: () => null, // Rendered by SortableRow
        enableSorting: false,
        size: 40,
      },
      // Content type icon
      {
        id: 'type',
        accessorFn: (row) => row.document.contentType,
        header: 'Typ',
        cell: ({ row }) => {
          const contentType = row.original.document.contentType
          const Icon = getContentTypeIcon(contentType)
          return (
            <div
              className={cn(
                'inline-flex items-center justify-center w-8 h-8 rounded',
                getContentTypeBadgeColor(contentType)
              )}
              title={getContentTypeLabel(contentType)}
            >
              <Icon className="h-4 w-4" />
            </div>
          )
        },
        size: 60,
      },
      // Document number
      {
        id: 'documentNumber',
        accessorFn: (row) => row.document.documentNumber,
        header: ({ column }) => (
          <SortableHeader column={column} label="Dokument" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.document.documentNumber}
          </span>
        ),
        size: 140,
      },
      // Title
      {
        id: 'title',
        accessorFn: (row) => row.document.title,
        header: ({ column }) => (
          <SortableHeader column={column} label="Titel" />
        ),
        cell: ({ row }) => (
          <Link
            href={getDocumentUrl(row.original)}
            className="hover:underline line-clamp-2"
          >
            {row.original.document.title}
          </Link>
        ),
        size: 300,
      },
      // Status (inline editable)
      {
        id: 'status',
        accessorKey: 'status',
        header: ({ column }) => (
          <SortableHeader column={column} label="Status" />
        ),
        cell: ({ row }) => (
          <StatusEditor
            value={row.original.status}
            onChange={async (newStatus) => {
              await onUpdateItem(row.original.id, { status: newStatus })
            }}
          />
        ),
        size: 140,
      },
      // Priority (inline editable)
      {
        id: 'priority',
        accessorKey: 'priority',
        header: ({ column }) => (
          <SortableHeader column={column} label="Prioritet" />
        ),
        cell: ({ row }) => (
          <PriorityEditor
            value={row.original.priority}
            onChange={async (newPriority) => {
              await onUpdateItem(row.original.id, { priority: newPriority })
            }}
          />
        ),
        size: 120,
      },
      // Due date (inline editable)
      {
        id: 'dueDate',
        accessorKey: 'dueDate',
        header: ({ column }) => (
          <SortableHeader column={column} label="Deadline" />
        ),
        cell: ({ row }) => (
          <DueDateEditor
            value={row.original.dueDate}
            onChange={async (newDate) => {
              await onUpdateItem(row.original.id, { dueDate: newDate })
            }}
          />
        ),
        size: 140,
      },
      // Assignee (inline editable)
      {
        id: 'assignee',
        accessorFn: (row) => row.assignee?.name ?? row.assignee?.email ?? '',
        header: ({ column }) => (
          <SortableHeader column={column} label="Tilldelad" />
        ),
        cell: ({ row }) => (
          <AssigneeEditor
            value={row.original.assignee?.id ?? null}
            members={workspaceMembers}
            onChange={async (newAssigneeId) => {
              await onUpdateItem(row.original.id, { assignedTo: newAssigneeId })
            }}
          />
        ),
        size: 160,
      },
      // Notes indicator
      {
        id: 'notes',
        accessorFn: (row) => row.notes,
        header: 'Ant.',
        cell: ({ row }) =>
          row.original.notes ? (
            <span className="text-muted-foreground" title={row.original.notes}>
              📝
            </span>
          ) : null,
        enableSorting: false,
        size: 50,
      },
      // Story 4.13: Group column (inline editable)
      {
        id: 'group',
        accessorFn: (row) => row.groupName ?? '',
        header: ({ column }) => (
          <SortableHeader column={column} label="Grupp" />
        ),
        cell: ({ row }) => (
          <GroupEditor
            value={row.original.groupId}
            groupName={row.original.groupName}
            groups={groups}
            onChange={async (newGroupId) => {
              if (onMoveToGroup) {
                return await onMoveToGroup(row.original.id, newGroupId)
              }
              return false
            }}
          />
        ),
        size: 160,
      },
      // Added date
      {
        id: 'addedAt',
        accessorKey: 'addedAt',
        header: ({ column }) => (
          <SortableHeader column={column} label="Tillagd" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.addedAt).toLocaleDateString('sv-SE')}
          </span>
        ),
        size: 100,
      },
      // Actions
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="h-8 w-8"
            >
              <Link href={getDocumentUrl(row.original)} title="Visa dokument">
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setRemoveConfirmItem(row.original)}
              title="Ta bort"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
        enableSorting: false,
        size: 80,
      },
    ],
    [onUpdateItem, workspaceMembers, groups, onMoveToGroup]
  )

  // Table instance
  const table = useReactTable({
    data: localItems,
    columns,
    state: {
      sorting,
      rowSelection,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: (updater) => {
      const newVisibility = typeof updater === 'function' ? updater(columnVisibility) : updater
      onColumnVisibilityChange(newVisibility)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
  })

  // Selected items
  const selectedItemIds = Object.keys(rowSelection).filter(
    (id) => rowSelection[id]
  )

  // Handle bulk update
  const handleBulkUpdate = async (updates: {
    status?: LawListItemStatus
    priority?: LawListItemPriority
  }) => {
    await onBulkUpdate(selectedItemIds, updates)
    setRowSelection({})
  }

  // Handle remove confirmation
  const handleRemoveConfirm = async () => {
    if (!removeConfirmItem) return
    await onRemoveItem(removeConfirmItem.id)
    setRemoveConfirmItem(null)
  }

  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="rounded-full bg-muted p-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground max-w-md">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bulk action bar */}
      {selectedItemIds.length > 0 && (
        <BulkActionBar
          selectedCount={selectedItemIds.length}
          onClearSelection={() => setRowSelection({})}
          onBulkUpdate={handleBulkUpdate}
        />
      )}

      {/* Info and column settings (matching card view layout) */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Visar {items.length} av {total} dokument.
        </p>
        <ColumnSettings
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={onColumnVisibilityChange}
        />
      </div>

      {/* Table with DnD - overflow-x-auto contains horizontal scroll within table */}
      <div className="rounded-md border overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className={cn(
                        header.id === 'title' && 'sticky left-0 bg-background z-10'
                      )}
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
            <TableBody>
              <SortableContext
                items={localItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <SortableRow
                      key={row.id}
                      row={row}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      {isLoading ? 'Laddar...' : 'Inga resultat.'}
                    </TableCell>
                  </TableRow>
                )}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Laddar...
              </>
            ) : (
              'Visa fler'
            )}
          </Button>
        </div>
      )}

      {/* Remove confirmation */}
      <RemoveConfirmation
        open={!!removeConfirmItem}
        onOpenChange={(open) => !open && setRemoveConfirmItem(null)}
        documentTitle={removeConfirmItem?.document.title ?? ''}
        onConfirm={handleRemoveConfirm}
      />
    </div>
  )
}

// ============================================================================
// Sortable Header Component
// ============================================================================

function SortableHeader({
  column,
  label,
}: {
  column: {
    getIsSorted: () => false | 'asc' | 'desc'
    toggleSorting: (desc?: boolean) => void
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
// Sortable Row Component
// ============================================================================

function SortableRow({
  row,
}: {
  row: ReturnType<ReturnType<typeof useReactTable<DocumentListItem>>['getRowModel']>['rows'][number]
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={row.getIsSelected() && 'selected'}
      className="group"
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            cell.column.id === 'title' && 'sticky left-0 bg-background z-10'
          )}
        >
          {cell.column.id === 'dragHandle' ? (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
              aria-label="Dra för att flytta"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : (
            flexRender(cell.column.columnDef.cell, cell.getContext())
          )}
        </TableCell>
      ))}
    </TableRow>
  )
}
