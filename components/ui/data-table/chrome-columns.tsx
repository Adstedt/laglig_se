'use client'

/**
 * Chrome columns injected by the core when their feature is enabled —
 * consumers never declare these, which removes the copy-pasted select
 * boilerplate and the magic-string id branches from the legacy tables.
 *
 * The dragHandle factory lands with the first dnd consumer (Story 28.8),
 * per the capability-accretion rule.
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
