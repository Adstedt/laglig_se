/**
 * Story 7.7: Swedish labels + display formatters for employee fields, usable
 * from `lib/` (server) code.
 *
 * The label maps DUPLICATE `components/features/personalregister/labels.ts`
 * (Story 7.2): `lib/` may not import from `components/`, and the
 * personalregister module is the UI's source of truth. A unit test asserts
 * the two stay identical (guards drift), and both are pinned exhaustive over
 * the Prisma enums.
 */

import type { EmploymentForm, PersonelType } from '@prisma/client'

export const EMPLOYMENT_FORM_LABELS: Record<EmploymentForm, string> = {
  TV: 'Tillsvidareanställning',
  PRO: 'Provanställning',
  TID: 'Tidsbegränsad',
  SVT: 'Säsongsanställning',
  VIK: 'Vikariat',
  PRJ: 'Projektanställning',
  PRA: 'Praktik',
  FER: 'Feriearbete',
  SES: 'Sessionsanställning',
  NEJ: 'Ingen',
}

export const PERSONEL_TYPE_LABELS: Record<PersonelType, string> = {
  TJM: 'Tjänsteman',
  ARB: 'Arbetare',
}

/** Established empty-state-label convention for missing optional data. */
export const EMPTY_FIELD_LABEL = 'Ej ifylld'

export function employmentFormLabel(form: EmploymentForm | null): string {
  return form ? EMPLOYMENT_FORM_LABELS[form] : EMPTY_FIELD_LABEL
}

export function personelTypeLabel(type: PersonelType | null): string {
  return type ? PERSONEL_TYPE_LABELS[type] : EMPTY_FIELD_LABEL
}

/** `employment_date` → `YYYY-MM-DD`, or "Ej ifylld" when missing. */
export function formatEmploymentDate(date: Date | string | null): string {
  if (!date) return EMPTY_FIELD_LABEL
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return EMPTY_FIELD_LABEL
  return d.toISOString().slice(0, 10)
}

/**
 * `full_time_equivalent` (Prisma Decimal 0–1, or plain number) → "75 %".
 * `0` is a real value (not "Ej ifylld") — only null/undefined are missing.
 */
export function formatFullTimeEquivalent(
  fte: { toNumber(): number } | number | null | undefined
): string {
  if (fte == null) return EMPTY_FIELD_LABEL
  const n = typeof fte === 'number' ? fte : fte.toNumber()
  if (!Number.isFinite(n)) return EMPTY_FIELD_LABEL
  // 0.75 → "75 %"; trim float noise to at most one decimal.
  const pct = Math.round(n * 1000) / 10
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)} %`
}

/** `inactive` boolean → the user-facing Aktiv/Inaktiv status word. */
export function employeeStatusLabel(inactive: boolean): string {
  return inactive ? 'Inaktiv' : 'Aktiv'
}
