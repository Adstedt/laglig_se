/**
 * Comprehensive Caching Strategy for Laglig.se
 * 
 * This file defines cache durations and strategies for different data types
 * to optimize performance and reduce database load.
 */

import { unstable_cache } from 'next/cache'

// ============================================================================
// Cache Durations (in seconds)
// ============================================================================

export const CACHE_DURATIONS = {
  // Frequently accessed, rarely changed
  LEGAL_DOCUMENTS: 86400,      // 24 hours - laws don't change often
  WORKSPACE_MEMBERS: 3600,      // 1 hour - team changes are rare
  TASK_COLUMNS: 3600,           // 1 hour - column setup rarely changes
  
  // Moderate frequency, moderate changes
  LAW_LIST_ITEMS: 300,          // 5 minutes - balance freshness vs performance
  WORKSPACE_SETTINGS: 300,      // 5 minutes
  
  // High frequency, frequent changes
  TASKS: 60,                    // 1 minute - tasks change frequently
  DASHBOARD: 60,                // 1 minute - needs fresh data
  TASK_STATS: 60,               // 1 minute - summary stats
  
  // Real-time data (minimal caching)
  COMMENTS: 10,                 // 10 seconds - near real-time
  ACTIVITY: 10,                 // 10 seconds
} as const

// ============================================================================
// Cache Tags
// ============================================================================

export const CACHE_TAGS = {
  // Workspace-scoped tags
  workspace: (id: string) => `workspace-${id}`,
  
  // Entity-specific tags
  tasks: (workspaceId: string) => `tasks-${workspaceId}`,
  taskColumns: (workspaceId: string) => `columns-${workspaceId}`,
  lawList: (listId: string) => `law-list-${listId}`,
  lawListItem: (itemId: string) => `law-list-item-${itemId}`,
  legalDocument: (docId: string) => `legal-doc-${docId}`,
  members: (workspaceId: string) => `members-${workspaceId}`,
  
  // Global tags for invalidation
  ALL_TASKS: 'all-tasks',
  ALL_DOCUMENTS: 'all-documents',
  ALL_LISTS: 'all-lists',
} as const

// ============================================================================
// Cache Wrapper Functions
// ============================================================================

/**
 * Cache legal document content (HTML/text)
 * These are large but immutable - cache for 24 hours
 */
export function cacheLegalDocument<T>(
  key: string[],
  fetcher: () => Promise<T>,
  documentId: string
) {
  return unstable_cache(
    fetcher,
    key,
    {
      revalidate: CACHE_DURATIONS.LEGAL_DOCUMENTS,
      tags: [CACHE_TAGS.legalDocument(documentId), CACHE_TAGS.ALL_DOCUMENTS],
    }
  )()
}

/**
 * Cache workspace tasks
 * Frequently accessed, moderate changes - cache for 1 minute
 */
export function cacheWorkspaceTasks<T>(
  key: string[],
  fetcher: () => Promise<T>,
  workspaceId: string
) {
  return unstable_cache(
    fetcher,
    key,
    {
      revalidate: CACHE_DURATIONS.TASKS,
      tags: [CACHE_TAGS.tasks(workspaceId), CACHE_TAGS.workspace(workspaceId)],
    }
  )()
}

/**
 * Cache task columns
 * Rarely changes - cache for 1 hour
 */
export function cacheTaskColumns<T>(
  key: string[],
  fetcher: () => Promise<T>,
  workspaceId: string
) {
  return unstable_cache(
    fetcher,
    key,
    {
      revalidate: CACHE_DURATIONS.TASK_COLUMNS,
      tags: [CACHE_TAGS.taskColumns(workspaceId), CACHE_TAGS.workspace(workspaceId)],
    }
  )()
}

/**
 * Cache workspace members
 * Rarely changes - cache for 1 hour
 */
export function cacheWorkspaceMembers<T>(
  key: string[],
  fetcher: () => Promise<T>,
  workspaceId: string
) {
  return unstable_cache(
    fetcher,
    key,
    {
      revalidate: CACHE_DURATIONS.WORKSPACE_MEMBERS,
      tags: [CACHE_TAGS.members(workspaceId), CACHE_TAGS.workspace(workspaceId)],
    }
  )()
}

/**
 * Cache law list item details
 * Moderate frequency - cache for 5 minutes
 */
export function cacheLawListItem<T>(
  key: string[],
  fetcher: () => Promise<T>,
  itemId: string,
  listId: string
) {
  return unstable_cache(
    fetcher,
    key,
    {
      revalidate: CACHE_DURATIONS.LAW_LIST_ITEMS,
      tags: [
        CACHE_TAGS.lawListItem(itemId),
        CACHE_TAGS.lawList(listId),
        CACHE_TAGS.ALL_LISTS,
      ],
    }
  )()
}

// ============================================================================
// Cache Invalidation Helpers
// ============================================================================

import { revalidateTag } from 'next/cache'

/**
 * Invalidate all task-related caches for a workspace
 */
export async function invalidateTaskCaches(workspaceId: string) {
  revalidateTag(CACHE_TAGS.tasks(workspaceId))
  revalidateTag(CACHE_TAGS.taskColumns(workspaceId))
}

/**
 * Invalidate law list caches
 */
export async function invalidateLawListCaches(listId: string) {
  revalidateTag(CACHE_TAGS.lawList(listId))
}

/**
 * Invalidate specific document cache
 */
export async function invalidateDocumentCache(documentId: string) {
  revalidateTag(CACHE_TAGS.legalDocument(documentId))
}

/**
 * Invalidate all caches for a workspace (nuclear option)
 */
export async function invalidateWorkspaceCaches(workspaceId: string) {
  revalidateTag(CACHE_TAGS.workspace(workspaceId))
}

// ============================================================================
// Document Content Caching (Emergency Performance Fix)
// ============================================================================

import { getCachedOrFetch, invalidateCacheKey } from './redis'

/**
 * Cache document HTML content separately from metadata
 * Story P.1: Emergency Document Content Caching
 * Implements 24-hour TTL for document content to achieve >80% cache hit rate
 */
export async function getCachedDocumentContent(
  documentId: string,
  fetcher: () => Promise<{ fullText: string | null; htmlContent: string | null }>
) {
  const cacheKey = `document:content:${documentId}`
  const ttl = CACHE_DURATIONS.LEGAL_DOCUMENTS // 24 hours
  
  // Track performance for monitoring
  const startTime = performance.now()
  
  try {
    const result = await getCachedOrFetch(
      cacheKey,
      fetcher,
      ttl
    )
    
    const duration = performance.now() - startTime
    
    // Log cache performance
    if (result.cached) {
      console.log(`[CACHE HIT] Document ${documentId} - ${duration.toFixed(0)}ms`)
    } else {
      console.log(`[CACHE MISS] Document ${documentId} - ${duration.toFixed(0)}ms`)
    }
    
    // Monitor slow operations
    if (duration > 500) {
      console.warn(`⚠️ Slow document fetch: ${documentId} took ${duration.toFixed(0)}ms`)
    }
    
    return result.data
  } catch (error) {
    console.error(`Failed to get cached document content for ${documentId}:`, error)
    // Fall back to fetcher on error
    return fetcher()
  }
}

/**
 * Invalidate document content cache on updates
 */
export async function invalidateDocumentContent(documentId: string) {
  const cacheKey = `document:content:${documentId}`
  await invalidateCacheKey(cacheKey)
  // Also invalidate Next.js cache tag
  invalidateDocumentCache(documentId)
}

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Wrap a cache operation with performance tracking
 */
export async function trackCachePerformance<T>(
  operation: () => Promise<T>,
  cacheName: string
): Promise<T> {
  if (process.env.NODE_ENV === 'development') {
    const start = performance.now()
    try {
      const result = await operation()
      const duration = performance.now() - start
      if (duration > 100) {
        console.warn(`⚠️ Slow cache operation: ${cacheName} took ${duration.toFixed(0)}ms`)
      }
      return result
    } catch (error) {
      const duration = performance.now() - start
      console.error(`❌ Cache operation failed: ${cacheName} after ${duration.toFixed(0)}ms`, error)
      throw error
    }
  }
  return operation()
}