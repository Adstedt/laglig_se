import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}))

vi.mock('jose', () => ({
  SignJWT: vi.fn(),
  jwtVerify: vi.fn(),
}))

vi.mock('next-auth/jwt', () => ({
  decode: vi.fn(),
}))

import { decode } from 'next-auth/jwt'
import { jwtVerify } from 'jose'
import {
  isImpersonating,
  getImpersonationInfo,
  getNextAuthCookieName,
} from '@/lib/admin/auth'

beforeEach(() => {
  vi.clearAllMocks()
  mockCookieStore.get.mockReturnValue(undefined)
  process.env.ADMIN_JWT_SECRET = 'admin-test-secret'
  process.env.NEXTAUTH_SECRET = 'nextauth-test-secret'
})

describe('getNextAuthCookieName', () => {
  it('returns non-prefixed name in test/development', () => {
    expect(getNextAuthCookieName()).toBe('next-auth.session-token')
  })
})

describe('isImpersonating', () => {
  it('returns true when both cookies present and admin session valid', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'next-auth.session-token') return { value: 'session-token' }
      if (name === 'admin_session') return { value: 'admin-token' }
      return undefined
    })
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { email: 'admin@test.com' },
    } as never)

    const result = await isImpersonating()

    expect(result).toBe(true)
  })

  it('returns false when only admin cookie present (no NextAuth session)', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'admin_session') return { value: 'admin-token' }
      return undefined
    })

    const result = await isImpersonating()

    expect(result).toBe(false)
  })

  it('returns false when no admin session cookie', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'next-auth.session-token') return { value: 'session-token' }
      return undefined
    })

    const result = await isImpersonating()

    expect(result).toBe(false)
  })

  it('returns false when both cookies present but NextAuth session belongs to admin (own session)', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'next-auth.session-token') return { value: 'session-token' }
      if (name === 'admin_session') return { value: 'admin-token' }
      return undefined
    })
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { email: 'admin@test.com' },
    } as never)
    // NextAuth session email matches admin email
    vi.mocked(decode).mockResolvedValue({
      id: 'admin-user-id',
      email: 'admin@test.com',
    } as never)

    const result = await isImpersonating()

    expect(result).toBe(false)
  })
})

describe('getImpersonationInfo', () => {
  it('returns decoded info when impersonating', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'next-auth.session-token') return { value: 'session-token' }
      if (name === 'admin_session') return { value: 'admin-token' }
      return undefined
    })
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { email: 'admin@test.com' },
    } as never)
    vi.mocked(decode).mockResolvedValue({
      id: 'user-123',
      email: 'user@test.com',
    } as never)

    const result = await getImpersonationInfo()

    expect(result).toEqual({
      adminEmail: 'admin@test.com',
      impersonatedUserId: 'user-123',
      impersonatedEmail: 'user@test.com',
    })
  })

  it('returns null when not impersonating (no admin session)', async () => {
    mockCookieStore.get.mockReturnValue(undefined)

    const result = await getImpersonationInfo()

    expect(result).toBeNull()
  })

  it('returns null when admin session valid but no NextAuth cookie', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'admin_session') return { value: 'admin-token' }
      return undefined
    })
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { email: 'admin@test.com' },
    } as never)

    const result = await getImpersonationInfo()

    expect(result).toBeNull()
  })

  it('returns null when decode fails', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'next-auth.session-token') return { value: 'bad-token' }
      if (name === 'admin_session') return { value: 'admin-token' }
      return undefined
    })
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { email: 'admin@test.com' },
    } as never)
    vi.mocked(decode).mockRejectedValue(new Error('Invalid token'))

    const result = await getImpersonationInfo()

    expect(result).toBeNull()
  })

  it('returns null when admin email matches decoded session email (own session)', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'next-auth.session-token') return { value: 'session-token' }
      if (name === 'admin_session') return { value: 'admin-token' }
      return undefined
    })
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { email: 'admin@test.com' },
    } as never)
    // NextAuth session email matches admin email
    vi.mocked(decode).mockResolvedValue({
      id: 'admin-user-id',
      email: 'admin@test.com',
    } as never)

    const result = await getImpersonationInfo()

    expect(result).toBeNull()
  })
})
