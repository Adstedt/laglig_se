/**
 * Story 7.3: Unit tests for the personnummer validator (format + Luhn).
 *
 * Pure functions — no mocks. Valid fixtures use well-known public example
 * numbers (e.g. 640823-3234 from the Skatteverket algorithm example and the
 * 811218-9876 test number), never real people's data.
 */
import { describe, test, expect } from 'vitest'
import {
  luhnCheck,
  isValidPersonnummerFormat,
  validatePersonnummer,
  PERSONNUMMER_FORMAT_ERROR,
  PERSONNUMMER_CHECKSUM_ERROR,
} from '@/lib/employees/personnummer-validation'

describe('luhnCheck', () => {
  test('accepts a valid 10-digit century-less personnummer', () => {
    expect(luhnCheck('6408233234')).toBe(true)
    expect(luhnCheck('8112189876')).toBe(true)
  })

  test('rejects a wrong check digit', () => {
    expect(luhnCheck('6408233235')).toBe(false)
    expect(luhnCheck('8112189875')).toBe(false)
  })

  test('rejects non-10-digit input', () => {
    expect(luhnCheck('640823323')).toBe(false) // 9 digits
    expect(luhnCheck('196408233234')).toBe(false) // 12 digits
    expect(luhnCheck('64082x3234')).toBe(false) // non-digit
    expect(luhnCheck('')).toBe(false)
  })
})

describe('isValidPersonnummerFormat', () => {
  test('accepts YYMMDD-XXXX and YYYYMMDD-XXXX, with and without hyphen', () => {
    expect(isValidPersonnummerFormat('640823-3234')).toBe(true)
    expect(isValidPersonnummerFormat('6408233234')).toBe(true)
    expect(isValidPersonnummerFormat('19640823-3234')).toBe(true)
    expect(isValidPersonnummerFormat('196408233234')).toBe(true)
  })

  test('accepts the `+` century separator (100+ years)', () => {
    expect(isValidPersonnummerFormat('121212+1212')).toBe(true)
  })

  test('rejects impossible dates', () => {
    expect(isValidPersonnummerFormat('641323-3234')).toBe(false) // month 13
    expect(isValidPersonnummerFormat('640832-3234')).toBe(false) // day 32
    expect(isValidPersonnummerFormat('640200-3234')).toBe(false) // day 0
    expect(isValidPersonnummerFormat('19990231-1234')).toBe(false) // Feb 31
    expect(isValidPersonnummerFormat('20230229-1234')).toBe(false) // non-leap Feb 29
  })

  test('accepts Feb 29 when a plausible century makes it a leap year', () => {
    expect(isValidPersonnummerFormat('20000229-1234')).toBe(true)
    // Century-less: 000229 could be 2000 (leap) → valid format.
    expect(isValidPersonnummerFormat('000229-1234')).toBe(true)
  })

  test('rejects malformed strings', () => {
    expect(isValidPersonnummerFormat('64-0823-3234')).toBe(false)
    expect(isValidPersonnummerFormat('640823-323')).toBe(false)
    expect(isValidPersonnummerFormat('640823-32345')).toBe(false)
    expect(isValidPersonnummerFormat('abcdef-ghij')).toBe(false)
    expect(isValidPersonnummerFormat('')).toBe(false)
  })
})

describe('validatePersonnummer', () => {
  test('valid samples pass (with/without century, with/without hyphen)', () => {
    expect(validatePersonnummer('640823-3234')).toEqual({ valid: true })
    expect(validatePersonnummer('6408233234')).toEqual({ valid: true })
    expect(validatePersonnummer('19640823-3234')).toEqual({ valid: true })
    expect(validatePersonnummer('196408233234')).toEqual({ valid: true })
    expect(validatePersonnummer('811218-9876')).toEqual({ valid: true })
  })

  test('Luhn failure yields the Swedish checksum error', () => {
    expect(validatePersonnummer('640823-3235')).toEqual({
      valid: false,
      error: PERSONNUMMER_CHECKSUM_ERROR,
    })
    // 12-digit form: Luhn is computed over the century-less 10 digits.
    expect(validatePersonnummer('19640823-3235')).toEqual({
      valid: false,
      error: PERSONNUMMER_CHECKSUM_ERROR,
    })
  })

  test('impossible date yields the Swedish format error', () => {
    expect(validatePersonnummer('641323-3234')).toEqual({
      valid: false,
      error: PERSONNUMMER_FORMAT_ERROR,
    })
    expect(validatePersonnummer('nonsense')).toEqual({
      valid: false,
      error: PERSONNUMMER_FORMAT_ERROR,
    })
  })

  test('empty/null/undefined passes — the field is optional', () => {
    expect(validatePersonnummer('')).toEqual({ valid: true })
    expect(validatePersonnummer('   ')).toEqual({ valid: true })
    expect(validatePersonnummer(null)).toEqual({ valid: true })
    expect(validatePersonnummer(undefined)).toEqual({ valid: true })
  })

  test('trims surrounding whitespace before validating', () => {
    expect(validatePersonnummer(' 640823-3234 ')).toEqual({ valid: true })
  })
})
