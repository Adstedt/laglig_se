/**
 * Cache Invalidation Module (Story 2.19)
 *
 * Provides utilities for invalidating caches after sync jobs complete.
 * Supports both Redis cache invalidation and Next.js cache tag revalidation.
 *
 * Usage:
 * - Call invalidateLawCaches() after sync-sfs completes
 * - Call invalidateCourtCaseCaches() after sync-court-cases completes
 * - Call invalidateAllCaches() for full cache clear (rare, emergency use)
 */

// Note: revalidateTag in Next.js can be async or sync depending on version
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { revalidateTag } = require('next/cache')
import { invalidateCachePattern } from './redis'

/**
 * Invalidate law-related caches
 * Call after sync-sfs job completes successfully
 */
export async function invalidateLawCaches(): Promise<{
  redisKeysCleared: number
  tagsRevalidated: string[]
}> {
  console.log('[CACHE INVALIDATION] Starting law cache invalidation...')

  // Clear Redis browse cache keys for laws
  const redisKeysCleared = await invalidateCachePattern('browse:*')

  // Revalidate Next.js cache tags
  const tags = ['laws', 'browse', 'catalogue', 'documents']
  for (const tag of tags) {
    try {
      revalidateTag(tag)
      console.log(`[CACHE INVALIDATION] Revalidated tag: ${tag}`)
    } catch (error) {
      console.warn(`[CACHE INVALIDATION] Failed to revalidate tag ${tag}:`, error)
    }
  }

  console.log(
    `[CACHE INVALIDATION] Law caches cleared. Redis keys: ${redisKeysCleared}, Tags: ${tags.join(', ')}`
  )

  return { redisKeysCleared, tagsRevalidated: tags }
}

/**
 * Invalidate court case-related caches
 * Call after sync-court-cases job completes successfully
 */
export async function invalidateCourtCaseCaches(): Promise<{
  redisKeysCleared: number
  tagsRevalidated: string[]
}> {
  console.log('[CACHE INVALIDATION] Starting court case cache invalidation...')

  // Clear Redis browse cache keys for court cases
  const redisKeysCleared = await invalidateCachePattern('browse:*')

  // Revalidate Next.js cache tags
  const tags = ['court-cases', 'browse', 'catalogue', 'documents']
  for (const tag of tags) {
    try {
      revalidateTag(tag)
      console.log(`[CACHE INVALIDATION] Revalidated tag: ${tag}`)
    } catch (error) {
      console.warn(`[CACHE INVALIDATION] Failed to revalidate tag ${tag}:`, error)
    }
  }

  console.log(
    `[CACHE INVALIDATION] Court case caches cleared. Redis keys: ${redisKeysCleared}, Tags: ${tags.join(', ')}`
  )

  return { redisKeysCleared, tagsRevalidated: tags }
}

/**
 * Invalidate EU legislation-related caches
 * Call after EU sync jobs complete successfully
 */
export async function invalidateEuCaches(): Promise<{
  redisKeysCleared: number
  tagsRevalidated: string[]
}> {
  console.log('[CACHE INVALIDATION] Starting EU legislation cache invalidation...')

  // Clear Redis browse cache keys
  const redisKeysCleared = await invalidateCachePattern('browse:*')

  // Revalidate Next.js cache tags
  const tags = ['eu-legislation', 'browse', 'catalogue', 'documents']
  for (const tag of tags) {
    try {
      revalidateTag(tag)
      console.log(`[CACHE INVALIDATION] Revalidated tag: ${tag}`)
    } catch (error) {
      console.warn(`[CACHE INVALIDATION] Failed to revalidate tag ${tag}:`, error)
    }
  }

  console.log(
    `[CACHE INVALIDATION] EU caches cleared. Redis keys: ${redisKeysCleared}, Tags: ${tags.join(', ')}`
  )

  return { redisKeysCleared, tagsRevalidated: tags }
}

/**
 * Invalidate all caches
 * Use sparingly - for emergency situations or major sync events
 */
export async function invalidateAllCaches(): Promise<{
  redisKeysCleared: number
  tagsRevalidated: string[]
}> {
  console.log('[CACHE INVALIDATION] Starting full cache invalidation...')

  // Clear all Redis cache keys
  const redisKeysCleared = await invalidateCachePattern('*')

  // Revalidate all cache tags
  const tags = [
    'laws',
    'court-cases',
    'eu-legislation',
    'browse',
    'catalogue',
    'documents',
    'static-generation',
  ]

  for (const tag of tags) {
    try {
      revalidateTag(tag)
      console.log(`[CACHE INVALIDATION] Revalidated tag: ${tag}`)
    } catch (error) {
      console.warn(`[CACHE INVALIDATION] Failed to revalidate tag ${tag}:`, error)
    }
  }

  console.log(
    `[CACHE INVALIDATION] All caches cleared. Redis keys: ${redisKeysCleared}, Tags: ${tags.join(', ')}`
  )

  return { redisKeysCleared, tagsRevalidated: tags }
}
