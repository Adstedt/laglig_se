import type { Metadata } from 'next'
import {
  MARKETING_KIND_LABELS,
  type MarketingFrontmatter,
  type MarketingKind,
} from './frontmatter-schemas'

/**
 * Metadata + JSON-LD bundle for marketing pages (Story 26.1 AC 14).
 *
 * Follows the proven pattern from app/(public)/lagar/[id]/page.tsx:
 * canonical via NEXT_PUBLIC_BASE_URL, JSON-LD rendered by the page as
 * <script type="application/ld+json">.
 */

/**
 * Serialize a JSON-LD payload for <script type="application/ld+json">.
 * Escapes `<` so user/editorial strings containing "</script>" can never
 * break out of the script element (JSON.stringify alone does not protect
 * against this). Always use this — never raw JSON.stringify — in pages.
 */
export function serializeJsonLd(payload: Record<string, unknown>): string {
  return JSON.stringify(payload).replace(/</g, '\\u003c')
}

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'
}

export function generateMarketingMetadata(
  kind: MarketingKind,
  slug: string,
  fm: MarketingFrontmatter
): Metadata {
  const baseUrl = getBaseUrl()
  const canonical = `${baseUrl}/${kind}/${slug}`
  const ogImage = `${baseUrl}/og-image/${kind}/${slug}`

  return {
    // Bare title — the root layout's `%s | Laglig.se` template adds the
    // suffix (Story 26.4: was double-suffixed "… | Laglig.se | Laglig.se").
    title: fm.title,
    description: fm.description,
    alternates: { canonical },
    openGraph: {
      title: fm.title,
      description: fm.description,
      url: canonical,
      siteName: 'Laglig.se',
      locale: 'sv_SE',
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630, alt: fm.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fm.title,
      description: fm.description,
      images: [ogImage],
    },
  }
}

type JsonLd = Record<string, unknown>

/**
 * JSON-LD payloads for a marketing page:
 *  - BreadcrumbList — always
 *  - FAQPage — always (faq frontmatter is required and is the SAME array
 *    <FaqAccordion> renders, so markup/visible-content parity holds)
 *  - Article — feature + industry pages (topic pages are reference-style)
 *
 * Purpose is machine comprehension (Google + AI answer engines), not FAQ
 * rich-result chips (restricted by Google since 2023).
 */
export function getMarketingJsonLd(
  kind: MarketingKind,
  slug: string,
  fm: MarketingFrontmatter
): JsonLd[] {
  const baseUrl = getBaseUrl()
  const canonical = `${baseUrl}/${kind}/${slug}`

  const breadcrumb: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Hem', item: baseUrl },
      {
        '@type': 'ListItem',
        position: 2,
        name: MARKETING_KIND_LABELS[kind],
        item: `${baseUrl}/${kind}`,
      },
      { '@type': 'ListItem', position: 3, name: fm.title, item: canonical },
    ],
  }

  const faqPage: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: fm.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }

  const payloads: JsonLd[] = [breadcrumb, faqPage]

  if (kind === 'funktioner' || kind === 'branscher') {
    payloads.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: fm.title,
      description: fm.description,
      mainEntityOfPage: canonical,
      inLanguage: 'sv-SE',
      author: { '@type': 'Organization', name: 'Laglig.se', url: baseUrl },
      publisher: { '@type': 'Organization', name: 'Laglig.se', url: baseUrl },
      image: `${baseUrl}/og-image/${kind}/${slug}`,
    })
  }

  return payloads
}
