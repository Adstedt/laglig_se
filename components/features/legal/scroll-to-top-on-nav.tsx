'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Forces scroll-to-top on every legal-page route change. Next.js App Router
// usually does this automatically, but sticky navs + shared layouts can leave
// the user mid-scroll on the previous page — this guarantees they land at the
// hero whenever they click a sidebar/breadcrumb link.
export function ScrollToTopOnNav() {
  const pathname = usePathname()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}
