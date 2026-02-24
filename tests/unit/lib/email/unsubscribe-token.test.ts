import { describe, it, expect, vi, beforeEach } from 'vitest'

const TEST_USER_ID = '11111111-1111-4111-a111-111111111111'
const TEST_WORKSPACE_ID = '22222222-2222-4222-a222-222222222222'
const TEST_SECRET = 'test-secret-key-for-hmac-signing'

beforeEach(() => {
  vi.stubEnv('NEXTAUTH_SECRET', TEST_SECRET)
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://laglig.se')
})

import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  generateUnsubscribeUrl,
} from '@/lib/email/unsubscribe-token'

describe('generateUnsubscribeToken', () => {
  it('generates a non-empty base64url token', () => {
    const token = generateUnsubscribeToken(TEST_USER_ID, TEST_WORKSPACE_ID)

    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
    // base64url should not contain + / =
    expect(token).not.toMatch(/[+/=]/)
  })

  it('generates deterministic tokens for same input', () => {
    const token1 = generateUnsubscribeToken(TEST_USER_ID, TEST_WORKSPACE_ID)
    const token2 = generateUnsubscribeToken(TEST_USER_ID, TEST_WORKSPACE_ID)

    expect(token1).toBe(token2)
  })

  it('generates different tokens for different inputs', () => {
    const token1 = generateUnsubscribeToken(TEST_USER_ID, TEST_WORKSPACE_ID)
    const token2 = generateUnsubscribeToken(
      TEST_USER_ID,
      '99999999-9999-4999-a999-999999999999'
    )

    expect(token1).not.toBe(token2)
  })
})

describe('verifyUnsubscribeToken', () => {
  it('validates a valid token and returns userId + workspaceId', () => {
    const token = generateUnsubscribeToken(TEST_USER_ID, TEST_WORKSPACE_ID)
    const result = verifyUnsubscribeToken(token)

    expect(result).toEqual({
      userId: TEST_USER_ID,
      workspaceId: TEST_WORKSPACE_ID,
    })
  })

  it('rejects a tampered token (modified payload)', () => {
    const token = generateUnsubscribeToken(TEST_USER_ID, TEST_WORKSPACE_ID)

    // Decode, tamper, re-encode
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = decoded.split(':')
    parts[0] = 'tampered-user-id'
    const tampered = Buffer.from(parts.join(':')).toString('base64url')

    const result = verifyUnsubscribeToken(tampered)
    expect(result).toBeNull()
  })

  it('rejects completely invalid base64 input', () => {
    expect(verifyUnsubscribeToken('not-a-valid-token')).toBeNull()
    expect(verifyUnsubscribeToken('')).toBeNull()
    expect(verifyUnsubscribeToken('!!!invalid!!!')).toBeNull()
  })

  it('rejects token with wrong number of parts', () => {
    // Encode just one part
    const token = Buffer.from('onlyonepart').toString('base64url')
    expect(verifyUnsubscribeToken(token)).toBeNull()
  })
})

describe('generateUnsubscribeUrl', () => {
  it('generates a full URL with token query parameter', () => {
    const url = generateUnsubscribeUrl(TEST_USER_ID, TEST_WORKSPACE_ID)

    expect(url).toMatch(/^https:\/\/laglig\.se\/unsubscribe\?token=.+$/)
  })

  it('contains a verifiable token', () => {
    const url = generateUnsubscribeUrl(TEST_USER_ID, TEST_WORKSPACE_ID)
    const token = url.split('token=')[1]

    expect(token).toBeTruthy()
    const result = verifyUnsubscribeToken(token!)
    expect(result).toEqual({
      userId: TEST_USER_ID,
      workspaceId: TEST_WORKSPACE_ID,
    })
  })
})
