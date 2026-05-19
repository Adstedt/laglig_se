import Link from 'next/link'
import Image from 'next/image'
import {
  MapPin,
  Database,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react'

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
          {/* Eyebrow */}
          <div className="mb-7">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/50 px-3.5 py-1.5 text-xs font-medium backdrop-blur"
              style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
            >
              <Sparkles className="h-3 w-3 text-foreground/60" />
              <span>Compliance OS · Öppen beta</span>
            </div>
          </div>

          {/* H1 — left-aligned, spans wide, second line muted for rhythm */}
          <h1
            className="mb-8 max-w-5xl text-[2.5rem] font-medium leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-[4.75rem]"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            <span className="block">Compliance, byggt</span>
            <span className="block text-foreground/45">för moderna team.</span>
          </h1>

          {/* Sub on the left + small "live" callout on the right — Linear's
              dot-and-link pattern. Aligns to the same baseline as the sub at
              lg+, stacks below on mobile. */}
          <div className="mb-10 flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-xl text-lg text-muted-foreground md:text-xl">
              Operativsystemet för efterlevnad. Bevaka lagändringar, fördela
              ansvar och visa spårbarhet — på ett ställe.
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

          {/* Product screenshot — the visual anchor. Sits below the title block
              with a subtle warm halo and a soft frame, matching the floating-
              window aesthetic Linear uses for its hero capture. */}
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -inset-y-8 rounded-[2rem] bg-gradient-to-br from-amber-100/40 via-orange-50/20 to-transparent blur-3xl"
            />
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl ring-1 ring-foreground/5">
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
