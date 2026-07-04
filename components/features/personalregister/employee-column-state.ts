/**
 * Story 7.4b: Column show/hide + resize state for the Personalregister table.
 *
 * Persistence is deliberately NOT the law table's Zustand store (that store is
 * document-list-typed and per-list): per-user `localStorage`, keyed by
 * workspace id, holding `{ visibility, sizing }`. Everything read back is
 * sanitized — corrupt JSON, stale/unknown column ids, out-of-bounds widths or
 * an attempt to hide a non-hideable column all degrade to defaults instead of
 * crashing or rendering a broken table. Unknown ids are DROPPED, so columns
 * added in later stories default to visible.
 *
 * Sizing bounds mirror the law table's `COLUMN_SIZE_BOUNDS` fix (Story 6.x):
 * TanStack's `onEnd` resize mode commits `startSize + deltaOffset` unclamped,
 * so widths are clamped HERE before they are stored or applied — localStorage
 * can never hold an out-of-bounds width (the historical "drag to infinite
 * width" bug).
 */

import type { ColumnSizingState, VisibilityState } from '@tanstack/react-table'

// ---------------------------------------------------------------------------
// Column catalog
// ---------------------------------------------------------------------------

/**
 * Width bounds per column id. Mirrors size/minSize/maxSize on the column defs
 * in `employee-list-table.tsx` — the clamp below is the source of truth for
 * what may be persisted.
 */
export const EMPLOYEE_COLUMN_SIZE_BOUNDS: Record<
  string,
  { min: number; max: number }
> = {
  // Mins are >= the column's own header-label width (user checkpoint: a
  // column must never shrink to where its header overlaps the neighbor or
  // its cell content wraps to two lines — e.g. Personnummer `890503-2556`).
  dragHandle: { min: 40, max: 40 },
  employee_id_ref: { min: 135, max: 220 },
  name: { min: 160, max: 480 },
  personnummer: { min: 140, max: 200 },
  personel_type: { min: 115, max: 220 },
  employment_form: { min: 150, max: 260 },
  salary_form: { min: 110, max: 220 },
  // Story 7.10: Lön column — hidden by default (see
  // EMPLOYEE_DEFAULT_HIDDEN_COLUMN_IDS).
  salary: { min: 120, max: 200 },
  collective_agreement: { min: 140, max: 300 },
  group: { min: 120, max: 280 },
  status: { min: 140, max: 260 },
}

/**
 * Columns that can never be hidden: Anställd is the primary/identity column
 * (AC2) and the drag handle is structural chrome (not data). Stored `false`
 * entries for these are discarded on load AND on change — defense in depth on
 * top of `enableHiding: false` in the column defs.
 */
export const EMPLOYEE_NON_HIDEABLE_COLUMN_IDS: ReadonlySet<string> = new Set([
  'name',
  'dragHandle',
])

/** Every id that may legitimately appear in persisted visibility state. */
const HIDEABLE_COLUMN_IDS: ReadonlySet<string> = new Set(
  Object.keys(EMPLOYEE_COLUMN_SIZE_BOUNDS).filter(
    (id) => !EMPLOYEE_NON_HIDEABLE_COLUMN_IDS.has(id)
  )
)

/**
 * Story 7.10 (trap #4): columns that must seed HIDDEN on first load. The
 * sanitizer DROPS unknown ids, and an absent id defaults to TanStack-visible —
 * so a `defaultVisible: false` column (Lön) would otherwise appear on first
 * load AND for every user whose persisted blob predates the column. This set is
 * the source of the hidden seed; it mirrors the `defaultVisible: false` options
 * in `employee-column-settings.tsx` (a catalog-invariant test cross-checks the
 * two never drift). A user who explicitly toggles the column stores an explicit
 * `true`/`false`, which is then honored on load (present → kept).
 */
export const EMPLOYEE_DEFAULT_HIDDEN_COLUMN_IDS: ReadonlySet<string> = new Set([
  'salary',
])

/**
 * Seed the hidden default for any default-hidden column NOT already carrying an
 * explicit stored entry. Applied on every load so first-load-hidden holds even
 * for returning users whose blob predates the column.
 */
function seedDefaultHidden(visibility: VisibilityState): VisibilityState {
  const seeded: VisibilityState = { ...visibility }
  for (const id of EMPLOYEE_DEFAULT_HIDDEN_COLUMN_IDS) {
    if (!(id in seeded)) seeded[id] = false
  }
  return seeded
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface EmployeeColumnState {
  visibility: VisibilityState
  sizing: ColumnSizingState
}

/**
 * Fresh default state: column-def default widths, everything visible EXCEPT the
 * default-hidden columns (Story 7.10: Lön), which seed hidden.
 */
export function defaultEmployeeColumnState(): EmployeeColumnState {
  return { visibility: seedDefaultHidden({}), sizing: {} }
}

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

/**
 * Clamp every sizing entry to its declared bounds (law-table
 * `clampColumnSizing` parity). Entries for unknown columns are dropped —
 * stale localStorage must not size columns that no longer exist.
 */
export function clampEmployeeColumnSizing(
  sizing: ColumnSizingState
): ColumnSizingState {
  const clamped: ColumnSizingState = {}
  for (const [id, size] of Object.entries(sizing)) {
    const bounds = EMPLOYEE_COLUMN_SIZE_BOUNDS[id]
    if (!bounds || typeof size !== 'number' || !Number.isFinite(size)) continue
    clamped[id] = Math.max(bounds.min, Math.min(bounds.max, size))
  }
  return clamped
}

/**
 * Keep only boolean entries for known, hideable columns. Non-hideable ids
 * (Anställd, drag handle) and unknown/new column ids are dropped — absent
 * means "default visible" in TanStack visibility state.
 */
export function sanitizeEmployeeColumnVisibility(
  visibility: unknown
): VisibilityState {
  if (typeof visibility !== 'object' || visibility === null) return {}
  const sanitized: VisibilityState = {}
  for (const [id, value] of Object.entries(visibility)) {
    if (typeof value !== 'boolean') continue
    if (!HIDEABLE_COLUMN_IDS.has(id)) continue
    sanitized[id] = value
  }
  return sanitized
}

// ---------------------------------------------------------------------------
// localStorage persistence (per user via the browser profile, per workspace
// via the key)
// ---------------------------------------------------------------------------

const STORAGE_KEY_PREFIX = 'laglig:personalregister:columns:v1:'

function storageKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}${workspaceId}`
}

/** Load persisted column state; ANY failure degrades to defaults. */
export function loadEmployeeColumnState(
  workspaceId: string
): EmployeeColumnState {
  if (typeof window === 'undefined') return defaultEmployeeColumnState()
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId))
    if (!raw) return defaultEmployeeColumnState()
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return defaultEmployeeColumnState()
    }
    const record = parsed as Record<string, unknown>
    return {
      // Seed the default-hidden columns (Lön) for any blob that lacks an
      // explicit entry — first-load-hidden survives stale persisted state.
      visibility: seedDefaultHidden(
        sanitizeEmployeeColumnVisibility(record.visibility)
      ),
      sizing: clampEmployeeColumnSizing(
        typeof record.sizing === 'object' && record.sizing !== null
          ? (record.sizing as ColumnSizingState)
          : {}
      ),
    }
  } catch {
    // Corrupt JSON, storage disabled, … — never crash the register.
    return defaultEmployeeColumnState()
  }
}

/** Persist column state; failures (quota, disabled storage) are swallowed. */
export function saveEmployeeColumnState(
  workspaceId: string,
  state: EmployeeColumnState
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      storageKey(workspaceId),
      JSON.stringify({
        visibility: sanitizeEmployeeColumnVisibility(state.visibility),
        sizing: clampEmployeeColumnSizing(state.sizing),
      })
    )
  } catch {
    // Best-effort persistence only.
  }
}
