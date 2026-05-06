'use client'

/**
 * Story 5.13: Bottom-right countdown banner.
 *
 * Renders only when the workspace is in TRIAL with 1-2 days left
 * (Days 13/14 of a 15-day trial). Mounted from app/(workspace)/layout.tsx
 * which computes daysLeft server-side and omits the banner entirely
 * outside the trigger window.
 *
 * Dismiss persists for the browser session via sessionStorage. New session
 * → banner re-appears (so a user who dismisses on Day 13 still sees the
 * stronger Day 14 nudge if they return the next day).
 *
 * Accessibility:
 * - role="status" + aria-live="polite" so screen readers announce on appear
 *   without stealing focus.
 * - Dismiss button is keyboard-focusable with aria-label.
 * - CTA is a real <Link>, not a div+onClick.
 *
 * Mobile (<640px): hidden via Tailwind's `hidden sm:flex`. The countdown
 * email + the in-app /settings billing surface remain reachable; dropping
 * the floating banner avoids overlapping bottom nav on small viewports.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TrialCountdownBannerProps {
  daysLeft: number
}

const SESSION_DISMISS_KEY = 'laglig:trial-countdown-banner-dismissed'

export function TrialCountdownBanner({ daysLeft }: TrialCountdownBannerProps) {
  const [dismissed, setDismissed] = useState(true) // start hidden until SSR mismatch resolves

  useEffect(() => {
    // Sync dismiss state from sessionStorage on mount. Defaults to NOT dismissed
    // when no key exists (banner shows). Wrapped in try/catch because some
    // browsers throw on storage access in private mode.
    try {
      const stored = window.sessionStorage.getItem(SESSION_DISMISS_KEY)
      setDismissed(stored === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (dismissed) return null

  const handleDismiss = () => {
    try {
      window.sessionStorage.setItem(SESSION_DISMISS_KEY, '1')
    } catch {
      // ignore — dismiss still works for current render via state
    }
    setDismissed(true)
  }

  const dayLabel = daysLeft === 1 ? '1 dag' : `${daysLeft} dagar`

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-4 z-40 hidden w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-lg sm:flex sm:flex-col dark:border-amber-900 dark:bg-amber-950"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded-full bg-amber-100 p-1.5 dark:bg-amber-900">
          <Clock
            className="h-4 w-4 text-amber-700 dark:text-amber-200"
            aria-hidden="true"
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Din provperiod slutar om {dayLabel}
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200/80">
            Aktivera din prenumeration för att fortsätta använda Laglig.se.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Stäng"
          className="-mt-1 -mr-1 shrink-0 rounded-md p-1 text-amber-900/60 hover:bg-amber-100 hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-amber-200/60 dark:hover:bg-amber-900 dark:hover:text-amber-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 flex justify-end">
        <Button asChild size="sm" variant="default">
          <Link href="/settings?tab=billing">Aktivera nu</Link>
        </Button>
      </div>
    </div>
  )
}
