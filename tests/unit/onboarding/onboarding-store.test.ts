/**
 * Story 5.12 — unit tests for lib/onboarding/onboarding-store.ts.
 *
 * Covers parsePickedTier (new in 5.12) + the pickedTier round-trip through
 * saveOnboardingData / getOnboardingData.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  saveOnboardingData,
  getOnboardingData,
  clearOnboardingData,
  parsePickedTier,
} from '@/lib/onboarding/onboarding-store'

describe('parsePickedTier', () => {
  it('accepts SOLO / TEAM / ENTERPRISE (case-insensitive)', () => {
    expect(parsePickedTier('solo')).toBe('SOLO')
    expect(parsePickedTier('TEAM')).toBe('TEAM')
    expect(parsePickedTier('Enterprise')).toBe('ENTERPRISE')
    expect(parsePickedTier(' team ')).toBe('TEAM')
  })

  it('returns undefined for null / empty / unknown values', () => {
    expect(parsePickedTier(null)).toBeUndefined()
    expect(parsePickedTier('')).toBeUndefined()
    expect(parsePickedTier('FREE')).toBeUndefined()
    expect(parsePickedTier('trial')).toBeUndefined() // TRIAL not allowed
    expect(parsePickedTier('SOL0')).toBeUndefined() // typo guard
  })
})

describe('OnboardingData round-trip with pickedTier', () => {
  // Mock localStorage for the Node test environment (vitest jsdom may already
  // provide one — guard against either).
  beforeEach(() => {
    if (typeof globalThis.localStorage === 'undefined') {
      const store = new Map<string, string>()
      ;(globalThis as { localStorage?: Storage }).localStorage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, val: string) => {
          store.set(key, val)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
        clear: () => store.clear(),
        key: () => null,
        length: 0,
      } as Storage
    }
    clearOnboardingData()
  })

  afterEach(() => {
    clearOnboardingData()
  })

  it('persists pickedTier through saveOnboardingData → getOnboardingData', () => {
    saveOnboardingData({ pickedTier: 'TEAM' })
    expect(getOnboardingData()?.pickedTier).toBe('TEAM')
  })

  it('merges pickedTier with other fields without overwriting them', () => {
    saveOnboardingData({ orgNumber: '556677-1234' })
    saveOnboardingData({ pickedTier: 'SOLO' })
    const stored = getOnboardingData()
    expect(stored?.orgNumber).toBe('556677-1234')
    expect(stored?.pickedTier).toBe('SOLO')
  })

  it('updates pickedTier when set twice', () => {
    saveOnboardingData({ pickedTier: 'SOLO' })
    saveOnboardingData({ pickedTier: 'TEAM' })
    expect(getOnboardingData()?.pickedTier).toBe('TEAM')
  })
})
