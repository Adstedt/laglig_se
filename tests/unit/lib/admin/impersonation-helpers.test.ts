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
  it('returns true when marker cookie and admin session present', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'admin_impersonating') return { value: 'user-123' }
      if (name === 'admin_session') return { value: 'admin-token' }
      return undefined
    })
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { email: 'admin@test.com' },
    } as never)

    const result = await isImpersonating()

    expect(result).toBe(true)
  })

  it('returns false when no marker cookie', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'admin_session') return { value: 'admin-token' }
      if (name === 'next-auth.session-token') return { value: 'session-token' }
      return undefined
    })

    const result = await isImpersonating()

    expect(result).toBe(false)
  })

  it('returns false when marker cookie present but no admin session', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'admin_impersonating') return { value: 'user-123' }
      return undefined
    })

    const result = await isImpersonating()

    expect(result).toBe(false)
  })

  it('returns false when no cookies at all', async () => {
    const result = await isImpersonating()

    expect(result).toBe(false)
  })
})

describe('getImpersonationInfo', () => {
  it('returns decoded info when impersonating', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'admin_impersonating') return { value: 'user-123' }
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

  it('returns null when no marker cookie', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'next-auth.session-token') return { value: 'session-token' }
      if (name === 'admin_session') return { value: 'admin-token' }
      return undefined
    })

    const result = await getImpersonationInfo()

    expect(result).toBeNull()
  })

  it('returns null when no admin session', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'admin_impersonating') return { value: 'user-123' }
      return undefined
    })

    const result = await getImpersonationInfo()

    expect(result).toBeNull()
  })

  it('returns null when no NextAuth cookie', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'admin_impersonating') return { value: 'user-123' }
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
      if (name === 'admin_impersonating') return { value: 'user-123' }
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

  it('returns null when decoded token has no id or email', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'admin_impersonating') return { value: 'user-123' }
      if (name === 'next-auth.session-token') return { value: 'session-token' }
      if (name === 'admin_session') return { value: 'admin-token' }
      return undefined
    })
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { email: 'admin@test.com' },
    } as never)
    vi.mocked(decode).mockResolvedValue({} as never)

    const result = await getImpersonationInfo()

    expect(result).toBeNull()
  })
})
