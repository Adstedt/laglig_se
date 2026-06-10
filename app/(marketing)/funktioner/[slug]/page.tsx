import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getMarketingPage, listMarketingSlugs } from '@/lib/marketing/content'
import {
  generateMarketingMetadata,
  getMarketingJsonLd,
  serializeJsonLd,
} from '@/lib/marketing/get-page-metadata'
import { FeaturePageTemplate } from '@/components/marketing/templates/feature-page-template'
import type { FeaturePageFrontmatter } from '@/lib/marketing/frontmatter-schemas'

const KIND = 'funktioner' as const

export function generateStaticParams() {
  return listMarketingSlugs(KIND).map((slug) => ({ slug }))
}

// Unknown slugs 404 instead of attempting on-demand render.
export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = getMarketingPage(KIND, slug)
  if (!page) return {}
  return generateMarketingMetadata(KIND, slug, page.frontmatter)
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = getMarketingPage(KIND, slug)
  if (!page) notFound()

  const { default: Body } = await import(
    `@/content/marketing/funktioner/${slug}.mdx`
  )
  const jsonLd = getMarketingJsonLd(KIND, slug, page.frontmatter)

  return (
    <>
      {jsonLd.map((payload, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }}
        />
      ))}
      <FeaturePageTemplate
        slug={slug}
        frontmatter={page.frontmatter as FeaturePageFrontmatter}
      >
        <Body />
      </FeaturePageTemplate>
    </>
  )
}
