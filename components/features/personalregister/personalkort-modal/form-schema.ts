/**
 * Story 7.3: Personalkort form schema + value mapping.
 *
 * Co-located with the tabbed form (house convention) but kept in its own
 * module so the schema is testable without rendering the modal. Mirrors the
 * server action's `EmployeeInputSchema` — the action re-validates on the
 * server; this schema powers the inline errors.
 *
 * Lenient-required by design: only förnamn + efternamn block save (AC6).
 * Personnummer is validated (format + Luhn) only when present (AC7).
 *
 * Numeric fields are kept as strings in form state (empty = not filled) and
 * converted at the edge; sysselsättningsgrad is shown as % (0–100) and stored
 * as the 0–1 decimal.
 */

import { z } from 'zod'
import { EmploymentForm, PersonelType, SalaryForm } from '@prisma/client'
import { validatePersonnummer } from '@/lib/employees/personnummer-validation'
import { toISODate } from '@/components/ui/date-picker'
import type { EmployeeInput } from '@/app/actions/employees'
import type { EmployeeRow } from '../employee-row'

/** Sentinel for "no selection" items — Radix SelectItem values cannot be ''. */
export const NONE_VALUE = '__none__'

function parseDecimal(value: string): number {
  return Number(value.replace(',', '.'))
}

const optionalNumericString = (opts: {
  min?: number
  max?: number
  message: string
}) =>
  z
    .string()
    .trim()
    .refine((v) => {
      if (v === '') return true
      const n = parseDecimal(v)
      if (Number.isNaN(n)) return false
      if (opts.min !== undefined && n < opts.min) return false
      if (opts.max !== undefined && n > opts.max) return false
      return true
    }, opts.message)

export const personalkortFormSchema = z.object({
  // --- Personalinformation ---
  first_name: z.string().trim().min(1, 'Förnamn krävs'),
  last_name: z.string().trim().min(1, 'Efternamn krävs'),
  personnummer: z.string().superRefine((value, ctx) => {
    const result = validatePersonnummer(value)
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error ?? 'Ogiltigt personnummer',
      })
    }
  }),
  email: z.string().trim().max(255, 'Max 255 tecken'),
  phone1: z.string().trim().max(64, 'Max 64 tecken'),
  phone2: z.string().trim().max(64, 'Max 64 tecken'),
  address1: z.string().trim().max(255, 'Max 255 tecken'),
  address2: z.string().trim().max(255, 'Max 255 tecken'),
  post_code: z.string().trim().max(16, 'Max 16 tecken'),
  city: z.string().trim().max(128, 'Max 128 tecken'),
  country: z.string().trim().max(56, 'Max 56 tecken'),
  job_title: z.string().trim().max(30, 'Max 30 tecken'),
  employee_id_ref: z.string().trim().max(15, 'Max 15 tecken'),

  // --- Anställning ---
  employment_date: z.date().nullable(),
  employed_to: z.date().nullable(),
  employment_form: z.union([z.nativeEnum(EmploymentForm), z.literal('')]),
  personel_type: z.union([z.nativeEnum(PersonelType), z.literal('')]),
  salary_form: z.union([z.nativeEnum(SalaryForm), z.literal('')]),
  employment_percent: optionalNumericString({
    min: 0,
    max: 100,
    message: 'Ange en sysselsättningsgrad mellan 0 och 100 %',
  }),
  average_weekly_hours: optionalNumericString({
    min: 0,
    message: 'Veckoarbetstid kan inte vara negativ',
  }),
  manager_id: z.string(),
  collective_agreement_id: z.string(),
  inactive: z.boolean(),

  // --- Semester ---
  vacation_days_paid: optionalNumericString({
    min: 0,
    message: 'Semesterdagar kan inte vara negativa',
  }),
})

export type PersonalkortFormValues = z.infer<typeof personalkortFormSchema>

/** Empty defaults for create mode (`?anstalld=ny`). */
export function emptyFormValues(): PersonalkortFormValues {
  return {
    first_name: '',
    last_name: '',
    personnummer: '',
    email: '',
    phone1: '',
    phone2: '',
    address1: '',
    address2: '',
    post_code: '',
    city: '',
    country: 'SE',
    job_title: '',
    employee_id_ref: '',
    employment_date: null,
    employed_to: null,
    employment_form: '',
    personel_type: '',
    salary_form: '',
    employment_percent: '',
    average_weekly_hours: '',
    manager_id: '',
    collective_agreement_id: '',
    inactive: false,
    vacation_days_paid: '',
  }
}

function numberToString(value: number | null): string {
  return value === null ? '' : String(value)
}

/**
 * Prefill from the serialized register row (7.2's `EmployeeRow` — Decimals
 * already plain numbers). A masked personnummer (view role, or an unreadable
 * ciphertext) prefills as empty — the mask must never round-trip as a value.
 */
export function formValuesFromRow(row: EmployeeRow): PersonalkortFormValues {
  return {
    first_name: row.first_name,
    last_name: row.last_name,
    personnummer: row.personnummer_masked ? '' : (row.personnummer ?? ''),
    email: row.email ?? '',
    phone1: row.phone1 ?? '',
    phone2: row.phone2 ?? '',
    address1: row.address1 ?? '',
    address2: row.address2 ?? '',
    post_code: row.post_code ?? '',
    city: row.city ?? '',
    country: row.country ?? 'SE',
    job_title: row.job_title ?? '',
    employee_id_ref: row.employee_id_ref ?? '',
    employment_date: row.employment_date ? new Date(row.employment_date) : null,
    employed_to: row.employed_to ? new Date(row.employed_to) : null,
    employment_form: row.employment_form ?? '',
    personel_type: row.personel_type ?? '',
    salary_form: row.salary_form ?? '',
    employment_percent:
      row.full_time_equivalent === null
        ? ''
        : String(Math.round(row.full_time_equivalent * 1000) / 10),
    average_weekly_hours: numberToString(row.average_weekly_hours),
    manager_id: row.manager_id ?? '',
    collective_agreement_id: row.collective_agreement_id ?? '',
    inactive: row.inactive,
    vacation_days_paid: numberToString(row.vacation_days_paid),
  }
}

function stringOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function numericOrNull(value: string): number | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : parseDecimal(trimmed)
}

/**
 * Convert validated form values to the server action's input shape.
 *
 * `groupId` is threaded through from the row (or null in create mode) — the
 * Personalkort has no group field (the register's inline editor owns moves),
 * but the update action writes the full field set, so the current group must
 * be preserved.
 *
 * Personnummer three-state contract (QA DATA-001): when the loaded row's
 * personnummer was MASKED (`personnummerMasked: true` — view role, or an
 * undecryptable ciphertext under manage, e.g. a transient ENCRYPTION_KEY
 * misconfiguration), the field prefills empty and an empty submit means
 * "keep what is stored" — the `personnummer` key is OMITTED from the input
 * so the update action leaves the column untouched. Typing a value replaces
 * it. On a plaintext prefill (healthy manage path) an emptied field is a
 * deliberate clear (→ null), and create mode is unchanged (empty → null).
 */
export function toEmployeeInput(
  values: PersonalkortFormValues,
  groupId: string | null,
  options: { personnummerMasked?: boolean } = {}
): EmployeeInput {
  const percent = numericOrNull(values.employment_percent)
  const personnummer = stringOrNull(values.personnummer)
  // Masked prefill + still empty → omit the key entirely (= keep stored).
  const personnummerInput =
    options.personnummerMasked && personnummer === null ? {} : { personnummer }
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    ...personnummerInput,
    email: stringOrNull(values.email),
    phone1: stringOrNull(values.phone1),
    phone2: stringOrNull(values.phone2),
    address1: stringOrNull(values.address1),
    address2: stringOrNull(values.address2),
    post_code: stringOrNull(values.post_code),
    city: stringOrNull(values.city),
    country: stringOrNull(values.country) ?? 'SE',
    job_title: stringOrNull(values.job_title),
    employee_id_ref: stringOrNull(values.employee_id_ref),
    employment_date: values.employment_date
      ? toISODate(values.employment_date)
      : null,
    employed_to: values.employed_to ? toISODate(values.employed_to) : null,
    employment_form:
      values.employment_form === '' ? null : values.employment_form,
    personel_type: values.personel_type === '' ? null : values.personel_type,
    salary_form: values.salary_form === '' ? null : values.salary_form,
    // Shown as % in the UI, stored as the 0–1 decimal (Decimal(4,3)).
    full_time_equivalent: percent === null ? null : percent / 100,
    average_weekly_hours: numericOrNull(values.average_weekly_hours),
    vacation_days_paid: numericOrNull(values.vacation_days_paid),
    inactive: values.inactive,
    manager_id: stringOrNull(values.manager_id),
    collective_agreement_id: stringOrNull(values.collective_agreement_id),
    group_id: groupId,
  }
}
