/**
 * Redis Cache Module Tests (Story 2.19)
 *
 * Tests for the Redis cache module including:
 * - Graceful fallback when Redis unavailable
 * - Cache metrics tracking
 * - getCachedOrFetch utility function
 * - Cache invalidation functions
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  isRedisConfigured,
  getCacheMetrics,
  resetCacheMetrics,
  getCachedOrFetch,
  invalidateCachePattern,
  invalidateCacheKey,
} from '../../cache/redis'

describe('Redis Cache Module', () => {
  beforeEach(() => {
    resetCacheMetrics()
  })

  describe('isRedisConfigured', () => {
    it('should return boolean indicating Redis configuration status', () => {
      expect(typeof isRedisConfigured).toBe('boolean')
    })
  })

  describe('getCacheMetrics', () => {
    it('should return initial metrics with zeros', () => {
      const metrics = getCacheMetrics()

      expect(metrics.hits).toBe(0)
      expect(metrics.misses).toBe(0)
      expect(metrics.total).toBe(0)
      expect(metrics.hitRate).toBe('0.00%')
    })
  })

  describe('resetCacheMetrics', () => {
    it('should reset all metrics to zero', () => {
      resetCacheMetrics()
      const metrics = getCacheMetrics()

      expect(metrics.hits).toBe(0)
      expect(metrics.misses).toBe(0)
      expect(metrics.total).toBe(0)
    })
  })

  describe('getCachedOrFetch', () => {
    it('should call fetcher and return data', async () => {
      const testData = { message: 'test' }
      const result = await getCachedOrFetch(
        'test:key',
        async () => testData,
        60
      )

      expect(result.data).toEqual(testData)
    })

    it('should indicate cache status in response', async () => {
      const result = await getCachedOrFetch(
        'test:key2',
        async () => ({ value: 123 }),
        60
      )

      expect(typeof result.cached).toBe('boolean')
    })

    it('should handle async fetchers correctly', async () => {
      const result = await getCachedOrFetch(
        'test:async',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return { delayed: true }
        },
        60
      )

      expect(result.data.delayed).toBe(true)
    })

    it('should work with different data types', async () => {
      // String
      const stringResult = await getCachedOrFetch(
        'test:string',
        async () => 'hello',
        60
      )
      expect(stringResult.data).toBe('hello')

      // Number
      const numberResult = await getCachedOrFetch(
        'test:number',
        async () => 42,
        60
      )
      expect(numberResult.data).toBe(42)

      // Array
      const arrayResult = await getCachedOrFetch(
        'test:array',
        async () => [1, 2, 3],
        60
      )
      expect(arrayResult.data).toEqual([1, 2, 3])

      // Null
      const nullResult = await getCachedOrFetch(
        'test:null',
        async () => null,
        60
      )
      expect(nullResult.data).toBeNull()
    })
  })

  describe('invalidateCachePattern', () => {
    it('should return number of keys cleared', async () => {
      const result = await invalidateCachePattern('test:*')
      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThanOrEqual(0)
    })
  })

  describe('invalidateCacheKey', () => {
    it('should return boolean indicating success', async () => {
      const result = await invalidateCacheKey('test:specific')
      expect(typeof result).toBe('boolean')
    })
  })

  describe('Graceful Fallback', () => {
    it('should work without throwing when Redis is unavailable', async () => {
      // This tests the noopRedis fallback
      await expect(
        getCachedOrFetch('test:fallback', async () => 'data', 60)
      ).resolves.not.toThrow()
    })

    it('should return data even when Redis unavailable', async () => {
      const result = await getCachedOrFetch(
        'test:fallback2',
        async () => ({ success: true }),
        60
      )

      expect(result.data.success).toBe(true)
    })
  })
})
