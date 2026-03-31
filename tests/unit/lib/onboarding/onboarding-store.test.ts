import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  saveOnboardingData,
  getOnboardingData,
  clearOnboardingData,
  parseFlags,
} from '@/lib/onboarding/onboarding-store'

const STORAGE_KEY = 'laglig_onboarding_data'

describe('OnboardingStore', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key]
      }),
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // 5.1: saveOnboardingData stores to localStorage with timestamp
  it('saves data to localStorage with timestamp', () => {
    const now = Date.now()
    saveOnboardingData({ orgNumber: '556677-8899' })

    const stored = JSON.parse(store[STORAGE_KEY]!)
    expect(stored.data.orgNumber).toBe('556677-8899')
    expect(stored.timestamp).toBeGreaterThanOrEqual(now)
  })

  // 5.2: getOnboardingData returns data when within TTL
  it('returns data when within TTL', () => {
    saveOnboardingData({ orgNumber: '556677-8899', companyName: 'Test AB' })

    const result = getOnboardingData()
    expect(result).toEqual({
      orgNumber: '556677-8899',
      companyName: 'Test AB',
    })
  })

  // 5.3: getOnboardingData returns null and clears storage when TTL expired
  it('returns null and clears storage when TTL expired', () => {
    saveOnboardingData({ orgNumber: '556677-8899' })

    // Advance 25 hours
    vi.advanceTimersByTime(25 * 60 * 60 * 1000)

    const result = getOnboardingData()
    expect(result).toBeNull()
    expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY)
  })

  // 5.4: getOnboardingData returns null on localStorage error
  it('returns null on localStorage error (private browsing)', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new Error('SecurityError')
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })

    const result = getOnboardingData()
    expect(result).toBeNull()
  })

  // 5.5: clearOnboardingData removes key
  it('clears data from localStorage', () => {
    saveOnboardingData({ orgNumber: '556677-8899' })
    clearOnboardingData()

    expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY)
    expect(store[STORAGE_KEY]).toBeUndefined()
  })

  // 5.6: saveOnboardingData merges with existing data
  it('merges with existing data (preserves fields not in new partial)', () => {
    saveOnboardingData({ orgNumber: '556677-8899', companyName: 'Test AB' })
    saveOnboardingData({ websiteUrl: 'https://test.se' })

    const result = getOnboardingData()
    expect(result).toEqual({
      orgNumber: '556677-8899',
      companyName: 'Test AB',
      websiteUrl: 'https://test.se',
    })
  })

  // saveOnboardingData no-ops on localStorage error
  it('does not throw when localStorage.setItem fails', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError')
      }),
      removeItem: vi.fn(),
    })

    expect(() => saveOnboardingData({ orgNumber: '123' })).not.toThrow()
  })
})

describe('parseFlags', () => {
  // 5.7: "food,chemicals" → { food: true, chemicals: true }
  it('parses comma-separated flags', () => {
    expect(parseFlags('food,chemicals')).toEqual({
      food: true,
      chemicals: true,
    })
  })

  // 5.8: empty string / null → undefined
  it('returns undefined for null', () => {
    expect(parseFlags(null)).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(parseFlags('')).toBeUndefined()
  })

  // 5.9: malformed input with extra commas and whitespace
  it('trims whitespace and filters empty strings', () => {
    expect(parseFlags('food,,chemicals')).toEqual({
      food: true,
      chemicals: true,
    })
  })

  it('handles whitespace around flags', () => {
    expect(parseFlags('food, chemicals')).toEqual({
      food: true,
      chemicals: true,
    })
  })
})
