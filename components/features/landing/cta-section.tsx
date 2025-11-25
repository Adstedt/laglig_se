import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-grid opacity-10" />
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

      <div className="container relative mx-auto px-4 py-12 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          {/* Headline */}
          <h2
            className="font-safiro mb-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Redo att ta kontroll?
          </h2>

          {/* Subheadline */}
          <p className="mb-8 text-lg opacity-90">
            Sluta gissa. Få din personliga laglista på 2 minuter.
          </p>

          {/* CTA */}
          <Button
            size="lg"
            variant="secondary"
            className="h-14 px-8 text-base font-semibold shadow-lg"
            asChild
          >
            <Link href="/onboarding">
              Kom igång gratis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          {/* Trust line */}
          <p className="mt-6 text-sm opacity-70">
            14 dagars provperiod. Ingen bindningstid. Inget betalkort krävs.
          </p>
        </div>
      </div>
    </section>
  )
}
