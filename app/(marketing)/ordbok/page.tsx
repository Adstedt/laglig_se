import Link from 'next/link'
import type { Metadata } from 'next'
import { MarketingShell } from '@/components/marketing/templates/marketing-shell'
import { CtaBlock } from '@/components/marketing/sections/cta-block'
import {
  getGlossaryIndexEntries,
  type GlossaryIndexEntry,
} from '@/lib/marketing/glossary-registry'
import { getBaseUrl, serializeJsonLd } from '@/lib/marketing/get-page-metadata'

/**
 * /ordbok index (Story 26.11 AC 2) — every live term grouped alphabetically
 * with a jump-to-letter nav. Reads the glossary registry, so it lists ALL
 * terms A–Ö but ROUTES each to its single canonical page (a deep /omraden or
 * /funktioner page when one owns the term, else the /ordbok page). One
 * indexable page per term — no cannibalization. Grows automatically as ordbok
 * pages land.
 */

const TITLE = 'Ordbok — begrepp inom lagefterlevnad & regelverk'
const DESCRIPTION =
  'Ordbok för lagefterlevnad: laglista, lagbevakning, kravpunkt, egenkontroll, AFS, GDPR, ISO 14001 och fler begrepp förklarade — kort och konkret.'

function firstLetter(term: string): string {
  return term.charAt(0).toUpperCase()
}

export function generateMetadata(): Metadata {
  const baseUrl = getBaseUrl()
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: `${baseUrl}/ordbok` },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: `${baseUrl}/ordbok`,
      siteName: 'Laglig.se',
      locale: 'sv_SE',
      type: 'website',
    },
  }
}

export default function OrdbokIndexPage() {
  const baseUrl = getBaseUrl()
  const entries = getGlossaryIndexEntries()

  // Group by first letter, Swedish collation (å ä ö after z).
  const byLetter = new Map<string, GlossaryIndexEntry[]>()
  for (const e of [...entries].sort((a, b) =>
    a.term.localeCompare(b.term, 'sv')
  )) {
    const l = firstLetter(e.term)
    if (!byLetter.has(l)) byLetter.set(l, [])
    byLetter.get(l)!.push(e)
  }
  const letters = [...byLetter.keys()].sort((a, b) => a.localeCompare(b, 'sv'))

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Hem', item: baseUrl },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Ordbok',
          item: `${baseUrl}/ordbok`,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      name: 'Laglig.se ordbok — lagefterlevnad & regelverk',
      url: `${baseUrl}/ordbok`,
      inLanguage: 'sv-SE',
      hasDefinedTerm: entries.map((e) => ({
        '@type': 'DefinedTerm',
        name: e.term,
        description: e.blurb,
        url: `${baseUrl}${e.canonical}`,
      })),
    },
  ]

  return (
    <>
      {jsonLd.map((payload, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }}
        />
      ))}
      <MarketingShell>
        <header className="container mx-auto px-4 pb-6 pt-16 md:pt-24">
          <div className="mx-auto max-w-3xl">
            <p className="text-sm font-medium text-amber-700">Ordbok</p>
            <h1 className="mt-3 font-safiro text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
              Begrepp inom lagefterlevnad och regelverk
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Kort och konkret förklaring av de begrepp som återkommer i arbetet
              med laglista, lagbevakning och ledningssystem — från{' '}
              <em>kravpunkt</em> och <em>egenkontroll</em> till AFS, GDPR och
              ISO&nbsp;14001. Varje begrepp länkar vidare till lagtexten och de
              områden det hör till.
            </p>
          </div>
        </header>

        {entries.length > 0 && (
          <div className="container mx-auto px-4">
            <nav
              aria-label="Hoppa till bokstav"
              className="mx-auto flex max-w-3xl flex-wrap gap-1.5 border-y border-border py-4"
            >
              {letters.map((l) => (
                <a
                  key={l}
                  href={`#${l}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card font-safiro text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  {l}
                </a>
              ))}
            </nav>
          </div>
        )}

        <section className="container mx-auto px-4 py-10">
          <div className="mx-auto max-w-3xl space-y-10">
            {letters.map((l) => (
              <div key={l} id={l} className="scroll-mt-24">
                <h2 className="mb-4 font-safiro text-2xl font-medium tracking-tight text-foreground">
                  {l}
                </h2>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {byLetter.get(l)!.map((e) => (
                    <li key={e.slug}>
                      <Link
                        href={e.canonical}
                        className="group block px-5 py-4 transition-colors hover:bg-secondary/50"
                      >
                        <span className="font-safiro text-base font-medium text-foreground">
                          {e.term}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-muted-foreground">
                          {e.blurb}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {entries.length === 0 && (
              <p className="text-muted-foreground">
                Ordboken fylls på löpande.
              </p>
            )}
          </div>
        </section>

        <CtaBlock
          kind="ordbok"
          slug="index"
          placement="footer-strip"
          label="Testa gratis"
          href="/signup"
          variant="band"
          secondaryNote="15 dagar gratis · Lagboken är alltid fri · Data lagras i EU"
        />
      </MarketingShell>
    </>
  )
}
