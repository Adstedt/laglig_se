'use client'

/**
 * Story 7.4b: "Kolumner" control for the Personalregister table.
 *
 * Thin wrapper around the shared `ColumnSettings` primitive — the SAME
 * affordance the Laglistor table uses (Story 6.19 extracted it exactly so
 * sibling tables could reuse it without importing anything law-list-typed).
 *
 * - Anställd is listed but `mandatory` (disabled, "Obligatorisk") — the
 *   primary/identity column can never be hidden (AC2).
 * - Structural columns (drag handle) are NOT in the list at all.
 * - Personnummer IS hideable — the screen-share privacy case.
 * - `EMPLOYEE_COLUMN_LABELS` is the single Swedish label source shared with
 *   the table's header defs (labels moved here from the inline header
 *   strings so the toggle list can never drift from the headers).
 */

import {
  ColumnSettings as BaseColumnSettings,
  type ColumnOption,
} from '@/components/ui/column-settings'
import type { VisibilityState } from '@tanstack/react-table'

/**
 * Toggle list, in table column order. All register columns default to
 * visible (unlike the law table, the register has no low-priority extras).
 */
export const EMPLOYEE_COLUMN_OPTIONS: ColumnOption[] = [
  { id: 'employee_id_ref', label: 'Anställnings-ID', defaultVisible: true },
  { id: 'name', label: 'Anställd', defaultVisible: true, mandatory: true },
  { id: 'personnummer', label: 'Personnummer', defaultVisible: true },
  { id: 'personel_type', label: 'Personaltyp', defaultVisible: true },
  { id: 'employment_form', label: 'Anställningsform', defaultVisible: true },
  { id: 'salary_form', label: 'Löneform', defaultVisible: true },
  // Story 7.10: Lön — hidden by default (stronger screen-share-privacy default
  // than personnummer). The repository also gates the value for non-manage
  // roles before it ever ships to the client (visibility is display-only).
  { id: 'salary', label: 'Lön', defaultVisible: false },
  { id: 'collective_agreement', label: 'Kollektivavtal', defaultVisible: true },
  { id: 'group', label: 'Grupp', defaultVisible: true },
  { id: 'status', label: 'Status', defaultVisible: true },
]

/** Column id → Swedish header label (single source for headers + toggles). */
export const EMPLOYEE_COLUMN_LABELS: Record<string, string> =
  Object.fromEntries(EMPLOYEE_COLUMN_OPTIONS.map((o) => [o.id, o.label]))

interface EmployeeColumnSettingsProps {
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (_visibility: VisibilityState) => void
}

export function EmployeeColumnSettings({
  columnVisibility,
  onColumnVisibilityChange,
}: EmployeeColumnSettingsProps) {
  return (
    <BaseColumnSettings
      columnOptions={EMPLOYEE_COLUMN_OPTIONS}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
    />
  )
}
