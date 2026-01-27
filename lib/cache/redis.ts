/**
 * Redis Cache Module (Story 2.19)
 *
 * Provides a Redis client with graceful fallback for caching.
 * When Redis is unavailable, falls back to a no-op client that
 * returns null/empty for reads and succeeds silently for writes.
 *
 * This ensures the application continues to function (with database
 * queries) even if Redis is unavailable.
 */

import { Redis } from '@upstash/redis'

// Create a no-op Redis client for development/testing when Redis is not configured
// This implements AC: 33-34 - graceful fallback when Redis unavailable
const noopRedis = {
  get: async () => null,
  set: async () => 'OK',
  del: async () => 0,
  incr: async () => 1,
  expire: async () => 1,
  keys: async () => [],
  mget: async () => [],
  ttl: async () => -1,
  type: async () => 'none',
  pipeline: () => ({
    get: () => noopRedis,
    set: () => noopRedis,
    exec: async () => [],
  }),
} as unknown as Redis

// Lazy initialization to ensure env vars are loaded
let _redis: Redis | null = null
let _isConfigured: boolean | null = null

function initRedis(forceReinit = false): Redis {
  if (_redis === null || forceReinit) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (redisUrl && redisToken) {
      _redis = new Redis({
        url: redisUrl,
        token: redisToken,
      })
      _isConfigured = true
    } else {
      _redis = noopRedis
      _isConfigured = false
    }
  }
  return _redis
}

// Force reinitialization (useful for tests)
export function reinitializeRedis(): void {
  _redis = null
  _isConfigured = null
  initRedis(true)
}

// Export a proxy that lazy-initializes on first use
export const redis = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    const client = initRedis()
    return Reflect.get(client, prop, receiver)
  },
})

// Check if Redis is properly configured (lazy evaluation)
export const isRedisConfigured = () => {
  if (_isConfigured === null) {
    initRedis()
  }
  return _isConfigured!
}

// Cache metrics counters (for monitoring hit rates - AC: 19)
let cacheHits = 0
let cacheMisses = 0

/**
 * Get cache metrics for monitoring
 * Used by performance validation and logging
 */
export function getCacheMetrics() {
  const total = cacheHits + cacheMisses
  const hitRate = total > 0 ? (cacheHits / total) * 100 : 0
  return {
    hits: cacheHits,
    misses: cacheMisses,
    total,
    hitRate: hitRate.toFixed(2) + '%',
  }
}

/**
 * Reset cache metrics (useful for testing)
 */
export function resetCacheMetrics() {
  cacheHits = 0
  cacheMisses = 0
}

/**
 * Generic cache-through function with metrics
 * Attempts to get from cache, falls back to fetcher, stores result
 *
 * @param key - Redis cache key
 * @param fetcher - Function to call on cache miss
 * @param ttl - Time to live in seconds (default: 1 hour)
 * @returns Promise with data and cache status
 *
 * Implements AC: 19 (cache metrics logging)
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 3600
): Promise<{ data: T; cached: boolean }> {
  // Skip cache if Redis is not configured
  if (!isRedisConfigured()) {
    const data = await fetcher()
    return { data, cached: false }
  }

  try {
    // Try to get from cache
    const cached = await redis.get(key)
    if (cached !== null) {
      cacheHits++

      // Refresh TTL for frequently accessed items (sliding window)
      // Only for document content, not for frequently changing data
      if (key.startsWith('document:content:')) {
        await redis.expire(key, ttl).catch(() => {
          // Ignore expire errors - not critical
        })
      }

      // Parse the JSON string back to object
      const parsedData =
        typeof cached === 'string' ? JSON.parse(cached) : cached
      return { data: parsedData as T, cached: true }
    }

    cacheMisses++
  } catch (error) {
    // Redis read error - log but continue to fetcher
    console.warn(`[CACHE ERROR] Failed to read ${key}:`, error)
    cacheMisses++
  }

  // Cache miss or error - fetch data
  const data = await fetcher()

  // Try to store in cache (async, don't block)
  try {
    // Stringify the data before storing (Redis expects strings)
    await redis.set(key, JSON.stringify(data), { ex: ttl })
  } catch (error) {
    // Redis write error - log but don't fail (AC: 34)
    console.warn(`[CACHE ERROR] Failed to write ${key}:`, error)
  }

  return { data, cached: false }
}

/**
 * Invalidate cache entries by pattern
 * Used by sync jobs to clear stale data
 *
 * @param pattern - Key pattern to match (e.g., "browse:*")
 */
export async function invalidateCachePattern(pattern: string): Promise<number> {
  if (!isRedisConfigured()) {
    return 0
  }

  try {
    const keys = await redis.keys(pattern)
    if (keys.length === 0) {
      return 0
    }

    await Promise.all(keys.map((key) => redis.del(key)))
    return keys.length
  } catch (error) {
    console.warn(`[CACHE ERROR] Failed to invalidate ${pattern}:`, error)
    return 0
  }
}

/**
 * Invalidate a specific cache key
 *
 * @param key - Exact cache key to delete
 */
export async function invalidateCacheKey(key: string): Promise<boolean> {
  if (!isRedisConfigured()) {
    return true
  }

  try {
    await redis.del(key)
    return true
  } catch (error) {
    console.warn(`[CACHE ERROR] Failed to invalidate ${key}:`, error)
    return false
  }
}

/**
 * Set a value in cache with TTL
 * Story P.2: Added for server-side caching layer
 */
export async function setCacheValue<T>(
  key: string,
  value: T,
  ttl: number = 3600
): Promise<boolean> {
  if (!isRedisConfigured()) {
    return false
  }

  try {
    await redis.set(key, JSON.stringify(value), { ex: ttl })
    return true
  } catch (error) {
    console.warn(`[CACHE ERROR] Failed to set ${key}:`, error)
    return false
  }
}

/**
 * Get a value from cache
 * Story P.2: Added for server-side caching layer
 */
export async function getCacheValue<T>(key: string): Promise<T | null> {
  if (!isRedisConfigured()) {
    return null
  }

  try {
    const cached = await redis.get(key)
    if (cached !== null) {
      return typeof cached === 'string'
        ? (JSON.parse(cached) as T)
        : (cached as T)
    }
    return null
  } catch (error) {
    console.warn(`[CACHE ERROR] Failed to get ${key}:`, error)
    return null
  }
}

/**
 * Check if a key exists in cache
 * Story P.2: Added for server-side caching layer
 */
export async function cacheExists(key: string): Promise<boolean> {
  if (!isRedisConfigured()) {
    return false
  }

  try {
    const type = await redis.type(key)
    return type !== 'none'
  } catch (error) {
    console.warn(`[CACHE ERROR] Failed to check ${key}:`, error)
    return false
  }
}
