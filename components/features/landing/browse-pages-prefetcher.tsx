'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Invisible component that prefetches main browse pages after homepage render.
 * Makes navigation from homepage to browse pages feel instant.
 *
 * Pre-fetches:
 * - /lagar (Swedish laws)
 * - /rattskallor (Legal sources)
 * - /rattsfall (Court cases)
 * - /eu (EU legislation)
 */
export function BrowsePagesPrefetcher() {
  const router = useRouter()

  useEffect(() => {
    // Wait for main content to render before prefetching
    const timer = setTimeout(() => {
      // Prefetch main browse routes (Next.js handles RSC prefetch)
      const routes = ['/lagar', '/rattskallor', '/rattsfall', '/eu']

      routes.forEach((route, index) => {
        // Stagger prefetches to avoid overwhelming the network
        setTimeout(() => {
          router.prefetch(route)
        }, index * 100)
      })

      // Also warm the API cache for browse pages (low priority)
      // These endpoints power the browse pages
      const apiEndpoints = [
        '/api/browse/laws?page=1&pageSize=20',
        '/api/browse/court-cases?page=1&pageSize=20',
      ]

      apiEndpoints.forEach((endpoint, index) => {
        setTimeout(
          () => {
            fetch(endpoint, {
              priority: 'low',
            } as RequestInit).catch(() => {
              // Silently ignore prefetch errors
            })
          },
          500 + index * 200
        )
      })
    }, 500) // 500ms delay to let hero section render first

    return () => {
      clearTimeout(timer)
    }
  }, [router])

  // This component only handles prefetching, no UI
  return null
}
