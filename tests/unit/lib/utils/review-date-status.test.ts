import { describe, it, expect } from 'vitest'
import { getReviewDateStatus } from '@/lib/utils/review-date-status'

describe('getReviewDateStatus', () => {
  it('returns null for null input', () => {
    expect(getReviewDateStatus(null)).toBeNull()
  })

  it('returns "overdue" for a past date', () => {
    const pastDate = new Date(Date.now() - 86_400_000) // yesterday
    expect(getReviewDateStatus(pastDate)).toBe('overdue')
  })

  it('returns "upcoming" for a date within 30 days', () => {
    const soonDate = new Date(Date.now() + 15 * 86_400_000) // 15 days from now
    expect(getReviewDateStatus(soonDate)).toBe('upcoming')
  })

  it('returns "normal" for a date more than 30 days away', () => {
    const farDate = new Date(Date.now() + 60 * 86_400_000) // 60 days from now
    expect(getReviewDateStatus(farDate)).toBe('normal')
  })

  it('returns "upcoming" for a date exactly 30 days away', () => {
    const exactDate = new Date(Date.now() + 30 * 86_400_000)
    expect(getReviewDateStatus(exactDate)).toBe('upcoming')
  })

  it('accepts a string date', () => {
    const pastStr = new Date(Date.now() - 86_400_000).toISOString()
    expect(getReviewDateStatus(pastStr)).toBe('overdue')
  })

  it('returns "overdue" for today (just past midnight edge)', () => {
    // A date set to the start of today is technically in the past
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    expect(getReviewDateStatus(todayStart)).toBe('overdue')
  })
})
