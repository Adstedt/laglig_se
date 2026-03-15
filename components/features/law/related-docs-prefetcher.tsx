'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { prefetchManager } from '@/lib/prefetch'

interface Directive {
  slug: string
}

interface Amendment {
  slug: string | null
}

interface RelatedDocsPrefetcherProps {
  /** EU directives implemented by this law */
  implementedDirectives: Directive[]
  /** Amendment documents (other SFS laws that amend this one) */
  amendments?: Amendment[]
}

/**
 * Invisible component that prefetches related documents after page render.
 * Used on law detail pages to enable instant navigation to related content.
 *
 * Pre-fetches:
 * - EU directives this law implements
 * - Amendment history links
 */
export function RelatedDocsPrefetcher({
  implementedDirectives,
  amendments = [],
}: RelatedDocsPrefetcherProps) {
  const router = useRouter()

  useEffect(() => {
    prefetchManager.init(router)

    // Wait for main content to render before prefetching
    const timer = setTimeout(() => {
      const urls: string[] = []

      // Add EU directive URLs
      implementedDirectives.forEach((directive) => {
        urls.push(`/eu/direktiv/${directive.slug}`)
      })

      // Add amendment URLs (other SFS laws)
      amendments.forEach((amendment) => {
        if (amendment.slug) {
          urls.push(`/lagar/${amendment.slug}`)
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
  }, [router, implementedDirectives, amendments])

  // This component only handles prefetching, no UI
  return null
}
