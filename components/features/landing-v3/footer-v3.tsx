'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Cookie, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConsent } from '@/components/providers/consent-provider'
import {
  BRANSCHER_NAV,
  OMRADEN_NAV,
  resolveNavHref,
  type MarketingNavItem,
} from '@/lib/marketing/nav-links'

type FooterLink = { href: string; label: string; comingSoon?: boolean }

// Homepage anchors are root-relative so the footer works identically on `/`
// and on marketing pages (Story 26.2 — chrome is shared via MarketingShell).
const produkt: FooterLink[] = [
  { href: '/#how-it-works', label: 'Så fungerar det' },
  { href: '/#ai', label: 'AI-agenten' },
  { href: '/#skala', label: 'För hela företaget' },
  { href: '/#pricing', label: 'Priser' },
  { href: '/#faq', label: 'Vanliga frågor' },
]

const regelverk: FooterLink[] = [
  { href: '/lagar', label: 'Svenska lagar' },
  { href: '/rattskallor?types=AGENCY_REGULATION', label: 'Föreskrifter' },
  { href: '/eu', label: 'EU-regler' },
  { href: '/sok', label: 'Sök i lagboken' },
]

const foretag: FooterLink[] = [
  { href: '/#byraer', label: 'För revisorer & byråer' },
  { href: 'mailto:dev@laglig.se', label: 'Kontakt' },
]

/** Marketing-nav items → footer links: published page → live link,
 *  otherwise muted "Kommer snart" text (no dead hrefs in the footer). */
function toFooterLinks(
  items: MarketingNavItem[],
  publishedRoutes: readonly string[]
): FooterLink[] {
  return items.map((item) => {
    const resolved = resolveNavHref(item, publishedRoutes)
    return resolved.type === 'coming-soon'
      ? { href: '', label: item.label, comingSoon: true }
      : { href: resolved.href, label: item.label }
  })
}

const legal: FooterLink[] = [
  { href: '/villkor', label: 'Användarvillkor' },
  { href: '/integritetspolicy', label: 'Integritetspolicy' },
  { href: '/cookiepolicy', label: 'Cookiepolicy' },
  {
    href: '/personuppgiftsbitradesavtal',
    label: 'Personuppgiftsbiträdesavtal',
  },
  { href: '/underbitraden', label: 'Underbiträden' },
]

function Column({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className="mb-3.5 text-[13px] font-semibold">{title}</h3>
      <ul className="space-y-2.5">
        {links.map((l) =>
          l.comingSoon ? (
            <li key={l.label}>
              <span
                aria-disabled="true"
                className="text-sm text-muted-foreground/50"
              >
                {l.label}
                <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/40">
                  Kommer snart
                </span>
              </span>
            </li>
          ) : (
            <li key={l.label}>
              <Link
                href={l.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            </li>
          )
        )}
      </ul>
    </div>
  )
}

export function FooterV3({
  publishedRoutes = [],
}: {
  /** see NavbarV3 — computed server-side via getPublishedMarketingRoutes() */
  publishedRoutes?: string[]
}) {
  const { openSettings } = useConsent()
  const [email, setEmail] = React.useState('')
  const year = new Date().getFullYear()
  const branscher = toFooterLinks(BRANSCHER_NAV, publishedRoutes)
  const omraden = toFooterLinks(OMRADEN_NAV, publishedRoutes)

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault()
    setEmail('')
  }

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-14 md:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Brand + newsletter */}
          <div className="lg:col-span-4">
            <Link href="/">
              <Image
                src="/images/logo-final.png"
                alt="Laglig.se"
                width={140}
                height={54}
                className="h-8 w-auto invert dark:invert-0"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Allt för er regelefterlevnad — byggt för svenska företag, stora
              som små.
            </p>
            <form onSubmit={handleNewsletter} className="mt-6 max-w-xs">
              <label
                htmlFor="footer-newsletter-email"
                className="mb-2 block text-[13px] font-medium"
              >
                Tips om regelefterlevnad, direkt i inkorgen
              </label>
              <div className="flex gap-2">
                <Input
                  id="footer-newsletter-email"
                  type="email"
                  placeholder="din@email.se"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button type="submit" size="icon" aria-label="Prenumerera">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>

          {/* Link columns — 5 columns nested in the remaining 8/12 */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8 lg:grid-cols-5">
            <Column title="Produkt" links={produkt} />
            <Column title="Branscher" links={branscher} />
            <Column title="Områden" links={omraden} />
            <Column title="Regelverk" links={regelverk} />
            <Column title="Företag" links={foretag} />
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-12 rounded-lg bg-muted p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong>Juridisk ansvarsfriskrivning:</strong> Laglig.se
            tillhandahåller AI-assisterad juridisk information. Detta är inte
            juridisk rådgivning. Kontakta en kvalificerad jurist för specifik
            vägledning.{' '}
            <Link href="/villkor" className="underline hover:text-foreground">
              Läs mer
            </Link>
          </p>
        </div>

        {/* Bottom bar — legal + cookie + copyright */}
        <div className="mt-8 flex flex-col gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {year} Laglig.se. Alla rättigheter förbehållna.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {legal.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={openSettings}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Cookie className="h-3.5 w-3.5" />
              Cookieinställningar
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
