import {
  Banknote,
  Clock,
  Moon,
  Bell,
  Bot,
  Users,
  type LucideIcon,
  ArrowUpRight,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'

interface Benefit {
  icon: LucideIcon
  title: string
  description: string
  metric?: string
  highlight?: boolean
}

const benefits: Benefit[] = [
  {
    icon: Banknote,
    title: 'Undvik böter upp till 500 000 kr',
    description:
      'Arbetsmiljöverket, GDPR, branschkrav - vi håller koll så du slipper',
    metric: '500k',
    highlight: true,
  },
  {
    icon: Clock,
    title: 'Spara 10+ timmar varje månad',
    description: 'Slipp manuell lagbevakning, research och konsultarvoden',
    metric: '10h',
  },
  {
    icon: Users,
    title: 'Koppla lagar till rätt anställd',
    description: 'HR-modulen visar vem som påverkas och vad de behöver göra',
    metric: 'HR',
  },
  {
    icon: Bell,
    title: 'Aldrig missa en lagändring',
    description: 'Proaktiva notiser innan nya krav träder i kraft',
    metric: '24/7',
  },
  {
    icon: Bot,
    title: 'Fråga AI:n istället för juristen',
    description: '"Behöver vi skyddsombud?" - Svar på sekunder, inte dagar',
    metric: 'AI',
  },
  {
    icon: Moon,
    title: 'Sov gott om natten',
    description:
      'Du vet att ni är compliant - för systemet säger till om ni inte är det',
    metric: 'ZzZ',
    highlight: true,
  },
]

export function BenefitsSection() {
  return (
    <section className="bg-muted/30 py-16 md:py-20">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <Badge variant="outline" className="mb-4">
            Fördelar
          </Badge>
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Lagefterlevnad som faktiskt fungerar
          </h2>
          <p className="text-lg text-muted-foreground">
            Inte bara en laglista - ett komplett system som hjälper dig agera på
            rätt sätt
          </p>
        </div>

        {/* Bento grid */}
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit, index) => {
              // Create visual variety - first and last items are larger
              const isLarge = index === 0 || index === 5

              return (
                <div
                  key={benefit.title}
                  className={`group relative overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-300 hover:shadow-lg ${
                    isLarge ? 'md:col-span-2 lg:col-span-1' : ''
                  } ${benefit.highlight ? 'border-primary/20 bg-gradient-to-br from-card to-primary/5' : ''}`}
                >
                  {/* Metric badge */}
                  <div className="absolute right-4 top-4">
                    <span className="text-2xl font-bold text-muted-foreground/30 transition-colors group-hover:text-primary/30">
                      {benefit.metric}
                    </span>
                  </div>

                  {/* Icon */}
                  <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
                      benefit.highlight ? 'bg-primary/10' : 'bg-muted'
                    } transition-colors group-hover:bg-primary/10`}
                  >
                    <benefit.icon
                      className={`h-6 w-6 ${
                        benefit.highlight
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      } transition-colors group-hover:text-primary`}
                    />
                  </div>

                  {/* Content */}
                  <h3 className="mb-2 text-lg font-semibold tracking-tight">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>

                  {/* Hover indicator */}
                  <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    <span>Läs mer</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom stats */}
        <div className="mx-auto mt-12 max-w-3xl">
          <div className="grid grid-cols-3 gap-8 rounded-2xl border bg-card p-8">
            <div className="text-center">
              <p className="text-3xl font-bold tracking-tight">10 000+</p>
              <p className="text-sm text-muted-foreground">Lagar i databasen</p>
            </div>
            <div className="text-center border-x">
              <p className="text-3xl font-bold tracking-tight">1 000+</p>
              <p className="text-sm text-muted-foreground">Aktiva företag</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold tracking-tight">99.9%</p>
              <p className="text-sm text-muted-foreground">Upptid</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
