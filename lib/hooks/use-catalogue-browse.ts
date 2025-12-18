'use client'

import useSWR, { preload } from 'swr'
import type { BrowseInput, BrowseResponse } from '@/app/actions/browse'

/**
 * Fetcher function for SWR
 * Posts to /api/browse and returns the response
 */
async function fetcher(input: BrowseInput): Promise<BrowseResponse> {
  const response = await fetch('/api/browse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch browse results')
  }

  return response.json()
}

/**
 * Generate a stable cache key from browse input
 * Used by SWR for deduplication and caching
 */
function getCacheKey(input: BrowseInput): string {
  return `browse:${JSON.stringify(input)}`
}

/**
 * Prefetch browse results into SWR cache
 * Call this on hover to warm the cache before navigation
 */
export function prefetchBrowse(input: BrowseInput): void {
  const key = getCacheKey(input)
  preload(key, () => fetcher(input))
}

export interface UseCatalogueBrowseResult {
  results: BrowseResponse['results']
  total: number
  page: number
  totalPages: number
  queryTimeMs: number | undefined
  cached: boolean | undefined
  isLoading: boolean
  isValidating: boolean
  error: string | undefined
}

/**
 * SWR hook for catalogue browsing
 *
 * Features:
 * - Stale-while-revalidate: Shows cached data immediately while fetching fresh data
 * - Deduplication: Multiple components using the same input share the same request
 * - keepPreviousData: Shows previous results while loading new page/filters
 * - 1 minute dedup interval: Prevents refetch storms on filter changes
 *
 * @param input - Browse parameters (page, filters, sort, etc.)
 * @param initialData - Server-rendered initial data (for hydration)
 */
export function useCatalogueBrowse(
  input: BrowseInput,
  initialData?: BrowseResponse
): UseCatalogueBrowseResult {
  const { data, error, isLoading, isValidating } = useSWR(
    getCacheKey(input),
    () => fetcher(input),
    {
      // Only pass fallbackData if initialData is defined
      ...(initialData ? { fallbackData: initialData } : {}),
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: false, // Don't refetch on network reconnect
      dedupingInterval: 60000, // 1 minute - prevents refetch storms
      keepPreviousData: true, // Show stale data while loading (no skeleton flash!)
    }
  )

  return {
    results: data?.results ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    totalPages: data?.totalPages ?? 0,
    queryTimeMs: data?.queryTimeMs,
    cached: data?.cached,
    isLoading,
    isValidating,
    error: error?.message ?? data?.error,
  }
}
