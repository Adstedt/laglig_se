/**
 * Story 7.10: salary helpers — normalization (single canonicalization point),
 * encrypt/decrypt round-trip and the magnitude-free mask.
 */
import { describe, test, expect, beforeEach } from 'vitest'
import {
  normalizeSalary,
  encryptSalary,
  decryptSalary,
  maskSalary,
  SALARY_MASK,
} from '@/lib/employees/salary'

// Valid 32-byte base64 key so the real crypto path runs.
const TEST_KEY = Buffer.alloc(32, 7).toString('base64')

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY
})

describe('normalizeSalary', () => {
  test('canonicalizes to two decimals (toFixed(2))', () => {
    expect(normalizeSalary('45000')).toBe('45000.00')
    expect(normalizeSalary('185.5')).toBe('185.50')
  })

  test('accepts a Swedish decimal comma and strips thousands spaces', () => {
    expect(normalizeSalary('45 000,50')).toBe('45000.50')
    expect(normalizeSalary('1 234,5')).toBe('1234.50')
  })

  test('empty / whitespace → null (caller treats as clear)', () => {
    expect(normalizeSalary('')).toBeNull()
    expect(normalizeSalary('   ')).toBeNull()
  })

  test('rejects negative and non-numeric → null', () => {
    expect(normalizeSalary('-1')).toBeNull()
    expect(normalizeSalary('abc')).toBeNull()
    expect(normalizeSalary('12,,3')).toBeNull()
  })

  test('zero is a valid amount', () => {
    expect(normalizeSalary('0')).toBe('0.00')
  })
})

describe('encrypt/decrypt round-trip', () => {
  test('a normalized salary round-trips through ciphertext', () => {
    const normalized = normalizeSalary('45000')!
    const cipher = encryptSalary(normalized)
    // Ciphertext is not the plaintext (three dot-separated base64 segments).
    expect(cipher).not.toContain('45000')
    expect(cipher.split('.')).toHaveLength(3)
    expect(decryptSalary(cipher)).toBe('45000.00')
  })

  test('two encryptions of the same value differ (random IV) but both decrypt', () => {
    const a = encryptSalary('185.50')
    const b = encryptSalary('185.50')
    expect(a).not.toBe(b)
    expect(decryptSalary(a)).toBe('185.50')
    expect(decryptSalary(b)).toBe('185.50')
  })
})

describe('maskSalary', () => {
  test('is a fixed magnitude-free mask', () => {
    expect(maskSalary()).toBe(SALARY_MASK)
    // No digits leak the pay band.
    expect(maskSalary()).not.toMatch(/\d/)
  })
})
