'use client'

/**
 * Chrome columns injected by the core when their feature is enabled —
 * consumers never declare these, which removes the copy-pasted select
 * boilerplate and the magic-string id branches from the legacy tables.
 */
import type { ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'

export const SELECT_COLUMN_ID = 'dt-select'

export function createSelectColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: SELECT_COLUMN_ID,
    size: 56,
    minSize: 56,
    maxSize: 56,
    enableSorting: false,
    enableResizing: false,
    enableHiding: false,
    meta: {
      dt: {
        label: 'Välj',
        pinned: 'left',
        padding: 'tight',
        mandatory: true,
        card: { role: 'hidden' },
      },
    },
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllRowsSelected()
            ? true
            : table.getIsSomeRowsSelected()
              ? 'indeterminate'
              : false
        }
        onCheckedChange={(checked) =>
          table.toggleAllRowsSelected(checked === true)
        }
        aria-label="Markera alla rader"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onCheckedChange={(checked) => row.toggleSelected(checked === true)}
        aria-label="Markera rad"
      />
    ),
  }
}

export const DRAG_HANDLE_COLUMN_ID = 'dt-drag'

/**
 * Placeholder cell — the sortable row renders the actual grip (it owns the
 * useSortable listeners). Injected when dnd mode is 'self' or 'external'.
 */
export function createDragHandleColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: DRAG_HANDLE_COLUMN_ID,
    size: 40,
    minSize: 40,
    maxSize: 40,
    enableSorting: false,
    enableResizing: false,
    enableHiding: false,
    header: () => null,
    cell: () => null,
    meta: {
      dt: {
        label: 'Flytta',
        pinned: 'left',
        padding: 'tight',
        mandatory: true,
        card: { role: 'hidden' },
      },
    },
  }
}
