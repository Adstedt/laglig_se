import Link from 'next/link'
import { MarketingShell } from './marketing-shell'
import { CtaBlock } from '@/components/marketing/sections/cta-block'
import { OrgCheckCta } from '@/components/marketing/sections/org-check-cta'
import { CatalogLawList } from '@/components/marketing/sections/catalog-law-list'
import { FaqAccordion } from '@/components/marketing/sections/faq-accordion'
import {
  RelatedPagesGrid,
  type RelatedPage,
} from '@/components/marketing/sections/related-pages-grid'
import {
  getMarketingPage,
  type MarketingPageMeta,
} from '@/lib/marketing/content'
import { getGlossaryTerm } from '@/lib/marketing/glossary'
import { MARKETING_KINDS } from '@/lib/marketing/frontmatter-schemas'
import type { GlossaryTermFrontmatter } from '@/lib/marketing/glossary'

/**
 * Ordbok term layout (Story 26.11) — compact, answer-first, built for
 * featured-snippet + DefinedTerm capture. Deliberately NOT the org-check hero
 * used by the three MARKETING_KINDS: the term is the H1 and the short
 * definition is the very next thing on the page, so a snippet extractor (and
 * an AI answer engine) gets the answer with no chrome in between.
 *
 * Order: compact header (category eyebrow → term H1 → short definition →
 * synonyms) → MDX body (the longer explanation) → catalog laws → FAQ →
 * related pages → closing CTA band.
 */

/** Resolve related routes to card data. Handles the three marketing kinds AND
 *  sibling /ordbok terms (cross-linking within the glossary is a core part of
 *  the internal-link graph). Unresolvable routes are dropped — never a 404. */
function resolveRelated(routes: string[]): RelatedPage[] {
  return routes
    .map((route): RelatedPage | null => {
      const ordbok = route.match(/^\/ordbok\/([a-z0-9-]+)$/)
      if (ordbok) {
        let term = null
        try {
          term = getGlossaryTerm(ordbok[1] as string)
        } catch {
          return null
        }
        if (!term) return null
        return {
          href: route,
          title: term.frontmatter.term,
          description: term.frontmatter.shortDefinition,
        }
      }

      const marketing = route.match(
        /^\/(funktioner|branscher|omraden)\/([a-z0-9-]+)$/
      )
      if (!marketing) return null
      const [, kind, slug] = marketing
      if (!MARKETING_KINDS.includes(kind as (typeof MARKETING_KINDS)[number]))
        return null
      let page: MarketingPageMeta | null = null
      try {
        page = getMarketingPage(
          kind as (typeof MARKETING_KINDS)[number],
          slug as string
        )
      } catch {
        return null
      }
      if (!page) return null
      return {
        href: route,
        title: page.frontmatter.title,
        description: page.frontmatter.description,
      }
    })
    .filter((p): p is RelatedPage => p !== null)
}

export async function GlossaryTermTemplate({
  slug,
  frontmatter: fm,
  children,
}: {
  slug: string
  frontmatter: GlossaryTermFrontmatter
  children: React.ReactNode
}) {
  const related = resolveRelated(fm.relatedPages)

  return (
    <MarketingShell>
      <header className="container mx-auto px-4 pb-4 pt-16 md:pt-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-amber-700">
            <Link href="/ordbok" className="hover:underline">
              Ordbok
            </Link>{' '}
            · {fm.category}
          </p>
          <h1 className="mt-3 font-safiro text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            {fm.term}
          </h1>
          {/* Answer-first: the snippet-ready definition, immediately under H1. */}
          <p className="mt-4 text-lg leading-relaxed text-foreground/80 sm:text-xl">
            {fm.shortDefinition}
          </p>
          {fm.synonyms && fm.synonyms.length > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Även kallad: {fm.synonyms.join(', ')}
            </p>
          )}
        </div>
      </header>

      {/* Prose width is constrained per-element in mdx-components.tsx so inline
          section components can render full-width. */}
      <article className="pb-8 pt-2">{children}</article>

      {/* Value-first conversion slot: the org-number tester, between the
          explanation and the catalog list. Opt-out via frontmatter for
          neutral concept terms. */}
      {fm.showOrgCheck !== false && (
        <OrgCheckCta kind="ordbok" slug={slug} tone="sage" />
      )}

      <CatalogLawList
        heading="Lagar och föreskrifter kopplade till begreppet"
        intro="Länkarna går direkt in i Laglig.se:s öppna lagdatabas, där ni kan läsa hela lagtexten fritt."
        entries={fm.relatedCatalogLaws}
        context={`ordbok/${slug}`}
      />

      {fm.faq.length > 0 && <FaqAccordion items={fm.faq} />}

      {related.length > 0 && (
        <RelatedPagesGrid
          heading="Relaterade begrepp och sidor"
          pages={related}
        />
      )}

      <CtaBlock
        kind="ordbok"
        slug={slug}
        placement="footer-strip"
        label="Testa gratis"
        href="/signup"
        variant="band"
        secondaryNote="15 dagar gratis · Lagboken är alltid fri · Data lagras i EU"
      />
    </MarketingShell>
  )
}
