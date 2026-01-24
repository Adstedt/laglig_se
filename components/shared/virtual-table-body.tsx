'use client'

/**
 * Story P.4: Virtual Table Body Component
 *
 * A virtualized table body for TanStack Table integration.
 * Uses @tanstack/react-virtual for efficient rendering of large datasets.
 * Only renders rows visible in the viewport + overscan.
 */

import { useRef, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TableBody, TableRow, TableCell } from '@/components/ui/table'
import { flexRender, type Row, type Table } from '@tanstack/react-table'
import { cn } from '@/lib/utils'

interface VirtualTableBodyProps<TData> {
  /** TanStack Table instance */
  table: Table<TData>
  /** Estimated height of each row in pixels */
  estimatedRowHeight?: number
  /** Number of items to render outside of viewport (above and below) */
  overscan?: number
  /** Maximum height of the scrollable area */
  maxHeight?: number
  /** Callback when a row is clicked */
  onRowClick?: (_row: Row<TData>) => void
  /** Function to get additional row class names */
  getRowClassName?: (_row: Row<TData>) => string
  /** Custom row renderer - used for drag-and-drop sortable rows */
  renderRow?: (_row: Row<TData>, _style: React.CSSProperties) => React.ReactNode
}

/**
 * VirtualTableBody - Efficient rendering for large table datasets
 *
 * @example
 * ```tsx
 * <VirtualTableBody
 *   table={table}
 *   estimatedRowHeight={52}
 *   maxHeight={600}
 *   overscan={5}
 * />
 * ```
 */
function VirtualTableBodyInner<TData>({
  table,
  estimatedRowHeight = 52,
  overscan = 5,
  maxHeight = 600,
  onRowClick,
  getRowClassName,
  renderRow,
}: VirtualTableBodyProps<TData>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan,
  })

  const virtualItems = virtualizer.getVirtualItems()

  if (rows.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell
            colSpan={table.getAllColumns().length}
            className="h-24 text-center"
          >
            Inga resultat.
          </TableCell>
        </TableRow>
      </TableBody>
    )
  }

  return (
    <div ref={parentRef} className="overflow-auto" style={{ maxHeight }}>
      <TableBody
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const row = rows[virtualItem.index]
          if (!row) return null

          const rowStyle: React.CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: `${virtualItem.size}px`,
            transform: `translateY(${virtualItem.start}px)`,
          }

          // Use custom row renderer if provided (for DnD support)
          if (renderRow) {
            return renderRow(row, rowStyle)
          }

          const rowClassName = getRowClassName?.(row) ?? ''

          return (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && 'selected'}
              className={cn('group', rowClassName)}
              style={rowStyle}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          )
        })}
      </TableBody>
    </div>
  )
}

// Memoize to prevent unnecessary re-renders
export const VirtualTableBody = memo(
  VirtualTableBodyInner
) as typeof VirtualTableBodyInner

/**
 * Hook to determine if virtualization should be used
 * Returns true if item count exceeds threshold
 */
export function useVirtualizationEnabled(
  itemCount: number,
  threshold: number = 100
): boolean {
  return itemCount > threshold
}
