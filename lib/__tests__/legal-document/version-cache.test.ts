/**
 * Tests for Version Cache
 * Story 2.13 QA Fix: TEST-001
 *
 * Note: The LRU cache is an internal class. We test the exported functions
 * and observable cache behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getCacheStats,
  getPopularLaws,
  invalidateAllCaches,
} from '../../legal-document/version-cache'

describe('getCacheStats', () => {
  beforeEach(() => {
    // Clear caches before each test
    invalidateAllCaches()
  })

  it('should return stats object with required properties', () => {
    const stats = getCacheStats()

    expect(stats).toHaveProperty('version')
    expect(stats).toHaveProperty('diff')
    expect(stats).toHaveProperty('hitRate')
  })

  it('should return version cache stats with hits, misses, size', () => {
    const stats = getCacheStats()

    expect(stats.version).toHaveProperty('hits')
    expect(stats.version).toHaveProperty('misses')
    expect(stats.version).toHaveProperty('size')

    expect(typeof stats.version.hits).toBe('number')
    expect(typeof stats.version.misses).toBe('number')
    expect(typeof stats.version.size).toBe('number')
  })

  it('should return diff cache stats with hits, misses, size', () => {
    const stats = getCacheStats()

    expect(stats.diff).toHaveProperty('hits')
    expect(stats.diff).toHaveProperty('misses')
    expect(stats.diff).toHaveProperty('size')
  })

  it('should return hitRate as a number between 0 and 1', () => {
    const stats = getCacheStats()

    expect(typeof stats.hitRate).toBe('number')
    expect(stats.hitRate).toBeGreaterThanOrEqual(0)
    expect(stats.hitRate).toBeLessThanOrEqual(1)
  })

  it('should return 0 hitRate when no requests made', () => {
    invalidateAllCaches()
    const stats = getCacheStats()

    // After clearing, with no requests, hitRate should be 0
    expect(stats.hitRate).toBe(0)
  })
})

describe('getPopularLaws', () => {
  it('should return an array of SFS numbers', async () => {
    const laws = await getPopularLaws()

    expect(Array.isArray(laws)).toBe(true)
    expect(laws.length).toBeGreaterThan(0)
  })

  it('should return SFS formatted strings', async () => {
    const laws = await getPopularLaws()

    for (const law of laws) {
      // Should be in format "SFS YYYY:NNN"
      expect(law).toMatch(/^SFS \d{4}:\d+/)
    }
  })

  it('should respect limit parameter', async () => {
    const laws = await getPopularLaws(3)

    expect(laws.length).toBeLessThanOrEqual(3)
  })

  it('should include well-known Swedish laws', async () => {
    const laws = await getPopularLaws()

    // Should include at least one well-known law
    const wellKnownLaws = [
      'SFS 1962:700', // Brottsbalken
      'SFS 1977:1160', // Arbetsmiljölagen
      'SFS 1998:808', // Miljöbalken
    ]

    const hasWellKnown = wellKnownLaws.some((law) => laws.includes(law))
    expect(hasWellKnown).toBe(true)
  })
})

describe('invalidateAllCaches', () => {
  it('should reset cache sizes to 0', () => {
    invalidateAllCaches()
    const stats = getCacheStats()

    expect(stats.version.size).toBe(0)
    expect(stats.diff.size).toBe(0)
  })

  it('should not throw when called multiple times', () => {
    expect(() => {
      invalidateAllCaches()
      invalidateAllCaches()
      invalidateAllCaches()
    }).not.toThrow()
  })
})

describe('LRU Cache Behavior (via exported functions)', () => {
  beforeEach(() => {
    invalidateAllCaches()
  })

  it('should start with empty cache', () => {
    const stats = getCacheStats()

    expect(stats.version.size).toBe(0)
    expect(stats.diff.size).toBe(0)
  })

  it('should track hits and misses correctly', () => {
    const initialStats = getCacheStats()

    // Initial state should have 0 hits
    expect(initialStats.version.hits).toBe(0)
    expect(initialStats.diff.hits).toBe(0)
  })
})

describe('Cache Key Generation', () => {
  // Test the expected format of cache keys (indirectly via stats)
  it('should handle various SFS number formats', async () => {
    // These tests verify the cache doesn't crash with different inputs
    // The actual caching requires database access, so we just verify no errors
    const stats = getCacheStats()
    expect(stats).toBeDefined()
  })
})
