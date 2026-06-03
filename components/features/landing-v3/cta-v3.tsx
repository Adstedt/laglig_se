import Link from 'next/link'
import { ArrowRight, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function CtaV3() {
  return (
    <section className="relative overflow-hidden bg-foreground text-background">
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-background/5 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-background/5 blur-3xl" />

      <div className="container relative mx-auto px-4 py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            className="mb-5 text-3xl font-medium tracking-tight md:text-4xl lg:text-5xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Få koll på reglerna
            <br className="hidden sm:block" /> – på det enkla sättet.
          </h2>
          <p className="mb-10 text-lg opacity-80">
            Skapa er laglista på två minuter. Eller sök i lagboken gratis, helt
            utan konto. Ni bestämmer – och er data är alltid er.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              variant="secondary"
              className="h-14 px-8 text-base font-semibold shadow-lg"
              asChild
            >
              <Link href="/onboarding">
                Skapa konto gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="h-14 px-8 text-base text-background hover:bg-background/10 hover:text-background"
              asChild
            >
              <Link href="/sok">
                <Search className="mr-2 h-4 w-4" />
                Sök i lagdatabasen
              </Link>
            </Button>
          </div>

          <p className="mt-8 text-xs opacity-60">
            15 dagar gratis · Lagboken är alltid fri · Data lagras i Sverige
          </p>
        </div>
      </div>
    </section>
  )
}
