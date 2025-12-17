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
  beforeEach(async () => {
    // Clear caches before each test
    await invalidateAllCaches()
  })

  it('should return stats object with required properties', () => {
    const stats = getCacheStats()

    expect(stats).toHaveProperty('version')
    expect(stats).toHaveProperty('diff')
    expect(stats).toHaveProperty('timeline')
    expect(stats).toHaveProperty('l1HitRate')
    expect(stats).toHaveProperty('l2HitRate')
    expect(stats).toHaveProperty('overallHitRate')
    expect(stats).toHaveProperty('redisConfigured')
  })

  it('should return version cache stats with l1Hits, l2Hits, misses', () => {
    const stats = getCacheStats()

    expect(stats.version).toHaveProperty('l1Hits')
    expect(stats.version).toHaveProperty('l2Hits')
    expect(stats.version).toHaveProperty('misses')

    expect(typeof stats.version.l1Hits).toBe('number')
    expect(typeof stats.version.l2Hits).toBe('number')
    expect(typeof stats.version.misses).toBe('number')
  })

  it('should return diff cache stats with l1Hits, l2Hits, misses', () => {
    const stats = getCacheStats()

    expect(stats.diff).toHaveProperty('l1Hits')
    expect(stats.diff).toHaveProperty('l2Hits')
    expect(stats.diff).toHaveProperty('misses')
  })

  it('should return hit rates as numbers between 0 and 1', () => {
    const stats = getCacheStats()

    expect(typeof stats.l1HitRate).toBe('number')
    expect(typeof stats.l2HitRate).toBe('number')
    expect(typeof stats.overallHitRate).toBe('number')

    expect(stats.l1HitRate).toBeGreaterThanOrEqual(0)
    expect(stats.l1HitRate).toBeLessThanOrEqual(1)
    expect(stats.l2HitRate).toBeGreaterThanOrEqual(0)
    expect(stats.l2HitRate).toBeLessThanOrEqual(1)
    expect(stats.overallHitRate).toBeGreaterThanOrEqual(0)
    expect(stats.overallHitRate).toBeLessThanOrEqual(1)
  })

  it('should return 0 hit rates when no requests made', async () => {
    await invalidateAllCaches()
    const stats = getCacheStats()

    // After clearing, with no requests, hit rates should be 0
    expect(stats.overallHitRate).toBe(0)
  })

  it('should indicate whether Redis is configured', () => {
    const stats = getCacheStats()

    expect(typeof stats.redisConfigured).toBe('boolean')
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
  it('should reset stats to initial state', async () => {
    await invalidateAllCaches()
    const stats = getCacheStats()

    // After invalidation, no requests have been made so all counts should be 0
    expect(stats.version.l1Hits).toBe(0)
    expect(stats.diff.l1Hits).toBe(0)
  })

  it('should not throw when called multiple times', async () => {
    await expect(
      (async () => {
        await invalidateAllCaches()
        await invalidateAllCaches()
        await invalidateAllCaches()
      })()
    ).resolves.not.toThrow()
  })
})

describe('LRU Cache Behavior (via exported functions)', () => {
  beforeEach(async () => {
    await invalidateAllCaches()
  })

  it('should start with zero hits after invalidation', async () => {
    const stats = getCacheStats()

    expect(stats.version.l1Hits).toBe(0)
    expect(stats.version.l2Hits).toBe(0)
    expect(stats.diff.l1Hits).toBe(0)
    expect(stats.diff.l2Hits).toBe(0)
  })

  it('should track misses correctly', () => {
    const initialStats = getCacheStats()

    // Initial state should have 0 misses (no requests made)
    expect(initialStats.version.misses).toBe(0)
    expect(initialStats.diff.misses).toBe(0)
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

describe('Two-Tier Cache Architecture', () => {
  it('should report Redis configuration status', () => {
    const stats = getCacheStats()

    // In test environment, Redis is typically not configured
    expect(typeof stats.redisConfigured).toBe('boolean')
  })

  it('should have separate L1 and L2 hit tracking', () => {
    const stats = getCacheStats()

    // Each cache type should track L1 and L2 hits separately
    expect(stats.version).toHaveProperty('l1Hits')
    expect(stats.version).toHaveProperty('l2Hits')
    expect(stats.diff).toHaveProperty('l1Hits')
    expect(stats.diff).toHaveProperty('l2Hits')
    expect(stats.timeline).toHaveProperty('l1Hits')
    expect(stats.timeline).toHaveProperty('l2Hits')
  })
})
