import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cronJobRun: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import {
  startJobRun,
  completeJobRun,
  failJobRun,
  appendJobLog,
} from '@/lib/admin/job-logger'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('startJobRun', () => {
  it('creates a CronJobRun with RUNNING status', async () => {
    vi.mocked(prisma.cronJobRun.create).mockResolvedValue({
      id: 'run-1',
      job_name: 'warm-cache',
      status: 'RUNNING',
      started_at: new Date(),
      completed_at: null,
      duration_ms: null,
      items_processed: 0,
      items_failed: 0,
      error_message: null,
      error_stack: null,
      log_output: null,
      triggered_by: 'cron',
      metadata: null,
    } as never)

    const id = await startJobRun('warm-cache', 'cron')

    expect(id).toBe('run-1')
    expect(prisma.cronJobRun.create).toHaveBeenCalledWith({
      data: {
        job_name: 'warm-cache',
        status: 'RUNNING',
        triggered_by: 'cron',
      },
    })
  })

  it('does not throw on DB error (graceful degradation)', async () => {
    vi.mocked(prisma.cronJobRun.create).mockRejectedValue(
      new Error('DB connection failed') as never
    )

    const id = await startJobRun('warm-cache')

    expect(id).toBeUndefined()
  })
})

describe('completeJobRun', () => {
  it('updates status to SUCCESS with duration calculated from started_at', async () => {
    const startedAt = new Date(Date.now() - 5000)
    vi.mocked(prisma.cronJobRun.findUnique).mockResolvedValue({
      started_at: startedAt,
    } as never)
    vi.mocked(prisma.cronJobRun.update).mockResolvedValue({} as never)

    await completeJobRun('run-1', {
      itemsProcessed: 10,
      itemsFailed: 2,
    })

    expect(prisma.cronJobRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'SUCCESS',
        items_processed: 10,
        items_failed: 2,
      }),
    })

    const updateCall = vi.mocked(prisma.cronJobRun.update).mock.calls[0]?.[0]
    expect(updateCall?.data.duration_ms).toBeGreaterThanOrEqual(4000)
    expect(updateCall?.data.completed_at).toBeInstanceOf(Date)
  })

  it('does not throw on DB error (graceful degradation)', async () => {
    vi.mocked(prisma.cronJobRun.findUnique).mockRejectedValue(
      new Error('DB error') as never
    )

    await expect(
      completeJobRun('run-1', { itemsProcessed: 0, itemsFailed: 0 })
    ).resolves.toBeUndefined()
  })
})

describe('failJobRun', () => {
  it('updates status to FAILED with error_message and error_stack', async () => {
    const startedAt = new Date(Date.now() - 3000)
    vi.mocked(prisma.cronJobRun.findUnique).mockResolvedValue({
      started_at: startedAt,
    } as never)
    vi.mocked(prisma.cronJobRun.update).mockResolvedValue({} as never)

    const error = new Error('Something broke')
    error.stack = 'Error: Something broke\n    at test.ts:1:1'

    await failJobRun('run-1', error)

    expect(prisma.cronJobRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        error_message: 'Something broke',
        error_stack: 'Error: Something broke\n    at test.ts:1:1',
      }),
    })

    const updateCall = vi.mocked(prisma.cronJobRun.update).mock.calls[0]?.[0]
    expect(updateCall?.data.duration_ms).toBeGreaterThanOrEqual(2000)
    expect(updateCall?.data.completed_at).toBeInstanceOf(Date)
  })

  it('does not throw on DB error (graceful degradation)', async () => {
    vi.mocked(prisma.cronJobRun.findUnique).mockRejectedValue(
      new Error('DB error') as never
    )

    await expect(
      failJobRun('run-1', new Error('test'))
    ).resolves.toBeUndefined()
  })
})

describe('appendJobLog', () => {
  it('appends to log_output using raw SQL', async () => {
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1 as never)

    await appendJobLog('run-1', 'Processing batch 1')

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1)
  })

  it('does not throw on DB error (graceful degradation)', async () => {
    vi.mocked(prisma.$executeRaw).mockRejectedValue(
      new Error('DB error') as never
    )

    await expect(appendJobLog('run-1', 'test message')).resolves.toBeUndefined()
  })
})
