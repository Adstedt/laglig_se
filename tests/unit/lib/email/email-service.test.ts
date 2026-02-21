import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationType } from '@prisma/client'

const TEST_USER_ID = '11111111-1111-4111-a111-111111111111'
const TEST_WORKSPACE_ID = '22222222-2222-4222-a222-222222222222'

// Mock resend — use a class so `new Resend()` works
const mockSend = vi.fn()
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockSend }
  },
}))

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    activityLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-1' }),
    },
  },
}))

// Mock notification preferences
vi.mock('@/lib/email/notification-preferences', () => ({
  shouldSendEmail: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { shouldSendEmail } from '@/lib/email/notification-preferences'
import { sendEmail } from '@/lib/email/email-service'
import React from 'react'

// Minimal React element for testing
const TestEmailComponent = React.createElement('div', null, 'Test email')

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('RESEND_API_KEY', 'test-api-key')
})

describe('sendEmail', () => {
  it('sends email successfully via Resend', async () => {
    mockSend.mockResolvedValue({ id: 'email-1' })

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test Subject',
      react: TestEmailComponent,
    })

    expect(result).toEqual({ success: true })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Test Subject',
      })
    )
  })

  it('returns graceful error when RESEND_API_KEY is not configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '')

    // Need a fresh module for the empty API key to take effect on getResend()
    vi.resetModules()
    const { sendEmail: send } = await import('@/lib/email/email-service')

    const result = await send({
      to: 'user@example.com',
      subject: 'Test',
      react: TestEmailComponent,
    })

    expect(result).toEqual({
      success: false,
      error: 'RESEND_API_KEY not configured',
    })
  })

  it('skips send when user has opted out', async () => {
    mockSend.mockResolvedValue({ id: 'email-1' })
    vi.mocked(shouldSendEmail).mockResolvedValue(false)

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      react: TestEmailComponent,
      notificationType: NotificationType.TASK_ASSIGNED,
      userId: TEST_USER_ID,
      workspaceId: TEST_WORKSPACE_ID,
    })

    expect(result).toEqual({
      success: false,
      error: 'User has opted out of this notification type',
      skipped: true,
    })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('creates ActivityLog entry on successful workspace-scoped send', async () => {
    mockSend.mockResolvedValue({ id: 'email-1' })
    vi.mocked(shouldSendEmail).mockResolvedValue(true)

    await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      react: TestEmailComponent,
      notificationType: NotificationType.TASK_ASSIGNED,
      userId: TEST_USER_ID,
      workspaceId: TEST_WORKSPACE_ID,
    })

    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspace_id: TEST_WORKSPACE_ID,
        user_id: TEST_USER_ID,
        entity_type: 'email',
        action: 'notification_sent',
        new_value: expect.objectContaining({
          template: NotificationType.TASK_ASSIGNED,
          recipient: 'user@example.com',
        }),
      }),
    })
  })

  it('returns error when Resend send fails after retries', async () => {
    mockSend.mockRejectedValue(
      Object.assign(new Error('Service unavailable'), { statusCode: 502 })
    )

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      react: TestEmailComponent,
    })

    expect(result).toEqual({
      success: false,
      error: 'Service unavailable',
    })
    // Called multiple times due to retries (initial + 3 retries = 4)
    expect(mockSend.mock.calls.length).toBeGreaterThanOrEqual(2)
  }, 30000)

  it('does not create ActivityLog when no workspace context is provided', async () => {
    mockSend.mockResolvedValue({ id: 'email-1' })

    await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      react: TestEmailComponent,
    })

    expect(prisma.activityLog.create).not.toHaveBeenCalled()
  })
})
