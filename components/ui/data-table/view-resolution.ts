/**
 * Pure view-resolution logic for the table↔card renderer switch.
 * Kept side-effect-free so it unit-tests without a DOM.
 */
import type { DataTableView, ViewConfig } from './types'

export const DEFAULT_CARD_BELOW = 640

/**
 * Card→table flips back only at breakpoint + this band. The swap itself
 * changes content height, which can toggle the container's scrollbar
 * (up to ~17px on non-overlay scrollbars), which changes width — without
 * the band the two renderers would oscillate forever.
 */
export const VIEW_HYSTERESIS_PX = 24

export function resolveView(
  width: number | null,
  view: ViewConfig | undefined,
  prev: DataTableView | null
): DataTableView {
  if (view?.force) return view.force

  const cardBelow = view?.cardBelow ?? DEFAULT_CARD_BELOW
  if (cardBelow === false) return 'table'

  if (width === null) return view?.ssrDefault ?? 'table'

  if (prev === 'card') {
    return width >= cardBelow + VIEW_HYSTERESIS_PX ? 'table' : 'card'
  }
  return width < cardBelow ? 'card' : 'table'
}
