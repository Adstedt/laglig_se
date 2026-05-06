/**
 * Story 5.13: trial-expiration-cron tests.
 *
 * Covers the 3 actions (notifyExpiredTrials, pauseAbandonedTrials,
 * deleteAbandonedTrials) and the cross-cutting fail-safe pattern (email
 * failure must not block state transitions). Email assertions use vi.mock
 * spy on lib/email/email-service.sendEmail (no real-mailbox infra in the
 * codebase — matches Story 5.4 / 5.12 precedent).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock factories are hoisted — use vi.hoisted() for shared mock state.
const mocks = vi.hoisted(() => ({
  workspace: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  logActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { workspace: mocks.workspace },
}))

vi.mock('@/lib/email/email-service', () => ({
  sendEmail: (...args: unknown[]) => mocks.sendEmail(...args),
}))

vi.mock('@/lib/services/activity-logger', () => ({
  logActivity: (...args: unknown[]) => mocks.logActivity(...args),
}))

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    SALES_NOTIFICATION_EMAIL: 'sales@example.com',
  },
}))

import {
  notifyExpiredTrials,
  pauseAbandonedTrials,
  deleteAbandonedTrials,
} from '@/lib/billing/trial-expiration-cron'

const baseExpired = {
  id: 'ws_expired',
  name: 'Acme AB',
  owner_id: 'user_1',
  trial_picked_tier: 'TEAM' as const,
  enterprise_inquiry_at: null as Date | null,
  trial_ends_at: new Date('2026-04-01'),
  owner: { email: 'owner@example.com' },
}

afterEach(() => {
  vi.clearAllMocks()
})

beforeEach(() => {
  mocks.workspace.update.mockResolvedValue({})
})

describe('notifyExpiredTrials', () => {
  it('sets trial_expired_notified_at + sends trial-ended email + logs activity', async () => {
    mocks.workspace.findMany.mockResolvedValue([baseExpired])

    const result = await notifyExpiredTrials()

    expect(result).toEqual({ processed: 1, failed: 0 })
    // Idempotency lock set
    expect(mocks.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ws_expired' },
        data: expect.objectContaining({
          trial_expired_notified_at: expect.any(Date),
        }),
      })
    )
    // ActivityLog write
    expect(mocks.logActivity).toHaveBeenCalledWith(
      'ws_expired',
      'user_1',
      'workspace',
      'ws_expired',
      'trial_expired',
      null,
      expect.objectContaining({ picked_tier: 'TEAM' })
    )
    // Customer email — exactly 1 send for non-Enterprise inquirer
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        from: 'no-reply',
        subject: expect.stringContaining('Din provperiod är slut'),
      })
    )
  })

  it('also sends sales re-ping when enterprise_inquiry_at is set', async () => {
    mocks.workspace.findMany.mockResolvedValue([
      {
        ...baseExpired,
        enterprise_inquiry_at: new Date('2026-03-15'),
      },
    ])

    await notifyExpiredTrials()

    expect(mocks.sendEmail).toHaveBeenCalledTimes(2)
    const calls = mocks.sendEmail.mock.calls.map((c) => c[0])
    expect(calls).toContainEqual(
      expect.objectContaining({
        to: 'owner@example.com',
        from: 'no-reply',
      })
    )
    expect(calls).toContainEqual(
      expect.objectContaining({
        to: 'sales@example.com',
        from: 'notifications',
        subject: expect.stringContaining('Enterprise-lead'),
      })
    )
  })

  it('continues even if customer email throws (fail-safe pattern)', async () => {
    mocks.workspace.findMany.mockResolvedValue([baseExpired])
    mocks.sendEmail.mockRejectedValueOnce(new Error('Resend down'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await notifyExpiredTrials()

    // State transition + activity write still happened
    expect(mocks.workspace.update).toHaveBeenCalled()
    expect(mocks.logActivity).toHaveBeenCalled()
    // processed counter still incremented (state did transition)
    expect(result.processed).toBe(1)
    // Failure logged
    expect(consoleSpy).toHaveBeenCalledWith(
      '[TRIAL_EXPIRED_EMAIL_FAIL]',
      'ws_expired',
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })

  it('per-row failure increments failed counter without blocking siblings', async () => {
    mocks.workspace.findMany.mockResolvedValue([
      { ...baseExpired, id: 'ws_a' },
      { ...baseExpired, id: 'ws_b' },
      { ...baseExpired, id: 'ws_c' },
    ])
    // Make the middle row's UPDATE throw
    mocks.workspace.update
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('DB blip'))
      .mockResolvedValueOnce({})

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await notifyExpiredTrials()

    expect(result).toEqual({ processed: 2, failed: 1 })
    consoleSpy.mockRestore()
  })
})

describe('pauseAbandonedTrials', () => {
  it('flips status to PAUSED + sets paused_at + sends paused email + logs activity', async () => {
    mocks.workspace.findMany.mockResolvedValue([
      {
        id: 'ws_abandoned',
        name: 'Stale Co',
        owner_id: 'user_2',
        owner: { email: 'stale@example.com' },
      },
    ])

    const result = await pauseAbandonedTrials()

    expect(result).toEqual({ processed: 1, failed: 0 })
    expect(mocks.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ws_abandoned' },
        data: expect.objectContaining({
          status: 'PAUSED',
          paused_at: expect.any(Date),
        }),
      })
    )
    expect(mocks.logActivity).toHaveBeenCalledWith(
      'ws_abandoned',
      'user_2',
      'workspace',
      'ws_abandoned',
      'trial_paused'
    )
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'stale@example.com',
        from: 'no-reply',
        subject: expect.stringContaining('pausats'),
      })
    )
  })
})

describe('deleteAbandonedTrials', () => {
  it('flips status to DELETED + sets deleted_at + logs activity (no email)', async () => {
    mocks.workspace.findMany.mockResolvedValue([
      { id: 'ws_dead', owner_id: 'user_3' },
    ])

    const result = await deleteAbandonedTrials()

    expect(result).toEqual({ processed: 1, failed: 0 })
    expect(mocks.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ws_dead' },
        data: expect.objectContaining({
          status: 'DELETED',
          deleted_at: expect.any(Date),
        }),
      })
    )
    expect(mocks.logActivity).toHaveBeenCalledWith(
      'ws_dead',
      'user_3',
      'workspace',
      'ws_dead',
      'trial_workspace_deleted'
    )
    // No email at this stage — paused-email at Day 45 already warned.
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})
