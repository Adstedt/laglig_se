/**
 * Story 7.2: Pure client-side filter helpers for the Personalregister list.
 *
 * Search is deliberately client-side over the in-memory rows: personnummer is
 * encrypted at rest (ciphertext is not DB-searchable), and decrypted values
 * exist in memory only for `employees:manage` roles. Masked personnummer
 * values are unsearchable by design — the mask contains no digits, so digit
 * queries can never match it.
 */

import { assessEmployeeCompleteness } from '@/lib/employees/employee-completeness'
import type { EmployeeRow } from './employee-row'

export type EmployeeStatusTab = 'alla' | 'aktiva' | 'ej_kompletta' | 'inaktiva'

export interface EmployeeFilter {
  tab: EmployeeStatusTab
  search: string
  /**
   * Story 7.4: workspace kollektivavtal flag for the "Ej kompletta" tab
   * (feeds the completeness rule). Defaults to false — no kollektivavtal
   * requirement.
   */
  workspaceHasCollectiveAgreement?: boolean
}

function matchesTab(
  row: EmployeeRow,
  tab: EmployeeStatusTab,
  workspaceHasCollectiveAgreement: boolean
): boolean {
  if (tab === 'aktiva') return !row.inactive
  if (tab === 'inaktiva') return row.inactive
  // "Ej kompletta" filters completeness ONLY — orthogonal to Aktiv/Inaktiv
  // (Fortnox semantics: incomplete ≠ inactive).
  if (tab === 'ej_kompletta') {
    return !assessEmployeeCompleteness(row, { workspaceHasCollectiveAgreement })
      .complete
  }
  return true
}

function matchesSearch(row: EmployeeRow, query: string): boolean {
  const name = `${row.first_name} ${row.last_name}`.toLowerCase()
  if (name.includes(query)) return true

  if (row.employee_id_ref?.toLowerCase().includes(query)) return true

  // QA SEARCH-001: the cell DISPLAYS ÅÅMMDD-XXXX while storage may be
  // digit-only — normalize both sides to digits so either input form matches.
  const queryDigits = query.replace(/\D/g, '')
  if (
    queryDigits.length > 0 &&
    row.personnummer &&
    !row.personnummer_masked &&
    row.personnummer.replace(/\D/g, '').includes(queryDigits)
  ) {
    return true
  }
  // Only a decrypted (unmasked) personnummer is searchable; the mask is a
  // fixed placeholder and must never match user queries.
  if (
    row.personnummer &&
    !row.personnummer_masked &&
    row.personnummer.toLowerCase().includes(query)
  ) {
    return true
  }

  return false
}

/**
 * Filter rows by status tab and free-text search (case-insensitive over
 * name, anställnings-ID and — when decrypted — personnummer).
 */
export function filterEmployees(
  rows: EmployeeRow[],
  filter: EmployeeFilter
): EmployeeRow[] {
  const query = filter.search.trim().toLowerCase()
  const workspaceHasCollectiveAgreement =
    filter.workspaceHasCollectiveAgreement ?? false

  return rows.filter((row) => {
    if (!matchesTab(row, filter.tab, workspaceHasCollectiveAgreement)) {
      return false
    }
    if (query.length > 0 && !matchesSearch(row, query)) return false
    return true
  })
}
