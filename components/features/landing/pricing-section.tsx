'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface PricingTier {
  name: string
  description: string
  monthlyPrice: number | null
  yearlyPrice: number | null
  features: string[]
  highlighted?: boolean
  cta: string
  ctaLink: string
}

const tiers: PricingTier[] = [
  {
    name: 'Solo',
    description: 'För egenföretagare',
    monthlyPrice: 399,
    yearlyPrice: 3990,
    features: [
      '1 användare',
      'Personlig laglista',
      'AI-assistent (100 frågor/mån)',
      'Ändringsnotiser',
      'E-postsupport',
    ],
    cta: 'Kom igång',
    ctaLink: '/signup?plan=solo',
  },
  {
    name: 'Team',
    description: 'För växande team',
    monthlyPrice: 899,
    yearlyPrice: 8990,
    features: [
      'Upp till 10 användare',
      'Allt i Solo',
      'HR-modul',
      'Automatiska uppgifter',
      'Obegränsad AI-chat',
      'Export (PDF, Excel)',
    ],
    highlighted: true,
    cta: 'Kom igång',
    ctaLink: '/signup?plan=team',
  },
  {
    name: 'Enterprise',
    description: 'För stora organisationer',
    monthlyPrice: null,
    yearlyPrice: null,
    features: [
      'Obegränsat användare',
      'Allt i Team',
      'API-integration',
      'SSO (Azure AD/Google)',
      'SLA 99.9%',
      'Dedikerad support',
    ],
    cta: 'Kontakta oss',
    ctaLink: '/contact?plan=enterprise',
  },
]

export function PricingSection() {
  const [isYearly, setIsYearly] = React.useState(true)

  return (
    <section id="pricing" className="bg-section-cream py-12 md:py-20">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2
            className="font-safiro mb-4 text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Enkla, transparenta priser
          </h2>
          <p className="text-lg text-muted-foreground">
            14 dagars gratis provperiod. Inget betalkort krävs.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center rounded-full border bg-card p-1">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-all',
                !isYearly
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Månadsvis
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-all',
                isYearly
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Årsvis
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                -17%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 lg:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={cn(
                  'card-hover relative flex flex-col rounded-2xl border bg-card',
                  tier.highlighted &&
                    'border-primary shadow-lg shadow-primary/10 ring-1 ring-primary'
                )}
              >
                {/* Popular badge */}
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      Populärast
                    </span>
                  </div>
                )}

                <div className="flex flex-1 flex-col p-6">
                  {/* Tier header */}
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold">{tier.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {tier.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    {tier.monthlyPrice !== null ? (
                      <>
                        <div className="flex items-baseline">
                          <span className="text-4xl font-bold">
                            {isYearly
                              ? Math.round(tier.yearlyPrice! / 12)
                              : tier.monthlyPrice}
                          </span>
                          <span className="ml-1 text-muted-foreground">
                            kr/mån
                          </span>
                        </div>
                        {isYearly && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Faktureras{' '}
                            {tier.yearlyPrice?.toLocaleString('sv-SE')} kr/år
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-2xl font-semibold">Offert</span>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="mb-6 flex-1 space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span className="text-sm text-muted-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    className="w-full"
                    size="lg"
                    variant={tier.highlighted ? 'default' : 'outline'}
                    asChild
                  >
                    <Link href={tier.ctaLink}>
                      {tier.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <span>Ingen bindningstid</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <span>GDPR-compliant</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <span>Data lagras i Sverige</span>
          </div>
        </div>
      </div>
    </section>
  )
}
