/**
 * User Session Caching Module (Story P.2)
 *
 * Provides caching layer for user-specific data and preferences.
 * Implements session-level caching to reduce database queries.
 *
 * @see docs/stories/P.2.systematic-caching.story.md
 */

import { redis, isRedisConfigured, getCachedOrFetch } from './redis'
import type { User, Workspace } from '@prisma/client'

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system'
  language?: 'sv' | 'en'
  emailNotifications?: boolean
  smsNotifications?: boolean
  digestFrequency?: 'daily' | 'weekly' | 'monthly' | 'never'
  defaultView?: 'grid' | 'list' | 'kanban'
  sidebarCollapsed?: boolean
  showOnboarding?: boolean
}

export interface UserSession {
  user: User
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  preferences: UserPreferences
  lastActivity: Date
}

export interface FrequentDocument {
  documentId: string
  documentTitle: string
  documentType: string
  accessCount: number
  lastAccessedAt: Date
}

/**
 * Cache key generators for user-specific data
 */
export const USER_CACHE_KEYS = {
  // User session data (30 min TTL)
  SESSION: (userId: string) => `user:session:${userId}`,

  // User's workspaces list (5 min TTL)
  WORKSPACES: (userId: string) => `user:workspaces:${userId}`,

  // User's recent activity (10 min TTL)
  RECENT_ACTIVITY: (userId: string) => `user:activity:${userId}`,

  // User's saved searches (1 hour TTL)
  SAVED_SEARCHES: (userId: string) => `user:searches:${userId}`,

  // User's document access history (2 hours TTL)
  DOCUMENT_HISTORY: (userId: string, workspaceId: string) =>
    `user:history:${userId}:${workspaceId}`,

  // User's notification preferences (1 hour TTL)
  NOTIFICATIONS: (userId: string) => `user:notifications:${userId}`,
}

/**
 * Cache TTL values for user data
 */
export const USER_CACHE_TTL = {
  SESSION: 1800, // 30 minutes
  WORKSPACES: 300, // 5 minutes
  RECENT_ACTIVITY: 600, // 10 minutes
  SAVED_SEARCHES: 3600, // 1 hour
  DOCUMENT_HISTORY: 7200, // 2 hours
  NOTIFICATIONS: 3600, // 1 hour
}

/**
 * Get cached user session or fetch from database
 */
export async function getCachedUserSession(
  userId: string,
  fetcher: () => Promise<UserSession>
): Promise<{ data: UserSession; cached: boolean }> {
  const key = USER_CACHE_KEYS.SESSION(userId)
  return getCachedOrFetch(key, fetcher, USER_CACHE_TTL.SESSION)
}

/**
 * Get cached user workspaces
 */
export async function getCachedUserWorkspaces(
  userId: string,
  fetcher: () => Promise<Workspace[]>
): Promise<{ data: Workspace[]; cached: boolean }> {
  const key = USER_CACHE_KEYS.WORKSPACES(userId)
  return getCachedOrFetch(key, fetcher, USER_CACHE_TTL.WORKSPACES)
}

/**
 * Get cached user preferences
 * Merged with workspace-cache for consistency
 */
export async function getCachedPreferences(
  userId: string,
  fetcher: () => Promise<UserPreferences>
): Promise<{ data: UserPreferences; cached: boolean }> {
  const key = `user:prefs:${userId}`
  return getCachedOrFetch(key, fetcher, 1800) // 30 min TTL
}

/**
 * Track and cache frequently accessed documents
 * Implements cache warming for user's most accessed content
 */
export async function trackDocumentAccess(
  userId: string,
  workspaceId: string,
  documentId: string,
  documentTitle: string,
  documentType: string
): Promise<void> {
  if (!isRedisConfigured()) return

  const historyKey = USER_CACHE_KEYS.DOCUMENT_HISTORY(userId, workspaceId)
  const frequentKey = `user:frequent:${userId}:${workspaceId}`

  try {
    // Get existing history
    const historyData = await redis.get(historyKey)
    const history: FrequentDocument[] = historyData
      ? typeof historyData === 'string'
        ? JSON.parse(historyData)
        : historyData
      : []

    // Find or create document entry
    const existingIndex = history.findIndex((d) => d.documentId === documentId)
    const now = new Date()

    if (existingIndex >= 0 && history[existingIndex]) {
      // Update existing entry
      history[existingIndex].accessCount++
      history[existingIndex].lastAccessedAt = now
    } else {
      // Add new entry
      history.push({
        documentId,
        documentTitle,
        documentType,
        accessCount: 1,
        lastAccessedAt: now,
      })
    }

    // Sort by access count and keep top 20
    history.sort((a, b) => b.accessCount - a.accessCount)
    const topDocuments = history.slice(0, 20)

    // Update cache
    await redis.set(historyKey, JSON.stringify(topDocuments), {
      ex: USER_CACHE_TTL.DOCUMENT_HISTORY,
    })

    // Update frequently accessed documents (top 10)
    const frequentDocs = topDocuments.slice(0, 10)
    await redis.set(
      frequentKey,
      JSON.stringify(frequentDocs),
      { ex: 7200 } // 2 hours
    )
  } catch (error) {
    console.error('[USER CACHE] Failed to track document access:', error)
  }
}

/**
 * Get user's frequently accessed documents
 */
export async function getFrequentDocuments(
  userId: string,
  workspaceId: string
): Promise<FrequentDocument[]> {
  if (!isRedisConfigured()) return [] as FrequentDocument[]

  const key = `user:frequent:${userId}:${workspaceId}`

  try {
    const data = await redis.get(key)
    if (data) {
      return typeof data === 'string'
        ? (JSON.parse(data) as FrequentDocument[])
        : (data as FrequentDocument[])
    }
  } catch (error) {
    console.error('[USER CACHE] Failed to get frequent documents:', error)
  }

  return [] as FrequentDocument[]
}

/**
 * Update user activity timestamp
 */
export async function updateUserActivity(userId: string): Promise<void> {
  if (!isRedisConfigured()) return

  const key = USER_CACHE_KEYS.RECENT_ACTIVITY(userId)
  const now = new Date().toISOString()

  try {
    await redis.set(key, now, { ex: USER_CACHE_TTL.RECENT_ACTIVITY })
  } catch (error) {
    console.error('[USER CACHE] Failed to update activity:', error)
  }
}

/**
 * Get user's last activity timestamp
 */
export async function getUserLastActivity(
  userId: string
): Promise<Date | null> {
  if (!isRedisConfigured()) return null

  const key = USER_CACHE_KEYS.RECENT_ACTIVITY(userId)

  try {
    const data = await redis.get(key)
    if (data) {
      const timestamp = typeof data === 'string' ? data : String(data)
      return new Date(timestamp)
    }
  } catch (error) {
    console.error('[USER CACHE] Failed to get activity:', error)
  }

  return null
}

/**
 * Save user's search query for quick access
 */
export async function saveUserSearch(
  userId: string,
  query: string,
  filters?: any
): Promise<void> {
  if (!isRedisConfigured()) return

  const key = USER_CACHE_KEYS.SAVED_SEARCHES(userId)

  try {
    const searchesData = await redis.get(key)
    const searches = searchesData
      ? typeof searchesData === 'string'
        ? JSON.parse(searchesData)
        : searchesData
      : []

    // Add new search (keep last 10)
    searches.unshift({
      query,
      filters,
      timestamp: new Date().toISOString(),
    })

    const recentSearches = searches.slice(0, 10)

    await redis.set(key, JSON.stringify(recentSearches), {
      ex: USER_CACHE_TTL.SAVED_SEARCHES,
    })
  } catch (error) {
    console.error('[USER CACHE] Failed to save search:', error)
  }
}

/**
 * Get user's recent searches
 */
export async function getUserSearches(userId: string): Promise<any[]> {
  if (!isRedisConfigured()) return [] as any[]

  const key = USER_CACHE_KEYS.SAVED_SEARCHES(userId)

  try {
    const data = await redis.get(key)
    if (data) {
      return typeof data === 'string'
        ? (JSON.parse(data) as any[])
        : (data as any[])
    }
  } catch (error) {
    console.error('[USER CACHE] Failed to get searches:', error)
  }

  return [] as any[]
}

/**
 * Invalidate all user cache entries
 */
export async function invalidateAllUserCache(userId: string): Promise<void> {
  if (!isRedisConfigured()) return

  const patterns = [
    `user:session:${userId}`,
    `user:workspaces:${userId}`,
    `user:activity:${userId}`,
    `user:searches:${userId}`,
    `user:history:${userId}:*`,
    `user:notifications:${userId}`,
    `user:prefs:${userId}`,
    `user:frequent:${userId}:*`,
    `workspace:context:${userId}:*`,
  ]

  try {
    await Promise.all(
      patterns.map(async (pattern) => {
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
  } catch (error) {
    console.error('[USER CACHE] Failed to invalidate cache:', error)
  }
}

/**
 * Warm user session cache on login
 */
export async function warmUserSessionCache(
  userId: string,
  fetchers: {
    session?: () => Promise<UserSession>
    workspaces?: () => Promise<Workspace[]>
    preferences?: () => Promise<UserPreferences>
  }
): Promise<void> {
  if (!isRedisConfigured()) return

  const warmingTasks: Promise<any>[] = []

  if (fetchers.session) {
    warmingTasks.push(getCachedUserSession(userId, fetchers.session))
  }

  if (fetchers.workspaces) {
    warmingTasks.push(getCachedUserWorkspaces(userId, fetchers.workspaces))
  }

  if (fetchers.preferences) {
    warmingTasks.push(getCachedPreferences(userId, fetchers.preferences))
  }

  await Promise.all(warmingTasks)
}

/**
 * Get user cache statistics
 */
export async function getUserCacheStats(userId: string): Promise<{
  totalKeys: number
  keysByType: Record<string, number>
  lastActivity: Date | null
}> {
  if (!isRedisConfigured()) {
    return { totalKeys: 0, keysByType: {}, lastActivity: null }
  }

  try {
    const patterns = [
      `user:session:${userId}`,
      `user:workspaces:${userId}`,
      `user:activity:${userId}`,
      `user:searches:${userId}`,
      `user:history:${userId}:*`,
      `user:notifications:${userId}`,
      `user:prefs:${userId}`,
      `user:frequent:${userId}:*`,
    ]

    let totalKeys = 0
    const keysByType: Record<string, number> = {}

    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        const keys = await redis.keys(pattern)
        const type = pattern.split(':')[1]
        if (type) {
          keysByType[type] = keys.length
        }
        totalKeys += keys.length
      } else {
        const exists = await redis.type(pattern)
        if (exists !== 'none') {
          const type = pattern.split(':')[1]
          if (type) {
            keysByType[type] = (keysByType[type] || 0) + 1
          }
          totalKeys++
        }
      }
    }

    const lastActivity = await getUserLastActivity(userId)

    return {
      totalKeys,
      keysByType,
      lastActivity,
    }
  } catch (error) {
    console.error('[USER CACHE] Failed to get stats:', error)
    return { totalKeys: 0, keysByType: {}, lastActivity: null }
  }
}
