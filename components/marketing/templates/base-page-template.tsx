import { MarketingShell } from './marketing-shell'
import { MarketingHero } from '@/components/marketing/sections/marketing-hero'
import { CtaBlock } from '@/components/marketing/sections/cta-block'
import { OrgCheckCta } from '@/components/marketing/sections/org-check-cta'
import { HeroOrgCheck } from '@/components/marketing/sections/hero-org-check'
import { CatalogLawList } from '@/components/marketing/sections/catalog-law-list'
import { ChangeFeedEmbed } from '@/components/marketing/sections/change-feed-embed'
import { FaqAccordion } from '@/components/marketing/sections/faq-accordion'
import {
  RelatedPagesGrid,
  type RelatedPage,
} from '@/components/marketing/sections/related-pages-grid'
import {
  MARKETING_KIND_LABELS,
  type MarketingFrontmatter,
  type MarketingKind,
} from '@/lib/marketing/frontmatter-schemas'
import {
  getMarketingPage,
  type MarketingPageMeta,
} from '@/lib/marketing/content'

// Kind-appropriate heading for the catalog-link section (Story 26.4 — was a
// generic "…berör området" that read oddly on industry pages, and the MDX
// bodies duplicated the heading + intro).
const CATALOG_HEADING: Record<MarketingKind, string> = {
  branscher: 'Lagar och föreskrifter som berör branschen',
  omraden: 'Lagar och föreskrifter inom området',
  funktioner: 'Lagar och föreskrifter i Laglig.se:s katalog',
}

const CATALOG_INTRO =
  'Länkarna går direkt in i Laglig.se:s öppna lagdatabas, där ni kan läsa hela lagtexten fritt — samma katalog som driver er laglista i produkten.'

/** Resolve relatedPages routes to titles via the content loader; pages that
 *  don't exist yet are silently dropped (never link to a 404). */
function resolveRelatedPages(routes: string[]): RelatedPage[] {
  return routes
    .map((route): RelatedPage | null => {
      const match = route.match(
        /^\/(funktioner|branscher|omraden)\/([a-z0-9-]+)$/
      )
      if (!match) return null
      const [, kind, slug] = match
      let page: MarketingPageMeta | null = null
      try {
        page = getMarketingPage(kind as MarketingKind, slug as string)
      } catch {
        // invalid sibling frontmatter fails ITS build path; don't fail ours
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

/**
 * Shared composition for all three template kinds (Story 26.1 AC 7).
 * Fixed section order with three consistent CTA placements:
 * hero CTA → MDX body → mid-page conversion (org-check or CtaBlock) →
 * catalog laws → [topic only: change feed] → FAQ → related → footer band.
 */
export function BasePageTemplate({
  kind,
  slug,
  frontmatter: fm,
  showChangeFeed = false,
  children,
}: {
  kind: MarketingKind
  slug: string
  frontmatter: MarketingFrontmatter
  showChangeFeed?: boolean
  children: React.ReactNode
}) {
  const related = resolveRelatedPages(fm.relatedPages)

  return (
    <MarketingShell
      breadcrumbs={[
        { label: MARKETING_KIND_LABELS[kind] },
        { label: fm.title, current: true },
      ]}
    >
      <MarketingHero
        eyebrow={fm.heroEyebrow}
        title={fm.heroTitle}
        subtitle={fm.heroSubtitle}
        media={fm.heroMedia}
        cta={
          fm.heroOrgCheck ? (
            <HeroOrgCheck
              kind={kind}
              slug={slug}
              ctaLabel={fm.primaryCta.label}
              ctaHref={fm.primaryCta.href}
            />
          ) : (
            <CtaBlock
              kind={kind}
              slug={slug}
              placement="hero"
              label={fm.primaryCta.label}
              href={fm.primaryCta.href}
              secondaryNote="Gratis i 15 dagar · inget betalkort krävs"
            />
          )
        }
      />

      {/* Prose width is constrained per-element in mdx-components.tsx so that
          inline section components (<SplitFeature> etc.) can render full-width
          for the guide→product bridge rows. (Story 26.4) */}
      <article className="pb-12 pt-2">{children}</article>

      {fm.showOrgCheck ? (
        <OrgCheckCta kind={kind} slug={slug} />
      ) : (
        <div className="container mx-auto flex justify-center px-4 py-10">
          <CtaBlock
            kind={kind}
            slug={slug}
            placement="mid-page"
            label={fm.primaryCta.label}
            href={fm.primaryCta.href}
          />
        </div>
      )}

      <CatalogLawList
        heading={CATALOG_HEADING[kind]}
        intro={CATALOG_INTRO}
        entries={fm.relatedCatalogLaws}
        context={`${kind}/${slug}`}
      />

      {showChangeFeed && <ChangeFeedEmbed />}

      <FaqAccordion items={fm.faq} />

      {related.length > 0 && <RelatedPagesGrid pages={related} />}

      <CtaBlock
        kind={kind}
        slug={slug}
        placement="footer-strip"
        label={fm.primaryCta.label}
        href={fm.primaryCta.href}
        variant="band"
        secondaryNote="15 dagar gratis · Lagboken är alltid fri · Data lagras i EU"
      />
    </MarketingShell>
  )
}
