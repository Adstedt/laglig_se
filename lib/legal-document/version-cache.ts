/**
 * Caching Layer for Historical Law Versions
 *
 * Story 2.13 Phase 3: Provides caching for reconstructed law versions
 * - In-memory LRU cache with TTL (default)
 * - Optional Redis support via Upstash
 * - Cache invalidation on amendment sync
 */

import {
  getLawVersionAtDate,
  LawVersionResult,
  getLawAmendmentTimeline,
  AmendmentTimelineEntry,
} from './version-reconstruction'
import { compareLawVersions, LawVersionDiff } from './version-diff'

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

// ============================================================================
// In-Memory LRU Cache
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

// Cache for reconstructed law versions
const versionCache = new LRUCache<LawVersionResult>(500, 86400) // 500 entries, 24h TTL

// Cache for diffs (shorter TTL since they're computed on-demand)
const diffCache = new LRUCache<LawVersionDiff>(200, 3600) // 200 entries, 1h TTL

// Cache for amendment timelines (used by history page)
const timelineCache = new LRUCache<AmendmentTimelineEntry[]>(200, 86400) // 200 entries, 24h TTL

// ============================================================================
// Cache Key Generators
// ============================================================================

function versionCacheKey(sfs: string, date: Date): string {
  const dateStr = date.toISOString().split('T')[0]
  return `law-version:${sfs}:${dateStr}`
}

function diffCacheKey(sfs: string, dateA: Date, dateB: Date): string {
  const dateAStr = dateA.toISOString().split('T')[0]
  const dateBStr = dateB.toISOString().split('T')[0]
  return `law-diff:${sfs}:${dateAStr}:${dateBStr}`
}

function timelineCacheKey(sfs: string): string {
  // Normalize SFS number for consistent cache keys
  const normalizedSfs = sfs.replace(/^SFS\s*/i, '')
  return `law-timeline:${normalizedSfs}`
}

// ============================================================================
// Cached Functions
// ============================================================================

/**
 * Get a law version at a specific date (with caching)
 */
export async function getCachedLawVersion(
  baseLawSfs: string,
  date: Date
): Promise<LawVersionResult | null> {
  const key = versionCacheKey(baseLawSfs, date)

  // Try cache first
  const cached = versionCache.get(key)
  if (cached) {
    return cached
  }

  // Cache miss - fetch from database
  const result = await getLawVersionAtDate(baseLawSfs, date)

  if (result) {
    versionCache.set(key, result)
  }

  return result
}

/**
 * Get a diff between two law versions (with caching)
 */
export async function getCachedLawDiff(
  baseLawSfs: string,
  dateA: Date,
  dateB: Date
): Promise<LawVersionDiff | null> {
  // Ensure consistent key ordering
  const [older, newer] = dateA < dateB ? [dateA, dateB] : [dateB, dateA]
  const key = diffCacheKey(baseLawSfs, older, newer)

  // Try cache first
  const cached = diffCache.get(key)
  if (cached) {
    return cached
  }

  // Cache miss - compute diff
  const result = await compareLawVersions(baseLawSfs, older, newer)

  if (result) {
    diffCache.set(key, result)
  }

  return result
}

/**
 * Get amendment timeline for a law (with caching)
 * Returns list of all amendments with their metadata
 */
export async function getCachedAmendmentTimeline(
  baseLawSfs: string
): Promise<AmendmentTimelineEntry[]> {
  const key = timelineCacheKey(baseLawSfs)

  // Try cache first
  const cached = timelineCache.get(key)
  if (cached) {
    return cached
  }

  // Cache miss - fetch from database
  const result = await getLawAmendmentTimeline(baseLawSfs)

  // Always cache (even empty arrays are valid)
  timelineCache.set(key, result)

  return result
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
export function invalidateLawCache(baseLawSfs: string): {
  versionsDeleted: number
  diffsDeleted: number
  timelinesDeleted: number
} {
  const normalizedSfs = baseLawSfs.replace(/^SFS\s*/i, '')

  // Invalidate version cache
  const versionsDeleted = versionCache.deletePattern(normalizedSfs)

  // Invalidate diff cache
  const diffsDeleted = diffCache.deletePattern(normalizedSfs)

  // Invalidate timeline cache
  const timelinesDeleted = timelineCache.deletePattern(normalizedSfs)

  return { versionsDeleted, diffsDeleted, timelinesDeleted }
}

/**
 * Invalidate all cached data
 * Call this on deployment or major data updates
 */
export function invalidateAllCaches(): void {
  versionCache.clear()
  diffCache.clear()
  timelineCache.clear()
}

// ============================================================================
// Cache Stats & Monitoring
// ============================================================================

export function getCacheStats(): {
  version: CacheStats
  diff: CacheStats
  timeline: CacheStats
  hitRate: number
} {
  const versionStats = versionCache.getStats()
  const diffStats = diffCache.getStats()
  const timelineStats = timelineCache.getStats()

  const totalHits = versionStats.hits + diffStats.hits + timelineStats.hits
  const totalRequests =
    totalHits + versionStats.misses + diffStats.misses + timelineStats.misses
  const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0

  return {
    version: versionStats,
    diff: diffStats,
    timeline: timelineStats,
    hitRate,
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
