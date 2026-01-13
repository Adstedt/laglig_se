/**
 * PROPER Redis initialization for Next.js
 * This is the best practice approach
 */

import { Redis } from '@upstash/redis'

// Best practice: Create the client once, handle missing env gracefully
function createRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.warn('⚠️ Redis not configured - caching disabled')
    return null
  }
  
  return new Redis({ url, token })
}

// Singleton instance - created once per server instance
export const redis = createRedisClient()

// Simple boolean check
export const isRedisConfigured = redis !== null

/**
 * Cache helper that gracefully handles missing Redis
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 3600
): Promise<{ data: T; cached: boolean }> {
  // If Redis not available, just fetch
  if (!redis) {
    const data = await fetcher()
    return { data, cached: false }
  }
  
  try {
    const cached = await redis.get(key)
    if (cached) {
      return { 
        data: typeof cached === 'string' ? JSON.parse(cached) : cached as T, 
        cached: true 
      }
    }
  } catch (error) {
    console.warn('Redis read error:', error)
  }
  
  // Fetch and cache
  const data = await fetcher()
  
  try {
    await redis.set(key, JSON.stringify(data), { ex: ttl })
  } catch (error) {
    console.warn('Redis write error:', error)
  }
  
  return { data, cached: false }
}