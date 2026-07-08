/**
 * Expansion × virtualization: flattened render list.
 *
 * The legacy compliance table rendered expanded content as a second <tr>
 * OUTSIDE the virtualizer's items, breaking its fixed-height estimate.
 * Here the virtualizer iterates render items instead of rows: each expanded
 * detail is its own item with its own measureElement ref, so arbitrary
 * detail heights are measured, never estimated wrong.
 */
import type { Row } from '@tanstack/react-table'
import type { RenderItem } from '../types'

export const DETAIL_KEY_SUFFIX = '::detail'

export function buildRenderItems<TData>(
  rows: Row<TData>[],
  hasExpansion: boolean
): RenderItem<TData>[] {
  if (!hasExpansion) {
    return rows.map((row) => ({ kind: 'row', row, key: row.id }))
  }
  const items: RenderItem<TData>[] = []
  for (const row of rows) {
    items.push({ kind: 'row', row, key: row.id })
    if (row.getIsExpanded()) {
      items.push({
        kind: 'detail',
        row,
        key: `${row.id}${DETAIL_KEY_SUFFIX}`,
      })
    }
  }
  return items
}
