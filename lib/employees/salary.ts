/**
 * Story 7.10 (Epic 7): Salary (Lön) helpers.
 *
 * Salary amounts (`Employee.monthly_salary` / `Employee.hourly_pay`) are
 * sensitive comp data and are stored ENCRYPTED AT REST (ciphertext TEXT
 * columns), mirroring `personnummer` exactly (see
 * {@link lib/employees/personnummer.ts}). They are decrypted ONLY for roles
 * holding `employees:manage`; every other viewer gets {@link maskSalary}.
 *
 * 7.1 deliberately excluded salary as accounting-only; 7.10 reverses that for
 * löne-compliance ("betalar vi enligt kollektivavtalet?"). Because the value
 * is encrypted there is no numeric DB aggregation — that is fine: the AI does
 * the minimilön comparison, salary-analytics is a separate future concern.
 *
 * {@link normalizeSalary} is the SINGLE normalization point (comma→dot,
 * `toFixed(2)`): always normalize BEFORE encrypt on write so the ciphertext
 * holds a canonical decimal string (e.g. `"45000.00"`). Display and the
 * Fortnox round-trip therefore read a stable value.
 */

import { encryptField, decryptField } from '@/lib/crypto/field-encryption'

/**
 * Display mask for non-authorized viewers. Fixed string — no magnitude leaks
 * through length (unlike a real amount, which would betray the pay band).
 */
export const SALARY_MASK = '•••••'

/**
 * Normalize a raw salary input to a canonical two-decimal string, or null.
 *
 * - Accepts Swedish decimal comma (`"45 000,50"` → `"45000.50"`); strips
 *   spaces/thin-spaces used as thousands separators.
 * - `''` / whitespace → null (the caller treats null as "clear").
 * - Rejects NaN and negative amounts → null (the caller surfaces a friendly
 *   error; a negative or unparseable salary is never persisted).
 * - Emits `toFixed(2)` so the stored plaintext is always e.g. `"45000.00"`.
 */
export function normalizeSalary(input: string): string | null {
  const cleaned = input
    .trim()
    // Drop regular + thin/no-break spaces used as thousands separators.
    .replace(/[\s  ]/g, '')
    .replace(',', '.')
  if (cleaned === '') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return n.toFixed(2)
}

/**
 * Encrypt a NORMALIZED salary string for storage. Returns ciphertext (see
 * {@link encryptField} for format). Throws (fail-closed) if ENCRYPTION_KEY is
 * missing/invalid — plaintext is never persisted. Always call
 * {@link normalizeSalary} first.
 */
export function encryptSalary(normalized: string): string {
  return encryptField(normalized)
}

/**
 * Decrypt a stored salary ciphertext back to the canonical decimal string.
 * Only call for roles authorized to see the amount (`employees:manage`).
 */
export function decryptSalary(cipher: string): string {
  return decryptField(cipher)
}

/**
 * Mask value for non-authorized display. Always returns the fixed mask, so no
 * magnitude leaks through length or partial digits.
 */
export function maskSalary(): string {
  return SALARY_MASK
}
