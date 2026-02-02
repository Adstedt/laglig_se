import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SignJWT } from 'jose'

// Mock next/headers before importing the module under test
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

describe('lib/admin/auth', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
    process.env.ADMIN_JWT_SECRET = 'test-secret-that-is-long-enough-32chars!'
    process.env.ADMIN_EMAILS = 'admin@laglig.se,other@laglig.se'
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
    vi.restoreAllMocks()
  })

  async function getModule() {
    return import('@/lib/admin/auth')
  }

  describe('isAdminEmail', () => {
    it('returns true for listed emails', async () => {
      const { isAdminEmail } = await getModule()
      expect(isAdminEmail('admin@laglig.se')).toBe(true)
      expect(isAdminEmail('other@laglig.se')).toBe(true)
    })

    it('returns false for non-listed emails', async () => {
      const { isAdminEmail } = await getModule()
      expect(isAdminEmail('user@example.com')).toBe(false)
    })

    it('is case-insensitive', async () => {
      const { isAdminEmail } = await getModule()
      expect(isAdminEmail('Admin@LAGLIG.SE')).toBe(true)
      expect(isAdminEmail('ADMIN@laglig.se')).toBe(true)
      expect(isAdminEmail('Other@Laglig.Se')).toBe(true)
    })

    it('handles whitespace in ADMIN_EMAILS env var', async () => {
      process.env.ADMIN_EMAILS = ' admin@laglig.se , other@laglig.se '
      const { isAdminEmail } = await getModule()
      expect(isAdminEmail('admin@laglig.se')).toBe(true)
      expect(isAdminEmail('other@laglig.se')).toBe(true)
    })

    it('returns false when ADMIN_EMAILS is undefined', async () => {
      delete process.env.ADMIN_EMAILS
      const { isAdminEmail } = await getModule()
      expect(isAdminEmail('admin@laglig.se')).toBe(false)
    })

    it('returns false when ADMIN_EMAILS is empty', async () => {
      process.env.ADMIN_EMAILS = ''
      const { isAdminEmail } = await getModule()
      expect(isAdminEmail('admin@laglig.se')).toBe(false)
    })
  })

  describe('createAdminToken', () => {
    it('returns a valid JWT string', async () => {
      const { createAdminToken } = await getModule()
      const token = await createAdminToken('admin@laglig.se')
      expect(token).toBeTruthy()
      expect(token.startsWith('ey')).toBe(true)
    })
  })

  describe('verifyAdminToken', () => {
    it('decodes a valid token correctly', async () => {
      const { createAdminToken, verifyAdminToken } = await getModule()
      const token = await createAdminToken('admin@laglig.se')
      const result = await verifyAdminToken(token)
      expect(result).toEqual({ email: 'admin@laglig.se' })
    })

    it('returns null for expired tokens', async () => {
      const { verifyAdminToken } = await getModule()
      // Create a token that expired 1 hour ago
      const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET)
      const token = await new SignJWT({ email: 'admin@laglig.se' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(secret)

      const result = await verifyAdminToken(token)
      expect(result).toBeNull()
    })

    it('returns null for tokens signed with wrong secret', async () => {
      const { verifyAdminToken } = await getModule()
      const wrongSecret = new TextEncoder().encode(
        'wrong-secret-key-that-is-long!!'
      )
      const token = await new SignJWT({ email: 'admin@laglig.se' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(wrongSecret)

      const result = await verifyAdminToken(token)
      expect(result).toBeNull()
    })

    it('returns null for malformed strings', async () => {
      const { verifyAdminToken } = await getModule()
      expect(await verifyAdminToken('not-a-jwt')).toBeNull()
      expect(await verifyAdminToken('')).toBeNull()
      expect(await verifyAdminToken('ey.invalid.token')).toBeNull()
    })
  })
})
