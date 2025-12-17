'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TimelinePrefetcherProps {
  /** The SFS number of the law (e.g., "SFS 1977:1160" or "1977:1160") */
  lawSfs: string
  /** The URL slug of the law */
  lawSlug: string
}

/**
 * Invisible component that prefetches amendment timeline data after page render.
 * Used on law detail pages to enable instant navigation to history/version pages.
 *
 * Pre-fetches:
 * - The history page route (Next.js RSC prefetch)
 * - The timeline API endpoint (warms server-side cache)
 */
export function TimelinePrefetcher({
  lawSfs,
  lawSlug,
}: TimelinePrefetcherProps) {
  const router = useRouter()

  useEffect(() => {
    // Wait for main content to render before prefetching
    const timer = setTimeout(() => {
      // Prefetch the history page route (Next.js handles RSC prefetch)
      router.prefetch(`/lagar/${lawSlug}/historik`)

      // Warm the timeline cache by hitting the API
      // Use low priority to not block other requests
      const sfsForApi = lawSfs.replace(/^SFS\s*/i, '')
      fetch(`/api/laws/${encodeURIComponent(sfsForApi)}/history`, {
        priority: 'low',
      } as RequestInit).catch(() => {
        // Silently ignore prefetch errors
      })
    }, 300) // 300ms delay to let main content render first

    return () => {
      clearTimeout(timer)
    }
  }, [router, lawSfs, lawSlug])

  // This component only handles prefetching, no UI
  return null
}
