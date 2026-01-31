/**
 * Story 10.3: Tests for invitation server actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before imports
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceInvitation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    workspaceMember: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  setActiveWorkspace: vi.fn(),
}))

vi.mock('@/lib/cache/workspace-cache', () => ({
  invalidateUserCache: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  getPendingInvitations,
  acceptInvitation,
  declineInvitation,
  generateInvitationToken,
} from '@/app/actions/invitations'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth/session'
import { setActiveWorkspace } from '@/lib/auth/workspace-context'
import { invalidateUserCache } from '@/lib/cache/workspace-cache'

// ============================================================================
// Test Data
// ============================================================================

const mockSession = {
  user: {
    email: 'invitee@example.com',
    name: 'Invitee User',
  },
}

const mockUser = {
  id: 'user_invitee',
  email: 'invitee@example.com',
  name: 'Invitee User',
}

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago

const mockInvitation = {
  id: 'inv_1',
  workspace_id: 'ws_1',
  email: 'invitee@example.com',
  role: 'MEMBER' as const,
  token: 'test-token-abc',
  invited_by: 'user_inviter',
  status: 'PENDING' as const,
  expires_at: futureDate,
  created_at: new Date(),
  updated_at: new Date(),
  workspace: { id: 'ws_1', name: 'Test Workspace', status: 'ACTIVE' as const },
  inviter: {
    id: 'user_inviter',
    name: 'Inviter Name',
    email: 'inviter@example.com',
  },
}

const mockInvitation2 = {
  ...mockInvitation,
  id: 'inv_2',
  workspace_id: 'ws_2',
  workspace: { id: 'ws_2', name: 'Other Workspace', status: 'ACTIVE' as const },
}

// ============================================================================
// getPendingInvitations
// ============================================================================

describe('getPendingInvitations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(mockSession as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
    vi.mocked(prisma.workspaceInvitation.updateMany).mockResolvedValue({
      count: 0,
    } as never)
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValue([])
  })

  it('returns only PENDING, non-expired invitations for the given email', async () => {
    vi.mocked(prisma.workspaceInvitation.findMany).mockResolvedValue([
      mockInvitation,
    ] as never)

    const result = await getPendingInvitations('invitee@example.com')

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('inv_1')
    expect(prisma.workspaceInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: 'invitee@example.com',
          status: 'PENDING',
          expires_at: { gt: expect.any(Date) },
          workspace: { status: 'ACTIVE' },
        },
      })
    )
  })

  it('bulk-marks expired invitations as EXPIRED', async () => {
    vi.mocked(prisma.workspaceInvitation.findMany).mockResolvedValue([])

    await getPendingInvitations('invitee@example.com')

    expect(prisma.workspaceInvitation.updateMany).toHaveBeenCalledWith({
      where: {
        email: 'invitee@example.com',
        status: 'PENDING',
        expires_at: { lt: expect.any(Date) },
      },
      data: { status: 'EXPIRED' },
    })
  })

  it('deduplicates by workspace_id, keeping latest only', async () => {
    const olderInvitation = {
      ...mockInvitation,
      id: 'inv_old',
      created_at: new Date(Date.now() - 48 * 60 * 60 * 1000),
    }
    // Both have same workspace_id 'ws_1', ordered by created_at desc
    vi.mocked(prisma.workspaceInvitation.findMany).mockResolvedValue([
      mockInvitation,
      olderInvitation,
    ] as never)

    const result = await getPendingInvitations('invitee@example.com')

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('inv_1') // Most recent
  })

  it('auto-accepts invitations where user is already a member', async () => {
    vi.mocked(prisma.workspaceInvitation.findMany).mockResolvedValue([
      mockInvitation,
      mockInvitation2,
    ] as never)
    // User is already a member of ws_1
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValue([
      { workspace_id: 'ws_1' },
    ] as never)

    const result = await getPendingInvitations('invitee@example.com')

    // Should auto-accept ws_1 invitation
    expect(prisma.workspaceInvitation.updateMany).toHaveBeenCalledWith({
      where: {
        email: 'invitee@example.com',
        status: 'PENDING',
        workspace_id: { in: ['ws_1'] },
      },
      data: { status: 'ACCEPTED' },
    })

    // Only ws_2 should be returned
    expect(result).toHaveLength(1)
    expect(result[0]?.workspace_id).toBe('ws_2')
  })

  it('returns empty array if session email does not match', async () => {
    const result = await getPendingInvitations('other@example.com')

    expect(result).toEqual([])
    expect(prisma.workspaceInvitation.findMany).not.toHaveBeenCalled()
  })

  it('returns empty array if not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const result = await getPendingInvitations('invitee@example.com')

    expect(result).toEqual([])
  })

  it('returns empty array on database error instead of crashing', async () => {
    vi.mocked(prisma.workspaceInvitation.updateMany).mockRejectedValue(
      new Error('Database connection lost')
    )

    const result = await getPendingInvitations('invitee@example.com')

    expect(result).toEqual([])
  })

  it('filters out invitations to non-ACTIVE workspaces via query', async () => {
    vi.mocked(prisma.workspaceInvitation.findMany).mockResolvedValue([])

    await getPendingInvitations('invitee@example.com')

    expect(prisma.workspaceInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspace: { status: 'ACTIVE' },
        }),
      })
    )
  })
})

// ============================================================================
// acceptInvitation
// ============================================================================

describe('acceptInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(mockSession as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
    vi.mocked(prisma.workspaceInvitation.findUnique).mockResolvedValue({
      ...mockInvitation,
      workspace: { id: 'ws_1', status: 'ACTIVE' },
    } as never)
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        workspaceMember: {
          create: vi.fn().mockResolvedValue({ id: 'member_1' }),
        },
        workspaceInvitation: { update: vi.fn().mockResolvedValue({}) },
      }
      return callback(tx as never)
    })
  })

  it('creates WorkspaceMember with correct role, invited_by, invited_at', async () => {
    let capturedMemberData: Record<string, unknown> | null = null

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        workspaceMember: {
          create: vi.fn().mockImplementation((args) => {
            capturedMemberData = args.data
            return Promise.resolve({ id: 'member_1' })
          }),
        },
        workspaceInvitation: { update: vi.fn().mockResolvedValue({}) },
      }
      return callback(tx as never)
    })

    const result = await acceptInvitation('inv_1')

    expect(result.success).toBe(true)
    expect(result.workspaceId).toBe('ws_1')
    expect(capturedMemberData).toMatchObject({
      user_id: 'user_invitee',
      workspace_id: 'ws_1',
      role: 'MEMBER',
      invited_by: 'user_inviter',
    })
  })

  it('sets invitation status to ACCEPTED', async () => {
    let capturedUpdateData: Record<string, unknown> | null = null

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        workspaceMember: {
          create: vi.fn().mockResolvedValue({ id: 'member_1' }),
        },
        workspaceInvitation: {
          update: vi.fn().mockImplementation((args) => {
            capturedUpdateData = args.data
            return Promise.resolve({})
          }),
        },
      }
      return callback(tx as never)
    })

    await acceptInvitation('inv_1')

    expect(capturedUpdateData).toMatchObject({ status: 'ACCEPTED' })
  })

  it('sets active workspace cookie and invalidates cache', async () => {
    await acceptInvitation('inv_1')

    expect(setActiveWorkspace).toHaveBeenCalledWith('ws_1')
    expect(invalidateUserCache).toHaveBeenCalledWith('user_invitee', [
      'context',
    ])
  })

  it('rejects if invitation is expired', async () => {
    vi.mocked(prisma.workspaceInvitation.findUnique).mockResolvedValue({
      ...mockInvitation,
      expires_at: pastDate,
      workspace: { id: 'ws_1', status: 'ACTIVE' },
    } as never)

    const result = await acceptInvitation('inv_1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Inbjudan har gått ut')
  })

  it('rejects if invitation is already accepted', async () => {
    vi.mocked(prisma.workspaceInvitation.findUnique).mockResolvedValue({
      ...mockInvitation,
      status: 'ACCEPTED',
      workspace: { id: 'ws_1', status: 'ACTIVE' },
    } as never)

    const result = await acceptInvitation('inv_1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Inbjudan är inte längre giltig')
  })

  it('rejects if email does not match session', async () => {
    vi.mocked(prisma.workspaceInvitation.findUnique).mockResolvedValue({
      ...mockInvitation,
      email: 'different@example.com',
      workspace: { id: 'ws_1', status: 'ACTIVE' },
    } as never)

    const result = await acceptInvitation('inv_1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Inbjudan tillhör en annan användare')
  })

  it('rejects if user is already a member of the workspace', async () => {
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      id: 'existing_member',
    } as never)

    const result = await acceptInvitation('inv_1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Du är redan medlem i denna workspace')
  })

  it('rejects if not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const result = await acceptInvitation('inv_1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Du måste vara inloggad')
  })

  it('rejects if invitation not found', async () => {
    vi.mocked(prisma.workspaceInvitation.findUnique).mockResolvedValue(null)

    const result = await acceptInvitation('inv_nonexistent')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Inbjudan hittades inte')
  })
})

// ============================================================================
// declineInvitation
// ============================================================================

describe('declineInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(mockSession as never)
    vi.mocked(prisma.workspaceInvitation.findUnique).mockResolvedValue(
      mockInvitation as never
    )
    vi.mocked(prisma.workspaceInvitation.update).mockResolvedValue({} as never)
  })

  it('sets invitation status to REVOKED', async () => {
    const result = await declineInvitation('inv_1')

    expect(result.success).toBe(true)
    expect(prisma.workspaceInvitation.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { status: 'REVOKED' },
    })
  })

  it('rejects if invitation is not PENDING', async () => {
    vi.mocked(prisma.workspaceInvitation.findUnique).mockResolvedValue({
      ...mockInvitation,
      status: 'ACCEPTED',
    } as never)

    const result = await declineInvitation('inv_1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Inbjudan är inte längre giltig')
  })

  it('rejects if email does not match session', async () => {
    vi.mocked(prisma.workspaceInvitation.findUnique).mockResolvedValue({
      ...mockInvitation,
      email: 'other@example.com',
    } as never)

    const result = await declineInvitation('inv_1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Inbjudan tillhör en annan användare')
  })

  it('rejects if not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const result = await declineInvitation('inv_1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Du måste vara inloggad')
  })
})

// ============================================================================
// generateInvitationToken
// ============================================================================

describe('generateInvitationToken', () => {
  it('generates a base64url-encoded token', () => {
    const token = generateInvitationToken()

    // base64url uses A-Z, a-z, 0-9, -, _
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('generates tokens of sufficient length (32 bytes = ~43 chars base64url)', () => {
    const token = generateInvitationToken()

    // 32 bytes base64url encoded = 43 characters
    expect(token.length).toBe(43)
  })

  it('generates unique tokens', () => {
    const token1 = generateInvitationToken()
    const token2 = generateInvitationToken()

    expect(token1).not.toBe(token2)
  })
})
