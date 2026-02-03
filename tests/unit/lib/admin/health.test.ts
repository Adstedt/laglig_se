import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/cache/redis', () => ({
  redis: {
    ping: vi.fn(),
  },
  isRedisConfigured: vi.fn(),
}))

// Mock global fetch for API health checks
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { prisma } from '@/lib/prisma'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import {
  checkDatabase,
  checkRedis,
  runAllHealthChecks,
} from '@/lib/admin/health'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('checkDatabase', () => {
  it('returns ok:true when prisma.$queryRaw succeeds', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }] as never)

    const result = await checkDatabase()

    expect(result.ok).toBe(true)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('returns ok:false when prisma.$queryRaw throws', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(
      new Error('Connection refused') as never
    )

    const result = await checkDatabase()

    expect(result.ok).toBe(false)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })
})

describe('checkRedis', () => {
  it('returns ok:false when Redis is not configured', async () => {
    vi.mocked(isRedisConfigured).mockReturnValue(false)

    const result = await checkRedis()

    expect(result.ok).toBe(false)
    expect(result.latencyMs).toBe(0)
    expect(redis.ping).not.toHaveBeenCalled()
  })

  it('returns ok:true when redis.ping() succeeds', async () => {
    vi.mocked(isRedisConfigured).mockReturnValue(true)
    vi.mocked(redis.ping).mockResolvedValue('PONG' as never)

    const result = await checkRedis()

    expect(result.ok).toBe(true)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('returns ok:false when redis.ping() throws', async () => {
    vi.mocked(isRedisConfigured).mockReturnValue(true)
    vi.mocked(redis.ping).mockRejectedValue(new Error('timeout') as never)

    const result = await checkRedis()

    expect(result.ok).toBe(false)
  })
})

describe('runAllHealthChecks', () => {
  it('handles partial failures gracefully', async () => {
    // Riksdagen API: success
    mockFetch.mockResolvedValueOnce({ ok: true } as Response)
    // Domstolsverket API: fail
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    // Database: success
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }] as never)
    // Redis: not configured
    vi.mocked(isRedisConfigured).mockReturnValue(false)

    const results = await runAllHealthChecks()

    expect(results).toHaveLength(4)

    expect(results[0]?.name).toBe('Riksdagen API')
    expect(results[0]?.ok).toBe(true)

    expect(results[1]?.name).toBe('Domstolsverket API')
    expect(results[1]?.ok).toBe(false)

    expect(results[2]?.name).toBe('Databas')
    expect(results[2]?.ok).toBe(true)

    expect(results[3]?.name).toBe('Redis')
    expect(results[3]?.ok).toBe(false)
  })
})
