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

// Initialize Redis client from environment variables
// Falls back to a no-op client if not configured (for development)
const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

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
  pipeline: () => ({
    get: () => noopRedis,
    set: () => noopRedis,
    exec: async () => [],
  }),
} as unknown as Redis

export const redis: Redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : noopRedis

// Check if Redis is properly configured
export const isRedisConfigured = Boolean(redisUrl && redisToken)

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
  if (!isRedisConfigured) {
    const data = await fetcher()
    return { data, cached: false }
  }

  try {
    // Try to get from cache
    const cached = await redis.get(key)
    if (cached !== null) {
      cacheHits++
      console.log(`[CACHE HIT] ${key.substring(0, 60)}...`)
      return { data: cached as T, cached: true }
    }

    cacheMisses++
    console.log(`[CACHE MISS] ${key.substring(0, 60)}...`)
  } catch (error) {
    // Redis read error - log but continue to fetcher
    console.warn(`[CACHE ERROR] Failed to read ${key}:`, error)
    cacheMisses++
  }

  // Cache miss or error - fetch data
  const data = await fetcher()

  // Try to store in cache (async, don't block)
  try {
    await redis.set(key, data, { ex: ttl })
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
  if (!isRedisConfigured) {
    return 0
  }

  try {
    const keys = await redis.keys(pattern)
    if (keys.length === 0) {
      return 0
    }

    await Promise.all(keys.map((key) => redis.del(key)))
    console.log(`[CACHE INVALIDATE] Cleared ${keys.length} keys matching ${pattern}`)
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
  if (!isRedisConfigured) {
    return true
  }

  try {
    await redis.del(key)
    console.log(`[CACHE INVALIDATE] Cleared key: ${key}`)
    return true
  } catch (error) {
    console.warn(`[CACHE ERROR] Failed to invalidate ${key}:`, error)
    return false
  }
}
