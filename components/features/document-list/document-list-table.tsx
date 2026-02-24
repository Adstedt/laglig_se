'use client'

/**
 * Story 4.12: Document List Table View
 * TanStack Table with sorting, selection, and inline editing
 *
 * Story P.4: Added virtualization for large datasets (>100 items)
 * Uses @tanstack/react-virtual for efficient rendering
 */

import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
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
  type ColumnOrderState,
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
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
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
  GripVertical,
  Eye,
  Trash2,
  FileText,
  Loader2,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from 'lucide-react'
import { SortableHeader } from '@/components/ui/sortable-header'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RemoveConfirmation } from './remove-confirmation'
import { BulkActionBar } from './bulk-action-bar'
import { PriorityEditor } from './table-cell-editors/priority-editor'
import { DueDateEditor } from './table-cell-editors/due-date-editor'
import { AssigneeEditor } from './table-cell-editors/assignee-editor'
import {
  getContentTypeIcon,
  getContentTypeBadgeColor,
  getContentTypeLabel,
} from '@/lib/utils/content-type'
import type {
  DocumentListItem,
  WorkspaceMemberOption,
  ListGroupSummary,
} from '@/app/actions/document-list'
import type { LawListItemStatus, LawListItemPriority } from '@prisma/client'
import { useDebouncedCallback } from 'use-debounce'
import { DraggableColumnHeader } from '@/components/ui/draggable-column-header'
import { ChangeIndicator } from '@/components/features/changes/change-indicator'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { GroupEditor } from './table-cell-editors/group-editor'
// Story 6.2: Compliance view components
import { ComplianceStatusEditor } from './table-cell-editors/compliance-status-editor'
import { ResponsibleEditor } from './table-cell-editors/responsible-editor'
import { TaskProgressCell } from './table-cells/task-progress-cell'
import { LastActivityCell } from './table-cells/last-activity-cell'
import { CellErrorBoundary } from './table-cells/cell-error-boundary'
import type { ComplianceStatus } from '@prisma/client'
import type { TaskProgress, LastActivity } from '@/lib/db/queries/list-items'

// ============================================================================
// Story 6.16: Column Header Tooltip Texts (Swedish)
// ============================================================================

/** Tooltip content for Efterlevnad (Compliance Status) column header */
const EFTERLEVNAD_TOOLTIP_CONTENT = {
  title: 'Efterlevnad',
  lines: [
    'Visar hur väl lagens krav är uppfyllda i nuläget.',
    'Bedöms utifrån rutiner, dokumentation och faktisk tillämpning.',
    'Uppdateras när åtgärder eller underlag läggs till.',
  ],
}

/** Tooltip content for Prioritet (Priority) column header */
const PRIORITET_TOOLTIP_CONTENT = {
  title: 'Prioritet',
  lines: [
    'Visar hur allvarliga konsekvenserna är vid bristande efterlevnad.',
    'Baserat på risk, sanktionsnivå och påverkan på verksamheten.',
    'Påverkas inte av nuvarande efterlevnadsstatus.',
  ],
}

// ============================================================================
// Story P.4: Virtualization Configuration
// ============================================================================

/** Enable virtualization when items exceed this threshold */
const VIRTUALIZATION_THRESHOLD = 100

/** Estimated row height for virtualization calculations */
const ESTIMATED_ROW_HEIGHT = 52

/** Number of rows to render outside viewport for smooth scrolling */
const OVERSCAN_COUNT = 5

/** Maximum height of virtualized table container */
const VIRTUAL_TABLE_MAX_HEIGHT = 600

// ============================================================================
// Props
// ============================================================================

/** Column IDs that cannot be reordered (pinned to edges) */
const PINNED_COLUMN_IDS = new Set([
  'select',
  'dragHandle',
  'actions',
  'highRiskWarning',
])

interface DocumentListTableProps {
  items: DocumentListItem[]
  total: number
  hasMore: boolean
  isLoading: boolean
  workspaceMembers: WorkspaceMemberOption[]
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (_visibility: VisibilityState) => void
  // Column sizing for resizable columns
  columnSizing?: ColumnSizingState | undefined
  onColumnSizingChange?: ((_sizing: ColumnSizingState) => void) | undefined
  // Column order for drag-to-reorder
  columnOrder?: ColumnOrderState | undefined
  onColumnOrderChange?: ((_order: ColumnOrderState) => void) | undefined
  onLoadMore: () => void
  onRemoveItem: (_itemId: string) => Promise<boolean>
  onReorderItems: (
    _items: Array<{ id: string; position: number }>
  ) => Promise<boolean>
  onUpdateItem: (
    _itemId: string,
    _updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
      dueDate?: Date | null
      assignedTo?: string | null
      _resolvedAssignee?: {
        id: string
        name: string | null
        email: string
        avatarUrl: string | null
      } | null
      groupId?: string | null // Story 4.13
      // Story 6.2: Compliance fields
      complianceStatus?: ComplianceStatus
      responsibleUserId?: string | null
      _resolvedResponsibleUser?: {
        id: string
        name: string | null
        email: string
        avatarUrl: string | null
      } | null
    }
  ) => Promise<boolean>
  onBulkUpdate: (
    _itemIds: string[],
    _updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
      complianceStatus?: ComplianceStatus // Story 6.2
      responsibleUserId?: string | null // Story 6.2
    }
  ) => Promise<boolean>
  // Story 4.13: Group props
  groups?: ListGroupSummary[] | undefined
  onMoveToGroup?:
    | ((_itemId: string, _groupId: string | null) => Promise<boolean>)
    | undefined
  emptyMessage?: string | undefined
  // Story 6.2: Compliance view props
  taskProgress?: Map<string, TaskProgress> | undefined
  lastActivity?: Map<string, LastActivity> | undefined
  onRowClick?: ((_listItemId: string) => void) | undefined
  // Story 6.14: Props for nested usage in GroupedDocumentListTable
  hideGroupColumn?: boolean | undefined
  disableDndContext?: boolean | undefined
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
  total: _total, // Info row moved to parent component
  hasMore,
  isLoading,
  workspaceMembers,
  columnVisibility,
  onColumnVisibilityChange,
  columnSizing: externalColumnSizing,
  onColumnSizingChange,
  columnOrder: externalColumnOrder,
  onColumnOrderChange,
  onLoadMore,
  onRemoveItem,
  onReorderItems,
  onUpdateItem,
  onBulkUpdate,
  // Story 4.13: Group props for inline group editing
  groups = [],
  onMoveToGroup,
  emptyMessage = 'Inga dokument i listan.',
  // Story 6.2: Compliance view props
  taskProgress,
  lastActivity,
  onRowClick,
  // Story 6.14: Props for nested usage in GroupedDocumentListTable
  hideGroupColumn = false,
  disableDndContext = false,
}: DocumentListTableProps) {
  // Local state
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [removeConfirmItem, setRemoveConfirmItem] =
    useState<DocumentListItem | null>(null)
  const [localItems, setLocalItems] = useState<DocumentListItem[]>(items)
  const [internalColumnSizing, setInternalColumnSizing] =
    useState<ColumnSizingState>({})

  const [internalColumnOrder, setInternalColumnOrder] =
    useState<ColumnOrderState>([])

  // Use external sizing/order if provided, otherwise use internal
  const columnSizing = externalColumnSizing ?? internalColumnSizing
  const columnOrder = externalColumnOrder ?? internalColumnOrder
  const handleColumnSizingChange = useCallback(
    (
      updater:
        | ColumnSizingState
        | ((_old: ColumnSizingState) => ColumnSizingState)
    ) => {
      const newSizing =
        typeof updater === 'function' ? updater(columnSizing) : updater
      if (onColumnSizingChange) {
        onColumnSizingChange(newSizing)
      } else {
        setInternalColumnSizing(newSizing)
      }
    },
    [columnSizing, onColumnSizingChange]
  )

  const handleColumnOrderChange = useCallback(
    (newOrder: ColumnOrderState) => {
      if (onColumnOrderChange) {
        onColumnOrderChange(newOrder)
      } else {
        setInternalColumnOrder(newOrder)
      }
    },
    [onColumnOrderChange]
  )

  // Story P.4: Virtualization state
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const shouldVirtualize = localItems.length > VIRTUALIZATION_THRESHOLD

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
      },
      // Drag handle
      {
        id: 'dragHandle',
        header: '',
        cell: () => null, // Rendered by SortableRow
        enableSorting: false,
        enableResizing: false,
        size: 40,
      },
      // Content type icon - fixed size, consistent across views
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
        enableResizing: false,
        size: 60,
      },
      // Document (combined title + document number) - fixed size, consistent across views
      {
        id: 'title',
        accessorFn: (row) => row.document.title,
        header: ({ column }) => (
          <SortableHeader column={column} label="Dokument" />
        ),
        cell: ({ row }) => (
          <div className="w-full overflow-hidden">
            <div className="flex items-center gap-1.5">
              <Link
                href={getDocumentUrl(row.original)}
                className="text-sm font-medium text-foreground hover:underline truncate"
                title={row.original.document.title}
              >
                {row.original.document.title}
              </Link>
              {/* Story 8.1: Pending change indicator */}
              <ChangeIndicator
                count={row.original.pendingChangeCount}
                documentId={row.original.document.id}
              />
            </div>
            <span className="text-xs text-muted-foreground block truncate">
              {row.original.document.documentNumber}
            </span>
          </div>
        ),
        size: 300,
      },
      // Story 6.2: Compliance Status (inline editable)
      // Story 6.16: Added column header tooltip
      // Note: Legacy "status" field removed - it's now used for task workflow only
      // Efterlevnad (ComplianceStatus) is the overall compliance status for laws/documents
      {
        id: 'complianceStatus',
        accessorKey: 'complianceStatus',
        header: ({ column }) => (
          <ColumnHeaderWithTooltip
            column={column}
            label="Efterlevnad"
            tooltipContent={EFTERLEVNAD_TOOLTIP_CONTENT}
          />
        ),
        cell: ({ row }) => (
          <CellErrorBoundary>
            <ComplianceStatusEditor
              value={row.original.complianceStatus}
              onChange={async (newStatus) => {
                await onUpdateItem(row.original.id, {
                  complianceStatus: newStatus,
                })
              }}
            />
          </CellErrorBoundary>
        ),
        size: 150,
        minSize: 200,
        maxSize: 250,
        enableResizing: true,
      },
      // Priority (inline editable)
      // Story 6.16: Added column header tooltip
      {
        id: 'priority',
        accessorKey: 'priority',
        header: ({ column }) => (
          <ColumnHeaderWithTooltip
            column={column}
            label="Prioritet"
            tooltipContent={PRIORITET_TOOLTIP_CONTENT}
          />
        ),
        cell: ({ row }) => (
          <PriorityEditor
            value={row.original.priority}
            onChange={async (newPriority) => {
              await onUpdateItem(row.original.id, {
                priority: newPriority as LawListItemPriority,
              })
            }}
          />
        ),
        size: 120,
        minSize: 170,
        maxSize: 220,
        enableResizing: true,
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
        minSize: 120,
        maxSize: 200,
        enableResizing: true,
      },
      // Assignee (inline editable) - avatar only
      {
        id: 'assignee',
        accessorFn: (row) => row.assignee?.name ?? row.assignee?.email ?? '',
        header: 'Tilldelad',
        cell: ({ row }) => (
          <AssigneeEditor
            value={row.original.assignee?.id ?? null}
            members={workspaceMembers}
            onChange={async (newAssigneeId) => {
              const member = newAssigneeId
                ? workspaceMembers.find((m) => m.id === newAssigneeId)
                : null
              await onUpdateItem(row.original.id, {
                assignedTo: newAssigneeId,
                _resolvedAssignee: member
                  ? {
                      id: member.id,
                      name: member.name,
                      email: member.email,
                      avatarUrl: member.avatarUrl,
                    }
                  : null,
              })
            }}
          />
        ),
        enableSorting: false,
        enableResizing: false,
        size: 110,
      },
      // Story 6.2: Responsible Person (inline editable) - avatar only
      {
        id: 'responsiblePerson',
        accessorFn: (row) =>
          row.responsibleUser?.name ?? row.responsibleUser?.email ?? '',
        header: 'Ansvarig',
        cell: ({ row }) => (
          <CellErrorBoundary>
            <ResponsibleEditor
              value={row.original.responsibleUser?.id ?? null}
              members={workspaceMembers}
              onChange={async (newUserId) => {
                const member = newUserId
                  ? workspaceMembers.find((m) => m.id === newUserId)
                  : null
                await onUpdateItem(row.original.id, {
                  responsibleUserId: newUserId,
                  _resolvedResponsibleUser: member
                    ? {
                        id: member.id,
                        name: member.name,
                        email: member.email,
                        avatarUrl: member.avatarUrl,
                      }
                    : null,
                })
              }}
            />
          </CellErrorBoundary>
        ),
        enableSorting: false,
        enableResizing: false,
        size: 110,
      },
      // Story 6.2: Task Progress
      {
        id: 'taskProgress',
        header: 'Uppgifter',
        cell: ({ row }) => {
          const progress = taskProgress?.get(row.original.id)
          return (
            <CellErrorBoundary>
              <TaskProgressCell
                completed={progress?.completed ?? null}
                total={progress?.total ?? null}
              />
            </CellErrorBoundary>
          )
        },
        enableSorting: false,
        enableResizing: false,
        size: 160,
      },
      // Story 6.2: Last Activity
      {
        id: 'lastActivity',
        header: ({ column }) => (
          <SortableHeader column={column} label="Aktivitet" />
        ),
        cell: ({ row }) => {
          const activity = lastActivity?.get(row.original.id)
          return (
            <CellErrorBoundary>
              <LastActivityCell activity={activity ?? null} />
            </CellErrorBoundary>
          )
        },
        size: 120,
        minSize: 145,
        maxSize: 200,
        enableResizing: true,
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
        enableResizing: false,
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
        minSize: 100,
        maxSize: 250,
        enableResizing: true,
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
        minSize: 80,
        maxSize: 150,
        enableResizing: true,
      },
      // Actions
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
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
        enableResizing: false,
        size: 80,
      },
      // Story 6.16: High-Risk Warning Indicator (far right of row)
      // Shows warning icon when HIGH priority + EJ_UPPFYLLD compliance status
      {
        id: 'highRiskWarning',
        header: '',
        cell: ({ row }) => {
          const isHighRisk =
            row.original.priority === 'HIGH' &&
            row.original.complianceStatus === 'EJ_UPPFYLLD'

          if (!isHighRisk) return null

          return (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Hög prioritet och ej uppfylld – kräver åtgärd</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        },
        enableSorting: false,
        enableResizing: false,
        size: 40,
      },
    ],
    [
      onUpdateItem,
      workspaceMembers,
      groups,
      onMoveToGroup,
      taskProgress,
      lastActivity,
    ]
  )

  // Story 6.14: Compute effective column visibility (hide group column when in grouped mode)
  const effectiveColumnVisibility = useMemo(() => {
    if (hideGroupColumn) {
      return { ...columnVisibility, group: false }
    }
    return columnVisibility
  }, [columnVisibility, hideGroupColumn])

  // Column reorder handler (native HTML5 DnD via DraggableColumnHeader)
  const handleColumnReorder = useCallback(
    (activeId: string, overId: string) => {
      const currentOrder =
        columnOrder.length > 0
          ? columnOrder
          : columns.map((c) => c.id ?? '').filter(Boolean)

      const oldIndex = currentOrder.indexOf(activeId)
      const newIndex = currentOrder.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1) return

      handleColumnOrderChange(arrayMove(currentOrder, oldIndex, newIndex))
    },
    [columnOrder, columns, handleColumnOrderChange]
  )

  // Table instance
  const table = useReactTable({
    data: localItems,
    columns,
    state: {
      sorting,
      rowSelection,
      columnVisibility: effectiveColumnVisibility,
      columnSizing,
      columnOrder,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: (updater) => {
      const newVisibility =
        typeof updater === 'function' ? updater(columnVisibility) : updater
      onColumnVisibilityChange(newVisibility)
    },
    onColumnSizingChange: handleColumnSizingChange,
    onColumnOrderChange: (updater) => {
      const newOrder =
        typeof updater === 'function' ? updater(columnOrder) : updater
      handleColumnOrderChange(newOrder)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: 'onEnd',
  })

  // Helper to get column width with live resize preview
  // Uses columnSizingInfo to show resize feedback without state updates
  // Respects minSize/maxSize constraints for visual feedback
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
  const columnOrderKey = useMemo(() => columnOrder.join(','), [columnOrder])
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
    enabled: shouldVirtualize,
  })

  // Selected items
  const selectedItemIds = Object.keys(rowSelection).filter(
    (id) => rowSelection[id]
  )

  // Handle bulk update (Story 6.2: Added complianceStatus and responsibleUserId)
  const handleBulkUpdate = async (updates: {
    status?: LawListItemStatus
    priority?: LawListItemPriority
    complianceStatus?: ComplianceStatus
    responsibleUserId?: string | null
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

  // Render column-reorderable table header (shared between both DnD branches)
  const renderTableHeader = () => (
    <TableHeader
      className={
        shouldVirtualize ? 'sticky top-0 z-20 bg-background' : undefined
      }
    >
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header) => {
            const isPinned = PINNED_COLUMN_IDS.has(header.id)
            const headerContent = (
              <>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                {/* Resize handle - only show for resizable columns */}
                {header.column.getCanResize() && (
                  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    onPointerDown={(e) => e.stopPropagation()}
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
              </>
            )

            if (isPinned) {
              return (
                <TableHead
                  key={header.id}
                  style={{
                    width: getColumnWidth(header.id, header.getSize()),
                  }}
                  className={cn(
                    'relative',
                    header.id === 'title' && 'sticky left-0 bg-background z-10'
                  )}
                >
                  {headerContent}
                </TableHead>
              )
            }

            return (
              <DraggableColumnHeader
                key={header.id}
                id={header.id}
                onReorder={handleColumnReorder}
                style={{
                  width: getColumnWidth(header.id, header.getSize()),
                }}
                className={cn(
                  'relative',
                  header.id === 'title' && 'sticky left-0 bg-background z-10'
                )}
              >
                {headerContent}
              </DraggableColumnHeader>
            )
          })}
        </TableRow>
      ))}
    </TableHeader>
  )

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
          workspaceMembers={workspaceMembers}
        />
      )}

      {/* Table with DnD - overflow-x-auto contains horizontal scroll within table */}
      {/* Story P.4: Use ref for virtualization scroll element */}
      {/* Story 6.14: Conditionally wrap with DndContext (skip when nested in GroupedDocumentListTable) */}
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
        {disableDndContext ? (
          // Story 6.14: When nested, skip DndContext wrapper for rows (parent provides it)
          <Table className="table-fixed">
            {renderTableHeader()}
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
              <SortableContext
                items={localItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {rows.length > 0 ? (
                  shouldVirtualize ? (
                    rowVirtualizer.getVirtualItems().map((virtualItem) => {
                      const row = rows[virtualItem.index]
                      if (!row) return null
                      return (
                        <VirtualSortableRow
                          key={row.id}
                          row={row}
                          virtualItem={virtualItem}
                          columnOrderKey={columnOrderKey}
                          {...(onRowClick ? { onRowClick } : {})}
                        />
                      )
                    })
                  ) : (
                    rows.map((row) => (
                      <SortableRow
                        key={row.id}
                        row={row}
                        columnOrderKey={columnOrderKey}
                        {...(onRowClick ? { onRowClick } : {})}
                      />
                    ))
                  )
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
        ) : (
          // Standard: wrap with DndContext for standalone usage (row reordering)
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <Table className="table-fixed">
              {renderTableHeader()}
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
                <SortableContext
                  items={localItems.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {rows.length > 0 ? (
                    shouldVirtualize ? (
                      // Story P.4: Virtualized rendering for large datasets
                      rowVirtualizer.getVirtualItems().map((virtualItem) => {
                        const row = rows[virtualItem.index]
                        if (!row) return null
                        return (
                          <VirtualSortableRow
                            key={row.id}
                            row={row}
                            virtualItem={virtualItem}
                            columnOrderKey={columnOrderKey}
                            {...(onRowClick ? { onRowClick } : {})}
                          />
                        )
                      })
                    ) : (
                      // Standard rendering for small datasets
                      rows.map((row) => (
                        <SortableRow
                          key={row.id}
                          row={row}
                          columnOrderKey={columnOrderKey}
                          {...(onRowClick ? { onRowClick } : {})}
                        />
                      ))
                    )
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
        )}
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
// Story 6.16: Column Header with Info Tooltip
// ============================================================================

/**
 * Reusable column header component with sortable functionality and info tooltip
 * Used for Efterlevnad and Prioritet columns to explain their meaning
 */
function ColumnHeaderWithTooltip({
  column,
  label,
  tooltipContent,
}: {
  column: {
    getIsSorted: () => false | 'asc' | 'desc'
    toggleSorting: (_desc?: boolean) => void
  }
  label: string
  tooltipContent: { title: string; lines: string[] }
}) {
  const sorted = column.getIsSorted()

  return (
    <div className="flex items-center gap-1">
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
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="rounded p-0.5 hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={`Information om ${label}`}
            >
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px] p-3">
            <div className="space-y-2">
              <p className="font-semibold text-sm text-foreground">
                {tooltipContent.title}
              </p>
              <ul className="space-y-1.5">
                {tooltipContent.lines.map((line, i) => (
                  <li
                    key={i}
                    className="text-xs text-muted-foreground leading-relaxed flex gap-2"
                  >
                    <span className="text-muted-foreground/60">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

// ============================================================================
// Sortable Row Component (Story P.4: Wrapped with memo)
// ============================================================================

const SortableRow = memo(function SortableRow({
  row,
  onRowClick,
  columnOrderKey: _columnOrderKey,
}: {
  row: ReturnType<
    ReturnType<typeof useReactTable<DocumentListItem>>['getRowModel']
  >['rows'][number]
  onRowClick?: (_listItemId: string) => void
  columnOrderKey?: string
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

  // Story 6.2: Handle row click (ignore interactive elements)
  const handleRowClick = useCallback(
    (e: React.MouseEvent<HTMLTableRowElement>) => {
      if (!onRowClick) return
      const target = e.target as HTMLElement
      // Don't trigger if clicking on interactive elements
      if (
        target.closest(
          'button, input, select, a, [role="combobox"], [role="checkbox"]'
        )
      ) {
        return
      }
      onRowClick(row.original.id)
    },
    [onRowClick, row.original.id]
  )

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={row.getIsSelected() && 'selected'}
      className={cn('group', onRowClick && 'cursor-pointer hover:bg-muted/50')}
      onClick={handleRowClick}
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
})

// ============================================================================
// Story P.4: Virtual Sortable Row Component for large datasets
// ============================================================================

const VirtualSortableRow = memo(function VirtualSortableRow({
  row,
  virtualItem,
  onRowClick,
  columnOrderKey: _columnOrderKey,
}: {
  row: ReturnType<
    ReturnType<typeof useReactTable<DocumentListItem>>['getRowModel']
  >['rows'][number]
  virtualItem: VirtualItem
  onRowClick?: (_listItemId: string) => void
  columnOrderKey?: string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id })

  const style: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: `${virtualItem.size}px`,
    transform: transform
      ? `translate3d(${transform.x}px, ${virtualItem.start + transform.y}px, 0)`
      : `translateY(${virtualItem.start}px)`,
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  // Handle row click (ignore interactive elements)
  const handleRowClick = useCallback(
    (e: React.MouseEvent<HTMLTableRowElement>) => {
      if (!onRowClick) return
      const target = e.target as HTMLElement
      if (
        target.closest(
          'button, input, select, a, [role="combobox"], [role="checkbox"]'
        )
      ) {
        return
      }
      onRowClick(row.original.id)
    },
    [onRowClick, row.original.id]
  )

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={row.getIsSelected() && 'selected'}
      className={cn('group', onRowClick && 'cursor-pointer hover:bg-muted/50')}
      onClick={handleRowClick}
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
})
