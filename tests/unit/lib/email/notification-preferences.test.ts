import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationType } from '@prisma/client'

const TEST_USER_ID = '11111111-1111-4111-a111-111111111111'
const TEST_WORKSPACE_ID = '22222222-2222-4222-a222-222222222222'

const mockPreference = {
  id: '33333333-3333-4333-a333-333333333333',
  user_id: TEST_USER_ID,
  workspace_id: TEST_WORKSPACE_ID,
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
  email_enabled: true,
  push_enabled: false,
  created_at: new Date(),
  updated_at: new Date(),
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notificationPreference: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  getEmailPreference,
  shouldSendEmail,
} from '@/lib/email/notification-preferences'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getEmailPreference', () => {
  it('returns existing preference when found', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(
      mockPreference
    )

    const result = await getEmailPreference(TEST_USER_ID, TEST_WORKSPACE_ID)

    expect(result).toEqual(mockPreference)
    expect(prisma.notificationPreference.create).not.toHaveBeenCalled()
  })

  it('creates default preference when none exists', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.notificationPreference.create).mockResolvedValue(
      mockPreference
    )

    const result = await getEmailPreference(TEST_USER_ID, TEST_WORKSPACE_ID)

    expect(prisma.notificationPreference.create).toHaveBeenCalledWith({
      data: {
        user_id: TEST_USER_ID,
        workspace_id: TEST_WORKSPACE_ID,
      },
    })
    expect(result).toEqual(mockPreference)
  })
})

describe('shouldSendEmail', () => {
  it('returns false when email_enabled is false (global kill switch)', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      ...mockPreference,
      email_enabled: false,
    })

    const result = await shouldSendEmail(
      TEST_USER_ID,
      TEST_WORKSPACE_ID,
      NotificationType.TASK_ASSIGNED
    )

    expect(result).toBe(false)
  })

  it('returns false when per-type flag is false', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      ...mockPreference,
      task_assigned_enabled: false,
    })

    const result = await shouldSendEmail(
      TEST_USER_ID,
      TEST_WORKSPACE_ID,
      NotificationType.TASK_ASSIGNED
    )

    expect(result).toBe(false)
  })

  it('returns true when both global and per-type flags are true', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(
      mockPreference
    )

    const result = await shouldSendEmail(
      TEST_USER_ID,
      TEST_WORKSPACE_ID,
      NotificationType.TASK_ASSIGNED
    )

    expect(result).toBe(true)
  })

  it('returns true for all mapped notification types when enabled', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(
      mockPreference
    )

    const types = [
      NotificationType.TASK_ASSIGNED,
      NotificationType.TASK_DUE_SOON,
      NotificationType.TASK_OVERDUE,
      NotificationType.COMMENT_ADDED,
      NotificationType.MENTION,
      NotificationType.STATUS_CHANGED,
      NotificationType.WEEKLY_DIGEST,
      NotificationType.AMENDMENT_DETECTED,
      NotificationType.LAW_REPEALED,
      NotificationType.RULING_CITED,
      NotificationType.AMENDMENT_REMINDER,
    ]

    for (const type of types) {
      const result = await shouldSendEmail(
        TEST_USER_ID,
        TEST_WORKSPACE_ID,
        type
      )
      expect(result).toBe(true)
    }
  })

  it('returns false for AMENDMENT_DETECTED when amendment_detected_enabled is false', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      ...mockPreference,
      amendment_detected_enabled: false,
    })

    const result = await shouldSendEmail(
      TEST_USER_ID,
      TEST_WORKSPACE_ID,
      NotificationType.AMENDMENT_DETECTED
    )
    expect(result).toBe(false)
  })

  it('returns false for LAW_REPEALED when law_repealed_enabled is false', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      ...mockPreference,
      law_repealed_enabled: false,
    })

    const result = await shouldSendEmail(
      TEST_USER_ID,
      TEST_WORKSPACE_ID,
      NotificationType.LAW_REPEALED
    )
    expect(result).toBe(false)
  })

  it('returns false for RULING_CITED when ruling_cited_enabled is false', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      ...mockPreference,
      ruling_cited_enabled: false,
    })

    const result = await shouldSendEmail(
      TEST_USER_ID,
      TEST_WORKSPACE_ID,
      NotificationType.RULING_CITED
    )
    expect(result).toBe(false)
  })

  it('returns false for AMENDMENT_REMINDER when amendment_reminder_enabled is false', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      ...mockPreference,
      amendment_reminder_enabled: false,
    })

    const result = await shouldSendEmail(
      TEST_USER_ID,
      TEST_WORKSPACE_ID,
      NotificationType.AMENDMENT_REMINDER
    )
    expect(result).toBe(false)
  })

  it('creates default preference when none exists and returns true', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.notificationPreference.create).mockResolvedValue(
      mockPreference
    )

    const result = await shouldSendEmail(
      TEST_USER_ID,
      TEST_WORKSPACE_ID,
      NotificationType.TASK_ASSIGNED
    )

    expect(prisma.notificationPreference.create).toHaveBeenCalled()
    expect(result).toBe(true)
  })
})
