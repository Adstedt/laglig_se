'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/track-event'
import { buildUtmUrl, type CtaPlacement } from '@/lib/marketing/utm'

/**
 * UTM-tagged, event-instrumented CTA (Story 26.1 AC 11–12).
 *
 * Every conversion CTA on a marketing page goes through this block so
 * attribution ({kind}-{slug} × placement) is consistent across the funnel.
 * Client island: the click handler fires trackEvent (Vercel + consent-gated
 * GA4) — no raw gtag calls.
 */
export function CtaBlock({
  kind,
  slug,
  placement,
  label,
  href,
  variant = 'inline',
  secondaryNote,
}: {
  kind: string
  slug: string
  placement: CtaPlacement
  label: string
  href: string
  /** inline = button only (hero/mid-page slots); band = full-width ink strip */
  variant?: 'inline' | 'band'
  secondaryNote?: string | undefined
}) {
  const url = buildUtmUrl(href, { kind, slug, placement })
  const onClick = () => {
    trackEvent('marketing_cta_click', { kind, slug, placement })
  }

  const button = (
    <Button
      size="lg"
      variant={variant === 'band' ? 'secondary' : 'default'}
      className="h-12 px-7 text-base font-semibold"
      asChild
    >
      <Link href={url} onClick={onClick}>
        {label}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Button>
  )

  if (variant === 'inline') {
    return (
      <div>
        {button}
        {secondaryNote && (
          <p className="mt-2.5 text-xs text-muted-foreground">
            {secondaryNote}
          </p>
        )}
      </div>
    )
  }

  // Full-width closing band — the landing-v3 CtaV3 ink treatment.
  return (
    <section className="relative overflow-hidden bg-foreground text-background">
      <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-background/5 blur-3xl" />
      <div className="container relative mx-auto px-4 py-16 text-center md:py-20">
        <h2 className="mb-4 font-safiro text-3xl font-medium tracking-tight md:text-4xl">
          Kom igång på två minuter
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-lg opacity-80">
          Skapa er laglista och låt Laglig hålla koll på vad som gäller — och
          vad som ändras.
        </p>
        <div className="flex justify-center">{button}</div>
        {secondaryNote && (
          <p className="mt-6 text-xs opacity-60">{secondaryNote}</p>
        )}
      </div>
    </section>
  )
}
