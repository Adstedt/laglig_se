/**
 * Story 5.3: Cleanup cron tests.
 *
 * Verifies that only PENDING invitations with expires_at < now are flipped
 * to EXPIRED.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockStartJobRun = vi.fn().mockResolvedValue('run-1')
const mockCompleteJobRun = vi.fn().mockResolvedValue(undefined)
const mockFailJobRun = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/admin/job-logger', () => ({
  startJobRun: (...args: unknown[]) => mockStartJobRun(...args),
  completeJobRun: (...args: unknown[]) => mockCompleteJobRun(...args),
  failJobRun: (...args: unknown[]) => mockFailJobRun(...args),
}))

const mockUpdateMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceInvitation: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}))

const { GET } = await import('@/app/api/cron/cleanup-invitations/route')

function makeRequest(): Request {
  return new Request('http://localhost/api/cron/cleanup-invitations', {
    headers: { 'x-triggered-by': 'test' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdateMany.mockResolvedValue({ count: 3 })
  // Ensure we are not treated as production so the auth check is skipped.
  process.env.NODE_ENV = 'test'
})

describe('GET /api/cron/cleanup-invitations', () => {
  it('marks expired PENDING invitations as EXPIRED and reports the count', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.expired).toBe(3)

    const call = mockUpdateMany.mock.calls[0][0]
    expect(call.where.status).toBe('PENDING')
    expect(call.where.expires_at.lt).toBeInstanceOf(Date)
    expect(call.data).toEqual({ status: 'EXPIRED' })
  })

  it('returns 500 when the DB call throws and logs job failure', async () => {
    mockUpdateMany.mockRejectedValueOnce(new Error('db down'))

    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    expect(mockFailJobRun).toHaveBeenCalledTimes(1)
  })
})
