/**
 * Epic 28: Unified DataTable — public API.
 * Consumers import ONLY from this file.
 */
export { DataTable } from './data-table'
export { useDataTable } from './use-data-table'
export { DataTableSkeleton } from './data-table-skeleton'
export { useLocalSorting, useLocalStorageColumnState } from './adapters'
export { useContainerWidth } from './use-container-width'
export { INTERACTIVE_SELECTOR, isInteractiveTarget } from './interactive-guard'
export {
  DEFAULT_CARD_BELOW,
  VIEW_HYSTERESIS_PX,
  resolveView,
} from './view-resolution'
export { SELECT_COLUMN_ID } from './chrome-columns'
export { DataTableSortMenu } from './sort-menu'
export type {
  CardSlot,
  ColumnStateAdapter,
  DataTableColumnMeta,
  DataTableProps,
  DataTableRowHeight,
  DataTableSlots,
  DataTableStatus,
  DataTableView,
  DndConfig,
  ExpansionConfig,
  LoadMoreStrategy,
  RowInteraction,
  SelectionAdapter,
  SortingAdapter,
  ViewConfig,
  VirtualizationConfig,
} from './types'
