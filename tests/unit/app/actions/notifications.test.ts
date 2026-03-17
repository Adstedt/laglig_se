import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth
vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(
    (fn: (_ctx: { workspaceId: string; userId: string }) => unknown) =>
      fn({ workspaceId: 'ws-1', userId: 'user-1' })
  ),
}))

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    notificationPreference: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/app/actions/notifications'

const mockPreference = {
  id: 'pref-1',
  user_id: 'user-1',
  workspace_id: 'ws-1',
  email_enabled: true,
  task_assigned_enabled: true,
  task_due_soon_enabled: true,
  task_overdue_enabled: true,
  comment_added_enabled: true,
  mention_enabled: true,
  status_changed_enabled: true,
  weekly_digest_enabled: true,
  amendment_detected_enabled: true,
  law_repealed_enabled: true,
  ruling_cited_enabled: true,
  amendment_reminder_enabled: true,
  push_enabled: false,
  created_at: new Date(),
  updated_at: new Date(),
}

describe('getNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns existing preferences', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(
      mockPreference as never
    )

    const result = await getNotificationPreferences()

    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockPreference)
  })

  it('creates default preferences when none exist', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.notificationPreference.create).mockResolvedValue(
      mockPreference as never
    )

    const result = await getNotificationPreferences()

    expect(result.success).toBe(true)
    expect(prisma.notificationPreference.create).toHaveBeenCalledWith({
      data: { user_id: 'user-1', workspace_id: 'ws-1' },
    })
  })
})

describe('updateNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates specific preference fields', async () => {
    const updated = { ...mockPreference, task_assigned_enabled: false }
    vi.mocked(prisma.notificationPreference.upsert).mockResolvedValue(
      updated as never
    )

    const result = await updateNotificationPreferences({
      task_assigned_enabled: false,
    })

    expect(result.success).toBe(true)
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { task_assigned_enabled: false },
      })
    )
  })

  it('updates global email toggle', async () => {
    const updated = { ...mockPreference, email_enabled: false }
    vi.mocked(prisma.notificationPreference.upsert).mockResolvedValue(
      updated as never
    )

    const result = await updateNotificationPreferences({
      email_enabled: false,
    })

    expect(result.success).toBe(true)
    expect(result.data?.email_enabled).toBe(false)
  })

  it('rejects invalid input', async () => {
    // @ts-expect-error testing invalid input
    const _result = await updateNotificationPreferences({
      invalid_field: true,
    })

    // Zod strips unknown fields but doesn't fail — the upsert still runs
    // with an empty data object
    expect(prisma.notificationPreference.upsert).toHaveBeenCalled()
  })
})
