import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationType } from '@prisma/client'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: { findMany: vi.fn() },
    notification: { create: vi.fn() },
    notificationPreference: { findUnique: vi.fn() },
  },
}))

// Mock email service
vi.mock('@/lib/email/email-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  sendHtmlEmail: vi.fn().mockResolvedValue({ success: true }),
}))

// Mock notification preferences
vi.mock('@/lib/email/notification-preferences', () => ({
  shouldSendEmail: vi.fn().mockResolvedValue(true),
  NOTIFICATION_TYPE_TO_PREFERENCE: {
    WEEKLY_DIGEST: 'weekly_digest_enabled',
  },
}))

// Mock unsubscribe token
vi.mock('@/lib/email/unsubscribe-token', () => ({
  generateUnsubscribeUrl: vi
    .fn()
    .mockReturnValue('https://laglig.se/unsubscribe/token'),
}))

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/email-service'
import { GET } from '@/app/api/cron/notify-weekly-digest/route'

function makeRequest(secret?: string): Request {
  return new Request('http://localhost:3000/api/cron/notify-weekly-digest', {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

const nextMonday = new Date()
nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7))

const mockTask = {
  id: 'task-1',
  title: 'Weekly task',
  due_date: nextMonday,
  priority: 'MEDIUM',
  workspace_id: 'ws-1',
  assignee_id: 'user-1',
  assignee: { id: 'user-1', email: 'user@test.com', name: 'Test User' },
}

describe('notify-weekly-digest cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never)
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)
  })

  it('returns 401 without valid auth', async () => {
    const response = await GET(makeRequest('wrong-secret'))
    expect(response.status).toBe(401)
  })

  it('creates digest notification and sends email per user', async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([mockTask] as never)

    const response = await GET(makeRequest('test-secret'))
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.stats.notificationsCreated).toBe(1)
    expect(data.stats.emailsSent).toBe(1)

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: NotificationType.WEEKLY_DIGEST,
          user_id: 'user-1',
          title: 'Kommande veckan',
        }),
      })
    )
  })

  it('aggregates multiple tasks per user', async () => {
    const task2 = { ...mockTask, id: 'task-2', title: 'Another task' }
    vi.mocked(prisma.task.findMany).mockResolvedValue([
      mockTask,
      task2,
    ] as never)

    const response = await GET(makeRequest('test-secret'))
    const data = await response.json()

    // Only 1 notification and 1 email for the user (aggregated)
    expect(data.stats.notificationsCreated).toBe(1)
    expect(data.stats.emailsSent).toBe(1)

    // Body should mention 2 tasks
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: expect.stringContaining('2'),
        }),
      })
    )
  })

  it('respects weekly_digest_enabled preference', async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([mockTask] as never)
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      weekly_digest_enabled: false,
    } as never)

    const response = await GET(makeRequest('test-secret'))
    const data = await response.json()

    expect(data.stats.skippedByPreference).toBe(1)
    expect(data.stats.notificationsCreated).toBe(0)
  })

  it('handles no tasks gracefully', async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([] as never)

    const response = await GET(makeRequest('test-secret'))
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.stats.usersProcessed).toBe(0)
    expect(prisma.notification.create).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
