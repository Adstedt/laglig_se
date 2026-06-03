'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// "Funkar för hela företaget" — the SCALE story: the same platform fits a sole
// trader and a 300-person group. Skyldigheterna (regelområden) grow with size;
// the product grows with them. Editorial left + interactive workspace right,
// mirroring the #2 problem section's layout + quality. Near-monochrome warm,
// one sparing amber accent on what's *new at this size*.

interface Tier {
  id: string
  label: string
  people: string
  stats: { value: string; label: string }[]
  newRegs: string[]
}

const TIERS: Tier[] = [
  {
    id: 'firma',
    label: 'Enskild firma',
    people: '1 person',
    stats: [
      { value: '3', label: 'regelområden' },
      { value: '1', label: 'laglista' },
      { value: 'Du', label: 'ansvarig' },
      { value: 'Vid behov', label: 'kontroller' },
    ],
    newRegs: ['Bokföring', 'Skatt', 'Avtal'],
  },
  {
    id: 'litet',
    label: 'Litet AB',
    people: '2–10 anställda',
    stats: [
      { value: '6', label: 'regelområden' },
      { value: '1', label: 'laglista' },
      { value: '2–3', label: 'ansvariga' },
      { value: 'Årlig', label: 'genomgång' },
    ],
    newRegs: ['Arbetsmiljö', 'Arbetsrätt', 'Försäkringar'],
  },
  {
    id: 'vaxande',
    label: 'Växande bolag',
    people: '11–49 anställda',
    stats: [
      { value: '9', label: 'regelområden' },
      { value: '2', label: 'laglistor' },
      { value: 'Team', label: 'med roller' },
      { value: 'Löpande', label: 'kontroller' },
    ],
    newRegs: ['Systematiskt arbetsmiljöarbete', 'Dataskydd', 'Kollektivavtal'],
  },
  {
    id: 'koncern',
    label: 'Etablerat bolag',
    people: '50+ anställda',
    stats: [
      { value: '12+', label: 'regelområden' },
      { value: 'Flera', label: 'laglistor' },
      { value: 'Team', label: '+ revisor' },
      { value: 'Kvartal', label: 'kontroller' },
    ],
    newRegs: [
      'Aktiva åtgärder mot diskriminering',
      'Visselblåsarfunktion',
      'Hållbarhetsrapportering',
    ],
  },
]

export function ScaleSection() {
  const [activeId, setActiveId] = useState('litet')
  const activeIndex = Math.max(
    0,
    TIERS.findIndex((t) => t.id === activeId)
  )
  const active = TIERS[activeIndex]!

  // Accumulated regelområden up to (and including) the selected size — the ones
  // added *at this size* are highlighted in amber so the list visibly grows.
  const regs = TIERS.slice(0, activeIndex + 1).flatMap((t, ti) =>
    t.newRegs.map((r) => ({ name: r, isNew: ti === activeIndex }))
  )

  return (
    <section
      id="skala"
      className="relative scroll-mt-16 overflow-hidden border-y bg-section-warm py-12 md:py-20"
    >
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            En plattform, alla storlekar
          </p>

          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
            {/* LEFT — editorial */}
            <div className="lg:col-span-5">
              <h2
                className="mb-6 text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl lg:text-[3rem]"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                Funkar för hela företaget.
                <br />
                <span className="text-foreground/40">
                  Från enskild firma till koncern.
                </span>
              </h2>

              <p className="mb-6 max-w-md text-lg leading-relaxed text-muted-foreground">
                Skyldigheterna växer med företaget — men det gör systemet också.
                Samma plattform, oavsett om ni är tre eller trehundra.
              </p>

              <p className="max-w-md text-lg leading-relaxed text-foreground/85">
                Ni börjar enkelt och lägger till i takt med att ni växer.
                <span className="mt-3 block text-muted-foreground">
                  Fler regelområden, fler laglistor, team med behörigheter och
                  återkommande kontroller — utan att byta verktyg.
                </span>
              </p>
            </div>

            {/* RIGHT — the workspace, scaled to the selected size */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border bg-card/50 p-4 shadow-[0_1px_0_0_rgb(0_0_0_/_0.02),0_12px_32px_-16px_rgb(0_0_0_/_0.10)] backdrop-blur-sm md:p-5">
                {/* size selector */}
                <div className="flex flex-wrap gap-1.5">
                  {TIERS.map((t) => {
                    const isActive = t.id === activeId
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveId(t.id)}
                        className={cn(
                          'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition',
                          isActive
                            ? 'bg-foreground text-background shadow-sm'
                            : 'bg-card text-muted-foreground ring-1 ring-border hover:text-foreground hover:ring-foreground/25'
                        )}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>

                {/* workspace at this size */}
                <div className="mt-4 rounded-2xl border border-border/70 bg-card p-5 md:p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <p
                      className="text-base font-medium"
                      style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                    >
                      {active.label}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {active.people}
                    </span>
                  </div>

                  {/* stats */}
                  <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
                    {active.stats.map((s) => (
                      <div key={s.label} className="min-w-0">
                        <div
                          className="text-xl font-medium leading-tight tracking-tight"
                          style={{
                            fontFamily: "'Safiro', system-ui, sans-serif",
                          }}
                        >
                          {s.value}
                        </div>
                        <div className="mt-1 text-[11px] leading-tight text-muted-foreground">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* growing regelområden */}
                  <p className="mb-2.5 mt-6 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Regelområden ni omfattas av
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {regs.map((r) => (
                      <span
                        key={r.name}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition',
                          r.isNew
                            ? 'bg-card font-medium text-foreground shadow-sm ring-1 ring-amber-400/50'
                            : 'text-foreground/45 ring-1 ring-border'
                        )}
                      >
                        {r.isNew && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        )}
                        {r.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* count strip */}
                <div className="mt-4 flex items-center justify-between px-1 text-[12px]">
                  <span className="text-muted-foreground">
                    Samma system — det växer med er.
                  </span>
                  <span className="font-medium text-amber-900">
                    + {active.newRegs.length} nya vid den här storleken
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
