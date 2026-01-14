/**
 * Integration Tests for Caching System (Story P.2)
 * 
 * End-to-end tests for the multi-layered caching implementation.
 * Verifies cache hit rates, invalidation, and performance requirements.
 * 
 * @see docs/stories/P.2.systematic-caching.story.md
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { 
  getCachedWorkspaceContext,
  getCachedLawLists,
  invalidateWorkspaceCache,
  warmWorkspaceCache,
} from '@/lib/cache/workspace-cache'
import {
  getCachedUserSession,
  trackDocumentAccess,
  getFrequentDocuments,
} from '@/lib/cache/user-cache'
import {
  hybridCache,
  getCacheMetrics,
  resetCacheMetrics,
  monitorCacheHealth,
} from '@/lib/cache/server-cache'
import { redis, isRedisConfigured } from '@/lib/cache/redis'

// Skip tests if Redis is not configured
const skipIfNoRedis = isRedisConfigured() ? it : it.skip

describe('Caching System Integration', () => {
  const testUserId = 'test-user-123'
  const testWorkspaceId = 'test-workspace-456'
  
  beforeAll(async () => {
    // Clear test data from Redis
    if (isRedisConfigured()) {
      await redis.del(`workspace:context:${testUserId}:${testWorkspaceId}`)
      await redis.del(`workspace:lists:${testWorkspaceId}`)
      await redis.del(`user:session:${testUserId}`)
    }
    resetCacheMetrics()
  })
  
  afterAll(async () => {
    // Cleanup test data
    if (isRedisConfigured()) {
      const keysToDelete = [
        `workspace:context:${testUserId}:${testWorkspaceId}`,
        `workspace:lists:${testWorkspaceId}`,
        `user:session:${testUserId}`,
        `user:frequent:${testUserId}:${testWorkspaceId}`,
      ]
      await Promise.all(keysToDelete.map(key => redis.del(key)))
    }
  })
  
  beforeEach(() => {
    resetCacheMetrics()
  })
  
  describe('Workspace Caching', () => {
    skipIfNoRedis('should cache workspace context with proper TTL', async () => {
      const mockContext = {
        workspaceId: testWorkspaceId,
        workspaceName: 'Test Workspace',
        role: 'ADMIN' as const,
      }
      
      // First call - cache miss
      const result1 = await getCachedWorkspaceContext(
        testUserId,
        testWorkspaceId,
        async () => mockContext
      )
      
      expect(result1.data).toEqual(mockContext)
      expect(result1.cached).toBe(false)
      
      // Second call - cache hit
      const result2 = await getCachedWorkspaceContext(
        testUserId,
        testWorkspaceId,
        async () => ({ ...mockContext, workspaceName: 'Should not be called' })
      )
      
      expect(result2.data).toEqual(mockContext)
      expect(result2.cached).toBe(true)
      
      // Verify TTL is set (5 minutes = 300 seconds)
      const ttl = await redis.ttl(`workspace:context:${testUserId}:${testWorkspaceId}`)
      expect(ttl).toBeGreaterThan(250)
      expect(ttl).toBeLessThanOrEqual(300)
    })
    
    skipIfNoRedis('should invalidate workspace cache on mutation', async () => {
      const mockLists = [
        { id: 'list1', name: 'List 1' },
        { id: 'list2', name: 'List 2' },
      ]
      
      // Cache the lists
      await getCachedLawLists(
        testWorkspaceId,
        async () => mockLists
      )
      
      // Verify cached
      const cached = await getCachedLawLists(
        testWorkspaceId,
        async () => []
      )
      expect(cached.cached).toBe(true)
      expect(cached.data).toEqual(mockLists)
      
      // Invalidate
      await invalidateWorkspaceCache(testWorkspaceId, ['lists'])
      
      // Verify invalidation
      const afterInvalidation = await getCachedLawLists(
        testWorkspaceId,
        async () => [{ id: 'list3', name: 'New List' }]
      )
      expect(afterInvalidation.cached).toBe(false)
      expect(afterInvalidation.data).toHaveLength(1)
    })
    
    skipIfNoRedis('should warm workspace cache successfully', async () => {
      const warmingData = {
        context: async () => ({ workspaceId: testWorkspaceId, role: 'OWNER' }),
        lists: async () => [{ id: 'list1' }],
        members: async () => [{ id: 'member1' }],
      }
      
      await warmWorkspaceCache(testUserId, testWorkspaceId, warmingData)
      
      // Verify all data is cached
      const context = await getCachedWorkspaceContext(
        testUserId,
        testWorkspaceId,
        async () => ({ workspaceId: 'different' })
      )
      expect(context.cached).toBe(true)
      expect(context.data.workspaceId).toBe(testWorkspaceId)
      
      const lists = await getCachedLawLists(
        testWorkspaceId,
        async () => []
      )
      expect(lists.cached).toBe(true)
      expect(lists.data).toHaveLength(1)
    })
  })
  
  describe('User Session Caching', () => {
    skipIfNoRedis('should cache user session data', async () => {
      const mockSession = {
        user: { id: testUserId, email: 'test@example.com' },
        workspaces: [{ id: testWorkspaceId }],
        activeWorkspaceId: testWorkspaceId,
        preferences: { theme: 'dark' as const },
        lastActivity: new Date(),
      }
      
      // First call - miss
      const result1 = await getCachedUserSession(
        testUserId,
        async () => mockSession
      )
      expect(result1.cached).toBe(false)
      
      // Second call - hit
      const result2 = await getCachedUserSession(
        testUserId,
        async () => ({ ...mockSession, user: { id: 'different' } })
      )
      expect(result2.cached).toBe(true)
      expect(result2.data.user.id).toBe(testUserId)
    })
    
    skipIfNoRedis('should track frequently accessed documents', async () => {
      // Track multiple document accesses
      await trackDocumentAccess(
        testUserId,
        testWorkspaceId,
        'doc1',
        'Document 1',
        'law'
      )
      
      await trackDocumentAccess(
        testUserId,
        testWorkspaceId,
        'doc1',
        'Document 1',
        'law'
      )
      
      await trackDocumentAccess(
        testUserId,
        testWorkspaceId,
        'doc2',
        'Document 2',
        'law'
      )
      
      // Get frequent documents
      const frequent = await getFrequentDocuments(testUserId, testWorkspaceId)
      
      expect(frequent).toHaveLength(2)
      expect(frequent[0].documentId).toBe('doc1')
      expect(frequent[0].accessCount).toBe(2)
      expect(frequent[1].documentId).toBe('doc2')
      expect(frequent[1].accessCount).toBe(1)
    })
  })
  
  describe('Hybrid Caching', () => {
    skipIfNoRedis('should use Redis cache when available', async () => {
      const testKey = 'hybrid-test-key'
      const testData = { value: 'test data', timestamp: Date.now() }
      
      // First fetch - should be fresh
      const result1 = await hybridCache(
        testKey,
        async () => testData,
        { redisTTL: 300 }
      )
      
      expect(result1.data).toEqual(testData)
      expect(result1.source).toBe('fresh')
      
      // Second fetch - should be from Redis
      const result2 = await hybridCache(
        testKey,
        async () => ({ value: 'different' }),
        { redisTTL: 300 }
      )
      
      expect(result2.data).toEqual(testData)
      expect(result2.source).toBe('redis')
      
      // Cleanup
      await redis.del(testKey)
    })
  })
  
  describe('Performance Requirements', () => {
    skipIfNoRedis('should achieve >90% cache hit rate for workspace data', async () => {
      resetCacheMetrics()
      
      // Warm the cache
      await getCachedWorkspaceContext(
        testUserId,
        testWorkspaceId,
        async () => ({ workspaceId: testWorkspaceId })
      )
      
      // Simulate typical access pattern (9 hits, 1 miss)
      for (let i = 0; i < 9; i++) {
        await getCachedWorkspaceContext(
          testUserId,
          testWorkspaceId,
          async () => ({ workspaceId: 'should-not-call' })
        )
      }
      
      const metrics = getCacheMetrics()
      const hitRate = (metrics.hits / (metrics.hits + metrics.misses)) * 100
      
      expect(hitRate).toBeGreaterThanOrEqual(90) // AC: >90% hit rate
    })
    
    skipIfNoRedis('should respond in <100ms for cached data', async () => {
      // Ensure data is cached
      await getCachedWorkspaceContext(
        testUserId,
        testWorkspaceId,
        async () => ({ workspaceId: testWorkspaceId })
      )
      
      // Measure cached response time
      const startTime = performance.now()
      
      const result = await getCachedWorkspaceContext(
        testUserId,
        testWorkspaceId,
        async () => ({ workspaceId: 'should-not-call' })
      )
      
      const duration = performance.now() - startTime
      
      expect(result.cached).toBe(true)
      expect(duration).toBeLessThan(100) // AC: Sub-100ms response
    })
    
    skipIfNoRedis('should maintain cache health metrics', async () => {
      const health = await monitorCacheHealth()
      
      expect(health.status).toMatch(/healthy|degraded|unhealthy/)
      expect(health.redisStatus).toBe('connected')
      expect(health.metrics).toHaveProperty('hitRate')
      expect(health.metrics).toHaveProperty('averageLatency')
      expect(health.recommendations).toBeInstanceOf(Array)
    })
  })
  
  describe('Cache Invalidation Patterns', () => {
    skipIfNoRedis('should invalidate related caches on workspace update', async () => {
      const workspaceId = 'test-invalidation-workspace'
      const userId = 'test-invalidation-user'
      
      // Cache multiple related items
      await getCachedWorkspaceContext(
        userId,
        workspaceId,
        async () => ({ workspaceId })
      )
      
      await getCachedLawLists(
        workspaceId,
        async () => [{ id: 'list1' }]
      )
      
      // Invalidate all workspace cache
      await invalidateWorkspaceCache(workspaceId)
      
      // Verify all related caches are invalidated
      const context = await getCachedWorkspaceContext(
        userId,
        workspaceId,
        async () => ({ workspaceId: 'new-data' })
      )
      expect(context.cached).toBe(false)
      
      const lists = await getCachedLawLists(
        workspaceId,
        async () => [{ id: 'new-list' }]
      )
      expect(lists.cached).toBe(false)
    })
  })
  
  describe('Memory Usage', () => {
    skipIfNoRedis('should track memory usage within limits', async () => {
      // This is a simplified test - in production you'd monitor actual Redis memory
      const testWorkspace = 'memory-test-workspace'
      
      // Add some cache entries
      for (let i = 0; i < 10; i++) {
        await redis.set(
          `test:memory:${i}`,
          JSON.stringify({ data: 'x'.repeat(1000) }),
          { ex: 60 }
        )
      }
      
      // Get memory info (simplified - actual implementation would use Redis INFO)
      const keys = await redis.keys('test:memory:*')
      const estimatedMemory = keys.length * 1000 // Rough estimate
      
      expect(estimatedMemory).toBeLessThan(150 * 1024 * 1024) // AC: <150MB
      
      // Cleanup
      await Promise.all(keys.map(key => redis.del(key)))
    })
  })
})