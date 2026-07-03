import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { MarketingShell } from '@/components/marketing/templates/marketing-shell'
import { MarketingHero } from '@/components/marketing/sections/marketing-hero'
import { HeroOrgCheck } from '@/components/marketing/sections/hero-org-check'
import { DefinitionBox } from '@/components/marketing/sections/definition-box'
import { OrgCheckCta } from '@/components/marketing/sections/org-check-cta'
import { CatalogLawList } from '@/components/marketing/sections/catalog-law-list'
import { ChangeFeedEmbed } from '@/components/marketing/sections/change-feed-embed'
import { FaqAccordion } from '@/components/marketing/sections/faq-accordion'
import { CtaBlock } from '@/components/marketing/sections/cta-block'
import { getMarketingPage, listMarketingSlugs } from '@/lib/marketing/content'
import { getBaseUrl, serializeJsonLd } from '@/lib/marketing/get-page-metadata'

/**
 * /omraden hub (Epic 26, sidor/omraden-index brief) — category index for the
 * topic-page cluster. Short and navigational by design: it owns "lagkrav
 * områden", never the children's long-tail (anti-cannibalization note in the
 * brief). The group grid below renders ONLY published pages, so the hub
 * grows automatically as content waves land — no edit needed per page.
 */

// All 49 planned områden mapped to display groups (mirrors the brief's
// grouping). Unpublished slugs are filtered out at build time.
const GROUPS: Array<{ heading: string; slugs: string[] }> = [
  {
    heading: 'Miljö',
    slugs: [
      'miljo',
      'miljobalken',
      'avfallsforordningen',
      'avfallstrappan',
      'kemikalieforteckning',
      'reach',
      'egenkontroll',
      'energikartlaggning',
    ],
  },
  {
    heading: 'Arbetsmiljö',
    slugs: [
      'arbetsmiljo',
      'arbetsmiljolagen',
      'afs',
      'sam',
      'riskbedomning',
      'arbetstidslagen',
      'diskrimineringslagen',
      'las',
    ],
  },
  {
    heading: 'Säkerhet & brandskydd',
    slugs: [
      'brandskydd',
      'sba',
      'lag-om-skydd-mot-olyckor',
      'elsakerhetslagen',
      'stralskyddslagen',
    ],
  },
  {
    heading: 'Bygg & fastighet',
    slugs: [
      'plan-och-bygglagen',
      'boverkets-byggregler',
      'ovk',
      'ce-markning',
      'maskindirektivet',
    ],
  },
  {
    heading: 'Dataskydd & IT',
    slugs: ['gdpr', 'nis2', 'dora', 'ai-act', 'iso-27001'],
  },
  {
    heading: 'Hållbarhet & rapportering',
    slugs: ['csrd', 'esg', 'eu-taxonomin', 'iso-50001'],
  },
  {
    heading: 'Ledningssystem & ISO',
    slugs: [
      'ledningssystem',
      'kvalitetsledningssystem',
      'miljoledningssystem',
      'iso-9000',
      'iso-9001',
      'iso-14001',
      'iso-45001',
      'internrevision',
      'lagrevision',
      'lagefterlevnad',
    ],
  },
  {
    heading: 'Övrig efterlevnad',
    slugs: [
      'alkohollagen',
      'livsmedelslagen',
      'penningtvatt',
      'visselblasarlagen',
    ],
  },
]

const FAQ = [
  {
    question: 'Vad är ett regelområde?',
    answer:
      'Ett ämnesområde som samlar relaterade lagar, förordningar, föreskrifter och standarder — till exempel miljö, arbetsmiljö eller dataskydd. Områdessidorna förklarar vad regelverken innebär och vilka krav de ställer på företag.',
  },
  {
    question: 'Vilka områden behöver mitt företag följa?',
    answer:
      'Det beror på verksamheten. De flesta företag berörs av miljö, arbetsmiljö och brandskydd, och många dessutom av GDPR och relevanta ISO-standarder. Org-nummerkollen ger en första bild av vilka regelområden som kan beröra just er.',
  },
  {
    question: 'Vad är skillnaden mellan ett område och en bransch?',
    answer:
      'Området är ämnet (till exempel arbetsmiljö), branschen är vad ni gör (till exempel verkstadsindustri). En bransch berörs typiskt av flera regelområden — branschens laglista sätts samman av krav från alla områden som kan beröra verksamheten.',
  },
  {
    question: 'Hur blir ett område till konkreta krav?',
    answer:
      'Tillämpliga lagar, förordningar och föreskrifter inom området hämtas ur Laglig.se:s katalog och blir kontrollerbara punkter i er laglista, med ansvarig och status — så att efterlevnaden kan bedömas och följas upp.',
  },
]

function getPublishedGroups() {
  const published = new Set(listMarketingSlugs('omraden'))
  return GROUPS.map((group) => ({
    heading: group.heading,
    pages: group.slugs
      .filter((slug) => published.has(slug))
      .map((slug) => {
        const page = getMarketingPage('omraden', slug)
        return page
          ? {
              slug,
              title: page.frontmatter.title,
              description: page.frontmatter.description,
              image: page.frontmatter.heroMedia ?? null,
            }
          : null
      })
      .filter((p): p is NonNullable<typeof p> => p !== null),
  })).filter((g) => g.pages.length > 0)
}

export function generateMetadata(): Metadata {
  const baseUrl = getBaseUrl()
  const title = 'Områden — lagkrav inom miljö, arbetsmiljö m.m.'
  const description =
    'Utforska lagkraven per område: miljö, arbetsmiljö, brandskydd, GDPR, hållbarhet och ISO. Förklaringar och tillämpliga lagar. Testa med ert org.nr.'
  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/omraden` },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/omraden`,
      siteName: 'Laglig.se',
      locale: 'sv_SE',
      type: 'website',
    },
  }
}

export default function OmradenIndexPage() {
  const baseUrl = getBaseUrl()
  const groups = getPublishedGroups()

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Hem', item: baseUrl },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Områden',
          item: `${baseUrl}/omraden`,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Regelområden',
      url: `${baseUrl}/omraden`,
      inLanguage: 'sv-SE',
      hasPart: groups.flatMap((g) =>
        g.pages.map((p) => ({
          '@type': 'WebPage',
          name: p.title,
          url: `${baseUrl}/omraden/${p.slug}`,
        }))
      ),
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
        <MarketingHero
          eyebrow="Områden"
          title="Regelområden — från miljö och arbetsmiljö till hållbarhet"
          subtitle="Lagefterlevnad spänner över flera regelområden. Här hittar du förklaringar av regelverken inom varje område, vilka lagar, förordningar och föreskrifter som hör dit — och hur kraven blir kontrollerbara punkter i en laglista."
          cta={
            <HeroOrgCheck
              kind="omraden"
              slug="index"
              ctaLabel="Testa gratis"
              ctaHref="/signup"
            />
          }
        />

        <DefinitionBox term="Regelområde">
          <p>
            Ett ämnesområde som samlar relaterade lagar, förordningar,
            föreskrifter och standarder — som miljö, arbetsmiljö eller
            dataskydd. Området är ämnet; branschen är vad ni gör. En bransch
            berörs typiskt av flera regelområden samtidigt.
          </p>
        </DefinitionBox>

        <section className="container mx-auto px-4 py-14 md:py-20">
          <h2 className="mb-10 text-center font-safiro text-2xl font-medium tracking-tight text-foreground md:text-3xl">
            Utforska områdena
          </h2>
          <div className="mx-auto max-w-5xl space-y-10">
            {groups.map((group) => (
              <div key={group.heading}>
                <p className="mb-3 font-safiro text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
                  {group.heading}
                </p>
                {/* Mobile: horizontal snap-scroll row (the 49-page end state
                    would make a stacked list absurdly long); ≥sm: grid. */}
                <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
                  {group.pages.map((page) => (
                    <Link
                      key={page.slug}
                      href={`/omraden/${page.slug}`}
                      className="group w-[78vw] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md sm:w-auto sm:max-w-none sm:shrink"
                    >
                      {page.image && (
                        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                          <Image
                            src={page.image.src}
                            alt={page.image.alt}
                            fill
                            sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
                            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        </div>
                      )}
                      <div className="p-5">
                        <h3 className="font-safiro text-base font-medium text-foreground">
                          {page.title}
                        </h3>
                        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {page.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Fler områdessidor publiceras löpande. Saknar du ett område? Hela
            regelverket finns redan i{' '}
            <Link
              href="/lagar"
              className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            >
              lagkatalogen
            </Link>
            .
          </p>
        </section>

        <OrgCheckCta kind="omraden" slug="index" />

        <CatalogLawList
          heading="Centrala författningar per område"
          intro="Varje regelområde vilar på en eller ett par centrala författningar — lagar, förordningar och föreskrifter. Länkarna går direkt in i Laglig.se:s öppna lagdatabas — samma katalog som driver er laglista i produkten."
          entries={[
            {
              documentNumber: 'SFS 1998:808',
              title: 'Miljöbalk (1998:808)',
            },
            {
              documentNumber: 'SFS 1977:1160',
              title: 'Arbetsmiljölag (1977:1160)',
            },
            {
              documentNumber: 'SFS 2003:778',
              title: 'Lag (2003:778) om skydd mot olyckor',
            },
            {
              documentNumber: '32016R0679',
              title: 'Dataskyddsförordningen (EU) 2016/679 (GDPR)',
            },
          ]}
          context="omraden/index"
        />

        <ChangeFeedEmbed />

        <FaqAccordion heading="Vanliga frågor om regelområdena" items={FAQ} />

        <CtaBlock
          kind="omraden"
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
