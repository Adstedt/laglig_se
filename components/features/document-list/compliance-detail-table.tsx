'use client'

/**
 * Story 6.18: Compliance Detail Table (Efterlevnad view)
 * Shows compliance substance (business impact and compliance actions) directly in the list
 * for quick scanning during audit preparation without opening modals.
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
  type ColumnSizingState,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
} from 'lucide-react'
import { BulkActionBar } from './bulk-action-bar'
import { ComplianceStatusEditor } from './table-cell-editors/compliance-status-editor'
import { PriorityEditor } from './table-cell-editors/priority-editor'
import { ResponsibleEditor } from './table-cell-editors/responsible-editor'
import { CellErrorBoundary } from './table-cells/cell-error-boundary'
import type {
  DocumentListItem,
  WorkspaceMemberOption,
  ListGroupSummary,
} from '@/app/actions/document-list'
import type { ComplianceStatus, LawListItemPriority } from '@prisma/client'
import type { VisibilityState } from '@tanstack/react-table'
import { useDebouncedCallback } from 'use-debounce'
import { cn } from '@/lib/utils'
import {
  getContentTypeIcon,
  getContentTypeBadgeColor,
  getContentTypeLabel,
} from '@/lib/utils/content-type'

// ============================================================================
// Constants
// ============================================================================

/** Enable virtualization when items exceed this threshold */
const VIRTUALIZATION_THRESHOLD = 100

/** Estimated row height for virtualization calculations */
const ESTIMATED_ROW_HEIGHT = 72

/** Number of rows to render outside viewport for smooth scrolling */
const OVERSCAN_COUNT = 5

/** Maximum height of virtualized table container */
const VIRTUAL_TABLE_MAX_HEIGHT = 600

/** Tooltip delay in ms (AC specifies 200-300ms) */
const TOOLTIP_DELAY = 250

// ============================================================================
// Props
// ============================================================================

interface ComplianceDetailTableProps {
  items: DocumentListItem[]
  total: number
  hasMore: boolean
  isLoading: boolean
  workspaceMembers: WorkspaceMemberOption[]
  onLoadMore: () => void
  onRemoveItem: (_itemId: string) => Promise<boolean>
  onReorderItems: (
    _items: Array<{ id: string; position: number }>
  ) => Promise<boolean>
  onUpdateItem: (
    _itemId: string,
    _updates: {
      complianceStatus?: ComplianceStatus
      priority?: LawListItemPriority
      responsibleUserId?: string | null
    }
  ) => Promise<boolean>
  onBulkUpdate: (
    _itemIds: string[],
    _updates: {
      complianceStatus?: ComplianceStatus
      responsibleUserId?: string | null
    }
  ) => Promise<boolean>
  groups?: ListGroupSummary[] | undefined
  onMoveToGroup?:
    | ((_itemId: string, _groupId: string | null) => Promise<boolean>)
    | undefined
  /** Story 6.18: Column visibility for showing/hiding optional columns */
  columnVisibility?: VisibilityState | undefined
  onColumnVisibilityChange?:
    | ((_visibility: VisibilityState) => void)
    | undefined
  /** Column sizing for resizable columns */
  columnSizing?: ColumnSizingState | undefined
  onColumnSizingChange?: ((_sizing: ColumnSizingState) => void) | undefined
  emptyMessage?: string | undefined
  /** Called when row is clicked (opens modal) */
  onRowClick?: ((_listItemId: string) => void) | undefined
  /** Called when "Lägg till" link is clicked (opens modal with editor focused) */
  onAddContent?:
    | ((
        _listItemId: string,
        _field: 'businessContext' | 'complianceActions'
      ) => void)
    | undefined
  /** For nested usage in grouped accordion tables */
  hideGroupColumn?: boolean | undefined
  disableDndContext?: boolean | undefined
}

// ============================================================================
// Helper: Strip HTML tags for display
// ============================================================================

function stripHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').trim()
}

// ============================================================================
// Truncated Text Cell with Tooltip
// ============================================================================

interface TruncatedTextCellProps {
  content: string | null
  title: string
  updatedAt?: Date | null
  updatedByName?: string | null
  onAddClick?: () => void
  isNotApplicable?: boolean
}

function TruncatedTextCell({
  content,
  title,
  updatedAt,
  updatedByName,
  onAddClick,
  isNotApplicable,
}: TruncatedTextCellProps) {
  const text = stripHtml(content)

  // Not applicable - show dash
  if (isNotApplicable) {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  // Empty content - show "Lägg till" link
  if (!text) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onAddClick?.()
        }}
        className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 px-2 py-1 rounded border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-colors"
      >
        <Plus className="h-3 w-3" />
        Lägg till
      </button>
    )
  }

  // Has content - show truncated with tooltip
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <TooltipProvider delayDuration={TOOLTIP_DELAY}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="line-clamp-2 text-sm text-foreground cursor-help">
            {text}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-[400px] p-4"
        >
          <div className="space-y-2">
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {text}
            </p>
            {updatedAt && (
              <p className="text-xs text-muted-foreground">
                Senast uppdaterad {formatDate(updatedAt)}
                {updatedByName && ` av ${updatedByName}`}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// Expanded Row Content
// ============================================================================

interface ExpandedRowContentProps {
  item: DocumentListItem
  workspaceMembers: WorkspaceMemberOption[]
}

function ExpandedRowContent({
  item,
  workspaceMembers,
}: ExpandedRowContentProps) {
  const businessContextText = stripHtml(item.businessContext)
  const complianceActionsText = stripHtml(item.complianceActions)
  const isNotApplicable = item.complianceStatus === 'EJ_TILLAMPLIG'

  const formatDate = (date: Date | null) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getUserName = (userId: string | null) => {
    if (!userId) return null
    const user = workspaceMembers.find((m) => m.id === userId)
    return user?.name ?? user?.email ?? null
  }

  return (
    <div className="px-4 py-4 bg-muted/30 border-t space-y-4">
      {isNotApplicable ? (
        <p className="text-sm text-muted-foreground italic">
          Denna lag är markerad som ej tillämplig för verksamheten.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Business Context */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              Hur påverkar denna lag oss?
            </h4>
            {businessContextText ? (
              <>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {businessContextText}
                </p>
                {item.updatedAt && (
                  <p className="text-xs text-muted-foreground">
                    Senast uppdaterad {formatDate(item.updatedAt)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Ingen beskrivning tillagd.
              </p>
            )}
          </div>

          {/* Compliance Actions */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">
              Hur efterlever vi kraven?
            </h4>
            {complianceActionsText ? (
              <>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {complianceActionsText}
                </p>
                {item.complianceActionsUpdatedAt && (
                  <p className="text-xs text-muted-foreground">
                    Senast uppdaterad{' '}
                    {formatDate(item.complianceActionsUpdatedAt)}
                    {item.complianceActionsUpdatedBy &&
                      ` av ${getUserName(item.complianceActionsUpdatedBy)}`}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Ingen beskrivning tillagd.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ComplianceDetailTable({
  items,
  total: _total,
  hasMore,
  isLoading,
  workspaceMembers,
  onLoadMore,
  onRemoveItem: _onRemoveItem,
  onReorderItems,
  onUpdateItem,
  onBulkUpdate,
  groups: _groups = [],
  onMoveToGroup: _onMoveToGroup,
  columnVisibility = {},
  onColumnVisibilityChange: _onColumnVisibilityChange,
  columnSizing: externalColumnSizing,
  onColumnSizingChange,
  emptyMessage = 'Inga dokument i listan.',
  onRowClick,
  onAddContent,
  hideGroupColumn: _hideGroupColumn = false,
  disableDndContext = false,
}: ComplianceDetailTableProps) {
  // Local state
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [localItems, setLocalItems] = useState<DocumentListItem[]>(items)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [internalColumnSizing, setInternalColumnSizing] =
    useState<ColumnSizingState>({})

  // Use external sizing if provided, otherwise use internal
  const columnSizing = externalColumnSizing ?? internalColumnSizing
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

  // Virtualization refs
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

  // Toggle row expansion (accordion behavior - only one row at a time)
  const handleToggleExpand = useCallback((rowId: string) => {
    setExpandedRowId((prev) => (prev === rowId ? null : rowId))
  }, [])

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
      // Content Type icon (Typ) - fixed size, consistent across views
      {
        id: 'contentType',
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
        enableSorting: false,
        enableResizing: false,
        size: 60,
      },
      // Document title - fixed size, consistent across views
      {
        id: 'title',
        accessorFn: (row) => row.document.title,
        header: ({ column }) => (
          <SortableHeader column={column} label="Dokument" />
        ),
        cell: ({ row }) => (
          <div className="w-full overflow-hidden">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRowClick?.(row.original.id)
              }}
              className="text-sm font-medium text-foreground hover:underline text-left block truncate"
              title={row.original.document.title}
            >
              {row.original.document.title}
            </button>
            <span className="text-xs text-muted-foreground block truncate">
              {row.original.document.documentNumber}
            </span>
          </div>
        ),
        size: 300,
      },
      // Business Context (truncated)
      {
        id: 'businessContext',
        header: 'Hur påverkar denna lag oss?',
        cell: ({ row }) => (
          <CellErrorBoundary>
            <TruncatedTextCell
              content={row.original.businessContext}
              title="Hur påverkar denna lag oss?"
              updatedAt={row.original.updatedAt}
              isNotApplicable={
                row.original.complianceStatus === 'EJ_TILLAMPLIG'
              }
              onAddClick={() =>
                onAddContent?.(row.original.id, 'businessContext')
              }
            />
          </CellErrorBoundary>
        ),
        size: 240,
        minSize: 240,
        maxSize: 500,
        enableResizing: true,
      },
      // Compliance Actions (truncated)
      {
        id: 'complianceActions',
        header: 'Hur efterlever vi kraven?',
        cell: ({ row }) => (
          <CellErrorBoundary>
            <TruncatedTextCell
              content={row.original.complianceActions}
              title="Hur efterlever vi kraven?"
              updatedAt={row.original.complianceActionsUpdatedAt}
              updatedByName={
                row.original.complianceActionsUpdatedBy
                  ? (workspaceMembers.find(
                      (m) => m.id === row.original.complianceActionsUpdatedBy
                    )?.name ?? null)
                  : null
              }
              isNotApplicable={
                row.original.complianceStatus === 'EJ_TILLAMPLIG'
              }
              onAddClick={() =>
                onAddContent?.(row.original.id, 'complianceActions')
              }
            />
          </CellErrorBoundary>
        ),
        size: 215,
        minSize: 215,
        maxSize: 500,
        enableResizing: true,
      },
      // Compliance Status (compact badge)
      {
        id: 'complianceStatus',
        accessorKey: 'complianceStatus',
        header: 'Status',
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
        size: 140,
        minSize: 200,
        maxSize: 250,
        enableResizing: true,
      },
      // Priority (compact badge)
      {
        id: 'priority',
        accessorKey: 'priority',
        header: 'Prioritet',
        cell: ({ row }) => (
          <PriorityEditor
            value={row.original.priority}
            onChange={async (newPriority) => {
              await onUpdateItem(row.original.id, { priority: newPriority })
            }}
          />
        ),
        size: 110,
        minSize: 170,
        maxSize: 220,
        enableResizing: true,
      },
      // Responsible Person (avatar only)
      {
        id: 'responsiblePerson',
        header: 'Ansvarig',
        cell: ({ row }) => (
          <CellErrorBoundary>
            <ResponsibleEditor
              value={row.original.responsibleUser?.id ?? null}
              members={workspaceMembers}
              onChange={async (newUserId) => {
                await onUpdateItem(row.original.id, {
                  responsibleUserId: newUserId,
                })
              }}
            />
          </CellErrorBoundary>
        ),
        enableSorting: false,
        enableResizing: false,
        size: 110,
      },
      // Expand chevron
      {
        id: 'expand',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation()
              handleToggleExpand(row.original.id)
            }}
            aria-label={
              expandedRowId === row.original.id ? 'Fäll ihop' : 'Expandera'
            }
          >
            {expandedRowId === row.original.id ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        ),
        enableSorting: false,
        enableResizing: false,
        size: 50,
      },
    ],
    [
      onUpdateItem,
      workspaceMembers,
      onRowClick,
      onAddContent,
      handleToggleExpand,
      expandedRowId,
    ]
  )

  // Table instance
  const table = useReactTable({
    data: localItems,
    columns,
    state: {
      sorting,
      rowSelection,
      columnVisibility,
      columnSizing,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: handleColumnSizingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: 'onEnd',
  })

  // Row virtualizer for large datasets
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

  const rows = table.getRowModel().rows
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

  // Handle bulk update
  const handleBulkUpdate = async (updates: {
    complianceStatus?: ComplianceStatus
    responsibleUserId?: string | null
  }) => {
    await onBulkUpdate(selectedItemIds, updates)
    setRowSelection({})
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

  const renderTableContent = () => (
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
                style={{ width: getColumnWidth(header.id, header.getSize()) }}
                className={cn(
                  'relative',
                  header.id === 'title' && 'sticky left-0 bg-background z-10'
                )}
              >
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
                  <VirtualComplianceRow
                    key={row.id}
                    row={row}
                    virtualItem={virtualItem}
                    expandedRowId={expandedRowId}
                    onRowClick={onRowClick}
                  />
                )
              })
            ) : (
              rows.map((row) => (
                <ComplianceRow
                  key={row.id}
                  row={row}
                  expandedRowId={expandedRowId}
                  workspaceMembers={workspaceMembers}
                  onRowClick={onRowClick}
                />
              ))
            )
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {isLoading ? 'Laddar...' : 'Inga resultat.'}
              </TableCell>
            </TableRow>
          )}
        </SortableContext>
      </TableBody>
    </Table>
  )

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

      {/* Table */}
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
          renderTableContent()
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            {renderTableContent()}
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
// Compliance Row Component
// ============================================================================

const ComplianceRow = memo(function ComplianceRow({
  row,
  expandedRowId,
  workspaceMembers,
  onRowClick,
}: {
  row: ReturnType<
    ReturnType<typeof useReactTable<DocumentListItem>>['getRowModel']
  >['rows'][number]
  expandedRowId: string | null
  workspaceMembers: WorkspaceMemberOption[]
  onRowClick?: ((_listItemId: string) => void) | undefined
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

  const isExpanded = expandedRowId === row.original.id

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
    <>
      <TableRow
        ref={setNodeRef}
        style={style}
        data-state={row.getIsSelected() && 'selected'}
        className={cn(
          'group',
          onRowClick && 'cursor-pointer hover:bg-muted/50',
          isExpanded && 'bg-muted/30'
        )}
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
      {/* Expanded content */}
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={row.getVisibleCells().length} className="p-0">
            <ExpandedRowContent
              item={row.original}
              workspaceMembers={workspaceMembers}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  )
})

// ============================================================================
// Virtual Compliance Row Component
// ============================================================================

const VirtualComplianceRow = memo(function VirtualComplianceRow({
  row,
  virtualItem,
  expandedRowId,
  onRowClick,
}: {
  row: ReturnType<
    ReturnType<typeof useReactTable<DocumentListItem>>['getRowModel']
  >['rows'][number]
  virtualItem: VirtualItem
  expandedRowId: string | null
  onRowClick?: ((_listItemId: string) => void) | undefined
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id })

  const isExpanded = expandedRowId === row.original.id

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
    <>
      <TableRow
        ref={setNodeRef}
        style={style}
        data-state={row.getIsSelected() && 'selected'}
        className={cn(
          'group',
          onRowClick && 'cursor-pointer hover:bg-muted/50',
          isExpanded && 'bg-muted/30'
        )}
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
    </>
  )
})
