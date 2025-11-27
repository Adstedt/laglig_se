import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      {/* Subtle gradient mesh overlay */}
      <div className="absolute inset-0 opacity-[0.07]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
            radial-gradient(at 20% 30%, rgba(255,255,255,0.4) 0px, transparent 50%),
            radial-gradient(at 80% 70%, rgba(255,255,255,0.3) 0px, transparent 50%)
          `,
          }}
        />
      </div>
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

      <div className="container relative mx-auto px-4 py-12 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          {/* Headline */}
          <h2
            className="font-safiro mb-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Slipp bevaka. Börja sova gott.
          </h2>

          {/* Subheadline */}
          <p className="mb-8 text-lg opacity-90">
            Ert företags personliga laglista väntar. På 2 minuter vet ni exakt
            vad som gäller.
          </p>

          {/* CTA */}
          <Button
            size="lg"
            variant="secondary"
            className="h-14 px-8 text-base font-semibold shadow-lg"
            asChild
          >
            <Link href="/onboarding">
              Skapa er laglista nu
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          {/* Trust line */}
          <p className="mt-6 text-sm opacity-70">
            Gratis i 14 dagar · Ingen bindning · Inget kort
          </p>
        </div>
      </div>
    </section>
  )
}
