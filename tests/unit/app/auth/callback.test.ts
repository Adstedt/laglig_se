/**
 * Story 4.16: Unit tests for /auth/callback OAuth bridge
 *
 * Tests cover:
 * (a) New-user path — creates Prisma row + sets cookie (AC 14)
 * (b) Returning-user path — updates last_login_at only (AC 15)
 * (c) Email-collision path — signOut + redirect (AC 16)
 * (d) JWT encode failure — error redirect (AC 13)
 * (e) Invalid `next` param — falls back to /dashboard (AC 12)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Mocks (must be before imports) ---

const mockExchangeCodeForSession = vi.fn()
const mockGetUser = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
  })),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

const mockEncode = vi.fn()
vi.mock('next-auth/jwt', () => ({
  encode: (...args: unknown[]) => mockEncode(...args),
}))

const mockCookieSet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    set: mockCookieSet,
  })),
}))

vi.mock('@/lib/admin/auth', () => ({
  getNextAuthCookieName: vi.fn(() => 'next-auth.session-token'),
}))

// --- Import after mocks ---

import { GET } from '@/app/auth/callback/route'
import { prisma } from '@/lib/prisma'
import { getNextAuthCookieName } from '@/lib/admin/auth'

// --- Fixtures ---

const FIXTURE_SUPABASE_USER = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  user_metadata: { full_name: 'Test User' },
}

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/auth/callback')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url)
}

// --- Tests ---

describe('/auth/callback OAuth bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({
      data: { user: FIXTURE_SUPABASE_USER },
    })
    mockSignOut.mockResolvedValue({})
    mockEncode.mockResolvedValue('mock-jwt-token')
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.upsert).mockResolvedValue({
      id: FIXTURE_SUPABASE_USER.id,
      email: FIXTURE_SUPABASE_USER.email,
      name: 'Test User',
    } as never)
  })

  it('(a) creates Prisma user and sets cookie for new Google user', async () => {
    const request = makeRequest({ code: 'valid-code', next: '/dashboard' })
    const response = await GET(request)

    // Prisma collision check ran
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: FIXTURE_SUPABASE_USER.email },
      select: { id: true },
    })

    // Prisma upsert created the user
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FIXTURE_SUPABASE_USER.id },
        create: expect.objectContaining({
          id: FIXTURE_SUPABASE_USER.id,
          email: FIXTURE_SUPABASE_USER.email,
          name: 'Test User',
        }),
      })
    )

    // JWT was encoded with correct payload
    expect(mockEncode).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.objectContaining({
          id: FIXTURE_SUPABASE_USER.id,
          email: FIXTURE_SUPABASE_USER.email,
          sub: FIXTURE_SUPABASE_USER.id,
        }),
        secret: expect.any(String),
        maxAge: 30 * 24 * 60 * 60,
      })
    )

    // Cookie was set with the correct name from helper
    expect(mockCookieSet).toHaveBeenCalledWith(
      getNextAuthCookieName(),
      'mock-jwt-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      })
    )

    // Redirects to /dashboard
    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location')!).pathname).toBe(
      '/dashboard'
    )
  })

  it('(b) updates last_login_at for returning Google user', async () => {
    // Existing user with same ID
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: FIXTURE_SUPABASE_USER.id,
    } as never)

    const request = makeRequest({ code: 'valid-code', next: '/dashboard' })
    await GET(request)

    // Upsert should still be called (update path)
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FIXTURE_SUPABASE_USER.id },
        update: expect.objectContaining({
          last_login_at: expect.any(Date),
        }),
      })
    )

    // Should NOT have called signOut (no collision)
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('(c) rejects with email_exists_with_password on email collision', async () => {
    // Existing user with DIFFERENT ID but same email
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'different-user-id',
    } as never)

    const request = makeRequest({ code: 'valid-code', next: '/dashboard' })
    const response = await GET(request)

    // Should sign out the Supabase session
    expect(mockSignOut).toHaveBeenCalled()

    // Should NOT upsert
    expect(prisma.user.upsert).not.toHaveBeenCalled()

    // Should redirect to login with collision error
    expect(response.status).toBe(307)
    const redirectUrl = new URL(response.headers.get('location')!)
    expect(redirectUrl.pathname).toBe('/login')
    expect(redirectUrl.searchParams.get('error')).toBe(
      'email_exists_with_password'
    )
  })

  it('(d) redirects to /login?error=oauth_failed when encode throws', async () => {
    mockEncode.mockRejectedValue(new Error('JWT encode failed'))

    const request = makeRequest({ code: 'valid-code', next: '/dashboard' })
    const response = await GET(request)

    // Should redirect to login with oauth_failed error
    expect(response.status).toBe(307)
    const redirectUrl = new URL(response.headers.get('location')!)
    expect(redirectUrl.pathname).toBe('/login')
    expect(redirectUrl.searchParams.get('error')).toBe('oauth_failed')
  })

  it('(e) falls back to /dashboard for malformed next param', async () => {
    // Test various unsafe redirect attempts
    const unsafePaths = [
      '//evil.com',
      '/\\evil.com',
      'https://evil.com',
      'javascript:alert(1)',
      '',
    ]

    for (const unsafePath of unsafePaths) {
      vi.clearAllMocks()
      mockExchangeCodeForSession.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({
        data: { user: FIXTURE_SUPABASE_USER },
      })
      mockEncode.mockResolvedValue('mock-jwt-token')
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.user.upsert).mockResolvedValue({
        id: FIXTURE_SUPABASE_USER.id,
        email: FIXTURE_SUPABASE_USER.email,
        name: 'Test User',
      } as never)

      const request = makeRequest({ code: 'valid-code', next: unsafePath })
      const response = await GET(request)

      expect(
        new URL(response.headers.get('location')!).pathname,
        `Expected /dashboard for next="${unsafePath}"`
      ).toBe('/dashboard')
    }
  })

  it('preserves existing email-verification flow (no next param)', async () => {
    const request = makeRequest({ code: 'valid-code' })
    const response = await GET(request)

    // Should still create session and redirect to /dashboard
    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location')!).pathname).toBe(
      '/dashboard'
    )
    expect(prisma.user.upsert).toHaveBeenCalled()
  })

  it('redirects to /login?error=missing_code when no code param', async () => {
    const request = makeRequest({})
    const response = await GET(request)

    expect(response.status).toBe(307)
    const redirectUrl = new URL(response.headers.get('location')!)
    expect(redirectUrl.pathname).toBe('/login')
    expect(redirectUrl.searchParams.get('error')).toBe('missing_code')
  })

  it('redirects to /login?error=verification_failed on exchange error', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'Invalid code' },
    })

    const request = makeRequest({ code: 'bad-code' })
    const response = await GET(request)

    expect(response.status).toBe(307)
    const redirectUrl = new URL(response.headers.get('location')!)
    expect(redirectUrl.pathname).toBe('/login')
    expect(redirectUrl.searchParams.get('error')).toBe('verification_failed')
  })
})
