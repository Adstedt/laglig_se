'use client'

/**
 * SWR hooks for law lists and items with caching
 *
 * - Law lists are cached for 5 minutes (rarely change)
 * - Items are cached per list ID for 2 minutes
 * - Supports search with debouncing at component level
 */

import useSWR from 'swr'
import {
  getWorkspaceLawLists,
  getLawListItemsForLinking,
  type LawListForLinking,
  type LawListItemForLinking,
} from '@/app/actions/tasks'

/**
 * Hook for fetching and caching workspace law lists
 */
export function useLawLists() {
  const { data, error, isLoading, mutate } = useSWR<LawListForLinking[]>(
    'law-lists',
    async () => {
      const result = await getWorkspaceLawLists()
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Failed to load law lists')
      }
      return result.data
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateOnMount: true, // Always fetch fresh data when dialog opens
      dedupingInterval: 5000, // Short dedup to allow quick refresh
    }
  )

  return {
    lists: data ?? [],
    isLoading,
    error: error?.message ?? null,
    mutate,
  }
}

/**
 * Hook for fetching and caching law list items
 */
export function useLawListItems(listId: string | null, search?: string) {
  const cacheKey = listId ? `law-list-items:${listId}:${search ?? ''}` : null

  const { data, error, isLoading } = useSWR<LawListItemForLinking[]>(
    cacheKey,
    async () => {
      if (!listId) return []
      const result = await getLawListItemsForLinking(listId, search)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Failed to load items')
      }
      return result.data
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 120000, // 2 minutes
      keepPreviousData: true, // Keep showing old data while loading new search
    }
  )

  return {
    items: data ?? [],
    isLoading,
    error: error?.message ?? null,
  }
}
