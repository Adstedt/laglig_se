'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { prefetchManager } from '@/lib/prefetch'

interface SwedishImplementation {
  slug: string | null
}

interface RelatedDocsPrefetcherProps {
  /** Swedish laws implementing this EU directive */
  swedishImplementations: SwedishImplementation[]
}

/**
 * Invisible component that prefetches related documents after page render.
 * Used on EU legislation detail pages to enable instant navigation to related content.
 *
 * Pre-fetches:
 * - Swedish SFS laws implementing this directive
 */
export function RelatedDocsPrefetcher({
  swedishImplementations,
}: RelatedDocsPrefetcherProps) {
  const router = useRouter()

  useEffect(() => {
    prefetchManager.init(router)

    // Wait for main content to render before prefetching
    const timer = setTimeout(() => {
      const urls: string[] = []

      // Add Swedish law URLs
      swedishImplementations.forEach((law) => {
        if (law.slug) {
          urls.push(`/lagar/${law.slug}`)
        }
      })

      // Batch prefetch all URLs with staggered timing
      if (urls.length > 0) {
        prefetchManager.addBatch(urls)
      }
    }, 200) // 200ms delay to let main content render first

    return () => {
      clearTimeout(timer)
      prefetchManager.clear()
    }
  }, [router, swedishImplementations])

  // This component only handles prefetching, no UI
  return null
}
