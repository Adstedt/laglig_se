/**
 * Single source of truth for the "row click must ignore interactive elements"
 * guard — previously duplicated verbatim in four row components.
 *
 * `[data-no-row-click]` lets any consumer cell opt out without a new role.
 */
export const INTERACTIVE_SELECTOR =
  'button, input, select, a, [role="combobox"], [role="checkbox"], [role="menuitem"], [data-no-row-click]'

export function isInteractiveTarget(event: {
  target: EventTarget | null
}): boolean {
  const target = event.target
  if (!(target instanceof Element)) return false
  return target.closest(INTERACTIVE_SELECTOR) !== null
}
