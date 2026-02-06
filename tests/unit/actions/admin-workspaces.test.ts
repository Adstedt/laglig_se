import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTx = {
  workspace: {
    update: vi.fn(),
  },
  activityLog: {
    create: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb: (_tx: typeof mockTx) => Promise<void>) =>
      cb(mockTx)
    ),
  },
}))

vi.mock('@/lib/admin/auth', () => ({
  getAdminSession: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin/auth'
import {
  updateWorkspaceTier,
  updateWorkspaceStatus,
} from '@/app/actions/admin-workspaces'

beforeEach(() => {
  vi.clearAllMocks()
})

const mockSession = { email: 'admin@test.com' }
const mockAdminUser = { id: 'admin-user-id' }
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('updateWorkspaceTier', () => {
  it('updates tier, creates ActivityLog in transaction, returns success', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockSession)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as never)
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      subscription_tier: 'TRIAL',
    } as never)
    mockTx.workspace.update.mockResolvedValue({} as never)
    mockTx.activityLog.create.mockResolvedValue({} as never)

    const result = await updateWorkspaceTier(WORKSPACE_ID, 'TEAM')

    expect(result).toEqual({ success: true })

    expect(mockTx.workspace.update).toHaveBeenCalledWith({
      where: { id: WORKSPACE_ID },
      data: { subscription_tier: 'TEAM' },
    })

    expect(mockTx.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspace_id: WORKSPACE_ID,
        user_id: 'admin-user-id',
        entity_type: 'ADMIN_ACTION',
        entity_id: WORKSPACE_ID,
        action: 'CHANGE_TIER',
        old_value: { tier: 'TRIAL' },
        new_value: { tier: 'TEAM' },
      }),
    })
  })

  it('rejects with error when no admin session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null)

    const result = await updateWorkspaceTier(WORKSPACE_ID, 'TEAM')

    expect(result).toEqual({ success: false, error: 'Ej autentiserad' })
    expect(mockTx.workspace.update).not.toHaveBeenCalled()
  })

  it('rejects with error when admin user not found in DB', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockSession)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never)

    const result = await updateWorkspaceTier(WORKSPACE_ID, 'TEAM')

    expect(result).toEqual({
      success: false,
      error: 'Admin-användare hittades inte',
    })
    expect(mockTx.workspace.update).not.toHaveBeenCalled()
  })

  it('returns error when workspace not found', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockSession)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as never)
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null as never)

    const result = await updateWorkspaceTier(WORKSPACE_ID, 'TEAM')

    expect(result).toEqual({
      success: false,
      error: 'Arbetsytan hittades inte',
    })
    expect(mockTx.workspace.update).not.toHaveBeenCalled()
  })
})

describe('updateWorkspaceStatus', () => {
  it('updates status + timestamps, creates ActivityLog in transaction', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockSession)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as never)
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      status: 'ACTIVE',
    } as never)
    mockTx.workspace.update.mockResolvedValue({} as never)
    mockTx.activityLog.create.mockResolvedValue({} as never)

    const result = await updateWorkspaceStatus(WORKSPACE_ID, 'PAUSED')

    expect(result).toEqual({ success: true })

    expect(mockTx.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'CHANGE_STATUS',
        old_value: { status: 'ACTIVE' },
        new_value: { status: 'PAUSED' },
      }),
    })
  })

  it('sets paused_at when status is PAUSED', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockSession)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as never)
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      status: 'ACTIVE',
    } as never)
    mockTx.workspace.update.mockResolvedValue({} as never)
    mockTx.activityLog.create.mockResolvedValue({} as never)

    await updateWorkspaceStatus(WORKSPACE_ID, 'PAUSED')

    const updateCall = mockTx.workspace.update.mock.calls[0]?.[0]
    expect(updateCall?.data).toMatchObject({
      status: 'PAUSED',
      paused_at: expect.any(Date),
    })
  })

  it('rejects with error when no admin session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null)

    const result = await updateWorkspaceStatus(WORKSPACE_ID, 'PAUSED')

    expect(result).toEqual({ success: false, error: 'Ej autentiserad' })
    expect(mockTx.workspace.update).not.toHaveBeenCalled()
  })

  it('rejects with error when admin user not found in DB', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockSession)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never)

    const result = await updateWorkspaceStatus(WORKSPACE_ID, 'PAUSED')

    expect(result).toEqual({
      success: false,
      error: 'Admin-användare hittades inte',
    })
    expect(mockTx.workspace.update).not.toHaveBeenCalled()
  })

  it('clears deleted_at and paused_at when transitioning to ACTIVE', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockSession)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as never)
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      status: 'DELETED',
    } as never)
    mockTx.workspace.update.mockResolvedValue({} as never)
    mockTx.activityLog.create.mockResolvedValue({} as never)

    const result = await updateWorkspaceStatus(WORKSPACE_ID, 'ACTIVE')

    expect(result).toEqual({ success: true })

    const updateCall = mockTx.workspace.update.mock.calls[0]?.[0]
    expect(updateCall?.data).toMatchObject({
      status: 'ACTIVE',
      paused_at: null,
      deleted_at: null,
    })
  })

  it('returns error when workspace already has the same status', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockSession)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdminUser as never)
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      status: 'PAUSED',
    } as never)

    const result = await updateWorkspaceStatus(WORKSPACE_ID, 'PAUSED')

    expect(result).toEqual({
      success: false,
      error: 'Arbetsytan har redan denna status',
    })
    expect(mockTx.workspace.update).not.toHaveBeenCalled()
  })
})
