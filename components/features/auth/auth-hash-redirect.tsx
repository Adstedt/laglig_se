'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * Recovers the password-reset flow when Supabase redirects the user to a
 * page that isn't `/reset-password/confirm`. This happens when the project
 * Site URL is misconfigured or the requested redirect_to isn't whitelisted —
 * Supabase falls back to the Site URL and the recovery tokens get stranded
 * in the URL hash.
 *
 * Two hash shapes we recover from:
 *
 *   1. Successful recovery — `#access_token=...&type=recovery&...`
 *      Route to `/reset-password/confirm` and preserve the hash so the
 *      Supabase client there picks up the recovery session.
 *
 *   2. Failed recovery — `#error=access_denied&error_code=otp_expired&...`
 *      Route to `/reset-password?error=expired` so the user sees a clean
 *      "request a new link" screen instead of being stranded on the
 *      homepage with a cryptic URL.
 *
 * Mounted from the root layout so it covers any landing path. Skips itself
 * on `/reset-password/confirm` (so we don't loop) and on `/reset-password`
 * (so we don't clobber the error param the form already reads).
 */
export function AuthHashRedirect() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.location.hash) return

    // Already on a reset-password page — let those handle it.
    if (pathname?.startsWith('/reset-password')) return

    const hash = window.location.hash
    const params = new URLSearchParams(hash.substring(1))

    if (params.get('type') === 'recovery' && params.get('access_token')) {
      // Preserve hash so the confirm page's Supabase client reads the session.
      window.location.replace(`/reset-password/confirm${hash}`)
      return
    }

    if (params.get('error_code') === 'otp_expired') {
      router.replace('/reset-password?error=expired')
      return
    }
  }, [pathname, router])

  return null
}
