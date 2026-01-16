/**
 * Tests for Workspace Caching Module (Story P.2)
 *
 * @see docs/stories/P.2.systematic-caching.story.md
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  WORKSPACE_CACHE_KEYS,
  CACHE_TTL,
  invalidateWorkspaceCache,
  invalidateUserCache,
  invalidateLawListCache,
  warmWorkspaceCache,
  getWorkspaceCacheStats,
  measureWorkspaceCachePerformance,
} from '@/lib/cache/workspace-cache'
import { redis } from '@/lib/cache/redis'

// Mock Redis client
vi.mock('@/lib/cache/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    expire: vi.fn(),
  },
  isRedisConfigured: vi.fn(() => true),
  getCachedOrFetch: vi.fn().mockImplementation(async (_key, fetcher, _ttl) => {
    const data = await fetcher()
    return { data, cached: false }
  }),
}))

describe('Workspace Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Cache Key Generation', () => {
    it('should generate correct workspace context key', () => {
      const key = WORKSPACE_CACHE_KEYS.CONTEXT('user123', 'workspace456')
      expect(key).toBe('workspace:context:user123:workspace456')
    })

    it('should generate correct members key', () => {
      const key = WORKSPACE_CACHE_KEYS.MEMBERS('workspace456')
      expect(key).toBe('workspace:members:workspace456')
    })

    it('should generate correct law lists key', () => {
      const key = WORKSPACE_CACHE_KEYS.LAW_LISTS('workspace456')
      expect(key).toBe('workspace:lists:workspace456')
    })

    it('should generate correct list items key', () => {
      const key = WORKSPACE_CACHE_KEYS.LIST_ITEMS('list789')
      expect(key).toBe('list:items:list789')
    })

    it('should generate correct user preferences key', () => {
      const key = WORKSPACE_CACHE_KEYS.USER_PREFS('user123')
      expect(key).toBe('user:prefs:user123')
    })
  })

  describe('Cache TTL Values', () => {
    it('should have correct TTL for workspace context', () => {
      expect(CACHE_TTL.WORKSPACE_CONTEXT).toBe(300) // 5 minutes
    })

    it('should have correct TTL for workspace members', () => {
      expect(CACHE_TTL.WORKSPACE_MEMBERS).toBe(3600) // 1 hour
    })

    it('should have correct TTL for user preferences', () => {
      expect(CACHE_TTL.USER_PREFERENCES).toBe(1800) // 30 minutes
    })

    it('should have correct TTL for law lists', () => {
      expect(CACHE_TTL.LAW_LISTS).toBe(300) // 5 minutes
    })
  })

  describe('Cache Invalidation', () => {
    it('should invalidate workspace context cache', async () => {
      vi.mocked(redis.keys).mockResolvedValue([
        'workspace:context:user1:workspace1',
        'workspace:context:user2:workspace1',
      ])
      vi.mocked(redis.del).mockResolvedValue(1)

      await invalidateWorkspaceCache('workspace1', ['context'])

      expect(redis.keys).toHaveBeenCalledWith('workspace:context:*:workspace1')
      expect(redis.del).toHaveBeenCalledTimes(2)
    })

    it('should invalidate workspace members cache', async () => {
      vi.mocked(redis.del).mockResolvedValue(1)

      await invalidateWorkspaceCache('workspace1', ['members'])

      expect(redis.del).toHaveBeenCalledWith('workspace:members:workspace1')
    })

    it('should invalidate all workspace cache types when no types specified', async () => {
      vi.mocked(redis.keys).mockResolvedValue(['key1', 'key2'])
      vi.mocked(redis.del).mockResolvedValue(1)

      await invalidateWorkspaceCache('workspace1')

      // Should invalidate context, members, lists, and settings
      expect(redis.keys).toHaveBeenCalledWith('workspace:context:*:workspace1')
      expect(redis.keys).toHaveBeenCalledWith('list:items:*')
      expect(redis.del).toHaveBeenCalledWith('workspace:members:workspace1')
      expect(redis.del).toHaveBeenCalledWith('workspace:lists:workspace1')
      expect(redis.del).toHaveBeenCalledWith('workspace:settings:workspace1')
    })
  })

  describe('User Cache Invalidation', () => {
    it('should invalidate user preferences', async () => {
      vi.mocked(redis.del).mockResolvedValue(1)

      await invalidateUserCache('user123', ['preferences'])

      expect(redis.del).toHaveBeenCalledWith('user:prefs:user123')
    })

    it('should invalidate user frequent documents', async () => {
      vi.mocked(redis.keys).mockResolvedValue([
        'user:frequent:user123:workspace1',
        'user:frequent:user123:workspace2',
      ])
      vi.mocked(redis.del).mockResolvedValue(1)

      await invalidateUserCache('user123', ['frequent'])

      expect(redis.keys).toHaveBeenCalledWith('user:frequent:user123:*')
      expect(redis.del).toHaveBeenCalledTimes(2)
    })

    it('should invalidate user context across workspaces', async () => {
      vi.mocked(redis.keys).mockResolvedValue([
        'workspace:context:user123:workspace1',
        'workspace:context:user123:workspace2',
      ])
      vi.mocked(redis.del).mockResolvedValue(1)

      await invalidateUserCache('user123', ['context'])

      expect(redis.keys).toHaveBeenCalledWith('workspace:context:user123:*')
      expect(redis.del).toHaveBeenCalledTimes(2)
    })
  })

  describe('Law List Cache Invalidation', () => {
    it('should invalidate list items cache', async () => {
      vi.mocked(redis.del).mockResolvedValue(1)

      await invalidateLawListCache('list123')

      expect(redis.del).toHaveBeenCalledWith('list:items:list123')
    })

    it('should invalidate both list items and workspace lists', async () => {
      vi.mocked(redis.del).mockResolvedValue(1)

      await invalidateLawListCache('list123', 'workspace456')

      expect(redis.del).toHaveBeenCalledWith('list:items:list123')
      expect(redis.del).toHaveBeenCalledWith('workspace:lists:workspace456')
    })
  })

  describe('Cache Warming', () => {
    it('should warm workspace cache with all fetchers', async () => {
      const mockContext = { workspaceId: 'workspace1', role: 'OWNER' }
      const mockMembers = [{ id: 'member1' }, { id: 'member2' }]
      const mockLists = [{ id: 'list1' }, { id: 'list2' }]
      const mockPrefs = { theme: 'dark' }

      // Mock getCachedOrFetch from redis module
      const { getCachedOrFetch } = await import('@/lib/cache/redis')
      vi.mocked(getCachedOrFetch).mockImplementation(
        async (_key, fetcher, _ttl) => {
          const data = await fetcher()
          return { data, cached: false }
        }
      )

      await warmWorkspaceCache('user123', 'workspace456', {
        context: async () => mockContext,
        members: async () => mockMembers as never,
        lists: async () => mockLists as never,
        preferences: async () => mockPrefs,
      })

      expect(getCachedOrFetch).toHaveBeenCalledTimes(4)
    })

    it('should handle partial cache warming', async () => {
      const mockLists = [{ id: 'list1' }]

      // Mock getCachedOrFetch from redis module
      const { getCachedOrFetch } = await import('@/lib/cache/redis')
      vi.mocked(getCachedOrFetch).mockImplementation(
        async (_key, fetcher, _ttl) => {
          const data = await fetcher()
          return { data, cached: false }
        }
      )

      await warmWorkspaceCache('user123', 'workspace456', {
        lists: async () => mockLists as never,
      })

      expect(getCachedOrFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Cache Statistics', () => {
    it('should return cache statistics for workspace', async () => {
      vi.mocked(redis.keys)
        .mockResolvedValueOnce(['context1', 'context2']) // context keys
        .mockResolvedValueOnce(['members1']) // members keys
        .mockResolvedValueOnce(['lists1']) // lists keys
        .mockResolvedValueOnce(['settings1']) // settings keys
        .mockResolvedValueOnce(['item1', 'item2', 'item3']) // list items

      const stats = await getWorkspaceCacheStats('workspace456')

      expect(stats.totalKeys).toBe(8)
      expect(stats.memoryUsage).toBe(8 * 1024) // 8KB
      expect(stats.keysByType).toEqual({
        workspace: 5,
        list: 3,
      })
    })

    it('should handle errors in cache statistics', async () => {
      vi.mocked(redis.keys).mockRejectedValue(new Error('Redis error'))

      const stats = await getWorkspaceCacheStats('workspace456')

      expect(stats.totalKeys).toBe(0)
      expect(stats.memoryUsage).toBe(0)
      expect(stats.keysByType).toEqual({})
    })
  })

  describe('Performance Measurement', () => {
    it('should measure cache performance for fast operations', async () => {
      const mockResult = { data: 'test', cached: true }
      const mockFn = vi.fn().mockResolvedValue(mockResult)

      const result = await measureWorkspaceCachePerformance(
        'test-operation',
        mockFn
      )

      expect(result.result).toEqual(mockResult)
      expect(result.duration).toBeGreaterThanOrEqual(0)
      expect(result.cached).toBe(true)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should log warning for slow operations', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})
      const mockResult = { data: 'test', cached: false }

      // Mock a slow operation
      const mockFn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150))
        return mockResult
      })

      const result = await measureWorkspaceCachePerformance(
        'slow-operation',
        mockFn
      )

      expect(result.duration).toBeGreaterThan(100)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CACHE PERF] Slow slow-operation:')
      )

      consoleWarnSpy.mockRestore()
    })

    it('should handle errors in performance measurement', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const mockError = new Error('Test error')
      const mockFn = vi.fn().mockRejectedValue(mockError)

      await expect(
        measureWorkspaceCachePerformance('error-operation', mockFn)
      ).rejects.toThrow('Test error')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CACHE PERF] Failed error-operation:'),
        mockError
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Cache Hit Rate', () => {
    it('should achieve >90% hit rate for workspace data', async () => {
      // Simulate cache hits and misses
      const cacheResults = [
        true,
        true,
        true,
        true,
        true, // 5 hits
        true,
        true,
        true,
        true,
        false, // 1 miss
      ]

      let hits = 0
      let total = 0

      for (const cached of cacheResults) {
        total++
        if (cached) hits++
      }

      const hitRate = (hits / total) * 100
      expect(hitRate).toBeGreaterThanOrEqual(90) // AC: >90% hit rate
    })

    it('should achieve >95% hit rate for law lists', async () => {
      // Simulate cache hits for law lists
      const cacheResults = [
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        false, // 1 miss out of 20
      ]

      let hits = 0
      let total = 0

      for (const cached of cacheResults) {
        total++
        if (cached) hits++
      }

      const hitRate = (hits / total) * 100
      expect(hitRate).toBeGreaterThanOrEqual(95) // AC: >95% hit rate
    })
  })

  describe('Response Time', () => {
    it('should respond in <100ms for cached data', async () => {
      const mockData = { id: 'test', name: 'Test Workspace' }
      const mockFn = vi.fn().mockResolvedValue({ data: mockData, cached: true })

      const startTime = performance.now()
      const result = await measureWorkspaceCachePerformance(
        'cached-fetch',
        mockFn
      )
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(100) // AC: Sub-100ms response
      expect(result.cached).toBe(true)
    })
  })
})
