/**
 * Fortnox Employee Mapping Layer (Story 7.8)
 *
 * Pure, side-effect-free adapter between our `Employee` row shape
 * (snake_case, Prisma types) and the Fortnox Employee payload shape
 * (PascalCase, per the Fortnox OpenAPI spec).
 *
 * Source of truth for the field map:
 * - docs/reference/fortnox-employee-schema-analysis.md (Fortnox schema)
 * - prisma/schema.prisma `Employee` model (our columns)
 * - docs/reference/fortnox-integration-plan.md (deferred sync design +
 *   documented assumptions)
 *
 * Contract:
 * - Enum mapping is IDENTITY — our Prisma enum members ARE the Fortnox codes
 *   (by design since Story 7.1). This module only handles field-name casing,
 *   date formats, Decimal conversion and the `country` default (`SE`).
 * - `fromFortnox` throws `FortnoxMappingError` if the record is missing
 *   FirstName/LastName (Fortnox-required, our only NOT NULL name columns).
 *   That is the ONLY throw case; every other missing/malformed field
 *   degrades to null.
 * - `fortnox_raw` is NOT managed here: the future sync job snapshots the
 *   full raw Fortnox payload (including the ~80 payroll/vacation/tax fields
 *   we do not map) onto `Employee.fortnox_raw` at its own boundary. The
 *   mapper is a pure projection of the mapped subset.
 * - `personnummer` ↔ `PersonalIdentityNumber` is mapped as an OPAQUE field.
 *   Our column stores ciphertext; the future sync job owns encrypt/decrypt
 *   at its boundary. This module never imports crypto.
 * - No I/O, no network, no Prisma client import — pure functions only.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Fortnox Employee enum codes — verbatim from the Fortnox OpenAPI spec.
 * Identity map with our Prisma enums (`EmploymentForm`, `PersonelType`,
 * `SalaryForm`); the unit tests loop the Prisma enums against these arrays
 * to guard drift.
 */
export const EMPLOYMENT_FORM_CODES = [
  'TV', // Tillsvidareanställning (permanent)
  'PRO', // Provanställning (probation)
  'TID', // Tidsbegränsad (temporary)
  'SVT', // Säsongsvisa (seasonal)
  'VIK', // Vikariat (substitute)
  'PRJ', // Projektanställning (project)
  'PRA', // Praktik (internship)
  'FER', // Feriearbete (summer job)
  'SES', // Sessionsanställning
  'NEJ', // Ingen (none)
] as const

export const PERSONEL_TYPE_CODES = [
  'TJM', // Tjänsteman (salaried employee)
  'ARB', // Arbetare (worker)
] as const

export const SALARY_FORM_CODES = [
  'MAN', // Månadslön (monthly)
  'TIM', // Timlön (hourly)
] as const

export type EmploymentFormCode = (typeof EMPLOYMENT_FORM_CODES)[number]
export type PersonelTypeCode = (typeof PERSONEL_TYPE_CODES)[number]
export type SalaryFormCode = (typeof SALARY_FORM_CODES)[number]

/**
 * Fortnox `Employee` payload — transcribed from
 * docs/reference/fortnox-employee-schema-analysis.md.
 *
 * Every MAPPED property carries a doc comment linking our column ↔ the
 * Fortnox property (single source of truth for the mapping). Properties the
 * mapper emits are typed `X | null`; Fortnox-side-only properties we do not
 * emit are optional (`?:`) and documented as such.
 *
 * CRITICAL type split (verified from the Fortnox spec — NOT uniform):
 * - `MonthlySalary`, `HourlyPay`, `AverageHourlyWage`, `AverageWeeklyHours`
 *   are Fortnox STRINGS.
 * - `FullTimeEquivalent`, `VacationDaysPaid` are Fortnox FLOATS.
 *
 * Unmapped Fortnox fields (payroll/tax/bank, full vacation ledger, flex/comp
 * balances, DatedWages/DatedSchedules/OpeningSalaries/EmployeeCategories/
 * EmployeeChildren arrays, ~80 fields) are intentionally not transcribed
 * property-by-property: they are preserved verbatim via the sync job's
 * `fortnox_raw` snapshot, never by this mapper.
 */
export interface FortnoxEmployee {
  // --- Identity ---
  /**
   * ↔ `Employee.employee_id_ref` — Fortnox company business key
   * (Anställnings-ID, 1–15 chars, unique per company).
   *
   * TWO-ID DISTINCTION (never conflate): this is NOT
   * `Employee.fortnox_employee_id`, which is OUR sync-metadata reference
   * owned by the future sync job. `toFortnox` emits `EmployeeId` from
   * `employee_id_ref` only; `fromFortnox` writes `employee_id_ref` only and
   * never touches sync metadata.
   */
  EmployeeId: string | null
  /**
   * ↔ `Employee.personnummer` — Swedish personnummer. Our column stores
   * CIPHERTEXT at rest; the mapper passes the field through opaquely and the
   * future sync job encrypts/decrypts at its boundary (no crypto here).
   */
  PersonalIdentityNumber: string | null
  /** ↔ `Employee.first_name` (Fortnox-required). */
  FirstName: string
  /** ↔ `Employee.last_name` (Fortnox-required). */
  LastName: string
  /** Fortnox auto-generated; never emitted by `toFortnox`, ignored inbound. */
  FullName?: string

  // --- Contact ---
  /**
   * ↔ `Employee.email` — Fortnox-required on CREATE; nullable here because
   * the mapper is not a validator (the sync job enforces create-payload
   * requirements).
   */
  Email: string | null
  /** ↔ `Employee.phone1` */
  Phone1: string | null
  /** ↔ `Employee.phone2` */
  Phone2: string | null

  // --- Address ---
  /** ↔ `Employee.address1` */
  Address1: string | null
  /** ↔ `Employee.address2` */
  Address2: string | null
  /** ↔ `Employee.city` */
  City: string | null
  /** ↔ `Employee.post_code` */
  PostCode: string | null
  /** ↔ `Employee.country` — defaulted to `'SE'` when absent (both ways). */
  Country: string | null

  // --- Role ---
  /**
   * ↔ `Employee.job_title` — Fortnox max 30 chars. Passed through unmodified
   * (no truncation): length validation is the sync job's concern.
   */
  JobTitle: string | null

  // --- Employment ---
  /**
   * ↔ `Employee.employment_date` — Fortnox `date`; emitted as `YYYY-MM-DD`
   * (documented assumption — the spec analysis types it `date` without a
   * wire format; see fortnox-integration-plan.md).
   */
  EmploymentDate: string | null
  /** ↔ `Employee.employed_to` — Fortnox `date`, `YYYY-MM-DD` (same assumption). */
  EmployedTo: string | null
  /** ↔ `Employee.employment_form` — identity enum (codes above). */
  EmploymentForm: EmploymentFormCode | null
  /** ↔ `Employee.personel_type` — identity enum (Fortnox spelling). */
  PersonelType: PersonelTypeCode | null
  /** ↔ `Employee.inactive` */
  Inactive: boolean

  // --- Schedule / working time ---
  /**
   * ↔ `Employee.full_time_equivalent` (Prisma `Decimal(4,3)`) — Fortnox
   * FLOAT (e.g. `1.0` = 100%). Emitted as a number.
   */
  FullTimeEquivalent: number | null
  /**
   * ↔ `Employee.average_weekly_hours` (Prisma `Decimal(5,2)`) — Fortnox
   * STRING (spec-verified, unlike FullTimeEquivalent). Emitted as a
   * decimal string, e.g. `"38.25"`.
   */
  AverageWeeklyHours: string | null
  /** ↔ `Employee.schedule_id` — opaque Fortnox schedule ref. */
  ScheduleId: string | null

  // --- Salary ---
  /** ↔ `Employee.salary_form` — identity enum (codes above). */
  SalaryForm: SalaryFormCode | null
  /** Fortnox STRING; NOT mapped (no amount columns) — survives via `fortnox_raw`. */
  MonthlySalary?: string
  /** Fortnox STRING; NOT mapped — survives via `fortnox_raw`. */
  HourlyPay?: string
  /** Fortnox STRING; NOT mapped — survives via `fortnox_raw`. */
  AverageHourlyWage?: string

  // --- Vacation (headline only) ---
  /**
   * ↔ `Employee.vacation_days_paid` (Prisma `Decimal(5,2)`) — Fortnox FLOAT.
   * Emitted as a number. The rest of the Fortnox vacation ledger is
   * unmapped (`fortnox_raw`).
   */
  VacationDaysPaid: number | null
}

/**
 * Anything convertible at the Decimal boundary. Prisma's `Decimal` satisfies
 * this structurally via its exact `toString()` — the mapper never imports
 * the Prisma runtime.
 */
export interface DecimalLike {
  toString(): string
}

export type NumericInput = DecimalLike | number | string | null | undefined

/**
 * Structural input of `toFortnox` — the mapped subset of an `Employee` row.
 * A Prisma `Employee` satisfies this shape directly (Decimal columns via
 * `DecimalLike`, enums via the identity code unions). String forms are also
 * accepted for decimals/dates so `EmployeeInput` (from `fromFortnox`)
 * round-trips without conversion.
 *
 * Deliberately ABSENT: `fortnox_employee_id` and all sync metadata — the
 * mapper never reads them (two-id distinction, see `EmployeeId`).
 * Laglig-native columns (`group_id`, `manager_id`, `collective_agreement_id`,
 * audit/timestamps) are not mapped either.
 */
export interface EmployeeMappable {
  employee_id_ref: string | null
  personnummer: string | null
  first_name: string
  last_name: string
  email: string | null
  phone1: string | null
  phone2: string | null
  address1: string | null
  address2: string | null
  post_code: string | null
  city: string | null
  country: string | null
  job_title: string | null
  employment_date: Date | string | null
  employed_to: Date | string | null
  employment_form: EmploymentFormCode | null
  personel_type: PersonelTypeCode | null
  inactive: boolean
  full_time_equivalent: NumericInput
  average_weekly_hours: NumericInput
  schedule_id: string | null
  salary_form: SalaryFormCode | null
  vacation_days_paid: NumericInput
}

/**
 * Output of `fromFortnox` — a plain shape aligned with what a future sync
 * upsert needs. Nullable per the lenient-required design (Story 7.1); only
 * `first_name`/`last_name` are guaranteed present (enforced by the single
 * throw case).
 *
 * Decimal columns are emitted as PRECISION-SAFE DECIMAL STRINGS (Prisma
 * accepts strings for `Decimal` columns without float round-tripping).
 *
 * Deliberately ABSENT: `fortnox_employee_id`, `fortnox_synced_at`,
 * `fortnox_sync_status`, `fortnox_raw` — sync metadata is owned by the
 * future sync job, never written by the mapper.
 */
export interface EmployeeInput {
  employee_id_ref: string | null
  personnummer: string | null
  first_name: string
  last_name: string
  email: string | null
  phone1: string | null
  phone2: string | null
  address1: string | null
  address2: string | null
  post_code: string | null
  city: string | null
  /** Defaults to `'SE'` when the Fortnox record has no Country. */
  country: string
  job_title: string | null
  employment_date: Date | null
  employed_to: Date | null
  employment_form: EmploymentFormCode | null
  personel_type: PersonelTypeCode | null
  inactive: boolean
  /** Decimal string (e.g. `"0.875"`), safe for Prisma `Decimal(4,3)`. */
  full_time_equivalent: string | null
  /** Decimal string (e.g. `"38.25"`), safe for Prisma `Decimal(5,2)`. */
  average_weekly_hours: string | null
  schedule_id: string | null
  salary_form: SalaryFormCode | null
  /** Decimal string (e.g. `"25.5"`), safe for Prisma `Decimal(5,2)`. */
  vacation_days_paid: string | null
}

/**
 * The mapper's single typed error: a Fortnox record without FirstName or
 * LastName cannot become an `EmployeeInput` (our only required columns).
 */
export class FortnoxMappingError extends Error {
  public readonly code = 'FORTNOX_MISSING_REQUIRED_NAME'

  constructor(message: string) {
    super(message)
    this.name = 'FortnoxMappingError'
  }
}

// ============================================================================
// Conversion helpers (pure)
// ============================================================================

const DEFAULT_COUNTRY = 'SE'

/** Plain decimal literal, e.g. "38.25", "-1", "0.875". */
const DECIMAL_RE = /^-?\d+(\.\d+)?$/

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}/

/** Non-empty trimmed string, else null (whitespace-only counts as absent). */
function strOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.trim().length > 0 ? value : null
}

/**
 * Precision-safe canonical decimal string from a Decimal/number/string.
 * String-based: NEVER `parseFloat` on a Decimal object — Prisma `Decimal`'s
 * exact `toString()` is the sole conversion path. Malformed → null.
 */
function toDecimalString(value: NumericInput): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null
  }
  const s = String(value).trim()
  return DECIMAL_RE.test(s) ? s : null
}

/** Number via the string path (float fields). Malformed → null. */
function toDecimalNumber(value: NumericInput): number | null {
  const s = toDecimalString(value)
  return s === null ? null : Number(s)
}

/**
 * `YYYY-MM-DD` toward Fortnox (documented assumption — see plan doc).
 * Accepts `Date` or an ISO-ish string; invalid → null.
 */
function toFortnoxDate(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string' && DATE_ONLY_RE.test(value.trim())) {
    return value.trim().slice(0, 10)
  }
  return null
}

/** `YYYY-MM-DD` (or ISO) from Fortnox → UTC-midnight `Date`; invalid → null. */
function fromFortnoxDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!DATE_ONLY_RE.test(trimmed)) return null
  const date = new Date(`${trimmed.slice(0, 10)}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Identity enum guard: unknown codes degrade to null (no translation). */
function toEnumCode<T extends string>(
  codes: readonly T[],
  value: unknown
): T | null {
  return typeof value === 'string' &&
    (codes as readonly string[]).includes(value)
    ? (value as T)
    : null
}

// ============================================================================
// Mappers
// ============================================================================

/**
 * Maps our `Employee` row shape to a Fortnox Employee payload.
 *
 * Pure projection; never throws. Emits the COMPLETE mapped field set with
 * nulls for absent values — the future sync job decides which keys to
 * include in the actual API call (e.g. stripping nulls on PUT to avoid
 * wiping Fortnox-side data).
 *
 * `EmployeeId` is emitted from `employee_id_ref` ONLY — never from
 * `fortnox_employee_id` (which is not even part of the input shape).
 */
export function toFortnox(employee: EmployeeMappable): FortnoxEmployee {
  return {
    EmployeeId: strOrNull(employee.employee_id_ref),
    PersonalIdentityNumber: strOrNull(employee.personnummer),
    FirstName: employee.first_name ?? '',
    LastName: employee.last_name ?? '',
    Email: strOrNull(employee.email),
    Phone1: strOrNull(employee.phone1),
    Phone2: strOrNull(employee.phone2),
    Address1: strOrNull(employee.address1),
    Address2: strOrNull(employee.address2),
    City: strOrNull(employee.city),
    PostCode: strOrNull(employee.post_code),
    Country: strOrNull(employee.country) ?? DEFAULT_COUNTRY,
    JobTitle: strOrNull(employee.job_title),
    EmploymentDate: toFortnoxDate(employee.employment_date),
    EmployedTo: toFortnoxDate(employee.employed_to),
    EmploymentForm: toEnumCode(EMPLOYMENT_FORM_CODES, employee.employment_form),
    PersonelType: toEnumCode(PERSONEL_TYPE_CODES, employee.personel_type),
    Inactive: employee.inactive === true,
    // Float in Fortnox (spec-verified type split).
    FullTimeEquivalent: toDecimalNumber(employee.full_time_equivalent),
    // STRING in Fortnox (spec-verified type split).
    AverageWeeklyHours: toDecimalString(employee.average_weekly_hours),
    ScheduleId: strOrNull(employee.schedule_id),
    SalaryForm: toEnumCode(SALARY_FORM_CODES, employee.salary_form),
    // Float in Fortnox (spec-verified type split).
    VacationDaysPaid: toDecimalNumber(employee.vacation_days_paid),
  }
}

/**
 * Maps a (possibly partial) Fortnox Employee payload to an `EmployeeInput`.
 *
 * Tolerates a minimal record (only Email/FirstName/LastName): populates what
 * it can, leaves the rest null — Story 7.4's completeness rule then reports
 * "Ej komplett" with no code needed here.
 *
 * THE ONLY THROW CASE: missing/empty `FirstName` or `LastName` →
 * `FortnoxMappingError`. Every other absent or malformed field degrades to
 * null (or the documented default: `country` → `'SE'`, `inactive` → false).
 *
 * Writes `employee_id_ref` from `EmployeeId` and NEVER touches
 * `fortnox_employee_id`/sync metadata — those keys do not exist on
 * `EmployeeInput`; the sync job owns them (as it owns the `fortnox_raw`
 * snapshot of the full payload).
 */
export function fromFortnox(payload: Partial<FortnoxEmployee>): EmployeeInput {
  const firstName = strOrNull(payload.FirstName)
  const lastName = strOrNull(payload.LastName)

  if (firstName === null || lastName === null) {
    throw new FortnoxMappingError(
      'Fortnox employee record is missing FirstName and/or LastName ' +
        '(required to create an Employee)'
    )
  }

  return {
    employee_id_ref: strOrNull(payload.EmployeeId),
    personnummer: strOrNull(payload.PersonalIdentityNumber),
    first_name: firstName,
    last_name: lastName,
    email: strOrNull(payload.Email),
    phone1: strOrNull(payload.Phone1),
    phone2: strOrNull(payload.Phone2),
    address1: strOrNull(payload.Address1),
    address2: strOrNull(payload.Address2),
    post_code: strOrNull(payload.PostCode),
    city: strOrNull(payload.City),
    country: strOrNull(payload.Country) ?? DEFAULT_COUNTRY,
    job_title: strOrNull(payload.JobTitle),
    employment_date: fromFortnoxDate(payload.EmploymentDate),
    employed_to: fromFortnoxDate(payload.EmployedTo),
    employment_form: toEnumCode(EMPLOYMENT_FORM_CODES, payload.EmploymentForm),
    personel_type: toEnumCode(PERSONEL_TYPE_CODES, payload.PersonelType),
    inactive: payload.Inactive === true,
    full_time_equivalent: toDecimalString(payload.FullTimeEquivalent),
    average_weekly_hours: toDecimalString(payload.AverageWeeklyHours),
    schedule_id: strOrNull(payload.ScheduleId),
    salary_form: toEnumCode(SALARY_FORM_CODES, payload.SalaryForm),
    vacation_days_paid: toDecimalString(payload.VacationDaysPaid),
  }
}
