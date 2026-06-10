'use client'

import { useCallback } from 'react'
import { OrgCheckForm } from '@/components/features/landing-v3/org-check-form'
import { trackEvent } from '@/lib/track-event'

/**
 * The org-number test as a marketing-page conversion section
 * (Story 26.1 AC 13). Wraps the landing-v3 OrgCheckForm in a section frame
 * and instruments successful previews. Rendered by the templates when
 * frontmatter `showOrgCheck: true` — typically the mid-page conversion slot.
 */
export function OrgCheckCta({
  kind,
  slug,
  heading = 'Vilka regler gäller er?',
  supporting = 'Skriv in ert organisationsnummer så visar vi vilka regelområden som berör just er verksamhet — på 30 sekunder, utan konto.',
}: {
  kind: string
  slug: string
  heading?: string
  supporting?: string
}) {
  const onPreviewSuccess = useCallback(() => {
    trackEvent('marketing_org_check_submit', { kind, slug })
  }, [kind, slug])

  return (
    <section className="bg-[hsl(var(--section-warm,45_30%_96%))]">
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-safiro text-2xl font-medium tracking-tight text-foreground md:text-3xl">
            {heading}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            {supporting}
          </p>
          <div className="mx-auto mt-7 max-w-md text-left">
            <OrgCheckForm
              resultMode="inline"
              onPreviewSuccess={onPreviewSuccess}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
