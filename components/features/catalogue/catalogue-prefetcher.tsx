'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const CATALOGUE_ROUTES = ['/rattskallor', '/lagar', '/rattsfall', '/eu']

interface CataloguePrefetcherProps {
  /** Current page number for prefetching adjacent pages */
  currentPage?: number
  /** Total pages to limit prefetch range */
  totalPages?: number
}

/**
 * Catalogue cross-page prefetcher
 *
 * Prefetches:
 * 1. Adjacent pages (prev/next) for pagination
 * 2. Other catalogue routes for cross-navigation
 *
 * Features:
 * - Respects data-saver mode
 * - Skips slow connections (2g)
 * - Deduplicates prefetch requests
 * - Staggered prefetching to avoid network congestion
 * - Renders nothing (pure side-effect component)
 */
export function CataloguePrefetcher({
  currentPage = 1,
  totalPages = 1,
}: CataloguePrefetcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const prefetched = useRef(new Set<string>())

  useEffect(() => {
    // Check for data-saver mode or slow connection
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const conn = navigator.connection as {
        saveData?: boolean
        effectiveType?: string
      }
      if (conn.saveData || conn.effectiveType === '2g') {
        return
      }
    }

    // Delay to let main content load first
    const delay = 500
    const timeout = setTimeout(() => {
      const urlsToPrefetch: string[] = []

      // 1. Prefetch adjacent pages (if multi-page)
      if (totalPages > 1) {
        const pagesToPrefetch = [currentPage - 1, currentPage + 1].filter(
          (p) => p >= 1 && p <= totalPages
        )

        pagesToPrefetch.forEach((page) => {
          // Handle static pagination (/rattskallor/sida/[page]) vs query param (?page=)
          let url: string
          if (pathname.includes('/sida/')) {
            // Static pagination route - replace page number
            url = pathname.replace(/\/sida\/\d+/, `/sida/${page}`)
          } else if (page === 1) {
            // Page 1 - remove page param
            const params = new URLSearchParams(searchParams.toString())
            params.delete('page')
            const qs = params.toString()
            url = qs ? `${pathname}?${qs}` : pathname
          } else {
            // Other pages - add/update page param
            const params = new URLSearchParams(searchParams.toString())
            params.set('page', String(page))
            url = `${pathname}?${params.toString()}`
          }
          urlsToPrefetch.push(url)
        })
      }

      // 2. Prefetch other catalogue routes
      const currentBase = pathname.split('/')[1]
        ? `/${pathname.split('/')[1]}`
        : pathname

      CATALOGUE_ROUTES.forEach((route) => {
        if (route !== currentBase && route !== pathname) {
          urlsToPrefetch.push(route)
        }
      })

      // Prefetch with staggering to avoid network congestion
      urlsToPrefetch.forEach((url, index) => {
        if (!prefetched.current.has(url)) {
          setTimeout(
            () => {
              router.prefetch(url)
              prefetched.current.add(url)
            },
            index * 100 // 100ms stagger between each prefetch
          )
        }
      })
    }, delay)

    return () => clearTimeout(timeout)
  }, [router, pathname, searchParams, currentPage, totalPages])

  // Render nothing - this is a pure side-effect component
  return null
}
