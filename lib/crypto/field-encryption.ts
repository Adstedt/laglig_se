/**
 * Story 7.1 (Epic 7): Application-level field encryption.
 *
 * NET-NEW pattern for this codebase — there is no prior application-level
 * field-encryption precedent (the only sensitive-data precedent is HMAC-SHA256
 * *signing* in `lib/email/unsubscribe-token.ts`). This module establishes the
 * pattern for encrypting sensitive columns at rest (currently: Employee
 * personnummer).
 *
 * Algorithm: AES-256-GCM (authenticated encryption) via Node `crypto`.
 * Key:       `process.env.ENCRYPTION_KEY`, 32 bytes, base64-encoded.
 *            Generate with `openssl rand -base64 32`.
 * Format:    `base64(iv).base64(authTag).base64(ciphertext)` — three
 *            dot-separated base64 segments. A random 12-byte IV per call means
 *            two encryptions of the same plaintext produce different output.
 * Fail-closed: if the key is missing or malformed, `encryptField` throws a
 *            typed `FieldEncryptionError` — plaintext is NEVER persisted.
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32 // AES-256
const IV_BYTES = 12 // GCM standard nonce length
const AUTH_TAG_BYTES = 16

/**
 * Typed error for all field-encryption failures (missing/invalid key,
 * malformed ciphertext, tamper/auth-tag rejection). Callers can catch this to
 * distinguish crypto failures from other errors.
 */
export class FieldEncryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FieldEncryptionError'
  }
}

/**
 * Load and validate the 32-byte AES key from ENCRYPTION_KEY (base64).
 * Throws FieldEncryptionError (fail-closed) if missing or wrong length.
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new FieldEncryptionError(
      'ENCRYPTION_KEY is not configured. Generate one with `openssl rand -base64 32` and set it before persisting sensitive fields.'
    )
  }

  // `Buffer.from(_, 'base64')` never throws (invalid chars are silently
  // dropped), so the 32-byte length check below is the real guard against a
  // missing/garbled key — not a try/catch around the decode.
  const key = Buffer.from(raw, 'base64')

  if (key.length !== KEY_BYTES) {
    throw new FieldEncryptionError(
      `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes of base64 (got ${key.length}). Generate one with \`openssl rand -base64 32\`.`
    )
  }

  return key
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * @returns `base64(iv).base64(authTag).base64(ciphertext)`
 * @throws {FieldEncryptionError} if the key is missing/invalid (fail-closed).
 */
export function encryptField(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_BYTES)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.')
}

/**
 * Decrypt a value produced by {@link encryptField}.
 * @throws {FieldEncryptionError} if the key is missing/invalid, the format is
 *         malformed, or the auth tag fails (tampered ciphertext / wrong key).
 */
export function decryptField(payload: string): string {
  const key = getKey()

  const parts = payload.split('.')
  if (parts.length !== 3) {
    throw new FieldEncryptionError(
      'Malformed ciphertext: expected `iv.authTag.ciphertext`.'
    )
  }

  const [ivB64, authTagB64, ciphertextB64] = parts as [string, string, string]
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new FieldEncryptionError('Malformed ciphertext: invalid iv/authTag.')
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ])
    return plaintext.toString('utf8')
  } catch {
    // GCM auth-tag mismatch (tampered ciphertext or wrong key) throws here.
    throw new FieldEncryptionError(
      'Decryption failed: authentication tag mismatch (tampered ciphertext or wrong key).'
    )
  }
}
