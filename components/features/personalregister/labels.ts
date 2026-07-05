/**
 * Story 7.2: Swedish labels for the Fortnox-coded employee enums.
 *
 * The enum members ARE the Fortnox codes (identity-mappable; codes stay in
 * the DB) — the UI supplies these labels. Keep the maps exhaustive: a unit
 * test asserts every enum member has a label (guards enum drift).
 */

import type { EmploymentForm, PersonelType, SalaryForm } from '@prisma/client'

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

export const SALARY_FORM_LABELS: Record<SalaryForm, string> = {
  MAN: 'Månadslön',
  TIM: 'Timlön',
}

/** Established empty-state-label convention for missing optional data. */
export const EMPTY_FIELD_LABEL = 'Ej ifylld'

export function employmentFormLabel(form: EmploymentForm | null): string {
  return form ? EMPLOYMENT_FORM_LABELS[form] : EMPTY_FIELD_LABEL
}

export function personelTypeLabel(type: PersonelType | null): string {
  return type ? PERSONEL_TYPE_LABELS[type] : EMPTY_FIELD_LABEL
}

export function salaryFormLabel(form: SalaryForm | null): string {
  return form ? SALARY_FORM_LABELS[form] : EMPTY_FIELD_LABEL
}

// ---------------------------------------------------------------------------
// Story 7.10: salary display (client-safe — no crypto import). Amounts arrive
// already decrypted (manage) as canonical decimal strings, e.g. "45000.00".
// ---------------------------------------------------------------------------

const MONTHLY_SALARY_FORMATTER = new Intl.NumberFormat('sv-SE', {
  maximumFractionDigits: 0,
})
const HOURLY_PAY_FORMATTER = new Intl.NumberFormat('sv-SE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Månadslön → `45 000 kr` (thin-space thousands, sv-SE). */
export function formatMonthlySalary(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) ? `${MONTHLY_SALARY_FORMATTER.format(n)} kr` : value
}

/** Timlön → `185,50 kr/tim` (decimal comma, sv-SE). */
export function formatHourlyPay(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) ? `${HOURLY_PAY_FORMATTER.format(n)} kr/tim` : value
}
