'use client'

/**
 * Story 3.3: Media Query Hook
 * Reactive hook for responsive design
 */

import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Check if window is defined (SSR safety)
    if (typeof window === 'undefined') {
      return
    }

    const mediaQueryList = window.matchMedia(query)

    // Set initial value
    setMatches(mediaQueryList.matches)

    // Create event listener
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Add listener
    mediaQueryList.addEventListener('change', listener)

    // Cleanup
    return () => {
      mediaQueryList.removeEventListener('change', listener)
    }
  }, [query])

  return matches
}
