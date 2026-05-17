import Link from 'next/link'
import {
  MapPin,
  Database,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react'

import { HeroPreview } from '@/components/features/landing/hero-preview'

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
      <div className="container relative mx-auto px-4 pb-16 pt-24 md:pb-24 md:pt-28 lg:pb-28 lg:pt-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-10 xl:gap-16">
          {/* Left: positioning */}
          <div>
            <div className="mb-7">
              <div
                className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/50 px-3.5 py-1.5 text-xs font-medium backdrop-blur"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                <Sparkles className="h-3 w-3 text-foreground/60" />
                <span>Gör det enkelt att följa lagen</span>
              </div>
            </div>

            <h1
              className="mb-7 text-[2.5rem] font-medium leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-[4.5rem]"
              style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
            >
              <span className="block">Allt regelverk.</span>
              <span className="block text-foreground/70">
                Alla kravpunkter.
              </span>
              <span className="block">All efterlevnad.</span>
              <span className="block text-foreground/40">På ett ställe.</span>
            </h1>

            <p className="mb-8 max-w-xl text-lg text-muted-foreground md:text-xl">
              Laglig.se samlar alla lagar och regler som gäller ert företag på
              ett ställe – så ni vet vad ni ska göra, vem som gör det, och kan
              visa att det blev gjort. Att söka i lagboken är alltid gratis.
            </p>

            {/* Trust strip — only verifiable claims */}
            <div className="grid grid-cols-1 gap-3 border-t border-border/60 pt-6 sm:grid-cols-3">
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

            <div className="mt-6">
              <Link
                href="/sok"
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Eller sök i lagboken gratis – inget konto behövs
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* Right: the conversion tool — org-number + website → laglista */}
          <div className="relative">
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-amber-100/40 via-orange-50/20 to-transparent blur-3xl" />

            <div className="relative rounded-2xl border border-border/60 bg-card p-6 shadow-xl md:p-7">
              <div className="mb-5">
                <div
                  className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-medium text-background"
                  style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                >
                  Testa gratis — 30 sekunder
                </div>
                <h2
                  className="text-xl font-semibold"
                  style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                >
                  Vilka regler gäller ert företag?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Skriv in ert organisationsnummer så ser ni direkt vad ni
                  behöver ha koll på. Lägg till en webbplats för en mer
                  träffsäker bild.
                </p>
              </div>

              <HeroPreview />

              <p className="mt-4 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                Sen bygger vi er egen laglista – med allt ni behöver göra,
                samlat och klart.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
