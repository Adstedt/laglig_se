import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { StyleguideClient } from './styleguide-client'

/**
 * Living component index — renders the real `components/ui/*` primitives,
 * design tokens, and bespoke CSS patterns against the actual Tailwind build
 * and `globals.css`. Because it imports the shipping source, it never drifts:
 * tweak a token or a CVA variant and every specimen here updates with it.
 *
 * Availability: local dev + Vercel Preview deploys (so the page can be shared
 * for design review), but blocked on real Production. Always noindex.
 */
export const metadata: Metadata = {
  title: 'Komponentindex',
  robots: { index: false, follow: false },
}

export default function StyleguidePage() {
  if (process.env.VERCEL_ENV === 'production') {
    notFound()
  }

  return <StyleguideClient />
}
