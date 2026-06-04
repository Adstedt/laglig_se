'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { MapPin, ShieldCheck } from 'lucide-react'
import { OrgCheckForm } from './org-check-form'
import { useMediaQuery } from '@/lib/hooks/use-media-query'

// Client-only: the product shot pulls in heavy interactive deps (tanstack-table,
// dnd-kit) and dnd-kit's SSR ids cause hydration mismatches. Loading it client-
// side keeps the marketing page's first paint light and the hero hydration clean.
const HeroProductShot = dynamic(
  () => import('./hero-product-shot').then((m) => m.HeroProductShot),
  { ssr: false, loading: () => <div className="aspect-[1640/1080] w-full" /> }
)

const trustClaims = [
  {
    icon: ShieldCheck,
    label: 'GDPR från grunden',
    sub: 'personuppgifter skyddade',
  },
  {
    icon: MapPin,
    label: 'Data lagras i EU',
    sub: 'stannar inom EU',
  },
]

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
            <span className="block animate-fade-up">
              Det nya operativsystemet
            </span>
            <span className="block animate-fade-up-delay-1 text-foreground/45">
              för compliance.
            </span>
          </h1>

          <div className="mb-10 flex animate-fade-up-delay-2 flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-xl text-lg text-muted-foreground md:text-xl">
              Byggt för svenska företag, stora som små. Designat för AI-eran —
              där efterlevnad arbetar för er, inte tvärtom.
            </p>
            <OrgCheckForm
              eyebrow="Testa direkt · 30 sek"
              resultMode="modal"
              className="w-full shrink-0 lg:w-[400px]"
            />
          </div>
        </div>
      </div>

      {/* Product shot — wider than the text column (Linear-style). Frame rises
          in; the shot fades in when it finishes loading. */}
      <div className="relative mx-auto w-full max-w-[1600px] px-4 sm:px-6">
        <div className="relative animate-fade-up-delay-3">
          {/* Slow breathing warm halo behind the frame */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-16 -inset-y-12 animate-pulse-slow rounded-[3rem] bg-gradient-to-br from-amber-100/50 via-orange-50/25 to-transparent blur-3xl"
          />
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

      {/* Trust strip */}
      <div className="container relative mx-auto px-4 pb-12 md:pb-16 lg:pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="mt-12 flex flex-col gap-4 border-t border-border/60 pt-6 sm:flex-row sm:gap-12">
            {trustClaims.map((claim) => (
              <div key={claim.label} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground/70">
                  <claim.icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">
                    {claim.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{claim.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
