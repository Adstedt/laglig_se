import { describe, test, expect, beforeEach } from 'vitest'
import {
  encryptField,
  decryptField,
  FieldEncryptionError,
} from '@/lib/crypto/field-encryption'

// Two distinct, valid 32-byte base64 keys for round-trip / wrong-key tests.
const KEY_A = Buffer.alloc(32, 7).toString('base64')
const KEY_B = Buffer.alloc(32, 9).toString('base64')

beforeEach(() => {
  process.env.ENCRYPTION_KEY = KEY_A
})

describe('field-encryption (AES-256-GCM)', () => {
  test('round-trips plaintext (decrypt(encrypt(x)) === x)', () => {
    const plaintext = '19900101-1234'
    expect(decryptField(encryptField(plaintext))).toBe(plaintext)
  })

  test('round-trips unicode / long input', () => {
    const plaintext = 'åäö ÅÄÖ — a fairly long secret value 1234567890'
    expect(decryptField(encryptField(plaintext))).toBe(plaintext)
  })

  test('ciphertext is not the plaintext', () => {
    const plaintext = 'sensitive-data'
    const enc = encryptField(plaintext)
    expect(enc).not.toContain(plaintext)
    expect(enc.split('.')).toHaveLength(3)
  })

  test('uses a distinct random IV per call (same input → different output)', () => {
    const plaintext = 'same-input'
    const a = encryptField(plaintext)
    const b = encryptField(plaintext)
    expect(a).not.toBe(b)
    // ...but both still decrypt back to the same plaintext.
    expect(decryptField(a)).toBe(plaintext)
    expect(decryptField(b)).toBe(plaintext)
  })

  test('rejects tampered ciphertext (auth-tag mismatch)', () => {
    const enc = encryptField('data')
    const [iv, tag] = enc.split('.') as [string, string, string]
    const tampered = `${iv}.${tag}.${Buffer.from('totally-different').toString('base64')}`
    expect(() => decryptField(tampered)).toThrow(FieldEncryptionError)
  })

  test('rejects decryption with the wrong key', () => {
    const enc = encryptField('data')
    process.env.ENCRYPTION_KEY = KEY_B
    expect(() => decryptField(enc)).toThrow(FieldEncryptionError)
  })

  test('rejects malformed ciphertext (wrong segment count)', () => {
    expect(() => decryptField('not-a-valid-payload')).toThrow(
      FieldEncryptionError
    )
  })

  test('fails closed when ENCRYPTION_KEY is missing', () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => encryptField('x')).toThrow(FieldEncryptionError)
  })

  test('fails closed when ENCRYPTION_KEY is the wrong length', () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64')
    expect(() => encryptField('x')).toThrow(FieldEncryptionError)
  })
})
