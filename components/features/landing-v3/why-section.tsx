import { User, Users, Building, Building2 } from 'lucide-react'

import { cn } from '@/lib/utils'

// Each tier inherits the areas of the tiers before it and adds its own.
// The point of the visual: obligations grow with size — but are never zero.
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

export function WhySection() {
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

        {/* Size scale — obligations accumulate as the company grows */}
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {tiers.map((tier, i) => {
              const inherited = tiers.slice(0, i).flatMap((t) => t.newAreas)
              const cumulativeCount = inherited.length + tier.newAreas.length
              return (
                <div
                  key={tier.label}
                  className="flex flex-col rounded-2xl border bg-card p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background">
                      <tier.icon className="h-5 w-5" />
                    </div>
                    <div className="text-right">
                      <p
                        className="text-2xl font-medium leading-none"
                        style={{
                          fontFamily: "'Safiro', system-ui, sans-serif",
                        }}
                      >
                        {cumulativeCount}+
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        regelområden
                      </p>
                    </div>
                  </div>

                  <h3
                    className="text-base font-semibold"
                    style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                  >
                    {tier.label}
                  </h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {tier.people}
                  </p>

                  {/* Accumulated areas — inherited ones muted, new ones solid */}
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {inherited.map((area) => (
                      <span
                        key={area}
                        className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {area}
                      </span>
                    ))}
                    {tier.newAreas.map((area) => (
                      <span
                        key={area}
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          'bg-foreground/[0.06] text-foreground ring-1 ring-foreground/10'
                        )}
                      >
                        + {area}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
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
