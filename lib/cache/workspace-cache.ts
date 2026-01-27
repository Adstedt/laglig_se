/**
 * Workspace-Specific Caching Module (Story P.2)
 *
 * Provides caching layer for workspace data with proper isolation and TTL management.
 * Implements user-specific caching for logged-in users to improve performance.
 *
 * @see docs/stories/P.2.systematic-caching.story.md
 */

import { redis, isRedisConfigured, getCachedOrFetch } from './redis'
import type { WorkspaceMember, LawList, LawListItem } from '@prisma/client'

/**
 * Cache key generators for workspace-specific data
 * Ensures proper workspace isolation in multi-tenant environment
 */
export const WORKSPACE_CACHE_KEYS = {
  // User-specific workspace context (5 min TTL)
  CONTEXT: (userId: string, workspaceId: string) =>
    `workspace:context:${userId}:${workspaceId}`,

  // Workspace members list (1 hour TTL)
  MEMBERS: (workspaceId: string) => `workspace:members:${workspaceId}`,

  // Workspace law lists (5 min TTL)
  LAW_LISTS: (workspaceId: string) => `workspace:lists:${workspaceId}`,

  // Individual law list items (5 min TTL)
  LIST_ITEMS: (listId: string) => `list:items:${listId}`,

  // User preferences (30 min TTL)
  USER_PREFS: (userId: string) => `user:prefs:${userId}`,

  // Workspace settings (30 min TTL)
  SETTINGS: (workspaceId: string) => `workspace:settings:${workspaceId}`,

  // User's frequently accessed documents (2 hours TTL)
  USER_FREQUENT_DOCS: (userId: string, workspaceId: string) =>
    `user:frequent:${userId}:${workspaceId}`,
}

/**
 * Cache TTL values in seconds
 * Based on data volatility and access patterns
 */
export const CACHE_TTL = {
  WORKSPACE_CONTEXT: 300, // 5 minutes
  WORKSPACE_MEMBERS: 3600, // 1 hour
  WORKSPACE_SETTINGS: 1800, // 30 minutes
  USER_PREFERENCES: 1800, // 30 minutes
  LAW_LISTS: 300, // 5 minutes
  LIST_ITEMS: 300, // 5 minutes
  USER_FREQUENT_DOCS: 7200, // 2 hours
}

/**
 * Cache tags for grouped invalidation
 * Used to invalidate related cache entries together
 */
export const CACHE_TAGS = {
  WORKSPACE: (id: string) => `tag:workspace:${id}`,
  USER: (id: string) => `tag:user:${id}`,
  LAW_LIST: (id: string) => `tag:list:${id}`,
  DOCUMENT: (id: string) => `tag:doc:${id}`,
}

/**
 * Get cached workspace context or fetch from database
 * Implements AC: 1 - Workspace context cached per user session
 */
export async function getCachedWorkspaceContext<T extends object>(
  userId: string,
  workspaceId: string,
  fetcher: () => Promise<T>
): Promise<{ data: T; cached: boolean }> {
  const key = WORKSPACE_CACHE_KEYS.CONTEXT(userId, workspaceId)
  return getCachedOrFetch(key, fetcher, CACHE_TTL.WORKSPACE_CONTEXT)
}

/**
 * Get cached workspace members or fetch from database
 * Implements AC: 4 - Workspace members list cached at page level
 */
export async function getCachedWorkspaceMembers(
  workspaceId: string,
  fetcher: () => Promise<WorkspaceMember[]>
): Promise<{ data: WorkspaceMember[]; cached: boolean }> {
  const key = WORKSPACE_CACHE_KEYS.MEMBERS(workspaceId)
  return getCachedOrFetch(key, fetcher, CACHE_TTL.WORKSPACE_MEMBERS)
}

/**
 * Get cached law lists for workspace
 * Implements AC: 2 - User's law lists cached client-side and server-side
 */
export async function getCachedLawLists(
  workspaceId: string,
  fetcher: () => Promise<LawList[]>
): Promise<{ data: LawList[]; cached: boolean }> {
  const key = WORKSPACE_CACHE_KEYS.LAW_LISTS(workspaceId)
  return getCachedOrFetch(key, fetcher, CACHE_TTL.LAW_LISTS)
}

/**
 * Get cached law list items
 * Implements AC: 3 - Law list items cached with document metadata
 */
export async function getCachedListItems(
  listId: string,
  fetcher: () => Promise<LawListItem[]>
): Promise<{ data: LawListItem[]; cached: boolean }> {
  const key = WORKSPACE_CACHE_KEYS.LIST_ITEMS(listId)
  return getCachedOrFetch(key, fetcher, CACHE_TTL.LIST_ITEMS)
}

/**
 * Get cached user preferences
 * Implements AC: 5 - User preferences cached
 */
export async function getCachedUserPreferences<T extends object>(
  userId: string,
  fetcher: () => Promise<T>
): Promise<{ data: T; cached: boolean }> {
  const key = WORKSPACE_CACHE_KEYS.USER_PREFS(userId)
  return getCachedOrFetch(key, fetcher, CACHE_TTL.USER_PREFERENCES)
}

/**
 * Invalidate workspace-related cache entries
 * Implements AC: 6 - Cache invalidation on data mutations
 */
export async function invalidateWorkspaceCache(
  workspaceId: string,
  types?: Array<'context' | 'members' | 'lists' | 'settings'>
): Promise<void> {
  if (!isRedisConfigured()) return

  const keysToInvalidate: string[] = []

  // If no specific types, invalidate all workspace cache
  const typesToInvalidate = types || ['context', 'members', 'lists', 'settings']

  for (const type of typesToInvalidate) {
    switch (type) {
      case 'context':
        // Invalidate all user contexts for this workspace
        keysToInvalidate.push(`workspace:context:*:${workspaceId}`)
        break
      case 'members':
        keysToInvalidate.push(WORKSPACE_CACHE_KEYS.MEMBERS(workspaceId))
        break
      case 'lists':
        keysToInvalidate.push(WORKSPACE_CACHE_KEYS.LAW_LISTS(workspaceId))
        // Also invalidate all list items for this workspace
        keysToInvalidate.push(`list:items:*`)
        break
      case 'settings':
        keysToInvalidate.push(WORKSPACE_CACHE_KEYS.SETTINGS(workspaceId))
        break
    }
  }

  // Invalidate all matching keys
  await Promise.all(
    keysToInvalidate.map(async (pattern) => {
      if (pattern.includes('*')) {
        // Pattern-based invalidation
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await Promise.all(keys.map((key) => redis.del(key)))
        }
      } else {
        // Direct key invalidation
        await redis.del(pattern)
      }
    })
  )
}

/**
 * Invalidate user-specific cache entries
 */
export async function invalidateUserCache(
  userId: string,
  types?: Array<'preferences' | 'frequent' | 'context'>
): Promise<void> {
  if (!isRedisConfigured()) return

  const keysToInvalidate: string[] = []
  const typesToInvalidate = types || ['preferences', 'frequent', 'context']

  for (const type of typesToInvalidate) {
    switch (type) {
      case 'preferences':
        keysToInvalidate.push(WORKSPACE_CACHE_KEYS.USER_PREFS(userId))
        break
      case 'frequent':
        keysToInvalidate.push(`user:frequent:${userId}:*`)
        break
      case 'context':
        keysToInvalidate.push(`workspace:context:${userId}:*`)
        break
    }
  }

  await Promise.all(
    keysToInvalidate.map(async (pattern) => {
      if (pattern.includes('*')) {
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await Promise.all(keys.map((key) => redis.del(key)))
        }
      } else {
        await redis.del(pattern)
      }
    })
  )
}

/**
 * Invalidate law list cache entries
 */
export async function invalidateLawListCache(
  listId: string,
  workspaceId?: string
): Promise<void> {
  if (!isRedisConfigured()) return

  const keysToInvalidate = [WORKSPACE_CACHE_KEYS.LIST_ITEMS(listId)]

  if (workspaceId) {
    keysToInvalidate.push(WORKSPACE_CACHE_KEYS.LAW_LISTS(workspaceId))
  }

  await Promise.all(keysToInvalidate.map((key) => redis.del(key)))
}

/**
 * Warm cache for user's workspace
 * Implements AC: 7 - Cache warming for user's frequently accessed documents
 */
export async function warmWorkspaceCache(
  userId: string,
  workspaceId: string,
  fetchers: {
    context?: () => Promise<any>
    members?: () => Promise<WorkspaceMember[]>
    lists?: () => Promise<LawList[]>
    preferences?: () => Promise<any>
  }
): Promise<void> {
  if (!isRedisConfigured()) return

  const warmingTasks: Promise<any>[] = []

  // Warm context cache
  if (fetchers.context) {
    warmingTasks.push(
      getCachedWorkspaceContext(userId, workspaceId, fetchers.context)
    )
  }

  // Warm members cache
  if (fetchers.members) {
    warmingTasks.push(getCachedWorkspaceMembers(workspaceId, fetchers.members))
  }

  // Warm law lists cache
  if (fetchers.lists) {
    warmingTasks.push(getCachedLawLists(workspaceId, fetchers.lists))
  }

  // Warm user preferences
  if (fetchers.preferences) {
    warmingTasks.push(getCachedUserPreferences(userId, fetchers.preferences))
  }

  // Execute all warming tasks in parallel
  await Promise.all(warmingTasks)
}

/**
 * Get cache statistics for workspace
 * Used for monitoring cache performance
 */
export async function getWorkspaceCacheStats(workspaceId: string): Promise<{
  totalKeys: number
  memoryUsage: number
  keysByType: Record<string, number>
}> {
  if (!isRedisConfigured()) {
    return { totalKeys: 0, memoryUsage: 0, keysByType: {} }
  }

  try {
    // Get all workspace-related keys
    const patterns = [
      `workspace:context:*:${workspaceId}`,
      `workspace:members:${workspaceId}`,
      `workspace:lists:${workspaceId}`,
      `workspace:settings:${workspaceId}`,
      `list:items:*`, // Would need to filter by workspace
    ]

    let totalKeys = 0
    const keysByType: Record<string, number> = {}

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern)
      const type = pattern.split(':')[0]
      if (type) {
        keysByType[type] = (keysByType[type] || 0) + keys.length
      }
      totalKeys += keys.length
    }

    // Estimate memory usage (rough calculation)
    // Assuming average 1KB per cached item
    const memoryUsage = totalKeys * 1024

    return {
      totalKeys,
      memoryUsage,
      keysByType,
    }
  } catch (error) {
    console.error('[CACHE] Failed to get workspace cache stats:', error)
    return { totalKeys: 0, memoryUsage: 0, keysByType: {} }
  }
}

/**
 * Monitor cache performance for workspace operations
 * Returns metrics for the last operation
 */
export async function measureWorkspaceCachePerformance<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number; cached: boolean }> {
  const startTime = performance.now()

  try {
    const result = await fn()
    const duration = performance.now() - startTime

    // Check if result has cached property (from getCachedOrFetch)
    const cached = (result as any)?.cached || false

    // Log performance metrics for monitoring
    if (duration > 100) {
      console.warn(
        `[CACHE PERF] Slow ${operation}: ${duration.toFixed(2)}ms (cached: ${cached})`
      )
    }

    return {
      result,
      duration,
      cached,
    }
  } catch (error) {
    const duration = performance.now() - startTime
    console.error(
      `[CACHE PERF] Failed ${operation}: ${duration.toFixed(2)}ms`,
      error
    )
    throw error
  }
}
