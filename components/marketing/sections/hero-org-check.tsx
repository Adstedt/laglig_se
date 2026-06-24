'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { OrgCheckForm } from '@/components/features/landing-v3/org-check-form'
import { trackEvent } from '@/lib/track-event'
import { buildUtmUrl } from '@/lib/marketing/utm'

/**
 * Hero conversion for marketing pages with `showOrgCheck`: leads with the
 * org-number tester (value-first, modal result so it never balloons the hero
 * column) and demotes the trial signup to a secondary text link. Mirrors the
 * landing-v3 hero, while keeping the same UTM/analytics attribution as
 * <CtaBlock placement="hero">. The mid-page OrgCheckCta still stands on its own
 * as a re-conversion point further down.
 */
export function HeroOrgCheck({
  kind,
  slug,
  ctaLabel,
  ctaHref,
}: {
  kind: string
  slug: string
  ctaLabel: string
  ctaHref: string
}) {
  const onPreviewSuccess = useCallback(() => {
    trackEvent('marketing_org_check_submit', { kind, slug, placement: 'hero' })
  }, [kind, slug])

  const onSecondaryClick = useCallback(() => {
    trackEvent('marketing_cta_click', { kind, slug, placement: 'hero' })
  }, [kind, slug])

  const secondaryUrl = buildUtmUrl(ctaHref, { kind, slug, placement: 'hero' })

  return (
    <div className="w-full max-w-md">
      <OrgCheckForm
        eyebrow="Testa direkt · 30 sek"
        resultMode="modal"
        onPreviewSuccess={onPreviewSuccess}
      />
      <p className="mt-3 pl-1 text-xs text-muted-foreground">
        Eller{' '}
        <Link
          href={secondaryUrl}
          onClick={onSecondaryClick}
          className="inline-flex items-center gap-0.5 font-medium text-foreground underline-offset-2 hover:underline"
        >
          {ctaLabel.toLowerCase()} direkt
          <ArrowRight className="h-3 w-3" />
        </Link>{' '}
        · 15 dagar, inget betalkort krävs.
      </p>
    </div>
  )
}
