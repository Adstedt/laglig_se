/**
 * Story 5.3: Workspace invitations API unit + integration tests.
 *
 * Covers:
 *  - POST   /api/workspace/invitations      (create + send email)
 *  - GET    /api/workspace/invitations      (list members + pending)
 *  - DELETE /api/workspace/invitations/:id  (revoke)
 *  - POST   /api/workspace/invitations/:id/resend (resend)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindUniqueUser = vi.fn()
const mockFindFirstMember = vi.fn()
const mockFindFirstInvitation = vi.fn()
const mockFindManyInvitation = vi.fn()
const mockFindManyMember = vi.fn()
const mockCreateInvitation = vi.fn()
const mockUpdateInvitation = vi.fn()
const mockUpdateManyInvitation = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUniqueUser(...args),
    },
    workspaceMember: {
      findFirst: (...args: unknown[]) => mockFindFirstMember(...args),
      findMany: (...args: unknown[]) => mockFindManyMember(...args),
    },
    workspaceInvitation: {
      findFirst: (...args: unknown[]) => mockFindFirstInvitation(...args),
      findMany: (...args: unknown[]) => mockFindManyInvitation(...args),
      create: (...args: unknown[]) => mockCreateInvitation(...args),
      update: (...args: unknown[]) => mockUpdateInvitation(...args),
      updateMany: (...args: unknown[]) => mockUpdateManyInvitation(...args),
    },
  },
}))

const mockRequirePermission = vi.fn().mockResolvedValue(null)
vi.mock('@/lib/api/require-permission', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}))

const mockGetWorkspaceContext = vi.fn()
vi.mock('@/lib/auth/workspace-context', () => ({
  getWorkspaceContext: (...args: unknown[]) => mockGetWorkspaceContext(...args),
  WorkspaceAccessError: class extends Error {
    code: string
    constructor(message: string, code: string) {
      super(message)
      this.code = code
    }
  },
}))

const mockSendEmail = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/email/email-service', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}))

// Stub the email component so rendering is a no-op in Node.
vi.mock('@/emails/workspace-invitation', () => ({
  WorkspaceInvitationEmail: (props: Record<string, unknown>) => props,
}))

// Mock the rate limiter so tests don't hit real Upstash. Tests that need
// a "rate limit exceeded" scenario can override mockRatelimitLimit.
const mockRatelimitLimit = vi.fn().mockResolvedValue({
  success: true,
  limit: 50,
  remaining: 49,
  reset: Date.now() + 60 * 60 * 1000,
})
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {}
    }
    limit = mockRatelimitLimit
  },
}))

// In CI the Upstash env vars are absent, so the real isRedisConfigured()
// returns false and the route skips the rate-limit branch entirely —
// which would make the 429 test fall through to the inviter lookup and
// hit the 401 path. Force-configure Redis so the limiter is constructed.
vi.mock('@/lib/cache/redis', () => ({
  redis: {},
  isRedisConfigured: () => true,
}))

// Story 5.5a: route now calls assertSeatAvailable (which dives into
// countActiveAddonSeats → Stripe + prisma.workspace.findUniqueOrThrow).
// Stub the seat module so the route reaches the create path. SEAT_LIMIT /
// STRIPE_UNAVAILABLE branches aren't covered by these tests; if added later,
// override mockAssertSeatAvailable per-test.
const mockAssertSeatAvailable = vi.fn().mockResolvedValue({
  used: 1,
  limit: null,
  tier: 'TRIAL',
  addonSeatCount: 0,
})
// Error stubs — production classes carry currentSeats/limit/tier and cause
// fields, but these tests don't exercise the throw branches so a bare class
// is enough for the `instanceof` checks in the route.
class MockSeatLimitExceededError extends Error {}
class MockStripeUnavailableError extends Error {}
vi.mock('@/lib/usage/seats', () => ({
  assertSeatAvailable: (...args: unknown[]) => mockAssertSeatAvailable(...args),
  countActiveAddonSeats: vi.fn().mockResolvedValue(0),
  computeSeatUsage: vi.fn().mockResolvedValue({
    used: 1,
    limit: null,
    tier: 'TRIAL',
    addonSeatCount: 0,
  }),
  SeatLimitExceededError: MockSeatLimitExceededError,
  StripeUnavailableError: MockStripeUnavailableError,
}))

// Import routes after mocks.
const { POST, GET } = await import('@/app/api/workspace/invitations/route')
const { DELETE } = await import('@/app/api/workspace/invitations/[id]/route')
const { POST: RESEND } = await import(
  '@/app/api/workspace/invitations/[id]/resend/route'
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-1'
const WORKSPACE_NAME = 'Acme AB'
const USER_ID = 'user-1'

const baseContext = {
  userId: USER_ID,
  workspaceId: WORKSPACE_ID,
  workspaceName: WORKSPACE_NAME,
  workspaceSlug: 'acme',
  workspaceStatus: 'ACTIVE',
  role: 'OWNER',
  hasPermission: () => true,
}

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/workspace/invitations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequirePermission.mockResolvedValue(null)
  mockGetWorkspaceContext.mockResolvedValue(baseContext)
  mockFindUniqueUser.mockReset()
  mockFindFirstMember.mockResolvedValue(null)
  mockFindFirstInvitation.mockResolvedValue(null)
  mockSendEmail.mockResolvedValue({ success: true })
  mockRatelimitLimit.mockResolvedValue({
    success: true,
    limit: 50,
    remaining: 49,
    reset: Date.now() + 60 * 60 * 1000,
  })
})

// ===========================================================================
// POST /api/workspace/invitations
// ===========================================================================

describe('POST /api/workspace/invitations', () => {
  function setInviterUser(overrides: Record<string, unknown> = {}) {
    mockFindUniqueUser.mockImplementation(async ({ where }) => {
      if (where.id === USER_ID) {
        return { name: 'Alice Admin', email: 'alice@acme.se', ...overrides }
      }
      return null // no existing user for the invited email
    })
  }

  it('rejects invalid email', async () => {
    setInviterUser()
    const res = await POST(
      jsonRequest({ email: 'not-an-email', role: 'MEMBER' })
    )
    expect(res.status).toBe(400)
  })

  it('rejects the OWNER role on the Zod enum', async () => {
    setInviterUser()
    const res = await POST(jsonRequest({ email: 'new@acme.se', role: 'OWNER' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when the user is already a workspace member', async () => {
    mockFindUniqueUser.mockImplementation(async ({ where }) => {
      if (where.id === USER_ID) {
        return { name: 'Alice', email: 'alice@acme.se' }
      }
      if (where.email === 'existing@acme.se') {
        return { id: 'user-2', email: 'existing@acme.se' }
      }
      return null
    })
    mockFindFirstMember.mockResolvedValue({ id: 'wm-1' })

    const res = await POST(
      jsonRequest({ email: 'existing@acme.se', role: 'MEMBER' })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('medlem')
    expect(mockCreateInvitation).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('returns 400 when a pending invitation already exists', async () => {
    setInviterUser()
    mockFindFirstInvitation.mockResolvedValue({ id: 'inv-1' })

    const res = await POST(
      jsonRequest({ email: 'new@acme.se', role: 'MEMBER' })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error.toLowerCase()).toContain('inbjudan')
    expect(mockCreateInvitation).not.toHaveBeenCalled()
  })

  it('creates an invitation with 7-day expiry and lowercased email', async () => {
    setInviterUser()
    mockCreateInvitation.mockImplementation(async ({ data }) => ({
      id: 'inv-new',
      ...data,
    }))

    const before = Date.now()
    const res = await POST(jsonRequest({ email: 'NEW@Acme.SE', role: 'ADMIN' }))
    const after = Date.now()

    expect(res.status).toBe(200)
    expect(mockCreateInvitation).toHaveBeenCalledTimes(1)

    const createArgs = mockCreateInvitation.mock.calls[0][0].data
    expect(createArgs.email).toBe('new@acme.se')
    expect(createArgs.role).toBe('ADMIN')
    expect(createArgs.workspace_id).toBe(WORKSPACE_ID)
    expect(createArgs.invited_by).toBe(USER_ID)
    expect(typeof createArgs.token).toBe('string')
    expect(createArgs.token.length).toBeGreaterThanOrEqual(32)

    const expiry = createArgs.expires_at.getTime()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    expect(expiry).toBeGreaterThanOrEqual(before + sevenDays - 1000)
    expect(expiry).toBeLessThanOrEqual(after + sevenDays + 1000)
  })

  it('sends the invitation email with the accept URL containing the token', async () => {
    setInviterUser()
    let capturedToken = ''
    mockCreateInvitation.mockImplementation(async ({ data }) => {
      capturedToken = data.token
      return { id: 'inv-new', ...data }
    })
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.test'

    await POST(jsonRequest({ email: 'new@acme.se', role: 'MEMBER' }))

    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    const emailArgs = mockSendEmail.mock.calls[0][0]
    expect(emailArgs.to).toBe('new@acme.se')
    expect(emailArgs.from).toBe('no-reply')
    expect(emailArgs.subject).toContain(WORKSPACE_NAME)
    expect(emailArgs.react.acceptUrl).toBe(
      `https://example.test/invite/${capturedToken}`
    )
    expect(emailArgs.react.roleLabel).toBe('Medlem')
  })

  it('falls back to inviter email when User.name is null', async () => {
    setInviterUser({ name: null })
    mockCreateInvitation.mockImplementation(async ({ data }) => ({
      id: 'inv-new',
      ...data,
    }))

    await POST(jsonRequest({ email: 'new@acme.se', role: 'MEMBER' }))

    const emailArgs = mockSendEmail.mock.calls[0][0]
    expect(emailArgs.react.inviterName).toBe('alice@acme.se')
  })

  it('returns the permission denial response when requirePermission denies', async () => {
    mockRequirePermission.mockResolvedValue(
      new Response(JSON.stringify({ error: 'denied' }), { status: 403 })
    )
    const res = await POST(jsonRequest({ email: 'x@y.se', role: 'MEMBER' }))
    expect(res.status).toBe(403)
    expect(mockCreateInvitation).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid JSON body', async () => {
    const req = new Request('http://localhost/api/workspace/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 429 with Retry-After when the per-workspace rate limit is exceeded', async () => {
    mockRatelimitLimit.mockResolvedValueOnce({
      success: false,
      limit: 50,
      remaining: 0,
      reset: Date.now() + 30 * 60 * 1000, // 30 min out
    })

    const res = await POST(
      jsonRequest({ email: 'victim@acme.se', role: 'MEMBER' })
    )
    expect(res.status).toBe(429)
    const retryAfter = res.headers.get('Retry-After')
    expect(retryAfter).not.toBeNull()
    expect(Number(retryAfter)).toBeGreaterThan(0)
    expect(mockCreateInvitation).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// GET /api/workspace/invitations
// ===========================================================================

describe('GET /api/workspace/invitations', () => {
  it('returns members and pending invitations scoped to the workspace', async () => {
    mockFindManyMember.mockResolvedValue([
      { id: 'wm-1', user: { id: USER_ID, email: 'alice@acme.se' } },
    ])
    mockFindManyInvitation.mockResolvedValue([
      { id: 'inv-1', email: 'a@b.se', status: 'PENDING' },
    ])

    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.members).toHaveLength(1)
    expect(body.invitations).toHaveLength(1)

    expect(mockFindManyInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspace_id: WORKSPACE_ID, status: 'PENDING' },
      })
    )
  })

  it('returns the permission denial response when requirePermission denies', async () => {
    mockRequirePermission.mockResolvedValue(
      new Response(JSON.stringify({ error: 'denied' }), { status: 403 })
    )
    const res = await GET()
    expect(res.status).toBe(403)
  })
})

// ===========================================================================
// DELETE /api/workspace/invitations/:id (revoke)
// ===========================================================================

describe('DELETE /api/workspace/invitations/:id', () => {
  it('revokes a pending invitation scoped to the workspace', async () => {
    mockUpdateManyInvitation.mockResolvedValue({ count: 1 })

    const res = await DELETE(
      new Request('http://localhost/api/workspace/invitations/inv-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'inv-1' }) }
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    expect(mockUpdateManyInvitation).toHaveBeenCalledWith({
      where: {
        id: 'inv-1',
        workspace_id: WORKSPACE_ID,
        status: 'PENDING',
      },
      data: { status: 'REVOKED' },
    })
  })

  it('returns 404 when no pending invitation matches', async () => {
    mockUpdateManyInvitation.mockResolvedValue({ count: 0 })

    const res = await DELETE(
      new Request('http://localhost/api/workspace/invitations/missing', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'missing' }) }
    )
    expect(res.status).toBe(404)
  })
})

// ===========================================================================
// POST /api/workspace/invitations/:id/resend
// ===========================================================================

describe('POST /api/workspace/invitations/:id/resend', () => {
  it('returns 404 if invitation is not pending or not found', async () => {
    mockFindFirstInvitation.mockResolvedValue(null)

    const res = await RESEND(
      new Request('http://localhost/resend', { method: 'POST' }),
      { params: Promise.resolve({ id: 'inv-missing' }) }
    )
    expect(res.status).toBe(404)
    expect(mockUpdateInvitation).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('updates expires_at and re-sends email on a pending invitation', async () => {
    const originalExpires = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // 1 day left
    mockFindFirstInvitation.mockResolvedValue({
      id: 'inv-1',
      email: 'pending@acme.se',
      role: 'MEMBER',
      token: 'existing-token',
      expires_at: originalExpires,
    })
    mockFindUniqueUser.mockResolvedValue({
      name: 'Alice',
      email: 'alice@acme.se',
    })
    mockUpdateInvitation.mockImplementation(async ({ data }) => ({
      id: 'inv-1',
      expires_at: data.expires_at,
    }))
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.test'

    const before = Date.now()
    const res = await RESEND(
      new Request('http://localhost/resend', { method: 'POST' }),
      { params: Promise.resolve({ id: 'inv-1' }) }
    )
    const after = Date.now()

    expect(res.status).toBe(200)

    const updateArgs = mockUpdateInvitation.mock.calls[0][0].data
    const newExpiry = updateArgs.expires_at.getTime()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    expect(newExpiry).toBeGreaterThan(originalExpires.getTime())
    expect(newExpiry).toBeGreaterThanOrEqual(before + sevenDays - 1000)
    expect(newExpiry).toBeLessThanOrEqual(after + sevenDays + 1000)

    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    const emailArgs = mockSendEmail.mock.calls[0][0]
    expect(emailArgs.to).toBe('pending@acme.se')
    expect(emailArgs.subject).toContain('Påminnelse')
    expect(emailArgs.react.acceptUrl).toBe(
      'https://example.test/invite/existing-token'
    )
  })
})
