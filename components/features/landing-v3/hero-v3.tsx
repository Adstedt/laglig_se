import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Database, ShieldCheck, ArrowRight } from 'lucide-react'

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
      <div className="container relative mx-auto px-4 pb-12 pt-12 md:pb-16 md:pt-16 lg:pb-20 lg:pt-20">
        <div className="mx-auto max-w-7xl">
          {/* H1 — bold category claim. The "OS for X" move (cf. Notion's
              "OS for work", Ramp's "finance OS"). Second line muted to keep
              the visual rhythm we already use elsewhere on the page. */}
          <h1
            className="mb-8 max-w-5xl text-[2.5rem] font-medium leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-[4.75rem]"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            <span className="block">Det nya operativsystemet</span>
            <span className="block text-foreground/45">för efterlevnad.</span>
          </h1>

          {/* Sub names the ICP explicitly (SMB primary, compliance-team
              secondary) and the AI-era category. Workflow pillars after the
              em-dash. Same dot-and-link callout pattern as Linear. */}
          <div className="mb-10 flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
              Byggt för svenska företag, stora som små. Designat för AI-eran —
              så ni bevakar lagändringar, fördelar ansvar och visar spårbarhet
              på ett ställe.
            </p>
            <Link
              href="/sok"
              className="group inline-flex shrink-0 items-center gap-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500/70 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-600" />
              </span>
              <span>10 000+ lagar bevakas dagligen</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Product screenshot — the visual anchor. Linear-style edge:
              multi-layer drop shadow simulating real-world light falloff
              (near + mid + far), a hairline top-edge highlight catching
              "light", and a soft ring instead of a hard border so the frame
              feels like polished glass rather than a stroked rectangle. */}
          <div className="relative">
            {/* Soft warm halo behind the frame */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-16 -inset-y-12 rounded-[3rem] bg-gradient-to-br from-amber-100/45 via-orange-50/25 to-transparent blur-3xl"
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
              {/* Top-edge highlight — thin gradient line that gives the
                  illusion of light catching the rounded top edge */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"
              />
              <Image
                src="/landing-v3/hero-laglistor.png"
                alt="Laglig.se laglistor — översikt över alla regelområden och dokument för Almåsa Havshotell AB"
                width={1440}
                height={900}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>

          {/* Trust strip — moved below the screenshot, customer-logo-band style */}
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
