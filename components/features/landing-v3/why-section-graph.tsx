import { User, Users, Building, Building2 } from 'lucide-react'

import { cn } from '@/lib/utils'

// Each tier inherits the areas of the tiers before it and adds its own.
// The point of the visual: obligations grow with size — but are never zero.
// Prototype variant of WhySection that renders the growth story as a stepped
// bar chart composed of category segments instead of a four-card grid.
const tiers = [
  {
    icon: User,
    label: 'Enskild firma',
    people: 'Du, kanske en till',
    newAreas: ['Bokföring', 'Skatt', 'Avtal'],
  },
  {
    icon: Users,
    label: 'Litet AB',
    people: '2–10 anställda',
    newAreas: ['Arbetsmiljö', 'Arbetsrätt', 'Försäkringar'],
  },
  {
    icon: Building,
    label: 'Växande bolag',
    people: '11–49 anställda',
    newAreas: ['Systematiskt arbetsmiljöarbete', 'Dataskydd', 'Kollektivavtal'],
  },
  {
    icon: Building2,
    label: 'Etablerat bolag',
    people: '50+ anställda',
    newAreas: [
      'Aktiva åtgärder mot diskriminering',
      'Visselblåsarfunktion',
      'Hållbarhetsrapportering',
    ],
  },
]

export function WhySectionGraph() {
  return (
    <section className="border-b py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <h2
            className="mb-4 text-3xl font-medium tracking-tight md:text-4xl lg:text-5xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Ni har koll på bokföringen.
            <br className="hidden sm:block" /> Vem har koll på lagarna?
          </h2>
          <p className="text-lg text-muted-foreground md:text-xl">
            Varje företag har skyldigheter enligt lag – från enskild firma till
            koncern. Det som skiljer är hur många, inte om.
          </p>
        </div>

        {/* Stepped bar chart — each column is a stack of category segments,
            rising from a shared baseline. New segments for the tier are solid;
            inherited ones below them are muted. The bar height grows naturally
            with the cumulative area count. */}
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-4 md:gap-5">
            {tiers.map((tier, i) => {
              const inherited = tiers.slice(0, i).flatMap((t) => t.newAreas)
              const total = inherited.length + tier.newAreas.length
              return (
                <div key={tier.label} className="flex flex-col">
                  {/* Count label sitting above the bar */}
                  <div className="mb-2 flex items-baseline justify-between px-1">
                    <span
                      className="text-3xl font-medium leading-none md:text-4xl"
                      style={{
                        fontFamily: "'Safiro', system-ui, sans-serif",
                      }}
                    >
                      {total}+
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      regelområden
                    </span>
                  </div>

                  {/* The bar itself — column-reverse so we render from baseline
                      up: inherited first (sinks to bottom, muted), then new
                      areas (rise on top, solid). */}
                  <div className="flex flex-col-reverse gap-1 overflow-hidden rounded-2xl border bg-card p-1.5">
                    {inherited.map((area) => (
                      <Segment key={`inh-${area}`} variant="inherited">
                        {area}
                      </Segment>
                    ))}
                    {tier.newAreas.map((area) => (
                      <Segment key={`new-${area}`} variant="new">
                        + {area}
                      </Segment>
                    ))}
                  </div>

                  {/* Baseline label — tier identity sits under the bar where a
                      chart's x-axis ticks would be. */}
                  <div className="mt-4 flex items-start gap-3 px-1">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                      <tier.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-semibold leading-tight"
                        style={{
                          fontFamily: "'Safiro', system-ui, sans-serif",
                        }}
                      >
                        {tier.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tier.people}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Exempel på hur regelområdena växer med företaget. Den faktiska
            listan beror på bransch och verksamhet.
          </p>
        </div>

        {/* Bridge into the rest of the page */}
        <div className="mx-auto mt-14 max-w-2xl text-center md:mt-16">
          <p className="text-xl font-medium md:text-2xl">
            Det svåra är inte att följa lagen.
            <br />
            Det svåra är att veta vilka lagar som gäller just er.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Och &quot;vi visste inte&quot; är sällan ett bra svar – vare sig för
            en myndighet eller en kund som frågar. Det är där Laglig.se börjar.
          </p>
        </div>
      </div>
    </section>
  )
}

function Segment({
  variant,
  children,
}: {
  variant: 'new' | 'inherited'
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex h-9 items-center rounded-lg px-3 text-[11px] leading-tight md:text-xs',
        variant === 'new'
          ? 'bg-foreground font-medium text-background'
          : 'bg-muted/70 text-muted-foreground'
      )}
    >
      <span className="truncate">{children}</span>
    </div>
  )
}
