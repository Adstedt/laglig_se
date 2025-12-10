'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { prefetchManager } from '@/lib/prefetch'

interface CitedLaw {
  slug: string
}

interface RelatedDocsPrefetcherProps {
  /** Laws cited/referenced by this court case */
  citedLaws: CitedLaw[]
}

/**
 * Invisible component that prefetches related documents after page render.
 * Used on court case detail pages to enable instant navigation to related content.
 *
 * Pre-fetches:
 * - Referenced/cited SFS laws
 */
export function RelatedDocsPrefetcher({
  citedLaws,
}: RelatedDocsPrefetcherProps) {
  const router = useRouter()

  useEffect(() => {
    prefetchManager.init(router)

    // Wait for main content to render before prefetching
    const timer = setTimeout(() => {
      const urls: string[] = []

      // Add law URLs
      citedLaws.forEach((law) => {
        urls.push(`/lagar/${law.slug}`)
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
  }, [router, citedLaws])

  // This component only handles prefetching, no UI
  return null
}
