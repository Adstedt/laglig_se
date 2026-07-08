/**
 * Column-sizing subsystem — one implementation of the clamp/live-width
 * machinery previously copied in document-list-table, compliance-detail-table
 * and employee-column-state.
 *
 * Why clamping exists: TanStack's `columnResizeMode: 'onEnd'` commits
 * `startSize + deltaOffset` directly, which can fall outside
 * columnDef.minSize/maxSize on extreme drags — and stale persisted sizing
 * from before bounds were added can be out of range too. Clamping before
 * emitting means persisted stores can never hold an invalid width.
 */
import type {
  Column,
  ColumnDef,
  ColumnSizingState,
  Table,
} from '@tanstack/react-table'

export interface ColumnBounds {
  min: number
  max: number
}

/**
 * Bounds per column id, from meta.dt.bounds when present, else
 * minSize/maxSize on the column def. Replaces hand-maintained
 * COLUMN_SIZE_BOUNDS maps.
 */
export function boundsFromColumnDefs<TData>(
  columns: ColumnDef<TData, unknown>[]
): Record<string, ColumnBounds> {
  const bounds: Record<string, ColumnBounds> = {}
  for (const col of columns) {
    const id =
      col.id ??
      (typeof (col as { accessorKey?: unknown }).accessorKey === 'string'
        ? ((col as { accessorKey?: string }).accessorKey as string)
        : undefined)
    if (!id) continue
    const metaBounds = col.meta?.dt?.bounds
    bounds[id] = metaBounds ?? {
      min: col.minSize ?? 0,
      max: col.maxSize ?? Number.POSITIVE_INFINITY,
    }
  }
  return bounds
}

export function clampColumnSizing(
  sizing: ColumnSizingState,
  bounds: Record<string, ColumnBounds>
): ColumnSizingState {
  const clamped: ColumnSizingState = {}
  for (const [id, size] of Object.entries(sizing)) {
    const b = bounds[id]
    clamped[id] = b ? Math.max(b.min, Math.min(b.max, size)) : size
  }
  return clamped
}

function clampToColumn<TData>(column: Column<TData> | undefined, size: number) {
  const min = column?.columnDef.minSize ?? 0
  const max = column?.columnDef.maxSize ?? Number.POSITIVE_INFINITY
  return Math.max(min, Math.min(max, size))
}

/**
 * Column width with live resize preview: during a drag, TanStack exposes
 * startSize + deltaOffset in columnSizingInfo without committing state —
 * reading it here gives per-frame visual feedback for free.
 */
export function getColumnWidth<TData>(
  table: Table<TData>,
  columnId: string,
  defaultSize: number
): number {
  const { columnSizingInfo } = table.getState()
  const column = table.getColumn(columnId)
  if (columnSizingInfo.isResizingColumn === columnId) {
    const liveSize =
      (columnSizingInfo.startSize ?? defaultSize) +
      (columnSizingInfo.deltaOffset ?? 0)
    return clampToColumn(column, liveSize)
  }
  return clampToColumn(column, defaultSize)
}

/**
 * Sum of visible column widths (live-aware during a resize). Applied as
 * minWidth on a `table-fixed` table together with a trailing spacer cell,
 * so fixed-width chrome columns hold their declared widths instead of
 * inflating proportionally when the column sum is below container width.
 */
export function getLiveTotalWidth<TData>(table: Table<TData>): number {
  return table
    .getVisibleLeafColumns()
    .reduce((sum, col) => sum + getColumnWidth(table, col.id, col.getSize()), 0)
}
