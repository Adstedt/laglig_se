import { describe, it, expect } from 'vitest'
import {
  generateMarketingMetadata,
  getMarketingJsonLd,
  serializeJsonLd,
} from '@/lib/marketing/get-page-metadata'
import type { MarketingFrontmatter } from '@/lib/marketing/frontmatter-schemas'

const fm = {
  kind: 'branscher',
  title: 'Laglista för byggbranschen',
  description: 'Vilka lagar gäller byggföretag?',
  heroEyebrow: 'Bransch · Bygg',
  heroTitle: 'Koll på reglerna på bygget',
  heroSubtitle: 'AFS, PBL och miljöbalken — samlade.',
  primaryCta: { label: 'Testa gratis', href: '/signup' },
  showOrgCheck: true,
  relatedCatalogLaws: [],
  relatedPages: [],
  faq: [
    { question: 'F1?', answer: 'S1.' },
    { question: 'F2?', answer: 'S2.' },
    { question: 'F3?', answer: 'S3.' },
  ],
} as MarketingFrontmatter

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'

describe('generateMarketingMetadata', () => {
  const meta = generateMarketingMetadata('branscher', 'bygg', fm)

  it('returns the bare title — the root layout template owns the "| Laglig.se" suffix', () => {
    expect(meta.title).toBe(fm.title)
  })

  it('builds canonical from base URL + kind + slug', () => {
    expect(meta.alternates?.canonical).toBe(`${baseUrl}/branscher/bygg`)
  })

  it('points OG image at the generated og-image route', () => {
    const og = meta.openGraph as { images: Array<{ url: string }> }
    expect(og.images[0]?.url).toBe(`${baseUrl}/og-image/branscher/bygg`)
  })

  it('sets Swedish locale and article type', () => {
    const og = meta.openGraph as { locale: string; type: string }
    expect(og.locale).toBe('sv_SE')
    expect(og.type).toBe('article')
  })
})

describe('getMarketingJsonLd', () => {
  it('always includes BreadcrumbList and FAQPage', () => {
    for (const kind of ['funktioner', 'branscher', 'omraden'] as const) {
      const types = getMarketingJsonLd(kind, 'x', fm).map((p) => p['@type'])
      expect(types).toContain('BreadcrumbList')
      expect(types).toContain('FAQPage')
    }
  })

  it('FAQPage exactly mirrors the faq frontmatter array', () => {
    const faqPage = getMarketingJsonLd('branscher', 'bygg', fm).find(
      (p) => p['@type'] === 'FAQPage'
    ) as {
      mainEntity: Array<{
        name: string
        acceptedAnswer: { text: string }
      }>
    }
    expect(faqPage.mainEntity).toHaveLength(fm.faq.length)
    fm.faq.forEach((item, i) => {
      expect(faqPage.mainEntity[i]?.name).toBe(item.question)
      expect(faqPage.mainEntity[i]?.acceptedAnswer.text).toBe(item.answer)
    })
  })

  it('includes Article for feature + industry pages but not topic pages', () => {
    const feature = getMarketingJsonLd('funktioner', 'x', fm).map(
      (p) => p['@type']
    )
    const industry = getMarketingJsonLd('branscher', 'x', fm).map(
      (p) => p['@type']
    )
    const topic = getMarketingJsonLd('omraden', 'x', fm).map((p) => p['@type'])
    expect(feature).toContain('Article')
    expect(industry).toContain('Article')
    expect(topic).not.toContain('Article')
  })

  it('serializeJsonLd escapes "<" so "</script>" cannot break out of the tag', () => {
    const out = serializeJsonLd({
      '@type': 'FAQPage',
      answer: 'Stäng taggen </script><script>alert(1)</script> mitt i svaret',
    })
    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c/script')
    // round-trips losslessly
    expect(JSON.parse(out).answer).toContain('</script>')
  })

  it('breadcrumb trail is Hem → kind → page', () => {
    const breadcrumb = getMarketingJsonLd('branscher', 'bygg', fm).find(
      (p) => p['@type'] === 'BreadcrumbList'
    ) as { itemListElement: Array<{ name: string; item: string }> }
    expect(breadcrumb.itemListElement).toHaveLength(3)
    expect(breadcrumb.itemListElement[0]?.name).toBe('Hem')
    expect(breadcrumb.itemListElement[1]?.name).toBe('Branscher')
    expect(breadcrumb.itemListElement[2]?.item).toBe(
      `${baseUrl}/branscher/bygg`
    )
  })
})
