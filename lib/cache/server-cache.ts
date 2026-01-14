/**
 * Server-Side Caching Layer (Story P.2)
 * 
 * Implements Next.js cache configuration and utilities for server functions.
 * Provides cache tag system for grouped invalidation and monitoring.
 * 
 * @see docs/stories/P.2.systematic-caching.story.md
 */

import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { redis, isRedisConfigured, getCachedOrFetch } from './redis'

/**
 * Cache tag generators for grouped invalidation
 * Used with Next.js revalidateTag
 */
export const SERVER_CACHE_TAGS = {
  WORKSPACE: (id: string) => `workspace-${id}`,
  USER: (id: string) => `user-${id}`,
  DOCUMENT: (id: string) => `document-${id}`,
  LAW_LIST: (id: string) => `list-${id}`,
  LAW: (id: string) => `law-${id}`,
  BROWSE: 'browse-pages',
  SEARCH: 'search-results',
}

/**
 * Cache revalidation times in seconds
 * Aligned with business requirements for data freshness
 */
export const REVALIDATION_TIMES = {
  STATIC_CONTENT: 86400,    // 24 hours - laws, static pages
  WORKSPACE_DATA: 300,       // 5 minutes - workspace context
  USER_DATA: 1800,          // 30 minutes - user preferences
  SEARCH_RESULTS: 600,      // 10 minutes - search results
  BROWSE_PAGES: 3600,       // 1 hour - browse pages
  REALTIME: 0,              // No cache - real-time data
}

/**
 * Create a cached server function with automatic tags
 * Wrapper around Next.js unstable_cache with better DX
 */
export function createCachedServerFunction<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    name: string
    tags?: string[] | ((...args: TArgs) => string[])
    revalidate?: number
    keyParts?: ((...args: TArgs) => string[])
  }
): (...args: TArgs) => Promise<TResult> {
  // For now, just return the function with performance logging
  // unstable_cache doesn't support dynamic keys in the current Next.js version
  return async (...args: TArgs) => {
    const startTime = performance.now()
    try {
      const result = await fn(...args)
      const duration = performance.now() - startTime
      
      // Log slow operations
      if (duration > 100) {
        console.warn(`[SERVER CACHE] Slow operation ${options.name}: ${duration.toFixed(2)}ms`)
      }
      
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      console.error(`[SERVER CACHE] Failed ${options.name}: ${duration.toFixed(2)}ms`, error)
      throw error
    }
  }
}

/**
 * Request-level cache wrapper using React cache()
 * Deduplicates calls within the same request
 */
export function createRequestCache<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return cache(fn)
}

/**
 * Hybrid cache that uses both Redis and Next.js cache
 * Provides multi-layer caching for optimal performance
 */
export async function hybridCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    redisTTL?: number
    nextTags?: string[]
    nextRevalidate?: number
  } = {}
): Promise<{ data: T; source: 'redis' | 'next-cache' | 'fresh' }> {
  // Try Redis first (fastest)
  if (isRedisConfigured()) {
    try {
      const cached = await redis.get(key)
      if (cached) {
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached
        return { data: data as T, source: 'redis' }
      }
    } catch (error) {
      console.warn(`[HYBRID CACHE] Redis read failed for ${key}:`, error)
    }
  }

  // Fall back to Next.js cache (if tags provided)
  if (options.nextTags && options.nextTags.length > 0) {
    const cachedFn = unstable_cache(
      fetcher,
      [key],
      {
        revalidate: options.nextRevalidate ?? REVALIDATION_TIMES.WORKSPACE_DATA,
        tags: options.nextTags,
      }
    )
    
    const data = await cachedFn()
    
    // Also store in Redis for next time
    if (isRedisConfigured() && options.redisTTL) {
      try {
        await redis.set(key, JSON.stringify(data), { ex: options.redisTTL })
      } catch (error) {
        console.warn(`[HYBRID CACHE] Redis write failed for ${key}:`, error)
      }
    }
    
    return { data, source: 'next-cache' }
  }

  // Fresh fetch
  const data = await fetcher()
  
  // Store in Redis if available
  if (isRedisConfigured() && options.redisTTL) {
    try {
      await redis.set(key, JSON.stringify(data), { ex: options.redisTTL })
    } catch (error) {
      console.warn(`[HYBRID CACHE] Redis write failed for ${key}:`, error)
    }
  }
  
  return { data, source: 'fresh' }
}

/**
 * Cache metrics for monitoring
 */
interface CacheMetrics {
  hits: number
  misses: number
  errors: number
  slowQueries: number
  averageLatency: number
}

const metrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  errors: 0,
  slowQueries: 0,
  averageLatency: 0,
}

let totalLatency = 0
let totalQueries = 0

/**
 * Track cache operation metrics
 */
export function trackCacheOperation(
  hit: boolean,
  latency: number,
  error?: boolean
): void {
  if (error) {
    metrics.errors++
  } else if (hit) {
    metrics.hits++
  } else {
    metrics.misses++
  }
  
  if (latency > 100) {
    metrics.slowQueries++
  }
  
  totalLatency += latency
  totalQueries++
  metrics.averageLatency = totalLatency / totalQueries
}

/**
 * Get current cache metrics
 */
export function getCacheMetrics(): CacheMetrics & {
  hitRate: number
  totalQueries: number
} {
  const hitRate = totalQueries > 0 
    ? (metrics.hits / (metrics.hits + metrics.misses)) * 100 
    : 0
    
  return {
    ...metrics,
    hitRate,
    totalQueries,
  }
}

/**
 * Reset cache metrics (for testing)
 */
export function resetCacheMetrics(): void {
  metrics.hits = 0
  metrics.misses = 0
  metrics.errors = 0
  metrics.slowQueries = 0
  metrics.averageLatency = 0
  totalLatency = 0
  totalQueries = 0
}

/**
 * Cached database query wrapper
 * Automatically adds workspace isolation and caching
 */
export function createCachedQuery<TArgs extends any[], TResult>(
  queryFn: (...args: TArgs) => Promise<TResult>,
  options: {
    name: string
    ttl?: number
    tags?: string[] | ((...args: TArgs) => string[])
    cacheKey: (...args: TArgs) => string
  }
): (...args: TArgs) => Promise<{ data: TResult; cached: boolean }> {
  return async (...args: TArgs) => {
    const key = options.cacheKey(...args)
    const startTime = performance.now()
    
    try {
      const result = await getCachedOrFetch(
        key,
        () => queryFn(...args),
        options.ttl ?? REVALIDATION_TIMES.WORKSPACE_DATA
      )
      
      const latency = performance.now() - startTime
      trackCacheOperation(result.cached, latency)
      
      return result
    } catch (error) {
      const latency = performance.now() - startTime
      trackCacheOperation(false, latency, true)
      throw error
    }
  }
}

/**
 * Batch cache operations for efficiency
 * Useful for warming multiple cache keys at once
 */
export async function batchCacheWarm<T extends Record<string, () => Promise<any>>>(
  operations: T
): Promise<{ 
  [K in keyof T]: Awaited<ReturnType<T[K]>> 
}> {
  const entries = Object.entries(operations)
  const results = await Promise.allSettled(
    entries.map(([_, fn]) => fn())
  )
  
  const output: any = {}
  entries.forEach(([key], index) => {
    const result = results[index]
    if (result && result.status === 'fulfilled') {
      output[key] = result.value
    } else if (result && result.status === 'rejected') {
      console.error(`[BATCH CACHE] Failed to warm ${key}:`, result.reason)
      output[key] = null
    }
  })
  
  return output
}

/**
 * Monitor cache health and performance
 */
export async function monitorCacheHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  metrics: ReturnType<typeof getCacheMetrics>
  redisStatus: 'connected' | 'disconnected'
  recommendations: string[]
}> {
  const metrics = getCacheMetrics()
  const redisStatus = isRedisConfigured() ? 'connected' : 'disconnected'
  const recommendations: string[] = []
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  
  // Check hit rate
  if (metrics.hitRate < 70) {
    status = 'degraded'
    recommendations.push('Cache hit rate is below 70%. Consider increasing TTL or warming cache.')
  }
  
  if (metrics.hitRate < 50) {
    status = 'unhealthy'
  }
  
  // Check error rate
  const errorRate = totalQueries > 0 ? (metrics.errors / totalQueries) * 100 : 0
  if (errorRate > 5) {
    status = 'degraded'
    recommendations.push('High error rate detected. Check Redis connection and server health.')
  }
  
  if (errorRate > 10) {
    status = 'unhealthy'
  }
  
  // Check latency
  if (metrics.averageLatency > 100) {
    if (status === 'healthy') status = 'degraded'
    recommendations.push('Average latency exceeds 100ms. Consider optimizing queries or increasing cache coverage.')
  }
  
  // Check Redis status
  if (redisStatus === 'disconnected') {
    if (status === 'healthy') status = 'degraded'
    recommendations.push('Redis is not configured. Consider enabling Redis for better performance.')
  }
  
  return {
    status,
    metrics,
    redisStatus,
    recommendations,
  }
}