/**
 * Story 7.4: Employee completeness rule — the SINGLE source of truth for
 * "Ej komplett".
 *
 * COMPUTED, never persisted (no `is_complete` column, no migration): the rule
 * is a pure function over the serialized client row shape (7.2's
 * `EmployeeRow`), so it can evolve (7.5+ agreement statuses, Fortnox sync
 * fields) without data backfills. Every surface — filter tab, header stats,
 * status badge, group rollup, Personalkort sidebar reasons — derives from
 * this one function. Zero drift by construction.
 *
 * Presence semantics for personnummer: the repository returns null (missing),
 * a mask (exists but hidden — view role or unreadable ciphertext) or the
 * decrypted plaintext. The rule checks NULL-NESS ONLY — a masked value counts
 * as present. Never inspect or compare mask strings here.
 *
 * Copy rule (user checkpoint): the adjective "Ej komplett" / "kompletta" is
 * fine; the noun "kompletthet" is banned from all user-facing copy.
 *
 * Pure module: no imports. `EmployeeRow` satisfies the input shape
 * structurally.
 */

/** Structural subset of the serialized `EmployeeRow` the rule reads. */
export interface EmployeeCompletenessInput {
  personnummer: string | null
  employment_date: Date | null
  employment_form: string | null
  personel_type: string | null
  collective_agreement: { id: string; name: string } | null
}

export interface EmployeeCompletenessOptions {
  /**
   * `CompanyProfile.has_collective_agreement` for the workspace. The
   * kollektivavtal criterion only applies when the workspace says it has
   * one; missing profile → false (no requirement).
   */
  workspaceHasCollectiveAgreement: boolean
}

export interface EmployeeCompleteness {
  complete: boolean
  /** Swedish, one per missing item, in stable REASONS order. */
  reasons: string[]
}

/** Reason strings, exactly per AC1/AC3 — stable order. */
export const COMPLETENESS_REASONS = {
  personnummer: 'Saknar personnummer',
  employment_date: 'Saknar anställningsdatum',
  employment_form: 'Saknar anställningsform',
  personel_type: 'Saknar personaltyp',
  collective_agreement: 'Inget kollektivavtal tilldelat',
} as const

/**
 * Assess LAS-critical completeness for one employee row.
 *
 * "Ej komplett" is orthogonal to Inaktiv — an inactive employee can be
 * complete and vice versa (Fortnox semantics).
 */
export function assessEmployeeCompleteness(
  row: EmployeeCompletenessInput,
  opts: EmployeeCompletenessOptions
): EmployeeCompleteness {
  const reasons: string[] = []

  // Null-check only: a masked personnummer means "exists but hidden".
  if (row.personnummer === null) {
    reasons.push(COMPLETENESS_REASONS.personnummer)
  }
  if (row.employment_date === null) {
    reasons.push(COMPLETENESS_REASONS.employment_date)
  }
  if (row.employment_form === null) {
    reasons.push(COMPLETENESS_REASONS.employment_form)
  }
  if (row.personel_type === null) {
    reasons.push(COMPLETENESS_REASONS.personel_type)
  }
  if (
    opts.workspaceHasCollectiveAgreement &&
    row.collective_agreement === null
  ) {
    reasons.push(COMPLETENESS_REASONS.collective_agreement)
  }

  return { complete: reasons.length === 0, reasons }
}
