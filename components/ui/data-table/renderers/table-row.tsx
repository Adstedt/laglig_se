'use client'

/**
 * Memoized table rows. The comparator includes the memo-busting keys the
 * legacy tables passed but ignored (_columnOrderKey bug): rows re-render
 * when their data, selection, expansion, column order/sizing/visibility
 * or virtual position change — and nothing else.
 */
import { memo, useCallback } from 'react'
import { flexRender, type Cell, type Row } from '@tanstack/react-table'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { DRAG_HANDLE_COLUMN_ID } from '../chrome-columns'
import { isInteractiveTarget } from '../interactive-guard'
import { cellClassesFromMeta } from '../meta'
import type { DataTableView, RowInteraction } from '../types'

interface DataTableRowProps<TData> {
  row: Row<TData>
  rowInteraction?: RowInteraction<TData> | undefined
  view: DataTableView
  /** Memo-busting key: joined column order + visibility + sizing. */
  columnStateKey: string
  /** Virtual mode: measured absolute positioning. */
  virtualStart?: number | undefined
  measureRef?: ((_el: HTMLTableRowElement | null) => void) | undefined
  dataIndex?: number | undefined
  /**
   * Explicit pixel width for virtual rows. Percentages are unusable here:
   * an absolutely-positioned display:'table' row resolves width:100%
   * against a collapsed containing block (the display:block tbody inside
   * a table shrink-wraps), so rows must carry the live column-width sum.
   */
  rowWidth?: number | undefined
  /** Fill-column surplus (see TableView) — applied to per-cell widths in
   *  virtual mode so rows stay aligned with the header. Changes are
   *  captured by columnStateKey for the memo comparator. */
  fillColumnId?: string | undefined
  fillExtra?: number | undefined
  /** dnd 'self'/'external': the row is sortable and renders the grip. */
  sortable?: boolean | undefined
}

/** Grip cell content for sortable rows (listeners come from useSortable). */
function DragGrip({
  attributes,
  listeners,
}: {
  attributes: Record<string, unknown>
  listeners: Record<string, unknown> | undefined
}) {
  return (
    <button
      type="button"
      {...(attributes as object)}
      {...((listeners ?? {}) as object)}
      className="flex w-full cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
      aria-label="Dra för att flytta"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )
}

function DataTableRowInner<TData>({
  row,
  rowInteraction,
  view,
  columnStateKey: _columnStateKey,
  virtualStart,
  measureRef,
  dataIndex,
  rowWidth,
  fillColumnId,
  fillExtra = 0,
  sortable = false,
}: DataTableRowProps<TData>) {
  const onRowClick = rowInteraction?.onRowClick

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, disabled: !sortable })

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLTableRowElement>) => {
      if (!onRowClick) return
      if (isInteractiveTarget(e)) return
      onRowClick(row.original, { event: e, view })
    },
    [onRowClick, row.original, view]
  )

  const isVirtual = virtualStart !== undefined
  // Virtual rows escape the table-row-group layout context (display:
  // 'table' + block tbody, the krav-table recipe): inside a normal row
  // group the table engine couples row heights, so measureElement sees
  // heights shift as siblings mount → resize → flushSync → render loop.
  // Isolated rows measure independently and converge.
  const sortableTransform = sortable
    ? CSS.Transform.toString(transform)
    : undefined
  const style: React.CSSProperties | undefined = isVirtual
    ? {
        display: 'table',
        tableLayout: 'fixed',
        width: rowWidth ?? '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        transform: sortable
          ? transform
            ? `translate3d(${transform.x}px, ${(virtualStart ?? 0) + transform.y}px, 0)`
            : `translateY(${virtualStart}px)`
          : `translateY(${virtualStart}px)`,
        ...(sortable ? { transition, opacity: isDragging ? 0.5 : 1 } : {}),
      }
    : sortable
      ? {
          transform: sortableTransform,
          transition,
          opacity: isDragging ? 0.5 : 1,
        }
      : undefined

  const setRefs = (el: HTMLTableRowElement | null) => {
    measureRef?.(el)
    if (sortable) setSortableRef(el)
  }

  return (
    <TableRow
      ref={setRefs}
      data-index={dataIndex}
      style={style}
      data-state={row.getIsSelected() ? 'selected' : undefined}
      className={cn(
        onRowClick && 'cursor-pointer',
        rowInteraction?.getRowClassName?.(row.original)
      )}
      onClick={handleClick}
    >
      {row.getVisibleCells().map((cell: Cell<TData, unknown>, cellIndex) => (
        <TableCell
          key={cell.id}
          className={cellClassesFromMeta(cell.column, cellIndex === 0)}
          // display:'table' rows lay out independently of the header —
          // each cell needs its committed width to stay column-aligned.
          style={
            isVirtual
              ? {
                  width:
                    cell.column.getSize() +
                    (cell.column.id === fillColumnId ? fillExtra : 0),
                }
              : undefined
          }
        >
          {sortable && cell.column.id === DRAG_HANDLE_COLUMN_ID ? (
            <DragGrip
              attributes={attributes as unknown as Record<string, unknown>}
              listeners={
                listeners as unknown as Record<string, unknown> | undefined
              }
            />
          ) : (
            flexRender(cell.column.columnDef.cell, cell.getContext())
          )}
        </TableCell>
      ))}
      {/* Spacer absorbs leftover width so fixed chrome columns hold size */}
      <TableCell aria-hidden="true" className="p-0" />
    </TableRow>
  )
}

export const DataTableRow = memo(
  DataTableRowInner,
  (prev, next) =>
    prev.row === next.row &&
    prev.row.getIsSelected() === next.row.getIsSelected() &&
    prev.columnStateKey === next.columnStateKey &&
    prev.virtualStart === next.virtualStart &&
    prev.view === next.view &&
    prev.rowInteraction === next.rowInteraction &&
    prev.sortable === next.sortable
) as typeof DataTableRowInner

/** Expanded-detail row: one full-width cell, measured by the virtualizer. */
export function DataTableDetailRow<TData>({
  row,
  colSpan,
  renderExpanded,
  virtualStart,
  measureRef,
  dataIndex,
  rowWidth,
}: {
  row: Row<TData>
  colSpan: number
  renderExpanded: (_row: Row<TData>) => React.ReactNode
  virtualStart?: number | undefined
  measureRef?: ((_el: HTMLTableRowElement | null) => void) | undefined
  dataIndex?: number | undefined
  rowWidth?: number | undefined
}) {
  const isVirtual = virtualStart !== undefined
  const style: React.CSSProperties | undefined = isVirtual
    ? {
        display: 'table',
        tableLayout: 'fixed',
        width: rowWidth ?? '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        transform: `translateY(${virtualStart}px)`,
      }
    : undefined

  return (
    <TableRow
      ref={measureRef}
      data-index={dataIndex}
      style={style}
      className="hover:bg-transparent"
    >
      {/* Virtual detail rows are isolated display:'table' contexts with a
          single cell — colSpan would span nonexistent columns and collapse
          the cell to a fraction of the row. Span only in normal flow. */}
      <TableCell
        colSpan={isVirtual ? undefined : colSpan}
        style={isVirtual ? { width: '100%' } : undefined}
        className="bg-muted/30"
      >
        {renderExpanded(row)}
      </TableCell>
    </TableRow>
  )
}
