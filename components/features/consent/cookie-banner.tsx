'use client'

/**
 * Fixed-bottom consent banner shown until the user accepts or rejects.
 * Symmetric Accept / Reject buttons (IMY guidance — both equally
 * prominent), with a secondary "Inställningar" link that opens the
 * per-category dialog for users who want finer control.
 *
 * Hidden once hydrated && hasDecided — re-opens from the footer
 * "Cookieinställningar" link (which calls `openSettings()`).
 */

import Link from 'next/link'
import { Cookie } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConsent } from '@/components/providers/consent-provider'
import { cn } from '@/lib/utils'

export function CookieBanner() {
  const { hydrated, hasDecided, acceptAll, rejectAll, openSettings } =
    useConsent()

  // Skip render entirely until we know the prior state — prevents flash.
  if (!hydrated) return null
  if (hasDecided) return null

  return (
    <div
      role="region"
      aria-label="Cookieinställningar"
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 backdrop-blur',
        'supports-[backdrop-filter]:bg-card/85',
        'shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.18)]'
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex flex-1 items-start gap-3">
          <Cookie
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
          />
          <div className="space-y-1">
            <p className="font-safiro text-base font-medium leading-tight tracking-tight">
              Vi använder cookies
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Nödvändiga cookies krävs för att tjänsten ska fungera (t.ex.
              inloggning och val av arbetsyta). Med din tillåtelse använder vi
              även cookies för anonym besöksstatistik och för att mäta våra
              annonser. Läs mer i vår{' '}
              <Link
                href="/cookiepolicy"
                className="underline underline-offset-4 hover:text-foreground"
              >
                cookiepolicy
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={openSettings}
            className="text-muted-foreground hover:text-foreground"
          >
            Inställningar
          </Button>
          <Button variant="outline" size="sm" onClick={rejectAll}>
            Bara nödvändiga
          </Button>
          <Button size="sm" onClick={acceptAll}>
            Acceptera alla
          </Button>
        </div>
      </div>
    </div>
  )
}
