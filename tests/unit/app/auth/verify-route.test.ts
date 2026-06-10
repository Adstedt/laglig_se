/**
 * Production bug fix: corporate mail scanners (Outlook Safe Links etc.)
 * prefetch the verification link and consume the one-time token_hash before
 * the user clicks. The user's click then fails verifyOtp even though the
 * account got verified by the prefetch. The route must detect the
 * already-confirmed account and show success instead of a bogus failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerifyOtp = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args) },
  }),
}))

const mockQueryRaw = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}))

const { GET } = await import('@/app/auth/verify/route')

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('https://app.example.com/auth/verify')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockVerifyOtp.mockResolvedValue({ error: null })
  mockQueryRaw.mockResolvedValue([])
})

describe('GET /auth/verify', () => {
  it('redirects to login with success message and prefilled email on valid token', async () => {
    const response = await GET(
      makeRequest({
        token_hash: 'valid-token',
        type: 'signup',
        email: 'user@example.com',
      })
    )

    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('message')).toBe(
      'E-post verifierad! Logga in med ditt konto.'
    )
    expect(location.searchParams.get('email')).toBe('user@example.com')
    expect(location.searchParams.get('error')).toBeNull()
  })

  it('treats a consumed token as success when the account is already confirmed', async () => {
    // Scanner prefetch consumed the token: verifyOtp fails, but auth.users
    // shows the email as confirmed.
    mockVerifyOtp.mockResolvedValue({
      error: { message: 'Email link is invalid or has expired' },
    })
    mockQueryRaw.mockResolvedValue([{ email_confirmed_at: new Date() }])

    const response = await GET(
      makeRequest({
        token_hash: 'already-used-token',
        type: 'signup',
        email: 'User@Example.com',
      })
    )

    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('message')).toBe(
      'E-post verifierad! Logga in med ditt konto.'
    )
    expect(location.searchParams.get('email')).toBe('User@Example.com')
    expect(location.searchParams.get('error')).toBeNull()
  })

  it('shows verification_failed when the token is invalid and the account is unconfirmed', async () => {
    mockVerifyOtp.mockResolvedValue({
      error: { message: 'Email link is invalid or has expired' },
    })
    mockQueryRaw.mockResolvedValue([{ email_confirmed_at: null }])

    const response = await GET(
      makeRequest({
        token_hash: 'bad-token',
        type: 'signup',
        email: 'user@example.com',
      })
    )

    const location = new URL(response.headers.get('location')!)
    expect(location.searchParams.get('error')).toBe('verification_failed')
  })

  it('shows verification_failed when the token is invalid and no email param exists', async () => {
    mockVerifyOtp.mockResolvedValue({
      error: { message: 'Email link is invalid or has expired' },
    })

    const response = await GET(
      makeRequest({ token_hash: 'bad-token', type: 'signup' })
    )

    const location = new URL(response.headers.get('location')!)
    expect(location.searchParams.get('error')).toBe('verification_failed')
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('falls back to verification_failed when the confirmation lookup itself errors', async () => {
    mockVerifyOtp.mockResolvedValue({
      error: { message: 'Email link is invalid or has expired' },
    })
    mockQueryRaw.mockRejectedValue(new Error('db down'))

    const response = await GET(
      makeRequest({
        token_hash: 'bad-token',
        type: 'signup',
        email: 'user@example.com',
      })
    )

    const location = new URL(response.headers.get('location')!)
    expect(location.searchParams.get('error')).toBe('verification_failed')
  })

  it('redirects with missing_code when token_hash is absent', async () => {
    const response = await GET(makeRequest({ type: 'signup' }))

    const location = new URL(response.headers.get('location')!)
    expect(location.searchParams.get('error')).toBe('missing_code')
    expect(mockVerifyOtp).not.toHaveBeenCalled()
  })

  it('carries the next param through as callbackUrl on success', async () => {
    const response = await GET(
      makeRequest({
        token_hash: 'valid-token',
        type: 'signup',
        email: 'user@example.com',
        next: '/invite/abc-123',
      })
    )

    const location = new URL(response.headers.get('location')!)
    expect(location.searchParams.get('callbackUrl')).toBe('/invite/abc-123')
  })
})
