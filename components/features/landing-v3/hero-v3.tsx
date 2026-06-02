'use client'

import dynamic from 'next/dynamic'
import { MapPin, Database, ShieldCheck } from 'lucide-react'
import { OrgCheckForm } from './org-check-form'

// Client-only: the product shot pulls in heavy interactive deps (tanstack-table,
// dnd-kit) and dnd-kit's SSR ids cause hydration mismatches. Loading it client-
// side keeps the marketing page's first paint light and the hero hydration clean.
const HeroProductShot = dynamic(
  () => import('./hero-product-shot').then((m) => m.HeroProductShot),
  { ssr: false, loading: () => <div className="aspect-[1640/1080] w-full" /> }
)

const trustClaims = [
  {
    icon: Database,
    label: '10 000+ lagar och regler',
    sub: 'uppdateras varje dag',
  },
  {
    icon: MapPin,
    label: 'Data lagras i Sverige',
    sub: 'tryggt och säkert',
  },
  {
    icon: ShieldCheck,
    label: 'Spårbart från start',
    sub: 'redo när någon frågar',
  },
]

export function HeroV3() {
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
      <div className="relative mx-auto w-full max-w-[1476px] px-4 sm:px-6">
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
            <HeroProductShot />
          </div>
        </div>
      </div>

      {/* Trust strip */}
      <div className="container relative mx-auto px-4 pb-12 md:pb-16 lg:pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="mt-12 grid grid-cols-1 gap-3 border-t border-border/60 pt-6 sm:grid-cols-3">
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
