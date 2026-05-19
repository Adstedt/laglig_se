/**
 * Story 5.3 follow-up: tests for the emailRedirectTo wiring added to
 * signupAction. When signup is invite-bound, Supabase should send the
 * verification email to /auth/verify?next=/invite/<token> so the user
 * lands back at the accept page after login.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSignUp = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { signUp: (...args: unknown[]) => mockSignUp(...args) },
  }),
}))

vi.mock('@/lib/utils/app-url', () => ({
  getAppUrl: () => 'https://test.example.com',
}))

const { signupAction } = await import('@/app/actions/auth')

const validInput = {
  email: 'newuser@example.com',
  password: 'Str0ng-Password-1!',
  confirmPassword: 'Str0ng-Password-1!',
  name: 'New User',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSignUp.mockResolvedValue({
    data: { user: { id: 'user-id', email: validInput.email } },
    error: null,
  })
})

describe('signupAction — invite-bound emailRedirectTo', () => {
  it('sets emailRedirectTo to /auth/verify when no invite token is provided', async () => {
    // Always pass emailRedirectTo so Supabase doesn't fall back to its
    // dashboard Site URL (production), which breaks verification on
    // previews/staging/localhost.
    const result = await signupAction(validInput)
    expect(result.success).toBe(true)

    const args = mockSignUp.mock.calls[0][0]
    expect(args.options).toBeDefined()
    expect(args.options.emailRedirectTo).toBe(
      'https://test.example.com/auth/verify'
    )
  })

  it('sets emailRedirectTo with the next-param when inviteToken is provided', async () => {
    const token = 'abc-123_token'
    const result = await signupAction(validInput, { inviteToken: token })
    expect(result.success).toBe(true)

    const args = mockSignUp.mock.calls[0][0]
    expect(args.options.emailRedirectTo).toBe(
      `https://test.example.com/auth/verify?next=${encodeURIComponent(`/invite/${token}`)}`
    )
  })

  it('URL-encodes the invite path so tokens with special chars survive', async () => {
    // Reserved URL characters (%) and slashes must be encoded in the next param
    // to avoid breaking the outer URL when Supabase appends its own query args.
    const token = 'tok en/with+special'
    await signupAction(validInput, { inviteToken: token })
    const args = mockSignUp.mock.calls[0][0]
    expect(args.options.emailRedirectTo).toContain(
      encodeURIComponent(`/invite/${token}`)
    )
  })
})
