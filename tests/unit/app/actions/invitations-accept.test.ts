/**
 * Story 5.3 follow-up: tests for the cache-invalidation calls added to
 * acceptInvitation. Owner-side Team list was stale after accepts because
 * revalidatePath alone doesn't clear unstable_cache tags; we now call
 * updateTag + revalidatePath('/settings') + Redis key deletes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindUniqueInvitation = vi.fn()
const mockFindUniqueUser = vi.fn()
const mockFindFirstMember = vi.fn()
const mockUpdateInvitation = vi.fn()
const mockTransaction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceInvitation: {
      findUnique: (...args: unknown[]) => mockFindUniqueInvitation(...args),
      update: (...args: unknown[]) => mockUpdateInvitation(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockFindUniqueUser(...args),
    },
    workspaceMember: {
      findFirst: (...args: unknown[]) => mockFindFirstMember(...args),
    },
    $transaction: (cb: (_tx: unknown) => unknown) => mockTransaction(cb),
  },
}))

const mockSession = vi.fn()
vi.mock('@/lib/auth/session', () => ({
  getServerSession: (...args: unknown[]) => mockSession(...args),
}))

const mockSetActiveWorkspace = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/auth/workspace-context', () => ({
  setActiveWorkspace: (...args: unknown[]) => mockSetActiveWorkspace(...args),
}))

const mockUpdateTag = vi.fn()
const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  updateTag: (...args: unknown[]) => mockUpdateTag(...args),
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

const mockInvalidateUserCache = vi.fn().mockResolvedValue(undefined)
const mockInvalidateWorkspaceCache = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/cache/workspace-cache', () => ({
  invalidateUserCache: (...args: unknown[]) => mockInvalidateUserCache(...args),
  invalidateWorkspaceCache: (...args: unknown[]) =>
    mockInvalidateWorkspaceCache(...args),
}))

const mockRedisDel = vi.fn().mockResolvedValue(0)
const mockIsRedisConfigured = vi.fn().mockReturnValue(true)
vi.mock('@/lib/cache/redis', () => ({
  redis: { del: (...args: unknown[]) => mockRedisDel(...args) },
  isRedisConfigured: () => mockIsRedisConfigured(),
}))

const { acceptInvitation } = await import('@/app/actions/invitations')

beforeEach(() => {
  vi.clearAllMocks()
  mockSession.mockResolvedValue({ user: { email: 'invitee@example.com' } })
  mockFindUniqueInvitation.mockResolvedValue({
    id: 'inv-1',
    email: 'invitee@example.com',
    workspace_id: 'ws-1',
    role: 'MEMBER',
    invited_by: 'inviter-1',
    created_at: new Date(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'PENDING',
    workspace: { id: 'ws-1', status: 'ACTIVE' },
  })
  mockFindUniqueUser.mockResolvedValue({
    id: 'user-1',
    email: 'invitee@example.com',
  })
  mockFindFirstMember.mockResolvedValue(null)
  mockTransaction.mockResolvedValue(undefined)
  mockIsRedisConfigured.mockReturnValue(true)
})

describe('acceptInvitation — cache invalidation', () => {
  it('clears unstable_cache tags for workspace-members + workspace-<id>', async () => {
    const result = await acceptInvitation('inv-1')
    expect(result.success).toBe(true)

    expect(mockUpdateTag).toHaveBeenCalledWith('workspace-members')
    expect(mockUpdateTag).toHaveBeenCalledWith('workspace-ws-1')
  })

  it('revalidates /settings explicitly (not just /)', async () => {
    await acceptInvitation('inv-1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
  })

  it('calls both invalidateUserCache and invalidateWorkspaceCache', async () => {
    await acceptInvitation('inv-1')
    expect(mockInvalidateUserCache).toHaveBeenCalledWith('user-1', ['context'])
    expect(mockInvalidateWorkspaceCache).toHaveBeenCalledWith('ws-1', [
      'members',
      'context',
    ])
  })

  it('deletes the auth:context Redis keys the new member will actually read', async () => {
    await acceptInvitation('inv-1')
    expect(mockRedisDel).toHaveBeenCalledWith(
      'auth:context:invitee@example.com:ws-1',
      'auth:context:invitee@example.com:default'
    )
  })

  it('skips Redis deletes when Redis is not configured', async () => {
    mockIsRedisConfigured.mockReturnValue(false)
    await acceptInvitation('inv-1')
    expect(mockRedisDel).not.toHaveBeenCalled()
  })
})
