'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { prefetchManager } from '@/lib/prefetch'

// Court URL segment mapping (duplicated for simplicity, same as cross-references)
const COURT_URL_MAP: Record<string, string> = {
  COURT_CASE_AD: 'ad',
  COURT_CASE_HD: 'hd',
  COURT_CASE_HFD: 'hfd',
  COURT_CASE_HOVR: 'hovr',
  COURT_CASE_MOD: 'mod',
  COURT_CASE_MIG: 'mig',
}

interface CourtCase {
  slug: string
  contentType: string
}

interface Directive {
  slug: string
}

interface Amendment {
  slug: string | null
}

interface RelatedDocsPrefetcherProps {
  /** Court cases that cite this law */
  citingCases: CourtCase[]
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
 * - Court cases citing this law
 * - EU directives this law implements
 * - Amendment history links
 */
export function RelatedDocsPrefetcher({
  citingCases,
  implementedDirectives,
  amendments = [],
}: RelatedDocsPrefetcherProps) {
  const router = useRouter()

  useEffect(() => {
    prefetchManager.init(router)

    // Wait for main content to render before prefetching
    const timer = setTimeout(() => {
      const urls: string[] = []

      // Add court case URLs
      citingCases.forEach((courtCase) => {
        const courtSegment = COURT_URL_MAP[courtCase.contentType]
        if (courtSegment) {
          urls.push(`/rattsfall/${courtSegment}/${courtCase.slug}`)
        }
      })

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
  }, [router, citingCases, implementedDirectives, amendments])

  // This component only handles prefetching, no UI
  return null
}
