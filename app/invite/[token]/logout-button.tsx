'use client'

/**
 * Story 5.3 / QA fix: The invite page's email-mismatch state needs to let
 * the user sign out and re-attempt the invite link. The app uses NextAuth's
 * client-side `signOut()` (see components/layout/user-menu.tsx) — there is
 * no `/logout` route. This tiny client wrapper lives next to the server
 * page so we can preserve the intended UX without converting the whole
 * page to a client component.
 */

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

interface LogoutAndRetryButtonProps {
  /** Where to send the user after signOut completes. */
  returnTo: string
}

export function LogoutAndRetryButton({ returnTo }: LogoutAndRetryButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={() => signOut({ callbackUrl: returnTo })}
    >
      Logga ut
    </Button>
  )
}
