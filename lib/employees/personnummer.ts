/**
 * Story 7.1 (Epic 7): Personnummer (Swedish personal identity number) helpers.
 *
 * The personnummer is PII and is stored ENCRYPTED AT REST in the
 * `Employee.personnummer` column (ciphertext produced by
 * {@link encryptPersonnummer}). It is only ever decrypted for roles holding
 * `employees:manage`; other viewers get {@link maskPersonnummer}.
 *
 * This module is the write-side contract Story 7.3's create/update action will
 * call — 7.1 itself does not build a mutation action (proven via unit tests).
 */

import { encryptField, decryptField } from '@/lib/crypto/field-encryption'

/** Display mask for non-authorized viewers. */
export const PERSONNUMMER_MASK = '••••••-••••'

/**
 * Encrypt a personnummer for storage. Returns ciphertext (see
 * {@link encryptField} for format). Throws (fail-closed) if ENCRYPTION_KEY is
 * missing/invalid — plaintext is never persisted.
 */
export function encryptPersonnummer(value: string): string {
  return encryptField(value)
}

/**
 * Decrypt a stored personnummer ciphertext back to plaintext. Only call for
 * roles authorized to see the full value (`employees:manage`).
 */
export function decryptPersonnummer(cipher: string): string {
  return decryptField(cipher)
}

/**
 * Mask value for non-authorized display. Always returns the fixed mask
 * regardless of input, so no PII leaks through length or partial digits.
 */
export function maskPersonnummer(_value?: string | null): string {
  return PERSONNUMMER_MASK
}
