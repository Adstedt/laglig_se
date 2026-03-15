/**
 * Cache Invalidation Module Tests (Story 2.19)
 *
 * Tests for the cache invalidation module including:
 * - Law cache invalidation
 * - EU legislation cache invalidation
 * - Full cache invalidation
 */

import { describe, it, expect, vi } from 'vitest'
import {
  invalidateLawCaches,
  invalidateEuCaches,
  invalidateAllCaches,
} from '../../cache/invalidation'

// Mock the redis module
vi.mock('../../cache/redis', () => ({
  invalidateCachePattern: vi.fn().mockResolvedValue(5),
}))

describe('Cache Invalidation Module', () => {
  describe('invalidateLawCaches', () => {
    it('should return invalidation results', async () => {
      const result = await invalidateLawCaches()

      expect(result).toHaveProperty('redisKeysCleared')
      expect(result).toHaveProperty('tagsRevalidated')
      expect(typeof result.redisKeysCleared).toBe('number')
      expect(Array.isArray(result.tagsRevalidated)).toBe(true)
    })

    it('should include law-related cache tags', async () => {
      const result = await invalidateLawCaches()

      expect(result.tagsRevalidated).toContain('laws')
      expect(result.tagsRevalidated).toContain('browse')
      expect(result.tagsRevalidated).toContain('catalogue')
      expect(result.tagsRevalidated).toContain('documents')
    })
  })

  describe('invalidateEuCaches', () => {
    it('should return invalidation results', async () => {
      const result = await invalidateEuCaches()

      expect(result).toHaveProperty('redisKeysCleared')
      expect(result).toHaveProperty('tagsRevalidated')
    })

    it('should include EU-legislation-related cache tags', async () => {
      const result = await invalidateEuCaches()

      expect(result.tagsRevalidated).toContain('eu-legislation')
      expect(result.tagsRevalidated).toContain('browse')
      expect(result.tagsRevalidated).toContain('catalogue')
    })
  })

  describe('invalidateAllCaches', () => {
    it('should return invalidation results', async () => {
      const result = await invalidateAllCaches()

      expect(result).toHaveProperty('redisKeysCleared')
      expect(result).toHaveProperty('tagsRevalidated')
    })

    it('should include all cache tags', async () => {
      const result = await invalidateAllCaches()

      expect(result.tagsRevalidated).toContain('laws')
      expect(result.tagsRevalidated).toContain('eu-legislation')
      expect(result.tagsRevalidated).toContain('browse')
      expect(result.tagsRevalidated).toContain('catalogue')
      expect(result.tagsRevalidated).toContain('documents')
      expect(result.tagsRevalidated).toContain('static-generation')
    })
  })
})
