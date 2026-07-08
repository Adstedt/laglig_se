/**
 * Epic 28: Unified DataTable core — public type surface.
 *
 * This file is the API contract. After the Story 28.7 freeze checkpoint,
 * changes here require their own story — consumers add config, not surface.
 *
 * Hard rule for everything under components/ui/data-table/: no domain types
 * (Prisma models, DocumentListItem, …). Consumers own columns, cells, copy.
 */
import type {
  ColumnDef,
  ColumnOrderState,
  ColumnSizingState,
  ExpandedState,
  OnChangeFn,
  Row,
  RowData,
  SortingState,
  Table,
  VisibilityState,
} from '@tanstack/react-table'
import type * as React from 'react'

// ============================================================================
// Column meta (TanStack module augmentation, namespaced under `dt`)
// ============================================================================

declare module '@tanstack/react-table' {
  // Interface merging requires the exact type-param names TanStack declares.
  // eslint-disable-next-line no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    dt?: DataTableColumnMeta<TData>
  }
}

/** Card-face slot mapping for the narrow-container renderer. */
export type CardSlot<TData> =
  | { role: 'hidden' }
  | { role: 'title' }
  | {
      role: 'badge' | 'meta' | 'footer'
      /** Lower renders first; badge overflow collapses to "+N". Default: column order. */
      priority?: number
      /** Label shown next to the value in meta rows. Defaults to `label`; null = bare value. */
      cardLabel?: string | null
      /** Override the table cell renderer when it doesn't fit a card. */
      renderCard?: (_row: Row<TData>) => React.ReactNode
      /** Allow interactive popover editors on the card face. Default false. */
      interactive?: boolean
    }

export interface DataTableColumnMeta<TData = unknown> {
  /**
   * Plain-string label. Required by convention: drives the card-view sort
   * dropdown, column-settings UI, and card meta labels (headers may be JSX).
   */
  label: string

  // ---- table renderer ----
  /** Kept at the edge, excluded from reorder + visibility UI. */
  pinned?: 'left' | 'right'
  /** position:sticky left inside the horizontal scroll container (primary column). */
  stickyLeft?: boolean
  align?: 'left' | 'center' | 'right'
  /** tabular-nums + right-align default. */
  numeric?: boolean
  padding?: 'default' | 'tight' | 'none'
  /** Cannot be hidden via column settings. */
  mandatory?: boolean
  /** Resize clamp. Derived from columnDef.minSize/maxSize when omitted. */
  bounds?: { min: number; max: number }
  /**
   * This column absorbs leftover container width (at most one per table —
   * typically the title). Its declared size acts as the minimum; when the
   * column sum is below the container, the surplus goes here instead of
   * the trailing spacer, so the primary column breathes at every width.
   */
  fill?: boolean
  /** Rendered as an info-icon tooltip in the header. */
  headerTooltip?: { title: string; lines: string[] }
  /** Reserved (column shedding before the card flip — later phase). */
  hideBelow?: number

  // ---- card renderer ----
  /** Default when omitted: { role: 'meta', priority: columnIndex }. */
  card?: CardSlot<TData>
}

// ============================================================================
// State adapters — the core never owns persistence
// ============================================================================

export interface SortingAdapter {
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  /** true → manualSorting: the caller (server/URL) sorts; core skips getSortedRowModel. */
  manual?: boolean
}

/**
 * Set-of-ids, NOT TanStack RowSelectionState. The core keeps no local
 * selection state, so grouped cross-section selection is correct by
 * construction. Converted to/from RowSelectionState per instance internally.
 */
export interface SelectionAdapter<TData = unknown> {
  selected: ReadonlySet<string>
  onSelectedChange: (_next: Set<string>) => void
  enableRow?: (_row: TData) => boolean
}

export interface ColumnStateAdapter {
  visibility?: VisibilityState
  onVisibilityChange?: OnChangeFn<VisibilityState>
  /** Enables header drag-reorder when set. */
  order?: ColumnOrderState
  onOrderChange?: OnChangeFn<ColumnOrderState>
  /** Enables resize grips when set; core clamps before emitting. */
  sizing?: ColumnSizingState
  onSizingChange?: OnChangeFn<ColumnSizingState>
}

export interface ExpansionConfig<TData> {
  renderExpanded: (_row: Row<TData>) => React.ReactNode
  getRowCanExpand?: (_row: Row<TData>) => boolean
  /** Controlled; omit for internal state. */
  expanded?: ExpandedState
  onExpandedChange?: OnChangeFn<ExpandedState>
  /** Accordion behavior: expanding one row collapses the others. */
  single?: boolean
}

// ============================================================================
// Behaviors
// ============================================================================

export type DndConfig =
  | { mode: 'off' }
  | {
      /** Core owns DndContext + SortableContext (vertical reorder). */
      mode: 'self'
      onReorder: (
        _items: Array<{ id: string; position: number }>
      ) => Promise<boolean> | void
      disabled?: boolean
    }
  | {
      /** Parent owns DndContext (grouped mode); core renders sortable rows only. */
      mode: 'external'
    }

export type LoadMoreStrategy =
  | { kind: 'none' }
  | {
      /** "Visa fler" button — covers offset-append AND cursor-append. */
      kind: 'button'
      hasMore: boolean
      isLoading: boolean
      onLoadMore: () => void
      label?: string
      shownCount?: number
      totalCount?: number
    }
  | {
      /** Fired from the virtualizer's end-reach. */
      kind: 'infinite'
      hasMore: boolean
      isLoading: boolean
      onLoadMore: () => void
    }
  | {
      /** Numbered prev/next (admin tables). */
      kind: 'pagination'
      page: number
      pageCount: number
      onPageChange: (_page: number) => void
      /** Left-aligned summary ("Visar 1–50 av 213 mallar"). */
      summary?: string
    }

export interface RowInteraction<TData> {
  /**
   * Core applies the interactive-element guard BEFORE calling this.
   * The consumer decides modal / deeplink / router.push inside.
   */
  onRowClick?: (
    _row: TData,
    _ctx: { event: React.MouseEvent; view: DataTableView }
  ) => void
  getRowClassName?: (_row: TData) => string | undefined
}

export interface VirtualizationConfig {
  /** Row count above which virtualization engages. Default 100. */
  threshold?: number
  /** Default derived from rowHeight (44/52/72). */
  estimateRowHeight?: number
  /**
   * Scroll-container max height: px number or any CSS length ('70vh').
   * Default 600. 'fill' = flex-1 min-h-0 parent owns the height.
   */
  maxHeight?: number | 'fill' | string
  /** Default 5. */
  overscan?: number
}

// ============================================================================
// Renderer switch
// ============================================================================

export type DataTableView = 'table' | 'card'

export interface ViewConfig {
  /**
   * Container px below which the card renderer engages. Default 640.
   * false = table always. Card→table flips back only at cardBelow + 24
   * (hysteresis: the swap itself can toggle a ~17px scrollbar).
   */
  cardBelow?: number | false
  /** Manual override — wins over container width (laglistor's user viewMode). */
  force?: DataTableView
  /** First-paint fallback before the container is measured. Default 'table'. */
  ssrDefault?: DataTableView
  /**
   * Render the built-in sort dropdown above the card list. Default true.
   * Pages that place a DataTableSortMenu inside their own toolbar row set
   * this false to avoid a stacked duplicate.
   */
  showCardSortMenu?: boolean
}

// ============================================================================
// Presentation
// ============================================================================

export type DataTableRowHeight = 'compact' | 'default' | 'tall'

export const ROW_HEIGHT_PX: Record<DataTableRowHeight, number> = {
  compact: 44,
  default: 52,
  tall: 72,
}

export interface DataTableStatus {
  isLoading?: boolean
  error?: { message: string; retry?: () => void } | null
  /** Distinguishes truly-empty vs filtered-empty slot. */
  isFiltered?: boolean
}

export interface DataTableSlots<TData> {
  /** Truly empty (consumer-owned EmptyState composition + Swedish copy). */
  empty?: React.ReactNode
  /** Filters active, zero matches. */
  filteredEmpty?: React.ReactNode
  error?: React.ReactNode
  skeleton?: React.ReactNode
  /** Rendered below rows, before the load-more footer. */
  footer?: React.ReactNode
  /** Card-view kebab content. Defaults to the pinned-right actions column. */
  cardActions?: (_row: Row<TData>) => React.ReactNode
}

// ============================================================================
// Component props
// ============================================================================

export interface DataTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
  /** Required — Set-based selection and dnd depend on stable ids. */
  getRowId: (_row: TData) => string

  // State adapters (all optional; absent = feature off, zero mounted cost)
  sorting?: SortingAdapter
  selection?: SelectionAdapter<TData>
  columnState?: ColumnStateAdapter
  expansion?: ExpansionConfig<TData>

  // Behaviors
  dnd?: DndConfig
  loadMore?: LoadMoreStrategy
  rowInteraction?: RowInteraction<TData>
  virtualization?: VirtualizationConfig | false

  // Renderer switch
  view?: ViewConfig

  // Presentation
  rowHeight?: DataTableRowHeight
  /** Default: true when virtualized. */
  stickyHeader?: boolean
  status?: DataTableStatus
  slots?: DataTableSlots<TData>
  className?: string
}

// ============================================================================
// Internal render list (expansion × virtualization flattening)
// ============================================================================

/**
 * The virtualizer iterates this flattened list, not rows: each expanded
 * detail is its own virtual item with its own measureElement ref, so
 * dynamic detail heights never break the row-height estimate.
 */
export type RenderItem<TData> =
  | { kind: 'row'; row: Row<TData>; key: string }
  | { kind: 'detail'; row: Row<TData>; key: string }

export interface UseDataTableResult<TData> {
  table: Table<TData>
  containerProps: {
    ref: React.RefCallback<HTMLDivElement>
    className: string
  }
  view: DataTableView
  renderItems: RenderItem<TData>[]
  /** Measured container width (8px-quantized); null before first measure. */
  containerWidth: number | null
}
