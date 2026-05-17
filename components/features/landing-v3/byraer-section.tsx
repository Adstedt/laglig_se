import Link from 'next/link'
import { ArrowRight, Eye, ClipboardCheck, Network } from 'lucide-react'

import { Button } from '@/components/ui/button'

const partnerPoints = [
  {
    icon: Eye,
    title: 'Gratis för revisorn',
    desc: 'Era klienter bjuder in er med en egen inloggning. Ni betalar inget – och får allt ni behöver för att granska.',
  },
  {
    icon: ClipboardCheck,
    title: 'Allt på ett ställe',
    desc: 'Anmärkningar, åtgärder och bevis – samlat och spårbart. Ni slipper jaga underlag i mejl och pärmar.',
  },
  {
    icon: Network,
    title: 'Vi bygger det tillsammans',
    desc: 'Plattformen växer ihop med revisorer och konsulter. Inga partneravgifter, inga bindningar.',
  },
]

export function ByraerSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 grid items-end gap-8 lg:grid-cols-2">
            <div>
              <p
                className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                För revisorer och byråer
              </p>
              <h2
                className="text-3xl font-medium tracking-tight md:text-4xl lg:text-5xl"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                Funkar ihop med er revisor.
              </h2>
            </div>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Att följa lagen är ett lagarbete. Revisorer och konsulter är en
              del av hur svenska företag håller koll – så vi har byggt
              plattformen för att funka för dem också.
            </p>
          </div>

          <div className="mb-10 grid gap-4 md:grid-cols-3">
            {partnerPoints.map((point) => (
              <div key={point.title} className="rounded-2xl border bg-card p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background">
                  <point.icon className="h-5 w-5" />
                </div>
                <h3
                  className="mb-2 text-base font-semibold"
                  style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                >
                  {point.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {point.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border bg-muted/30 p-6 md:flex-row md:items-center md:p-8">
            <div>
              <p
                className="text-base font-semibold"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                Vill ni tipsa era klienter om Laglig.se?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Hör av er – vi berättar gärna hur ni kan jobba med plattformen.
              </p>
            </div>
            <Button asChild>
              <Link href="/kontakt">
                Kontakta oss
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
