/**
 * Story 21.4 (NH-3): shared Swedish copy templates for scope-summary strings.
 *
 * Consumed by:
 *  - Story 21.3 `ScopeSelector.tsx` live summary (selection-keyed)
 *  - Story 21.4 `CycleConfirmStep.tsx` confirmation summary (ScopeDefinition-keyed)
 *
 * Keep these strings LITERAL and IMMUTABLE — the existing scope-selector test
 * suite asserts exact strings; any drift here will fail those tests, which is
 * the intended drift-detection mechanism.
 *
 * Swedish inflection rules encoded:
 *   - `dokument` is neuter-singular + neuter-plural (same form for 1 and 2+).
 *   - Adjective agreement: `valt` (neuter sing.) / `valda` (neuter pl.)
 *   - `grupp` (1) / `grupper` (2+) — common gender.
 *
 * Copy history:
 *   - 2026-04-22: renamed "lag/lagar" to "dokument" across the board — the
 *     laglista contains mixed document types (SFS laws, föreskrifter, EU, etc.),
 *     not only laws. "Dokument" is the neutral term. User feedback, Story 21.4 QA.
 */

export const SCOPE_SUMMARY_EMPTY = 'Inga dokument valda'

export function scopeSummaryAll(totalItems: number): string {
  return `Alla ${totalItems} dokument valda`
}

export function scopeSummaryItems(itemCount: number): string {
  const valdWord = itemCount === 1 ? 'valt' : 'valda'
  return `${itemCount} dokument ${valdWord}`
}

export function scopeSummaryGroups(
  itemCount: number,
  groupCount: number
): string {
  const valdWord = itemCount === 1 ? 'valt' : 'valda'
  const gruppWord = groupCount === 1 ? 'grupp' : 'grupper'
  return `${itemCount} dokument ${valdWord} i ${groupCount} ${gruppWord}`
}
