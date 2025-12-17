/**
 * Caching Layer for Historical Law Versions
 *
 * Story 2.13 Phase 3: Provides caching for reconstructed law versions
 * - Two-tier cache: L1 in-memory (per-instance) + L2 Redis (shared)
 * - L1 provides fast access for hot items within a serverless instance
 * - L2 Redis provides cross-user/cross-instance cache sharing
 * - Cache invalidation on amendment sync
 */

import {
  getLawVersionAtDate,
  LawVersionResult,
  getLawAmendmentTimeline,
  AmendmentTimelineEntry,
} from './version-reconstruction'
import { compareLawVersions, LawVersionDiff } from './version-diff'
import { redis, isRedisConfigured } from '../cache/redis'

// ============================================================================
// Types
// ============================================================================

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

interface CacheStats {
  hits: number
  misses: number
  size: number
}

interface TwoTierStats {
  l1Hits: number
  l2Hits: number
  misses: number
}

// ============================================================================
// In-Memory LRU Cache (L1 - per instance, fast)
// ============================================================================

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>
  private maxSize: number
  private defaultTTL: number
  private stats: CacheStats

  constructor(maxSize: number = 1000, defaultTTLSeconds: number = 86400) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.defaultTTL = defaultTTLSeconds * 1000 // Convert to ms
    this.stats = { hits: 0, misses: 0, size: 0 }
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.stats.size--
      this.stats.misses++
      return null
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    this.stats.hits++
    return entry.data
  }

  set(key: string, data: T, ttlSeconds?: number): void {
    // Remove oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
        this.stats.size--
      }
    }

    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    })
    this.stats.size = this.cache.size
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) this.stats.size--
    return deleted
  }

  /**
   * Delete all entries matching a pattern (e.g., all versions of a law)
   */
  deletePattern(pattern: string): number {
    let deleted = 0
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
        deleted++
      }
    }
    this.stats.size = this.cache.size
    return deleted
  }

  clear(): void {
    this.cache.clear()
    this.stats.size = 0
  }

  getStats(): CacheStats {
    return { ...this.stats }
  }
}

// ============================================================================
// Cache Instances
// ============================================================================

// L1 In-memory caches (smaller, faster, per-instance)
const versionCacheL1 = new LRUCache<LawVersionResult>(100, 300) // 100 entries, 5min TTL
const diffCacheL1 = new LRUCache<LawVersionDiff>(50, 300) // 50 entries, 5min TTL
const timelineCacheL1 = new LRUCache<AmendmentTimelineEntry[]>(50, 300) // 50 entries, 5min TTL

// L2 Redis TTLs (longer, shared across instances)
const REDIS_VERSION_TTL = 86400 // 24 hours
const REDIS_DIFF_TTL = 3600 // 1 hour
const REDIS_TIMELINE_TTL = 86400 // 24 hours

// Stats tracking - using Record type to ensure all keys exist
const twoTierStats: Record<'version' | 'diff' | 'timeline', TwoTierStats> = {
  version: { l1Hits: 0, l2Hits: 0, misses: 0 },
  diff: { l1Hits: 0, l2Hits: 0, misses: 0 },
  timeline: { l1Hits: 0, l2Hits: 0, misses: 0 },
}

// ============================================================================
// Cache Key Generators
// ============================================================================

function versionCacheKey(sfs: string, date: Date): string {
  const normalizedSfs = sfs.replace(/^SFS\s*/i, '')
  const dateStr = date.toISOString().slice(0, 10)
  return `law-version:${normalizedSfs}:${dateStr}`
}

function diffCacheKey(sfs: string, dateA: Date, dateB: Date): string {
  const normalizedSfs = sfs.replace(/^SFS\s*/i, '')
  const dateAStr = dateA.toISOString().slice(0, 10)
  const dateBStr = dateB.toISOString().slice(0, 10)
  return `law-diff:${normalizedSfs}:${dateAStr}:${dateBStr}`
}

function timelineCacheKey(sfs: string): string {
  const normalizedSfs = sfs.replace(/^SFS\s*/i, '')
  return `law-timeline:${normalizedSfs}`
}

// ============================================================================
// Two-Tier Cache Helper
// ============================================================================

async function getTwoTierCache<T>(
  key: string,
  l1Cache: LRUCache<T>,
  redisTtl: number,
  fetcher: () => Promise<T | null>,
  statsKey: 'version' | 'diff' | 'timeline'
): Promise<T | null> {
  const stats = twoTierStats[statsKey]

  // L1: Check in-memory cache first (fastest)
  const l1Result = l1Cache.get(key)
  if (l1Result !== null) {
    stats.l1Hits++
    return l1Result
  }

  // L2: Check Redis (shared across instances)
  if (isRedisConfigured) {
    try {
      const l2Result = await redis.get<T>(key)
      if (l2Result !== null) {
        stats.l2Hits++
        // Populate L1 for future requests in this instance
        l1Cache.set(key, l2Result, 300) // 5 min L1 TTL
        return l2Result
      }
    } catch (error) {
      // Redis error - continue to fetcher
      console.warn(`[CACHE] Redis read error for ${key}:`, error)
    }
  }

  // Cache miss - fetch from database
  stats.misses++
  const result = await fetcher()

  if (result !== null) {
    // Populate both L1 and L2
    l1Cache.set(key, result, 300) // 5 min L1 TTL

    if (isRedisConfigured) {
      // Write to Redis async (don't block)
      redis.set(key, result, { ex: redisTtl }).catch((error) => {
        console.warn(`[CACHE] Redis write error for ${key}:`, error)
      })
    }
  }

  return result
}

// ============================================================================
// Cached Functions
// ============================================================================

/**
 * Get a law version at a specific date (with two-tier caching)
 */
export async function getCachedLawVersion(
  baseLawSfs: string,
  date: Date
): Promise<LawVersionResult | null> {
  const key = versionCacheKey(baseLawSfs, date)

  return getTwoTierCache(
    key,
    versionCacheL1,
    REDIS_VERSION_TTL,
    () => getLawVersionAtDate(baseLawSfs, date),
    'version'
  )
}

/**
 * Get a diff between two law versions (with two-tier caching)
 */
export async function getCachedLawDiff(
  baseLawSfs: string,
  dateA: Date,
  dateB: Date
): Promise<LawVersionDiff | null> {
  // Ensure consistent key ordering
  const [older, newer] = dateA < dateB ? [dateA, dateB] : [dateB, dateA]
  const key = diffCacheKey(baseLawSfs, older, newer)

  return getTwoTierCache(
    key,
    diffCacheL1,
    REDIS_DIFF_TTL,
    () => compareLawVersions(baseLawSfs, older, newer),
    'diff'
  )
}

/**
 * Get amendment timeline for a law (with two-tier caching)
 * Returns list of all amendments with their metadata
 */
export async function getCachedAmendmentTimeline(
  baseLawSfs: string
): Promise<AmendmentTimelineEntry[]> {
  const key = timelineCacheKey(baseLawSfs)

  const result = await getTwoTierCache(
    key,
    timelineCacheL1,
    REDIS_TIMELINE_TTL,
    async () => {
      const timeline = await getLawAmendmentTimeline(baseLawSfs)
      return timeline // Always return array (even empty)
    },
    'timeline'
  )

  return result ?? []
}

// ============================================================================
// Cache Invalidation
// ============================================================================

/**
 * Invalidate all cached versions for a specific law
 * Call this when a new amendment is synced
 *
 * @returns Object with counts of invalidated entries
 */
export async function invalidateLawCache(baseLawSfs: string): Promise<{
  l1Deleted: number
  l2Deleted: number
}> {
  const normalizedSfs = baseLawSfs.replace(/^SFS\s*/i, '')

  // Invalidate L1 (in-memory)
  const l1Versions = versionCacheL1.deletePattern(normalizedSfs)
  const l1Diffs = diffCacheL1.deletePattern(normalizedSfs)
  const l1Timelines = timelineCacheL1.deletePattern(normalizedSfs)
  const l1Deleted = l1Versions + l1Diffs + l1Timelines

  // Invalidate L2 (Redis)
  let l2Deleted = 0
  if (isRedisConfigured) {
    try {
      // Find and delete all keys matching this law
      const patterns = [
        `law-version:${normalizedSfs}:*`,
        `law-diff:${normalizedSfs}:*`,
        `law-timeline:${normalizedSfs}`,
      ]

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await Promise.all(keys.map((key) => redis.del(key)))
          l2Deleted += keys.length
        }
      }
    } catch (error) {
      console.warn(
        `[CACHE] Redis invalidation error for ${normalizedSfs}:`,
        error
      )
    }
  }

  return { l1Deleted, l2Deleted }
}

/**
 * Invalidate all cached data
 * Call this on deployment or major data updates
 */
export async function invalidateAllCaches(): Promise<void> {
  // Clear L1
  versionCacheL1.clear()
  diffCacheL1.clear()
  timelineCacheL1.clear()

  // Clear L2 Redis
  if (isRedisConfigured) {
    try {
      const patterns = ['law-version:*', 'law-diff:*', 'law-timeline:*']
      for (const pattern of patterns) {
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await Promise.all(keys.map((key) => redis.del(key)))
        }
      }
    } catch (error) {
      console.warn('[CACHE] Redis clear error:', error)
    }
  }
}

// ============================================================================
// Cache Stats & Monitoring
// ============================================================================

export function getCacheStats(): {
  version: TwoTierStats
  diff: TwoTierStats
  timeline: TwoTierStats
  l1HitRate: number
  l2HitRate: number
  overallHitRate: number
  redisConfigured: boolean
} {
  const version = twoTierStats.version
  const diff = twoTierStats.diff
  const timeline = twoTierStats.timeline

  const totalL1Hits = version.l1Hits + diff.l1Hits + timeline.l1Hits
  const totalL2Hits = version.l2Hits + diff.l2Hits + timeline.l2Hits
  const totalMisses = version.misses + diff.misses + timeline.misses
  const totalRequests = totalL1Hits + totalL2Hits + totalMisses

  const l1HitRate = totalRequests > 0 ? totalL1Hits / totalRequests : 0
  const l2HitRate = totalRequests > 0 ? totalL2Hits / totalRequests : 0
  const overallHitRate =
    totalRequests > 0 ? (totalL1Hits + totalL2Hits) / totalRequests : 0

  return {
    version,
    diff,
    timeline,
    l1HitRate,
    l2HitRate,
    overallHitRate,
    redisConfigured: isRedisConfigured,
  }
}

// ============================================================================
// Pre-warming (for popular laws)
// ============================================================================

/**
 * Pre-warm cache for a list of popular laws
 * Call this on server startup or via cron job
 */
export async function prewarmCache(
  popularLaws: Array<{ sfs: string; dates: Date[] }>
): Promise<{ warmed: number; failed: number }> {
  let warmed = 0
  let failed = 0

  for (const law of popularLaws) {
    for (const date of law.dates) {
      try {
        await getCachedLawVersion(law.sfs, date)
        warmed++
      } catch {
        failed++
      }
    }
  }

  return { warmed, failed }
}

/**
 * Get popular law SFS numbers from analytics (placeholder)
 * In production, this would query your analytics system
 */
export async function getPopularLaws(limit: number = 100): Promise<string[]> {
  // Placeholder - return well-known popular laws
  // In production, query analytics for most-viewed laws
  return [
    'SFS 1942:740', // Rättegångsbalken
    'SFS 1962:700', // Brottsbalken
    'SFS 1949:381', // Föräldrabalken
    'SFS 1972:207', // Skadeståndslag
    'SFS 1977:1160', // Arbetsmiljölagen
    'SFS 1982:80', // Anställningsskyddslagen
    'SFS 1987:10', // Plan- och bygglagen
    'SFS 1998:808', // Miljöbalken
    'SFS 1999:1229', // Inkomstskattelagen
    'SFS 2010:110', // Socialförsäkringsbalken
    'SFS 2017:30', // Hälso- och sjukvårdslag
    'SFS 2008:355', // Patientdatalagen
  ].slice(0, limit)
}
