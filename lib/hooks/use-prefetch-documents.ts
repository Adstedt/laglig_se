'use client'

import { useEffect, useRef } from 'react'
import {
  prefetchDocuments,
  prefetchListItemDetails,
} from '@/app/actions/prefetch-documents'

interface UsePrefetchOptions {
  enabled?: boolean
  delay?: number
}

/**
 * Hook to pre-fetch documents when they become visible
 * Warms up the cache for instant modal opening
 */
export function usePrefetchDocuments(
  items: Array<{ id: string; document_id: string }>,
  options: UsePrefetchOptions = {}
) {
  const { enabled = true, delay = 500 } = options
  const hasPrefetched = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    if (!enabled || hasPrefetched.current || items.length === 0) {
      return
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Delay prefetch slightly to prioritize initial render
    timeoutRef.current = setTimeout(() => {
      hasPrefetched.current = true

      // Extract unique document IDs
      const documentIds = [...new Set(items.map((item) => item.document_id))]
      const listItemIds = items.map((item) => item.id)

      // Pre-fetch in parallel (fire and forget)
      Promise.all([
        prefetchDocuments(documentIds.slice(0, 20)), // Limit to first 20 to avoid overload
        prefetchListItemDetails(listItemIds.slice(0, 20)),
      ]).catch(() => {
        // Pre-fetch failed - not critical
      })
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [items, enabled, delay])

  // Reset when items change significantly
  useEffect(() => {
    hasPrefetched.current = false
  }, [items.length])
}

/**
 * Hook to pre-fetch a single document on hover
 * For even faster response when user hovers before clicking
 */
export function usePrefetchOnHover(
  documentId: string | null,
  listItemId: string | null
) {
  const prefetchedRef = useRef(new Set<string>())

  const prefetch = () => {
    if (!documentId || !listItemId) return

    const key = `${documentId}-${listItemId}`
    if (prefetchedRef.current.has(key)) return

    prefetchedRef.current.add(key)

    // Pre-fetch both document content and list item details
    Promise.all([
      prefetchDocuments([documentId]),
      prefetchListItemDetails([listItemId]),
    ]).catch(console.error)
  }

  return { prefetch }
}
