'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { OrgCheckForm } from './org-check-form'
import { useMediaQuery } from '@/lib/hooks/use-media-query'

// Client-only: the product shot pulls in heavy interactive deps (tanstack-table,
// dnd-kit) and dnd-kit's SSR ids cause hydration mismatches. Loading it client-
// side keeps the marketing page's first paint light and the hero hydration clean.
const HeroProductShot = dynamic(
  () => import('./hero-product-shot').then((m) => m.HeroProductShot),
  { ssr: false, loading: () => <div className="aspect-[1640/1080] w-full" /> }
)

export function HeroV3() {
  // Phones get a crisp static screenshot instead of the live navigable shot —
  // it keeps the heavy table/dnd JS off mobile and avoids an unreadable scale.
  const isDesktop = useMediaQuery('(min-width: 768px)')

  return (
    <section className="relative overflow-hidden">
      {/* Headline block — constrained to the text column width. Lines reveal in
          sequence via the design system's CSS fade-up utilities (compositor-
          driven, so they never stall behind the heavy product shot mounting). */}
      <div className="container relative mx-auto px-4 pt-16 md:pt-24 lg:pt-28">
        <div className="mx-auto max-w-7xl">
          <h1
            className="mb-5 max-w-5xl text-[2.5rem] font-medium leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-[4.75rem]"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            <span className="block animate-fade-up">Håll koll på lagarna.</span>
            <span className="block animate-fade-up-delay-1 text-foreground/45">
              Automatiskt.
            </span>
          </h1>

          <div className="mb-10 flex animate-fade-up-delay-2 flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-xl text-lg text-muted-foreground md:text-xl">
              Laglig samlar alla regler som gäller just er verksamhet, håller
              dem aktuella när lagarna ändras, och hjälper er bevisa att ni
              följer dem — utan att ni behöver vara experter.
            </p>
            <OrgCheckForm
              eyebrow="Vilka regler gäller er? · 30 sek"
              resultMode="modal"
              className="w-full shrink-0 lg:w-[400px]"
            />
          </div>
        </div>
      </div>

      {/* Product shot — wider than the text column (Linear-style). Frame rises
          in; the shot fades in when it finishes loading. Bottom padding carries
          the hero into section 02 (the old trust strip lived here). */}
      <div className="relative mx-auto w-full max-w-[1600px] px-4 pb-6 sm:px-6 md:pb-14">
        <div className="relative animate-fade-up-delay-3">
          <div
            className="relative overflow-hidden rounded-[1.25rem] bg-card ring-1 ring-foreground/[0.07]"
            style={{
              boxShadow: [
                '0 1px 2px 0 rgb(0 0 0 / 0.03)',
                '0 8px 16px -4px rgb(0 0 0 / 0.05)',
                '0 24px 48px -12px rgb(0 0 0 / 0.10)',
                '0 56px 112px -28px rgb(0 0 0 / 0.16)',
              ].join(', '),
            }}
          >
            {/* Top-edge highlight — light catching the rounded top edge */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"
            />
            {isDesktop ? (
              <HeroProductShot />
            ) : (
              // Linear-style focal partial: a legible crop of the laglista, the
              // rest of the app bleeding off behind soft edge fades.
              <div className="relative">
                <Image
                  src="/images/landing-v3/hero.webp"
                  alt="Laglig.se – laglista med krav, status och ansvar per regelverk"
                  width={1504}
                  height={1391}
                  className="block h-auto w-full"
                  priority
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card/80 to-transparent" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
