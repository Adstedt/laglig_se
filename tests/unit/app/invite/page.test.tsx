/**
 * Story 5.3 follow-up (QA gate TEST-001): coverage for the /invite/[token]
 * page state machine. The page is an async Server Component; we invoke it
 * directly and render the returned JSX with RTL so we can assert on the
 * right branch without spinning up a full Next runtime.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindUniqueInvitation = vi.fn()
const mockFindUniqueUser = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceInvitation: {
      findUnique: (...args: unknown[]) => mockFindUniqueInvitation(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockFindUniqueUser(...args),
    },
  },
}))

const mockSession = vi.fn()
vi.mock('@/lib/auth/session', () => ({
  getServerSession: (...args: unknown[]) => mockSession(...args),
}))

const mockNotFound = vi.fn(() => {
  // Mirror next/navigation's behavior: throw so control flow stops.
  throw new Error('NEXT_NOT_FOUND')
})
vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}))

// InviteActionsClient and LogoutAndRetryButton are client components that
// would pull in next-auth etc. Stub them so the server-component render
// stays light and we can assert on their presence by data attribute.
vi.mock('@/app/invite/[token]/invite-actions-client', () => ({
  InviteActionsClient: ({ invitationId }: { invitationId: string }) => (
    <div data-testid="invite-actions" data-invitation-id={invitationId} />
  ),
}))
vi.mock('@/app/invite/[token]/logout-button', () => ({
  LogoutAndRetryButton: ({ returnTo }: { returnTo: string }) => (
    <button data-testid="logout-button" data-return-to={returnTo}>
      Logga ut
    </button>
  ),
}))

const { default: InvitePage } = await import('@/app/invite/[token]/page')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOKEN = 'tok-123'
const baseInvitation = {
  id: 'inv-1',
  email: 'invitee@example.com',
  role: 'MEMBER',
  status: 'PENDING' as const,
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day out
  workspace: {
    id: 'ws-1',
    name: 'Acme AB',
    slug: 'acme',
    status: 'ACTIVE' as const,
  },
  inviter: { name: 'Alice Admin', email: 'alice@acme.se' },
}

async function renderPage() {
  const element = await InvitePage({
    params: Promise.resolve({ token: TOKEN }),
  })
  return render(element)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvitePage state machine', () => {
  it('calls notFound for an unknown token', async () => {
    mockFindUniqueInvitation.mockResolvedValue(null)
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalledTimes(1)
  })

  it('shows the accepted state for a non-PENDING ACCEPTED invitation', async () => {
    mockFindUniqueInvitation.mockResolvedValue({
      ...baseInvitation,
      status: 'ACCEPTED',
    })
    mockSession.mockResolvedValue({ user: { email: 'invitee@example.com' } })

    const { getByText } = await renderPage()
    expect(getByText(/redan accepterad/i)).toBeInTheDocument()
  })

  it('shows the expired state when expires_at is past', async () => {
    mockFindUniqueInvitation.mockResolvedValue({
      ...baseInvitation,
      expires_at: new Date(Date.now() - 60 * 1000), // 1 min ago
    })
    mockSession.mockResolvedValue(null)

    const { getByText } = await renderPage()
    expect(getByText(/gått ut/i)).toBeInTheDocument()
  })

  it('shows a warning when the workspace is no longer ACTIVE', async () => {
    mockFindUniqueInvitation.mockResolvedValue({
      ...baseInvitation,
      workspace: { ...baseInvitation.workspace, status: 'DELETED' as const },
    })
    mockSession.mockResolvedValue(null)

    const { getByText } = await renderPage()
    expect(getByText(/inte tillgänglig/i)).toBeInTheDocument()
  })

  it('routes a new invitee (no existing User) to Skapa konto', async () => {
    mockFindUniqueInvitation.mockResolvedValue(baseInvitation)
    mockSession.mockResolvedValue(null) // not logged in
    mockFindUniqueUser.mockResolvedValue(null) // no account yet

    const { getByRole, getByText } = await renderPage()
    const cta = getByRole('link', { name: /skapa konto/i })
    expect(cta.getAttribute('href')).toContain('/signup')
    expect(cta.getAttribute('href')).toContain(
      `email=${encodeURIComponent(baseInvitation.email)}`
    )
    expect(cta.getAttribute('href')).toContain(`invite=${TOKEN}`)
    expect(getByText(/har inget konto/i)).toBeInTheDocument()
  })

  it('routes an existing invitee to Logga in with callbackUrl prefilled', async () => {
    mockFindUniqueInvitation.mockResolvedValue(baseInvitation)
    mockSession.mockResolvedValue(null)
    mockFindUniqueUser.mockResolvedValue({ id: 'user-1' })

    const { getByRole } = await renderPage()
    const cta = getByRole('link', { name: /logga in/i })
    const href = cta.getAttribute('href') ?? ''
    expect(href).toContain('/login')
    expect(href).toContain(`email=${encodeURIComponent(baseInvitation.email)}`)
    expect(href).toContain(
      `callbackUrl=${encodeURIComponent(`/invite/${TOKEN}`)}`
    )
  })

  it('shows the email-mismatch state with a logout button when session is a different user', async () => {
    mockFindUniqueInvitation.mockResolvedValue(baseInvitation)
    mockSession.mockResolvedValue({
      user: { email: 'someone-else@example.com' },
    })

    const { getByText, getByTestId } = await renderPage()
    expect(getByText(/tillhör en annan användare/i)).toBeInTheDocument()
    const logoutBtn = getByTestId('logout-button')
    expect(logoutBtn.getAttribute('data-return-to')).toBe(`/invite/${TOKEN}`)
  })

  it('renders the Accept/Decline UI on the happy path', async () => {
    mockFindUniqueInvitation.mockResolvedValue(baseInvitation)
    mockSession.mockResolvedValue({ user: { email: baseInvitation.email } })

    const { getByTestId, getByText } = await renderPage()
    expect(
      getByText(/Du har blivit inbjuden till Acme AB/i)
    ).toBeInTheDocument()
    const actions = getByTestId('invite-actions')
    expect(actions.getAttribute('data-invitation-id')).toBe(baseInvitation.id)
  })
})
