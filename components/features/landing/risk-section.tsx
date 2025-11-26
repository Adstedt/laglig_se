'use client'

import {
  AlertTriangle,
  FileStack,
  RefreshCw,
  Layers,
  ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const risks = [
  {
    icon: FileStack,
    title: 'Vilka gäller er?',
    description:
      'GDPR, arbetsmiljö, branschkrav... Listan är lång. Och unik för varje företag.',
    stat: '200+',
    statLabel: 'lagar',
  },
  {
    icon: RefreshCw,
    title: 'Vad har ändrats?',
    description:
      'Nya krav. Uppdaterade regler. Flyttade deadlines. Varje månad händer något.',
    stat: '50+',
    statLabel: 'ändringar/år',
  },
  {
    icon: Layers,
    title: 'Vem hinner kolla?',
    description:
      'Riksdag, myndigheter, branschorgan. Informationen är utspridd överallt.',
    stat: '20+',
    statLabel: 'källor att bevaka',
  },
  {
    icon: ShieldAlert,
    title: 'Vad är risken?',
    description:
      'Böter, personligt ansvar, förlorade affärer. Det räcker att missa en gång.',
    stat: 'Dyrt',
    statLabel: 'att missa',
  },
]

export function RiskSection() {
  return (
    <section className="relative border-y bg-gradient-to-b from-stone-50 to-stone-100/50 py-16 dark:from-stone-950/50 dark:to-stone-900/30 md:py-24">
      {/* Soft gradient mesh */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
            radial-gradient(at 10% 20%, hsl(40 50% 95% / 0.6) 0px, transparent 50%),
            radial-gradient(at 90% 80%, hsl(35 40% 94% / 0.5) 0px, transparent 50%),
            radial-gradient(at 50% 50%, hsl(45 30% 96% / 0.3) 0px, transparent 60%)
          `,
          }}
        />
      </div>

      <div className="container relative mx-auto px-4">
        {/* Header */}
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            Verkligheten för svenska företag
          </div>
          <h2
            className="mb-6 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Vet ni vilka lagar som{' '}
            <span className="relative">
              <span className="relative z-10">gäller er</span>
              <span className="absolute bottom-1 left-0 right-0 z-0 h-3 bg-red-200/60 dark:bg-red-900/40" />
            </span>
            ?
          </h2>
          <p className="text-lg text-muted-foreground md:text-xl">
            De flesta gissar. Resten kämpar med krångliga verktyg. Det finns ett
            enklare sätt.
          </p>
        </div>

        {/* Risk cards - Premium design */}
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2 lg:grid-cols-4">
          {risks.map((risk) => (
            <div
              key={risk.title}
              className={cn(
                'group relative overflow-hidden rounded-2xl border bg-gradient-to-b from-card to-card/80 p-6 transition-all duration-300',
                'hover:border-amber-300/60 hover:shadow-xl hover:shadow-amber-100/40 hover:-translate-y-1',
                'dark:hover:border-amber-800/60 dark:hover:shadow-amber-950/40'
              )}
            >
              {/* Subtle gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50/0 to-amber-50/0 transition-colors group-hover:from-amber-50/50 group-hover:to-orange-50/30 dark:group-hover:from-amber-950/20 dark:group-hover:to-orange-950/10" />

              <div className="relative">
                {/* Icon - more refined */}
                <div className="mb-5 inline-flex rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 p-3 text-amber-600 shadow-sm dark:from-amber-900/50 dark:to-amber-950/30 dark:text-amber-400">
                  <risk.icon className="h-5 w-5" />
                </div>

                {/* Stat - larger, more impactful */}
                <div className="mb-4">
                  <span
                    className="text-4xl font-bold tracking-tight text-foreground"
                    style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                  >
                    {risk.stat}
                  </span>
                  <span className="ml-1.5 text-sm text-muted-foreground">
                    {risk.statLabel}
                  </span>
                </div>

                {/* Title - slightly larger */}
                <h3 className="mb-2 text-base font-semibold">{risk.title}</h3>

                {/* Description */}
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {risk.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom message - bridge to solution */}
        <div className="mx-auto mt-16 max-w-2xl text-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-dashed border-muted-foreground/30 bg-background/50 px-6 py-3 backdrop-blur-sm">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-muted-foreground/40" />
            <p className="text-lg font-medium text-foreground">
              Tänk om någon annan kunde göra det åt er?
            </p>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-muted-foreground/40" />
          </div>
        </div>
      </div>
    </section>
  )
}
