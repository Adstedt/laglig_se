/**
 * meta.dt resolution — replaces the legacy tables' magic-string column-id
 * branches (`cell.column.id === 'title'` etc.) with declared metadata.
 */
import type { Column } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import type { CardSlot, DataTableColumnMeta } from './types'

export function getDtMeta<TData>(
  column: Column<TData, unknown>
): DataTableColumnMeta<TData> {
  return (
    (column.columnDef.meta?.dt as DataTableColumnMeta<TData> | undefined) ?? {
      label: column.id,
    }
  )
}

export function getCardSlot<TData>(
  column: Column<TData, unknown>,
  columnIndex: number
):
  | Exclude<CardSlot<TData>, { role: 'hidden' } | { role: 'title' }>
  | CardSlot<TData> {
  return getDtMeta(column).card ?? { role: 'meta', priority: columnIndex }
}

/**
 * Shared cell/header classes derived from meta (padding, alignment, sticky).
 * `isFirstColumn` applies the table-edge inset (pl-6) — the convention both
 * legacy krav (is_fulfilled) and laglistor (select) carried so first-column
 * content doesn't hug the table border. Suppressed by padding:'none'.
 */
export function cellClassesFromMeta<TData>(
  column: Column<TData, unknown>,
  isFirstColumn = false
): string | undefined {
  const dt = getDtMeta(column)
  return cn(
    dt.stickyLeft && 'sticky left-0 bg-background z-10',
    dt.padding === 'tight' && 'px-2',
    dt.padding === 'none' && 'p-0',
    isFirstColumn && dt.padding !== 'none' && 'pl-6',
    dt.align === 'center' && 'text-center',
    (dt.align === 'right' || dt.numeric) && 'text-right',
    dt.numeric && 'tabular-nums'
  )
}
