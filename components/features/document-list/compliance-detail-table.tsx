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
  type ColumnOrderState,
  type Row,
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
  Info,
} from 'lucide-react'
import { KravpunkterChecklist } from './legal-document-modal/kravpunkter-checklist'
import { RichTextDisplay } from '@/components/ui/rich-text-editor'
import useSWR from 'swr'
import {
  getRequirementsForListItem,
  type RequirementWithEvidence,
} from '@/app/actions/law-list-item-requirements'
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
import { DraggableColumnHeader } from '@/components/ui/draggable-column-header'
import { ChangeIndicator } from '@/components/features/changes/change-indicator'
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

/** Tooltip content for "Hur påverkar denna lag oss?" column header */
const HUR_PAVERKAR_TOOLTIP_CONTENT = {
  title: 'Hur påverkar denna lag oss?',
  lines: [
    'Beskriver varför lagen är relevant för er verksamhet.',
    'Förklarar vilka processer, avdelningar eller produkter som berörs.',
    'Ger kontext vid revisioner och underlättar intern kommunikation.',
  ],
}

/** Tooltip content for "Kravpunkter" column header (renamed from "Hur efterlever vi kraven?" in 17.18) */
const KRAVPUNKTER_TOOLTIP_CONTENT = {
  title: 'Kravpunkter',
  lines: [
    'Strukturerad checklista över konkreta krav denna lag ställer på er.',
    'Markera som uppfyllda när ni har bevis eller rutiner på plats.',
    'Länka dokument och filer som bevis per kravpunkt.',
  ],
}

// ============================================================================
// Props
// ============================================================================

/** Column IDs that cannot be reordered (pinned to edges) */
const PINNED_COLUMN_IDS = new Set(['select', 'dragHandle', 'expand'])

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
  /** Column order for drag-to-reorder */
  columnOrder?: ColumnOrderState | undefined
  onColumnOrderChange?: ((_order: ColumnOrderState) => void) | undefined
  emptyMessage?: string | undefined
  /** Called when row is clicked (opens modal) */
  onRowClick?: ((_listItemId: string) => void) | undefined
  /** Called when "Lägg till" link is clicked (opens modal with editor focused) */
  onAddContent?:
    | ((
        _listItemId: string,
        _field: 'businessContext' | 'complianceActions' | 'kravpunkter'
      ) => void)
    | undefined
  /** For nested usage in grouped accordion tables */
  hideGroupColumn?: boolean | undefined
  disableDndContext?: boolean | undefined
  /** Story 17.17: When true, inline kravpunkter editor renders read-only */
  complianceReadOnly?: boolean | undefined
}

// ============================================================================
// Helpers
// ============================================================================

function stripHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').trim()
}

function formatSwedishDate(date: Date | null): string | null {
  if (!date) return null
  return new Date(date).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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
                Senast uppdaterad {formatSwedishDate(updatedAt)}
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
  row: Row<DocumentListItem>
  /** Story 17.17: disables inline kravpunkter editing for users without tasks:edit */
  complianceReadOnly?: boolean | undefined
  /** Story 17.18: used to resolve "Senast uppdaterad … av {name}" in the Kommentar subsection */
  workspaceMembers: WorkspaceMemberOption[]
}

/**
 * Story 17.17 + 17.18: Expanded row content.
 *
 * Design direction (v1.3 "centered detail panel" + 17.18 kravpunkter-forward):
 * centered card with two sections — "Hur påverkar denna lag oss?" (business
 * context + Kommentar subsection) on the left, "Kravpunkter" (checklist +
 * progress tracker in the header) on the right. Sentence-case section labels
 * match the modal's accordion vocabulary. The legacy `compliance_actions` free
 * text is now surfaced as a first-class "Kommentar" subsection rather than a
 * dismissable banner.
 */
function ExpandedRowContent({
  row,
  complianceReadOnly,
  workspaceMembers,
}: ExpandedRowContentProps) {
  const item = row.original
  const businessContextText = stripHtml(item.businessContext)
  const hasComplianceActions =
    !!item.complianceActions && stripHtml(item.complianceActions).length > 0
  const isNotApplicable = item.complianceStatus === 'EJ_TILLAMPLIG'

  const businessContextUpdatedByName = item.businessContextUpdatedBy
    ? (workspaceMembers.find((m) => m.id === item.businessContextUpdatedBy)
        ?.name ?? null)
    : null

  const complianceActionsUpdatedByName = item.complianceActionsUpdatedBy
    ? (workspaceMembers.find((m) => m.id === item.complianceActionsUpdatedBy)
        ?.name ?? null)
    : null

  const [kravpunkterProgress, setKravpunkterProgress] = useState<{
    fulfilled: number
    total: number
  }>({ fulfilled: 0, total: 0 })

  const visibleCells = row.getVisibleCells()

  const outerCellClass = 'bg-muted/30 border-t border-border/60 p-0'
  const cardShellClass =
    'mx-auto max-w-6xl rounded-lg border border-border bg-card shadow-sm'
  // Section headers use sentence-case + a hairline underline — matches the
  // modal's accordion label treatment ("Kravpunkter" in both places).
  const sectionLabelClass =
    'flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border/50 pb-2 mb-3'

  if (isNotApplicable) {
    return (
      <TableCell colSpan={visibleCells.length} className={outerCellClass}>
        <div className="px-6 py-6 lg:px-8">
          <div className={cn(cardShellClass, 'px-6 py-5')}>
            <p className="text-sm text-muted-foreground italic">
              Denna lag är markerad som ej tillämplig för verksamheten.
            </p>
          </div>
        </div>
      </TableCell>
    )
  }

  const progressPercent =
    kravpunkterProgress.total > 0
      ? Math.round(
          (kravpunkterProgress.fulfilled / kravpunkterProgress.total) * 100
        )
      : 0

  return (
    <TableCell colSpan={visibleCells.length} className={outerCellClass}>
      <div className="px-6 py-6 lg:px-8">
        <div className={cn(cardShellClass, 'p-6 lg:p-8')}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-y-8 md:gap-y-0">
            {/* Hur påverkar denna lag oss? — business context + Kommentar (read-only detail view) */}
            <section className="md:pr-8 space-y-6">
              <div>
                <h4 className={sectionLabelClass}>
                  <span>Hur påverkar denna lag oss?</span>
                </h4>
                {businessContextText ? (
                  <div className="space-y-2">
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {businessContextText}
                    </p>
                    {item.businessContextUpdatedAt && (
                      <p className="text-[11px] text-muted-foreground/80">
                        Senast uppdaterad{' '}
                        {formatSwedishDate(item.businessContextUpdatedAt)}
                        {businessContextUpdatedByName &&
                          ` av ${businessContextUpdatedByName}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Ingen beskrivning tillagd.
                  </p>
                )}
              </div>

              <div>
                <h4 className={sectionLabelClass}>
                  <span>Kommentar</span>
                </h4>
                {hasComplianceActions ? (
                  <div className="space-y-2">
                    <RichTextDisplay
                      content={item.complianceActions ?? ''}
                      className="text-sm text-foreground"
                    />
                    {item.complianceActionsUpdatedAt && (
                      <p className="text-[11px] text-muted-foreground/80">
                        Senast uppdaterad{' '}
                        {formatSwedishDate(item.complianceActionsUpdatedAt)}
                        {complianceActionsUpdatedByName &&
                          ` av ${complianceActionsUpdatedByName}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Ingen kommentar tillagd.
                  </p>
                )}
              </div>
            </section>

            {/* Kravpunkter — primary action surface with inline progress tracker */}
            <section className="md:pl-8 md:border-l md:border-border/50">
              <h4 className={sectionLabelClass}>
                <span>Kravpunkter</span>
                {kravpunkterProgress.total > 0 && (
                  <div className="flex items-center gap-2 ml-auto font-normal">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {kravpunkterProgress.fulfilled}/
                      {kravpunkterProgress.total} uppfyllda
                    </span>
                    <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </h4>
              <KravpunkterChecklist
                listItemId={item.id}
                readOnly={complianceReadOnly ?? false}
                onProgressChange={setKravpunkterProgress}
              />
            </section>
          </div>
        </div>
      </div>
    </TableCell>
  )
}

// ============================================================================
// Kravpunkter Count Cell (Story 17.18)
// ============================================================================

/**
 * Story 17.18: Table cell for the "Kravpunkter" column. Renders either a live
 * `N/M uppfyllda` progress pill (when requirements exist) or a "+ Lägg till"
 * ghost button (when none exist). Uses the SAME SWR cache key as
 * KravpunkterChecklist so mutations in the expansion/modal auto-update the cell
 * and vice versa — one source of truth, no double-fetch on expand.
 */
interface KravpunkterCountCellProps {
  listItemId: string
  isNotApplicable: boolean
  readOnly: boolean
  onAddClick: () => void
}

function KravpunkterCountCell({
  listItemId,
  isNotApplicable,
  readOnly,
  onAddClick,
}: KravpunkterCountCellProps) {
  // Same key as KravpunkterChecklist — shared SWR cache.
  const { data: requirements, isLoading } = useSWR<RequirementWithEvidence[]>(
    `list-item-requirements:${listItemId}`,
    async () => {
      const result = await getRequirementsForListItem(listItemId)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta kravpunkter')
      }
      return result.data
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  if (isNotApplicable) {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  if (isLoading && !requirements) {
    return <div className="h-5 w-16 rounded-md bg-muted/60 animate-pulse" />
  }

  const total = requirements?.length ?? 0
  const fulfilled = requirements?.filter((r) => r.isFulfilled).length ?? 0

  if (total === 0) {
    if (readOnly) {
      return <span className="text-muted-foreground text-sm">—</span>
    }
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onAddClick()
        }}
        className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 px-2 py-1 rounded border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-colors"
      >
        <Plus className="h-3 w-3" />
        Lägg till
      </button>
    )
  }

  const progressPercent = Math.round((fulfilled / total) * 100)

  const pillContent = (
    <>
      <span className="text-xs text-muted-foreground tabular-nums">
        {fulfilled}/{total} uppfyllda
      </span>
      <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </>
  )

  if (readOnly) {
    return (
      <div className="inline-flex items-center gap-2 px-2 py-1">
        {pillContent}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onAddClick()
      }}
      className="inline-flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent transition-colors"
      aria-label={`${fulfilled} av ${total} uppfyllda — öppna kravpunkter`}
    >
      {pillContent}
    </button>
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
  columnOrder: externalColumnOrder,
  onColumnOrderChange,
  emptyMessage = 'Inga dokument i listan.',
  onRowClick,
  onAddContent,
  hideGroupColumn: _hideGroupColumn = false,
  disableDndContext = false,
  complianceReadOnly = false,
}: ComplianceDetailTableProps) {
  // Local state
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [localItems, setLocalItems] = useState<DocumentListItem[]>(items)
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(
    () => new Set()
  )
  const [internalColumnSizing, setInternalColumnSizing] =
    useState<ColumnSizingState>({})

  const [internalColumnOrder, setInternalColumnOrder] =
    useState<ColumnOrderState>([])

  // Use external sizing/order if provided, otherwise use internal
  const columnSizing = externalColumnSizing ?? internalColumnSizing
  const columnOrder = externalColumnOrder ?? internalColumnOrder
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

  // Row DnD sensors
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

  // Toggle row expansion — multiple rows may be expanded simultaneously.
  const handleToggleExpand = useCallback((rowId: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) {
        next.delete(rowId)
      } else {
        next.add(rowId)
      }
      return next
    })
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
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRowClick?.(row.original.id)
                }}
                className="text-sm font-medium text-foreground hover:underline text-left truncate"
                title={row.original.document.title}
              >
                {row.original.document.title}
              </button>
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
      // Business Context (truncated)
      {
        id: 'businessContext',
        header: () => (
          <HeaderWithTooltip
            label="Hur påverkar denna lag oss?"
            tooltipContent={HUR_PAVERKAR_TOOLTIP_CONTENT}
          />
        ),
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
      // Kravpunkter (Story 17.18: renamed from "Hur efterlever vi kraven?")
      {
        id: 'complianceActions',
        header: () => (
          <HeaderWithTooltip
            label="Kravpunkter"
            tooltipContent={KRAVPUNKTER_TOOLTIP_CONTENT}
          />
        ),
        cell: ({ row }) => (
          <CellErrorBoundary>
            <KravpunkterCountCell
              listItemId={row.original.id}
              isNotApplicable={
                row.original.complianceStatus === 'EJ_TILLAMPLIG'
              }
              readOnly={complianceReadOnly}
              onAddClick={() => onAddContent?.(row.original.id, 'kravpunkter')}
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
        size: 200,
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
              await onUpdateItem(row.original.id, {
                priority: newPriority as LawListItemPriority,
              })
            }}
          />
        ),
        size: 170,
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
              expandedRowIds.has(row.original.id) ? 'Fäll ihop' : 'Expandera'
            }
          >
            {expandedRowIds.has(row.original.id) ? (
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
      expandedRowIds,
      complianceReadOnly,
    ]
  )

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
      columnVisibility,
      columnSizing,
      columnOrder,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
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
                      header.id === 'title' &&
                        'sticky left-0 bg-background z-10'
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
                    expandedRowIds={expandedRowIds}
                    onRowClick={onRowClick}
                    columnOrderKey={columnOrderKey}
                    complianceReadOnly={complianceReadOnly}
                    workspaceMembers={workspaceMembers}
                  />
                )
              })
            ) : (
              rows.map((row) => (
                <ComplianceRow
                  key={row.id}
                  row={row}
                  expandedRowIds={expandedRowIds}
                  onRowClick={onRowClick}
                  columnOrderKey={columnOrderKey}
                  complianceReadOnly={complianceReadOnly}
                  workspaceMembers={workspaceMembers}
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
// Header with Tooltip Component (for non-sortable columns)
// ============================================================================

function HeaderWithTooltip({
  label,
  tooltipContent,
}: {
  label: string
  tooltipContent: { title: string; lines: string[] }
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-medium">{label}</span>
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
// Compliance Row Component
// ============================================================================

const ComplianceRow = memo(function ComplianceRow({
  row,
  expandedRowIds,
  onRowClick,
  columnOrderKey: _columnOrderKey,
  complianceReadOnly,
  workspaceMembers,
}: {
  row: ReturnType<
    ReturnType<typeof useReactTable<DocumentListItem>>['getRowModel']
  >['rows'][number]
  expandedRowIds: Set<string>
  onRowClick?: ((_listItemId: string) => void) | undefined
  columnOrderKey?: string
  complianceReadOnly?: boolean | undefined
  workspaceMembers: WorkspaceMemberOption[]
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

  const isExpanded = expandedRowIds.has(row.original.id)

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
          <ExpandedRowContent
            row={row}
            complianceReadOnly={complianceReadOnly}
            workspaceMembers={workspaceMembers}
          />
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
  expandedRowIds,
  onRowClick,
  columnOrderKey: _columnOrderKey,
  complianceReadOnly,
  workspaceMembers,
}: {
  row: ReturnType<
    ReturnType<typeof useReactTable<DocumentListItem>>['getRowModel']
  >['rows'][number]
  virtualItem: VirtualItem
  expandedRowIds: Set<string>
  onRowClick?: ((_listItemId: string) => void) | undefined
  columnOrderKey?: string
  complianceReadOnly?: boolean | undefined
  workspaceMembers: WorkspaceMemberOption[]
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id })

  const isExpanded = expandedRowIds.has(row.original.id)

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
      {/* Expanded content */}
      {isExpanded && (
        <TableRow>
          <ExpandedRowContent
            row={row}
            complianceReadOnly={complianceReadOnly}
            workspaceMembers={workspaceMembers}
          />
        </TableRow>
      )}
    </>
  )
})
