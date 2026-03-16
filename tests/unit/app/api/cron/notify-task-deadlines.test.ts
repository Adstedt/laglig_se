import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationType } from '@prisma/client'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: { findMany: vi.fn() },
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
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
    TASK_DUE_SOON: 'task_due_soon_enabled',
    TASK_OVERDUE: 'task_overdue_enabled',
  },
}))

// Mock unsubscribe token
vi.mock('@/lib/email/unsubscribe-token', () => ({
  generateUnsubscribeUrl: vi
    .fn()
    .mockReturnValue('https://laglig.se/unsubscribe/token'),
}))

import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/cron/notify-task-deadlines/route'

function makeRequest(secret?: string): Request {
  return new Request('http://localhost:3000/api/cron/notify-task-deadlines', {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

const now = new Date()
const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

const mockDueSoonTask = {
  id: 'task-due-soon',
  title: 'Upcoming task',
  due_date: twoDaysFromNow,
  workspace_id: 'ws-1',
  assignee_id: 'user-1',
  assignee: { id: 'user-1', email: 'user@test.com', name: 'Test User' },
}

const mockOverdueTask = {
  id: 'task-overdue',
  title: 'Late task',
  due_date: twoDaysAgo,
  workspace_id: 'ws-1',
  assignee_id: 'user-1',
  assignee: { id: 'user-1', email: 'user@test.com', name: 'Test User' },
}

describe('notify-task-deadlines cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never)
    vi.mocked(prisma.notification.deleteMany).mockResolvedValue({
      count: 0,
    } as never)
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)
  })

  it('returns 401 without valid auth', async () => {
    const response = await GET(makeRequest('wrong-secret'))
    expect(response.status).toBe(401)
  })

  it('finds tasks due within 3 days and creates DUE_SOON notifications', async () => {
    vi.mocked(prisma.task.findMany)
      .mockResolvedValueOnce([mockDueSoonTask] as never) // due soon
      .mockResolvedValueOnce([] as never) // overdue

    const response = await GET(makeRequest('test-secret'))
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.stats.dueSoonCreated).toBe(1)
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: NotificationType.TASK_DUE_SOON,
          entity_id: 'task-due-soon',
        }),
      })
    )
  })

  it('finds overdue tasks and creates OVERDUE notifications', async () => {
    vi.mocked(prisma.task.findMany)
      .mockResolvedValueOnce([] as never) // due soon
      .mockResolvedValueOnce([mockOverdueTask] as never) // overdue

    const response = await GET(makeRequest('test-secret'))
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.stats.overdueCreated).toBe(1)
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: NotificationType.TASK_OVERDUE,
          entity_id: 'task-overdue',
        }),
      })
    )
  })

  it('skips already-notified tasks (dedup)', async () => {
    vi.mocked(prisma.task.findMany)
      .mockResolvedValueOnce([mockDueSoonTask] as never)
      .mockResolvedValueOnce([] as never)

    // Simulate existing notification
    vi.mocked(prisma.notification.findFirst).mockResolvedValue({
      id: 'existing',
    } as never)

    const response = await GET(makeRequest('test-secret'))
    const data = await response.json()

    expect(data.stats.skippedByDedup).toBe(1)
    expect(data.stats.dueSoonCreated).toBe(0)
  })

  it('respects user preferences', async () => {
    vi.mocked(prisma.task.findMany)
      .mockResolvedValueOnce([mockDueSoonTask] as never)
      .mockResolvedValueOnce([] as never)

    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      task_due_soon_enabled: false,
    } as never)

    const response = await GET(makeRequest('test-secret'))
    const data = await response.json()

    expect(data.stats.skippedByPreference).toBe(1)
    expect(data.stats.dueSoonCreated).toBe(0)
  })

  it('cleans up notifications older than 30 days', async () => {
    vi.mocked(prisma.task.findMany)
      .mockResolvedValueOnce([] as never) // due soon
      .mockResolvedValueOnce([] as never) // overdue
    vi.mocked(prisma.notification.deleteMany).mockResolvedValue({
      count: 5,
    } as never)

    const response = await GET(makeRequest('test-secret'))
    const data = await response.json()

    expect(data.stats.cleanedUp).toBe(5)
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          created_at: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      })
    )
  })
})
