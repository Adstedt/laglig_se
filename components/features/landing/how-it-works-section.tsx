import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

const steps = [
  {
    number: '01',
    title: 'Ange org-nummer',
    description:
      'Vi hämtar automatiskt bransch, storlek och verksamhetstyp från Bolagsverket.',
    time: '30 sekunder',
  },
  {
    number: '02',
    title: 'AI genererar din laglista',
    description:
      'Vår AI analyserar 10 000+ lagar och väljer ut de som gäller just ditt företag.',
    time: '2 minuter',
  },
  {
    number: '03',
    title: 'Börja arbeta',
    description:
      'Koppla anställda, skapa uppgifter och ställ frågor till AI-assistenten.',
    time: 'Direkt',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-section-warm py-12 md:py-20">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="mx-auto mb-10 max-w-2xl text-center md:mb-16">
          <h2
            className="font-safiro mb-4 text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Kom igång på under 3 minuter
          </h2>
          <p className="text-lg text-muted-foreground">
            Inget krångel, inga långa formulär. Bara ditt organisationsnummer.
          </p>
        </div>

        {/* Steps */}
        <div className="mx-auto max-w-4xl">
          <div className="relative">
            {/* Connection line - desktop only */}
            <div className="absolute left-[27px] top-0 hidden h-full w-px bg-gradient-to-b from-border via-border to-transparent md:block" />

            <div className="space-y-6 md:space-y-12">
              {steps.map((step) => (
                <div key={step.number} className="relative flex gap-4 md:gap-8">
                  {/* Step indicator */}
                  <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background font-mono text-base font-bold text-primary md:h-14 md:w-14 md:text-lg">
                    {step.number}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-2 md:pb-8">
                    <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-6">
                      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-lg font-semibold md:text-xl">
                          {step.title}
                        </h3>
                        <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {step.time}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground md:text-base">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <Button size="lg" className="h-12 px-8" asChild>
              <Link href="/onboarding">
                Testa nu - det är gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
