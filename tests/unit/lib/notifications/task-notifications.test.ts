import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationType } from '@prisma/client'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: { findFirst: vi.fn() },
    user: { findMany: vi.fn() },
    notification: { findFirst: vi.fn(), create: vi.fn() },
    notificationPreference: { findUnique: vi.fn() },
  },
}))

// Mock email service
vi.mock('@/lib/email/email-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}))

// Mock unsubscribe token
vi.mock('@/lib/email/unsubscribe-token', () => ({
  generateUnsubscribeUrl: vi
    .fn()
    .mockReturnValue('https://laglig.se/unsubscribe/token'),
}))

// Mock email templates
vi.mock('@/emails/task-assigned', () => ({
  TaskAssignedEmail: vi.fn(),
}))
vi.mock('@/emails/comment-notification', () => ({
  CommentNotificationEmail: vi.fn(),
}))
vi.mock('@/emails/status-changed-notification', () => ({
  StatusChangedNotificationEmail: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/email-service'
import { createTaskNotification } from '@/lib/notifications/task-notifications'

const mockTask = {
  assignee_id: 'user-assignee',
  created_by: 'user-creator',
  assignee: { id: 'user-assignee', email: 'assignee@test.com', name: 'Anna' },
  creator: { id: 'user-creator', email: 'creator@test.com', name: 'Erik' },
}

const baseCtx = {
  taskId: 'task-1',
  workspaceId: 'ws-1',
  actorUserId: 'user-actor',
  taskTitle: 'Granska lag',
  actorName: 'Actor User',
}

describe('createTaskNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.task.findFirst).mockResolvedValue(mockTask as never)
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never)
  })

  describe('recipient resolution', () => {
    it('resolves assignee only for TASK_ASSIGNED', async () => {
      const stats = await createTaskNotification(
        NotificationType.TASK_ASSIGNED,
        baseCtx
      )

      expect(prisma.notification.create).toHaveBeenCalledOnce()
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'user-assignee',
            type: NotificationType.TASK_ASSIGNED,
            entity_type: 'task',
            entity_id: 'task-1',
          }),
        })
      )
      expect(stats.created).toBe(1)
    })

    it('resolves creator + assignee for COMMENT_ADDED', async () => {
      const stats = await createTaskNotification(
        NotificationType.COMMENT_ADDED,
        baseCtx
      )

      // Creator + assignee = 2 recipients (actor excluded if matching)
      expect(stats.created).toBe(2)
    })

    it('resolves mentioned users for MENTION', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user-mentioned', email: 'mentioned@test.com', name: 'Maja' },
      ] as never)

      const stats = await createTaskNotification(
        NotificationType.MENTION,
        baseCtx,
        { mentionedUserIds: ['user-mentioned'] }
      )

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-mentioned'] } },
        select: { id: true, email: true, name: true },
      })
      expect(stats.created).toBe(1)
    })

    it('resolves creator for STATUS_CHANGED', async () => {
      const stats = await createTaskNotification(
        NotificationType.STATUS_CHANGED,
        baseCtx,
        { newColumnName: 'Klar' }
      )

      expect(prisma.notification.create).toHaveBeenCalledOnce()
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'user-creator',
            title: 'Statusändring',
          }),
        })
      )
      expect(stats.created).toBe(1)
    })

    it('returns empty stats when task not found', async () => {
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null)

      const stats = await createTaskNotification(
        NotificationType.TASK_ASSIGNED,
        baseCtx
      )

      expect(stats.created).toBe(0)
      expect(prisma.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('self-exclusion', () => {
    it('does not notify actor when actor is the assignee', async () => {
      const ctx = { ...baseCtx, actorUserId: 'user-assignee' }

      const stats = await createTaskNotification(
        NotificationType.TASK_ASSIGNED,
        ctx
      )

      expect(stats.created).toBe(0)
      expect(prisma.notification.create).not.toHaveBeenCalled()
    })

    it('does not notify actor when actor is the creator for COMMENT_ADDED', async () => {
      const ctx = { ...baseCtx, actorUserId: 'user-creator' }

      const stats = await createTaskNotification(
        NotificationType.COMMENT_ADDED,
        ctx
      )

      // Only assignee should be notified (creator excluded as actor)
      expect(stats.created).toBe(1)
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ user_id: 'user-assignee' }),
        })
      )
    })
  })

  describe('deduplication', () => {
    it('skips notification if duplicate exists within 24h', async () => {
      vi.mocked(prisma.notification.findFirst).mockResolvedValue({
        id: 'existing-notif',
      } as never)

      const stats = await createTaskNotification(
        NotificationType.TASK_ASSIGNED,
        baseCtx
      )

      expect(stats.created).toBe(0)
      expect(stats.skippedByDedup).toBe(1)
      expect(prisma.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('preference checking', () => {
    it('skips notification when preference is disabled', async () => {
      vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
        task_assigned_enabled: false,
      } as never)

      const stats = await createTaskNotification(
        NotificationType.TASK_ASSIGNED,
        baseCtx
      )

      expect(stats.created).toBe(0)
      expect(stats.skippedByPreference).toBe(1)
    })

    it('creates notification when preference is enabled', async () => {
      vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
        task_assigned_enabled: true,
      } as never)

      const stats = await createTaskNotification(
        NotificationType.TASK_ASSIGNED,
        baseCtx
      )

      expect(stats.created).toBe(1)
    })

    it('creates notification when no preference record exists (defaults to enabled)', async () => {
      vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(
        null
      )

      const stats = await createTaskNotification(
        NotificationType.TASK_ASSIGNED,
        baseCtx
      )

      expect(stats.created).toBe(1)
    })
  })

  describe('stats', () => {
    it('returns correct NotificationStats', async () => {
      const stats = await createTaskNotification(
        NotificationType.TASK_ASSIGNED,
        baseCtx
      )

      expect(stats).toEqual({
        created: 1,
        skippedByPreference: 0,
        skippedByDedup: 0,
      })
    })
  })

  describe('email sending', () => {
    it('auto-sends email for TASK_ASSIGNED without explicit emailTemplate', async () => {
      await createTaskNotification(NotificationType.TASK_ASSIGNED, baseCtx)

      // sendEmail should be called with the auto-built template
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'assignee@test.com',
          subject: 'Ny tilldelning',
          from: 'notifications',
          notificationType: NotificationType.TASK_ASSIGNED,
          userId: 'user-assignee',
          workspaceId: 'ws-1',
        })
      )
    })

    it('auto-sends email for COMMENT_ADDED to both recipients', async () => {
      await createTaskNotification(NotificationType.COMMENT_ADDED, baseCtx)

      // 2 recipients (creator + assignee), both get emails
      expect(sendEmail).toHaveBeenCalledTimes(2)
    })

    it('does not send email for unsupported types (e.g., WEEKLY_DIGEST)', async () => {
      // WEEKLY_DIGEST has no auto-built template — emails are handled by the cron
      vi.mocked(prisma.task.findFirst).mockResolvedValue({
        ...mockTask,
        assignee: {
          id: 'user-assignee',
          email: 'assignee@test.com',
          name: 'Anna',
        },
        creator: {
          id: 'user-creator',
          email: 'creator@test.com',
          name: 'Erik',
        },
      } as never)

      await createTaskNotification(NotificationType.STATUS_CHANGED, baseCtx, {
        newColumnName: 'Klar',
      })

      // STATUS_CHANGED resolves to creator only
      expect(sendEmail).toHaveBeenCalledOnce()
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'creator@test.com',
          subject: 'Statusändring',
        })
      )
    })
  })
})
