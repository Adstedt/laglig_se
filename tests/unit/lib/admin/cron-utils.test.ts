import { describe, it, expect, vi, afterEach } from 'vitest'
import { getNextRun, isStale } from '@/lib/admin/cron-utils'

afterEach(() => {
  vi.useRealTimers()
})

describe('getNextRun', () => {
  it('returns null for manual schedule', () => {
    expect(getNextRun('manual')).toBeNull()
  })

  it('returns a Swedish relative time string for valid cron expression', () => {
    const result = getNextRun('0 3 * * *')
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
    // Swedish locale produces strings like "om 5 timmar"
    expect(result!.length).toBeGreaterThan(0)
  })

  it('returns null for invalid cron expression', () => {
    expect(getNextRun('not-a-cron')).toBeNull()
  })
})

describe('isStale', () => {
  it('returns false for manual schedule', () => {
    expect(isStale('manual', new Date())).toBe(false)
  })

  it('returns false when lastRunAt is null', () => {
    expect(isStale('0 3 * * *', null)).toBe(false)
  })

  it('returns false when last run is recent (within expected interval)', () => {
    // Daily job at 03:00, last run 1 hour ago — not stale
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    expect(isStale('0 3 * * *', oneHourAgo)).toBe(false)
  })

  it('returns true when last run is much older than schedule interval', () => {
    // Daily job at 03:00, last run 2 days ago — stale (>1.5x 24h)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    expect(isStale('0 3 * * *', twoDaysAgo)).toBe(true)
  })

  it('handles weekly schedule correctly', () => {
    // Weekly job (Sunday 06:00), last run 2 days ago — not stale
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    expect(isStale('0 6 * * 0', twoDaysAgo)).toBe(false)

    // Weekly job, last run 12 days ago — stale (>1.5x 7 days)
    const twelveDaysAgo = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
    expect(isStale('0 6 * * 0', twelveDaysAgo)).toBe(true)
  })

  it('returns false for invalid cron expression', () => {
    expect(isStale('not-a-cron', new Date())).toBe(false)
  })
})
