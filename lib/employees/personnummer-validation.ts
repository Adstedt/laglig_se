/**
 * Story 7.3: Swedish personnummer validation — format + Luhn checksum.
 *
 * This is the codebase's first checksum validator (orgnr checks today are
 * regex-format-only). Kept dependency-free and pure so it is reusable for
 * organisationsnummer later.
 *
 * Accepted formats (hyphen or `+` separator optional):
 *   - `YYYYMMDD-XXXX` (12 digits)
 *   - `YYMMDD-XXXX`   (10 digits)
 *
 * The Luhn checksum is always computed over the 10-digit century-less form
 * (YYMMDDXXX + check digit), per the Skatteverket algorithm.
 *
 * NOTE: this module only VALIDATES — it never stores or logs values. The
 * personnummer itself is PII and is encrypted at rest via
 * `encryptPersonnummer` (lib/employees/personnummer.ts) before persistence.
 */

/** Swedish error strings surfaced inline in forms and from server actions. */
export const PERSONNUMMER_FORMAT_ERROR = 'Ogiltigt format — ange ÅÅMMDD-XXXX'
export const PERSONNUMMER_CHECKSUM_ERROR = 'Ogiltigt personnummer'

const PERSONNUMMER_PATTERN = /^(\d{6}|\d{8})[-+]?(\d{4})$/

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function isValidCalendarDate(
  year: number,
  month: number,
  day: number
): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  return day <= (daysInMonth[month - 1] ?? 0)
}

/**
 * Luhn checksum over the 10-digit century-less personnummer form
 * (9 digits + check digit). Returns false for anything that is not exactly
 * 10 digits.
 */
export function luhnCheck(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false

  let sum = 0
  for (let i = 0; i < 10; i++) {
    let d = digits.charCodeAt(i) - 48
    // Positions 1,3,5,… (0-indexed even) are doubled per the Luhn algorithm.
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

/**
 * Structural check: `YYYYMMDD-XXXX` or `YYMMDD-XXXX` (separator optional),
 * with a possible calendar date. For the century-less form the date is
 * accepted if it is valid in EITHER 19xx or 20xx (leap-day ambiguity).
 */
export function isValidPersonnummerFormat(value: string): boolean {
  const trimmed = value.trim()
  const match = PERSONNUMMER_PATTERN.exec(trimmed)
  if (!match) return false

  const datePart = match[1] ?? ''

  if (datePart.length === 8) {
    const year = Number(datePart.slice(0, 4))
    const month = Number(datePart.slice(4, 6))
    const day = Number(datePart.slice(6, 8))
    return isValidCalendarDate(year, month, day)
  }

  const yy = Number(datePart.slice(0, 2))
  const month = Number(datePart.slice(2, 4))
  const day = Number(datePart.slice(4, 6))
  return (
    isValidCalendarDate(1900 + yy, month, day) ||
    isValidCalendarDate(2000 + yy, month, day)
  )
}

export interface PersonnummerValidationResult {
  valid: boolean
  error?: string
}

/**
 * Full validation: format (incl. impossible dates) + Luhn checksum.
 * Empty/null/undefined is VALID — the field is optional by design (missing
 * LAS-critical data becomes "Ej komplett" in Story 7.4, not a save blocker).
 */
export function validatePersonnummer(
  value: string | null | undefined
): PersonnummerValidationResult {
  const trimmed = value?.trim() ?? ''
  if (trimmed === '') return { valid: true }

  if (!isValidPersonnummerFormat(trimmed)) {
    return { valid: false, error: PERSONNUMMER_FORMAT_ERROR }
  }

  // Luhn is always computed over the century-less 10-digit form.
  const digits = trimmed.replace(/[-+]/g, '')
  const centuryless = digits.length === 12 ? digits.slice(2) : digits

  if (!luhnCheck(centuryless)) {
    return { valid: false, error: PERSONNUMMER_CHECKSUM_ERROR }
  }

  return { valid: true }
}
